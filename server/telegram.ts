import { z } from "zod";
import { accountSession } from "./auth";
import {
  getPantry,
  writePantry,
  json,
  readJSON,
  type Outgoing,
  type Pantry,
  type BotAction,
} from "./pantry";
import { botToday, parseExpiry, parseFoods } from "./telegram-food";
import { daysUntil, temperatureAlerts, type Product } from "../app/lib/model";
import { temperatures, zones, categories } from "../app/lib/catalog";
import { amountLabel, usePortions } from "../app/lib/inventory";
import { localDishes } from "../app/lib/local-kitchen";
import { kitchenSchema, type Dish } from "../app/lib/ai-contract";

export type TelegramEnv = {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_INGRESS_SECRET?: string;
  SHELF_PUBLIC_URL?: string;
};
type Link = {
  account_id: string;
  chat_id: string;
  link_id: string;
  telegram_id: string;
  display_name: string;
};
type AI = (
  account: string,
  products: Product[],
  today: string,
  prompt: string,
) => Promise<unknown>;
const menu = {
  keyboard: [
    [{ text: "🧊 Мой холодильник" }, { text: "⚠️ Скоро испортится" }],
    [{ text: "🍳 Рецепт из остатков" }, { text: "🔔 Тест уведомления" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Молоко 3 дня или яблоки 4 шт 7 дней",
};
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const safeEqual = (a: string, b: string) => {
  let v = a.length ^ b.length;
  for (let i = 0; i < b.length; i++)
    v |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return v === 0;
};
const siteURL = (env: TelegramEnv) =>
  env.SHELF_PUBLIC_URL || "https://shelf-sense.a-khassenov28.chatgpt.site";
const web = (env: TelegramEnv) => ({
  text: "🌐 Открыть веб-дашборд",
  url: siteURL(env),
});
const inline = (rows: Record<string, string>[][]) => ({
  inline_keyboard: rows,
});
const btn = (text: string, callback_data: string) => ({ text, callback_data });
const send = (
  chat: string,
  text: string,
  reply_markup: unknown = menu,
): Outgoing => ({
  method: "sendMessage",
  body: {
    chat_id: chat,
    text,
    parse_mode: "HTML",
    reply_markup,
    link_preview_options: { is_disabled: true },
  },
});
const active = (p: Product[]) =>
  p
    .filter((p) => p.state === "active")
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
const eligible = (p: Product, today: string) =>
  p.state === "active" &&
  daysUntil(p.expiresOn, today) >= 0 &&
  p.temperature !== "frozen" &&
  !temperatureAlerts(p).some((a) => a.level === "warning");
const badge = (p: Product, today: string) => {
  const n = daysUntil(p.expiresOn, today);
  return n < 0 ? "⛔" : n <= 2 ? "🔴" : n <= 5 ? "🟡" : "🟢";
};
const date = (d: string) => d.split("-").reverse().join(".");
const term = (p: Product, today: string) => {
  const n = daysUntil(p.expiresOn, today);
  return n < 0
    ? "срок истёк"
    : n === 0
      ? "срок сегодня"
      : n === 1
        ? "истекает завтра"
        : `осталось ${n} дн.`;
};
const row = (p: Product, today: string) =>
  `${badge(p, today)} <b>${escape(p.name)}</b> — ${term(p, today)}\n${amountLabel(p.amount, p.unit, "ru")} · ${zones[p.zone].shortRu} · ${temperatures[p.temperature].label}${p.demo ? " · демо" : ""}`;

export async function telegramAPI(
  env: TelegramEnv,
  method: string,
  body: unknown,
) {
  if (!env.TELEGRAM_BOT_TOKEN) throw Error("telegram_not_configured");
  let response: Response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw Error("telegram_unavailable");
  }
  const data = (await response.json()) as { ok: boolean; result?: unknown };
  if (response.status === 403) throw Error("telegram_chat_unavailable");
  if (!response.ok || !data.ok) throw Error("telegram_delivery_failed");
  return data.result;
}

export async function handleTelegramAccount(
  request: Request,
  env: TelegramEnv,
) {
  const user = await accountSession(request, env);
  if (!user) return json({ error: "sign_in_required" }, 401);
  const db = env.DB!,
    path = new URL(request.url).pathname;
  if (request.method === "GET") {
    const link = await db
      .prepare("SELECT display_name FROM ss_telegram_links WHERE account_id=?")
      .bind(user.id)
      .first<{ display_name: string }>();
    const runtime = await db
      .prepare("SELECT heartbeat FROM ss_telegram_runtime WHERE id='bridge'")
      .first<{ heartbeat: number }>();
    return json({
      configured: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME),
      username: env.TELEGRAM_BOT_USERNAME ?? null,
      linked: !!link,
      displayName: link?.display_name ?? null,
      online: !!runtime && Date.now() - runtime.heartbeat < 90000,
    });
  }
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "origin_not_allowed" }, 403);
  if (path.endsWith("/unlink")) {
    await db
      .prepare("DELETE FROM ss_telegram_links WHERE account_id=?")
      .bind(user.id)
      .run();
    await db
      .prepare("DELETE FROM ss_telegram_codes WHERE account_id=?")
      .bind(user.id)
      .run();
    return json({ ok: true });
  }
  if (!path.endsWith("/link")) return json({ error: "not_found" }, 404);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME)
    return json({ error: "not_configured" }, 503);
  if (!(await getPantry(db, user.id)))
    return json({ error: "pantry_not_ready" }, 409);
  if (
    await db
      .prepare("SELECT telegram_id FROM ss_telegram_links WHERE account_id=?")
      .bind(user.id)
      .first()
  )
    return json({ error: "already_linked" }, 409);
  const code = random(),
    expires = Date.now() + 10 * 60000;
  await db
    .prepare("DELETE FROM ss_telegram_codes WHERE account_id=? OR expires_at<?")
    .bind(user.id, Date.now())
    .run();
  await db
    .prepare(
      "INSERT INTO ss_telegram_codes(hash,account_id,expires_at) VALUES(?,?,?)",
    )
    .bind(await hash(code), user.id, expires)
    .run();
  return json({
    url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`,
    expiresAt: expires,
  });
}

function action(
  pantry: Pantry,
  link: Link,
  kind: BotAction["kind"],
  products: Product[],
  extra: Partial<BotAction> = {},
) {
  const id = crypto.randomUUID();
  pantry.bot.actions ??= {};
  pantry.bot.actions[id] = {
    kind,
    products,
    linkId: link.link_id,
    expires: Date.now() + 86400000,
    ...extra,
  };
  return id;
}
function trimState(pantry: Pantry) {
  pantry.bot.actions = Object.fromEntries(
    Object.entries(pantry.bot.actions ?? {})
      .filter(([, v]) => v.expires > Date.now())
      .slice(-150),
  );
  pantry.bot.receipts = Object.fromEntries(
    Object.entries(pantry.bot.receipts ?? {}).slice(-250),
  );
}
async function recipes(
  pantry: Pantry,
  link: Link,
  env: TelegramEnv,
  ai: AI,
  today: string,
  prompt = "",
): Promise<Outgoing[]> {
  const candidates = active(pantry.products)
    .filter((p) => eligible(p, today))
    .slice(0, 100);
  if (!candidates.length)
    return [
      send(
        link.chat_id,
        "Пока нет подходящих продуктов для рецепта. Добавьте продукты со свежими сроками. Просроченное и замороженное не включаю в быстрые блюда.",
      ),
    ];
  let dish: Dish | undefined,
    source = "Локальный подбор";
  try {
    const result = kitchenSchema.parse(
      await ai(link.account_id, candidates, today, prompt),
    );
    dish = result.dishes[0];
    if (dish) source = "Подбор с ИИ";
  } catch {}
  dish ??= localDishes(candidates, "ru", today, prompt)[0];
  if (!dish)
    return [
      send(
        link.chat_id,
        "Не удалось подобрать блюдо из этих остатков. Уточните пожелание: «Рецепт: овощи без молока» или добавьте ещё продукты.",
      ),
    ];
  if (
    new Set(dish.ingredients.map((i) => i.productId)).size !==
      dish.ingredients.length ||
    dish.ingredients.some(
      (i) =>
        !candidates.some(
          (p) =>
            p.id === i.productId && p.unit === i.unit && p.amount >= i.amount,
        ),
    )
  )
    return [send(link.chat_id, "Запасы изменились. Запросите рецепт ещё раз.")];
  const items = dish.ingredients.map(
    (i) => pantry.products.find((p) => p.id === i.productId)!,
  );
  const id = action(pantry, link, "cook", items, {
    portions: dish.ingredients.map(({ productId, amount, unit }) => ({
      productId,
      amount,
      unit,
    })),
    title: dish.title,
  });
  const text = `👨‍🍳 <b>${escape(dish.title)}</b> · ${dish.minutes} мин\n${source}\n\n${escape(dish.reason)}\n\n<b>Используем:</b>\n${dish.ingredients.map((i) => `${badge(items.find((p) => p.id === i.productId)!, today)} ${escape(i.name)} — ${amountLabel(i.amount, i.unit, "ru")}`).join("\n")}\n\n<b>Шаги:</b>\n${dish.steps.map((s, i) => `${i + 1}. ${escape(s)}`).join("\n")}\n\n${dish.extras.length ? `<b>Дополнительно, если есть:</b> ${dish.extras.map(escape).join(", ")}\n` : ""}${escape(dish.improvement)}\n\n«Готово» спишет только указанные количества. Для других порций откройте сайт. Дополнительные ингредиенты не списываются.`;
  if (text.length > 3900)
    return [
      send(
        link.chat_id,
        "Рецепт получился слишком длинным. Откройте кухонного помощника на сайте.",
        inline([[web(env)]]),
      ),
    ];
  return [
    send(
      link.chat_id,
      text,
      inline([[btn("✅ Готово! Списать продукты", `do:${id}`)], [web(env)]]),
    ),
  ];
}

async function linkedFlow(
  pantry: Pantry,
  link: Link,
  env: TelegramEnv,
  text: string,
  callback: string | undefined,
  ai: AI,
  updateId: number,
): Promise<Outgoing[]> {
  const today = botToday(),
    chat = link.chat_id;
  if (callback?.startsWith("do:")) {
    const entry = pantry.bot.actions?.[callback.slice(3)];
    if (!entry || entry.linkId !== link.link_id || entry.expires < Date.now())
      return [
        send(
          chat,
          "Эта кнопка устарела. Откройте холодильник или запросите новый рецепт.",
        ),
      ];
    if (entry.used)
      return [
        send(chat, "Эта операция уже выполнена. Повторного списания нет."),
      ];
    const actual = entry.products.map((p) =>
      pantry.products.find((x) => x.id === p.id),
    );
    if (
      actual.some(
        (p, i) => !p || JSON.stringify(p) !== JSON.stringify(entry.products[i]),
      )
    )
      return [
        send(
          chat,
          "Продукт изменился после этого сообщения. Проверьте свежие остатки и повторите действие из нового сообщения.",
        ),
      ];
    if (entry.kind === "edit") {
      pantry.bot.pending = {
        productId: entry.products[0].id,
        linkId: link.link_id,
        expires: Date.now() + 10 * 60000,
        snapshot: entry.products[0],
      };
      return [
        send(
          chat,
          `✏️ Новый срок для <b>${escape(entry.products[0].name)}</b>?\nНапишите «5 дней» или дату ДД.ММ.ГГГГ. Для выхода — /cancel.`,
        ),
      ];
    }
    if (entry.kind === "cancel") {
      const ids = new Set(entry.products.map((p) => p.id));
      pantry.products = pantry.products.filter((p) => !ids.has(p.id));
      entry.used = true;
      return [
        send(chat, "Добавление отменено. Карточка удалена из общих запасов."),
      ];
    }
    if (
      entry.kind !== "discard" &&
      entry.products.some((p) => !eligible(p, today))
    )
      return [
        send(
          chat,
          "Срок или условия хранения не подходят для этой операции. Проверьте продукт на сайте; просроченные продукты в рецепты не включаются.",
        ),
      ];
    const portions =
      entry.portions ??
      entry.products.map((p) => ({
        productId: p.id,
        amount: p.amount,
        unit: p.unit,
      }));
    pantry.products = usePortions(
      pantry.products,
      portions,
      entry.kind === "discard" ? "discarded" : "eaten",
      `telegram:${callback.slice(3)}`,
      entry.title ?? "Telegram",
      today,
    );
    entry.used = true;
    const money = entry.products
      .filter((p) => !p.demo)
      .reduce(
        (sum, p) =>
          sum +
          (p.price *
            (portions.find((i) => i.productId === p.id)?.amount ?? 0)) /
            (p.initialAmount ?? p.amount),
        0,
      );
    const detail = entry.products
      .map((p) => {
        const n = pantry.products.find((x) => x.id === p.id)!;
        return `${escape(n.name)}: ${n.amount ? `осталось ${amountLabel(n.amount, n.unit, "ru")}` : "перенесён в историю"}`;
      })
      .join("\n");
    return [
      send(
        chat,
        `${entry.kind === "discard" ? "🗑 Списание учтено в потерях за неделю." : "🎉 Готово! Продукты отмечены как использованные."}\n${detail}\n${money > 0 ? `${entry.kind === "discard" ? "Потери" : "Учтённая стоимость спасённых продуктов"}: ${Math.round(money)} ₸.` : "Стоимость не увеличена: у продуктов нет цены или это демо."}\nИзменения сохранены. Сайт обновит остатки при следующей синхронизации.`,
        inline([[web(env)]]),
      ),
    ];
  }
  if (text === "/cancel") {
    delete pantry.bot.pending;
    return [
      send(
        chat,
        "Ввод отменён. Можно добавить продукт или выбрать действие в меню.",
      ),
    ];
  }
  const command =
    text.startsWith("/") ||
    [
      "🧊 Мой холодильник",
      "⚠️ Скоро испортится",
      "🍳 Рецепт из остатков",
      "🔔 Тест уведомления",
    ].includes(text) ||
    !!callback;
  if (pantry.bot.pending && !command) {
    const pending = pantry.bot.pending;
    if (pending.linkId !== link.link_id || pending.expires < Date.now()) {
      delete pantry.bot.pending;
      return [
        send(
          chat,
          "Время изменения срока истекло. Нажмите «Изменить срок» ещё раз.",
        ),
      ];
    }
    const expiry = parseExpiry(text, today);
    if (!expiry.date || expiry.invalid)
      return [
        send(
          chat,
          "Нужен срок от 0 до 365 дней или действительная дата ДД.ММ.ГГГГ. Например: «3 дня». /cancel — отменить.",
        ),
      ];
    const p = pantry.products.find((p) => p.id === pending.productId);
    if (!p || JSON.stringify(p) !== JSON.stringify(pending.snapshot)) {
      delete pantry.bot.pending;
      return [
        send(chat, "Продукт уже изменился. Начните редактирование заново."),
      ];
    }
    p.expiresOn = expiry.date;
    delete pantry.bot.pending;
    return [
      send(
        chat,
        `✅ Срок для <b>${escape(p.name)}</b> изменён: до ${date(p.expiresOn)}. Проверьте его по упаковке.`,
        inline([[web(env)]]),
      ),
    ];
  }
  if (command) delete pantry.bot.pending;
  if (text.startsWith("/start") || text === "/help")
    return [
      send(
        chat,
        "👋 Привет! Я твой умный помощник против пищевых отходов.\n\nПомогаю следить за сроками, видеть остатки и экономить бюджет. Аккаунт подключён: сайт проверяет изменения каждые 5 секунд, пока открыт.\n\n<b>Как пользоваться?</b>\n1. Напиши «Молоко 3 дня», «Яблоки 4 шт 7 дней» или «Сыр, помидоры, хлеб».\n2. Выбери действие в меню 👇\n\nЕсли срок не указан, предложу ориентир — дата на упаковке важнее. Без количества добавляю 1 шт. / упаковку; стоимость можно уточнить на сайте.",
      ),
    ];
  if (
    text === "/fridge" ||
    text === "🧊 Мой холодильник" ||
    callback?.startsWith("page:")
  ) {
    const stock = active(pantry.products),
      page = Math.max(
        0,
        Math.min(499, Number(callback?.split(":")[1] ?? 0) || 0),
      ),
      items = stock.slice(page * 8, page * 8 + 8);
    const nav = [];
    if (page > 0) nav.push(btn("← Назад", `page:${page - 1}`));
    if (stock.length > (page + 1) * 8)
      nav.push(btn("Далее →", `page:${page + 1}`));
    return [
      send(
        chat,
        stock.length
          ? `🧊 <b>В запасах: ${stock.length} продуктов</b>\n\n${items.map((p) => row(p, today)).join("\n\n")}`
          : "🧊 Холодильник пока пуст. Напишите название продукта и срок.",
        inline([...(nav.length ? [nav] : []), [web(env)]]),
      ),
    ];
  }
  if (text === "/expiring" || text === "⚠️ Скоро испортится") {
    const stock = active(pantry.products),
      due = stock.filter(
        (p) =>
          daysUntil(p.expiresOn, today) >= 0 &&
          daysUntil(p.expiresOn, today) <= 2,
      ),
      expired = stock.filter((p) => daysUntil(p.expiresOn, today) < 0);
    const cost = due
      .filter((p) => !p.demo)
      .reduce(
        (n, p) => n + (p.price * p.amount) / (p.initialAmount ?? p.amount),
        0,
      );
    return [
      send(
        chat,
        `⚠️ <b>Срок сегодня или в ближайшие 2 дня</b>\n\n${
          due.length
            ? due
                .slice(0, 8)
                .map((p) => row(p, today))
                .join("\n\n")
            : "Таких продуктов нет."
        }${due.length > 8 ? `\nЕщё ${due.length - 8} — в холодильнике.` : ""}${cost > 0 ? `\n\nСтоимость этих остатков: ${Math.round(cost)} ₸.` : ""}${expired.length ? `\n\n⛔ Уже просрочено: ${expired.length}. Не включаю их в рецепты; проверьте список на сайте.` : ""}`,
        inline([[btn("🍳 Что из этого приготовить?", "recipe")], [web(env)]]),
      ),
    ];
  }
  if (
    text === "/recipe" ||
    text === "🍳 Рецепт из остатков" ||
    callback === "recipe" ||
    /^рецепт\s*:/i.test(text)
  )
    return recipes(
      pantry,
      link,
      env,
      ai,
      today,
      text.replace(/^рецепт\s*:/i, "").slice(0, 1000),
    );
  if (text === "/test" || text === "🔔 Тест уведомления") {
    const stock = active(pantry.products);
    const p =
      stock.find(
        (p) => eligible(p, today) && daysUntil(p.expiresOn, today) <= 2,
      ) ?? stock.find((p) => daysUntil(p.expiresOn, today) <= 2);
    if (!p)
      return [
        send(
          chat,
          "🔔 Тест уведомления: продуктов с близким или истёкшим сроком сейчас нет. Напоминание не выдумывает продукты.",
        ),
      ];
    const buttons = [];
    if (eligible(p, today)) {
      const eat = action(pantry, link, "eat", [p]);
      const value = p.demo
        ? 0
        : Math.round((p.price * p.amount) / (p.initialAmount ?? p.amount));
      buttons.push([
        btn(`✅ Съедено${value ? ` (+${value} ₸)` : ""}`, `do:${eat}`),
      ]);
    }
    const discard = action(pantry, link, "discard", [p]);
    buttons.push([btn("🗑 Выброшено", `do:${discard}`)]);
    return [
      send(
        chat,
        `🔔 <b>Радар свежести · тест</b>\n\n${row(p, today)}\n\n${eligible(p, today) ? "Не забудьте использовать при правильном хранении. Что сделаем с продуктом?" : "Проверьте срок и условия хранения. Не рекомендую употреблять этот продукт через эту кнопку."}\nКнопки спишут весь указанный остаток. Для части порции откройте сайт.\n\nЭто ручная демонстрация, ежедневная рассылка ещё не включена.`,
        inline([...buttons, [web(env)]]),
      ),
    ];
  }
  if (text.startsWith("/") || callback)
    return [
      send(
        chat,
        "Выберите действие в меню или напишите продукт: «Молоко 3 дня». /help — помощь.",
      ),
    ];
  if (text.length > 1500 || text.split(/;|\n|,(?!\d)/).length > 10)
    return [
      send(
        chat,
        "Добавляйте до 10 продуктов одним сообщением (не более 1500 символов).",
      ),
    ];
  if (!text)
    return [
      send(chat, "Пока понимаю текст. Напишите, например: «Молоко 3 дня»."),
    ];
  const result = parseFoods(text, today, `tg-${updateId}`);
  pantry.products = [...result.products, ...pantry.products];
  const replies = result.products.map((p) => {
    const edit = action(pantry, link, "edit", [p]),
      cancel = action(pantry, link, "cancel", [p]);
    return send(
      chat,
      `✅ <b>Добавлено в запасы!</b>\n\n${categories[p.category].icon} <b>Продукт:</b> ${escape(p.name)}\n📦 <b>Количество:</b> ${amountLabel(p.amount, p.unit, "ru")}\n❄️ <b>Зона:</b> ${zones[p.zone].shortRu} (${temperatures[p.temperature].label})\n⏳ <b>Срок:</b> до ${date(p.expiresOn)}${result.estimated.has(p.id) ? " · ориентир" : ""}\n\n${escape(p.notes)}\nКарточка сохранена на сервере и появится на открытом сайте в течение 5 секунд.`,
      inline([
        [
          btn("✏️ Изменить срок", `do:${edit}`),
          btn("❌ Отменить", `do:${cancel}`),
        ],
      ]),
    );
  });
  if (result.rejected.length)
    replies.push(
      send(
        chat,
        `Не добавлено: ${result.rejected.map((s) => escape(s.slice(0, 100))).join(", ")}.\nПока распознаю продукты из каталога. Неизвестный продукт добавьте на сайте; количество должно быть положительным, срок — до 365 дней.`,
        inline([[web(env)]]),
      ),
    );
  return replies;
}

const userSchema = z.object({
  id: z.number().int().positive().safe(),
  is_bot: z.boolean().optional(),
  first_name: z.string().max(200).optional(),
  username: z.string().max(100).optional(),
});
const messageSchema = z.object({
  message_id: z.number().int(),
  chat: z.object({ id: z.number().int().safe(), type: z.string() }),
  from: userSchema.optional(),
  text: z.string().max(8192).optional(),
});
const updateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: messageSchema.optional(),
  callback_query: z
    .object({
      id: z.string().max(200),
      from: userSchema,
      data: z.string().max(64).optional(),
      message: messageSchema.optional(),
    })
    .optional(),
});
type Update = z.infer<typeof updateSchema>;

async function processUpdate(
  update: Update,
  env: TelegramEnv,
  ai: AI,
): Promise<Outgoing[]> {
  const db = env.DB!,
    message = update.callback_query?.message ?? update.message,
    from = update.callback_query?.from ?? update.message?.from;
  if (
    !message ||
    !from ||
    from.is_bot ||
    message.chat.type !== "private" ||
    message.chat.id !== from.id
  )
    return [];
  const userId = String(from.id),
    chat = String(message.chat.id),
    text = update.message?.text?.trim() ?? "",
    callback = update.callback_query?.data;
  let link = await db
    .prepare("SELECT * FROM ss_telegram_links WHERE telegram_id=?")
    .bind(userId)
    .first<Link>();
  if (update.callback_query)
    await telegramAPI(env, "answerCallbackQuery", {
      callback_query_id: update.callback_query.id,
    }).catch(() => {});
  if (/^\/start\s+[a-f0-9]{48}$/.test(text)) {
    const code = await hash(text.split(/\s+/)[1]);
    const pair = await db
      .prepare(
        "SELECT account_id FROM ss_telegram_codes WHERE hash=? AND expires_at>?",
      )
      .bind(code, Date.now())
      .first<{ account_id: string }>();
    if (pair && (!link || link.account_id === pair.account_id)) {
      await db
        .prepare(
          "INSERT INTO ss_telegram_links(telegram_id,account_id,chat_id,link_id,display_name) SELECT ?,account_id,?,?,? FROM ss_telegram_codes WHERE hash=? AND expires_at>? ON CONFLICT DO NOTHING",
        )
        .bind(
          userId,
          chat,
          crypto.randomUUID(),
          (from.username
            ? `@${from.username}`
            : (from.first_name ?? "Telegram")
          ).slice(0, 100),
          code,
          Date.now(),
        )
        .run();
      link = await db
        .prepare("SELECT * FROM ss_telegram_links WHERE telegram_id=?")
        .bind(userId)
        .first<Link>();
      if (link?.account_id === pair.account_id)
        await db
          .prepare("DELETE FROM ss_telegram_codes WHERE account_id=?")
          .bind(pair.account_id)
          .run();
      else
        return [
          send(
            chat,
            "Этот аккаунт уже связан с другим Telegram. Отключите прежнюю связь в настройках сайта.",
          ),
        ];
    } else if (!link)
      return [
        send(
          chat,
          "Ссылка недействительна или устарела. Создайте новую в разделе Telegram на сайте.",
          inline([[web(env)]]),
        ),
      ];
    else if (pair && link.account_id !== pair.account_id)
      return [
        send(
          chat,
          "Telegram уже связан с другим аккаунтом. Сначала отключите его на прежнем аккаунте сайта.",
        ),
      ];
  }
  if (!link)
    return [
      send(
        chat,
        "👋 Привет! Я помощник Shelf Sense против пищевых отходов.\n\nСначала свяжите холодильник: войдите на сайт → Telegram → «Связать аккаунт» → нажмите Start. Это защищает ваши продукты от доступа других пользователей. Затем можно писать «Молоко 3 дня» и пользоваться меню.",
        inline([[web(env)]]),
      ),
    ];
  // The pantry revision and receipt are saved together. Retried Telegram updates
  // cannot repeat inventory mutations even after a delivery failure or crash.
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await getPantry(db, link.account_id);
    if (!current)
      return [
        send(
          chat,
          "Сначала откройте сайт, чтобы синхронизировать запасы.",
          inline([[web(env)]]),
        ),
      ];
    const cached = current.bot.receipts?.[String(update.update_id)];
    if (cached) return cached;
    if (attempt === 0) {
      const key = `tg:${userId}:${Math.floor(Date.now() / 60000)}`;
      await db
        .prepare(
          "INSERT INTO ss_auth_limits(id,count,until) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CAST(count AS INTEGER)+1",
        )
        .bind(key, String(Date.now() + 120000))
        .run();
      const rate = await db
        .prepare("SELECT count FROM ss_auth_limits WHERE id=?")
        .bind(key)
        .first<{ count: string }>();
      if (Number(rate?.count) > 30)
        return [
          send(chat, "Слишком много действий. Подождите минуту и повторите."),
        ];
    }
    trimState(current);
    const flowReplies = await linkedFlow(
      current,
      link,
      env,
      text,
      callback,
      ai,
      update.update_id,
    );
    const replies = flowReplies.map((reply) => ({
      ...reply,
      linkId: link.link_id,
    }));
    current.bot.receipts ??= {};
    current.bot.receipts[String(update.update_id)] = replies;
    if (
      await writePantry(
        db,
        link.account_id,
        current,
        current.products,
        current.bot,
        link.link_id,
      )
    )
      return replies;
  }
  throw Error("inventory_busy");
}

export async function handleTelegramIngress(
  request: Request,
  env: TelegramEnv,
  ai: AI,
) {
  if (
    !env.DB ||
    !env.TELEGRAM_INGRESS_SECRET ||
    !safeEqual(
      request.headers.get("x-shelf-telegram-secret") ??
        request.headers.get("x-telegram-bot-api-secret-token") ??
        "",
      env.TELEGRAM_INGRESS_SECRET,
    )
  )
    return json({ error: "unauthorized" }, 401);
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  const db = env.DB!;
  await db
    .prepare(
      "INSERT INTO ss_telegram_runtime(id,heartbeat) VALUES('bridge',?) ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat",
    )
    .bind(Date.now())
    .run();
  if (new URL(request.url).pathname.endsWith("/heartbeat"))
    return json({ ok: true });
  let update: Update;
  try {
    update = updateSchema.parse(await readJSON(request, 64000));
  } catch {
    return json({ error: "invalid_update" }, 400);
  }
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO ss_telegram_updates(id,lease_until) VALUES(?,0) ON CONFLICT(id) DO NOTHING",
    )
    .bind(update.update_id)
    .run();
  const existing = await db
    .prepare("SELECT completed FROM ss_telegram_updates WHERE id=?")
    .bind(update.update_id)
    .first<{ completed: number }>();
  if (existing?.completed) return json({ ok: true, duplicate: true });
  const claim = await db
    .prepare(
      "UPDATE ss_telegram_updates SET lease_until=? WHERE id=? AND lease_until<? AND completed=0",
    )
    .bind(now + 180000, update.update_id, now)
    .run();
  if (!claim.meta.changes) return json({ error: "busy" }, 409);
  try {
    const record = await db
      .prepare("SELECT response,sent FROM ss_telegram_updates WHERE id=?")
      .bind(update.update_id)
      .first<{ response: string | null; sent: number }>();
    let outgoing: Outgoing[];
    if (record?.response) outgoing = JSON.parse(record.response);
    else {
      outgoing = await processUpdate(update, env, ai);
      await db
        .prepare("UPDATE ss_telegram_updates SET response=? WHERE id=?")
        .bind(JSON.stringify(outgoing), update.update_id)
        .run();
    }
    for (let i = record?.sent ?? 0; i < outgoing.length; i++) {
      if (
        outgoing[i].linkId &&
        !(await db
          .prepare(
            "SELECT telegram_id FROM ss_telegram_links WHERE chat_id=? AND link_id=?",
          )
          .bind(String(outgoing[i].body.chat_id), outgoing[i].linkId)
          .first())
      )
        break;
      try {
        await telegramAPI(env, outgoing[i].method, outgoing[i].body);
      } catch (error) {
        // A user blocking the bot must not stall the queue for everybody else.
        if (
          error instanceof Error &&
          error.message === "telegram_chat_unavailable"
        )
          break;
        throw error;
      }
      await db
        .prepare("UPDATE ss_telegram_updates SET sent=? WHERE id=?")
        .bind(i + 1, update.update_id)
        .run();
    }
    await db
      .prepare(
        "UPDATE ss_telegram_updates SET completed=1,lease_until=? WHERE id=?",
      )
      .bind(Date.now(), update.update_id)
      .run();
    await db
      .prepare(
        "DELETE FROM ss_telegram_updates WHERE completed=1 AND lease_until<?",
      )
      .bind(now - 7 * 86400000)
      .run();
    return json({ ok: true });
  } catch {
    await db
      .prepare("UPDATE ss_telegram_updates SET lease_until=0 WHERE id=?")
      .bind(update.update_id)
      .run();
    return json({ error: "telegram_retry_required" }, 503);
  }
}
