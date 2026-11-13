import assert from "node:assert/strict";
import { build } from "esbuild";
process.env.SHELF_TEST_DB = ":memory:";
const { DB } = await import("../scripts/local-db.mjs");
await build({
  entryPoints: ["server/worker.ts"],
  outfile: "work/telegram-test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
await build({
  entryPoints: ["server/telegram-food.ts"],
  outfile: "work/telegram-food-test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { handleRequest } = await import("../work/telegram-test.mjs");
const { parseFoods, parseExpiry, botToday } = await import(
  "../work/telegram-food-test.mjs"
);
const today = botToday();
const env = {
  DB,
  TELEGRAM_BOT_TOKEN: "fixture-token",
  TELEGRAM_BOT_USERNAME: "fixture_bot",
  TELEGRAM_INGRESS_SECRET: "test-ingress-secret",
  SHELF_PUBLIC_URL: "https://shelf.test",
};
const sent = [];
let failDelivery = false;
globalThis.fetch = async (url, options) => {
  assert.ok(
    String(url).startsWith("https://api.telegram.org/botfixture-token/"),
  );
  const method = String(url).split("/").at(-1);
  if (failDelivery && method === "sendMessage") {
    failDelivery = false;
    return Response.json({ ok: false }, { status: 500 });
  }
  if (method === "sendMessage") sent.push(JSON.parse(options.body));
  return Response.json({ ok: true, result: { message_id: sent.length } });
};
const request = (
  path,
  body,
  cookie = "",
  method = body === undefined ? "GET" : "POST",
  extra = {},
) =>
  new Request("https://shelf.test" + path, {
    method,
    headers: {
      origin: "https://shelf.test",
      "content-type": "application/json",
      "oai-authenticated-user-id": "test-owner",
      cookie,
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const call = (...args) => handleRequest(request(...args), env);
async function register(n) {
  const r = await call("/api/auth/register", {
    nickname: "Tester",
    email: `${n}@example.com`,
    password: "LocalTest!2026",
  });
  assert.equal(r.status, 200);
  return { cookie: r.headers.get("set-cookie"), user: (await r.json()).user };
}
const a = await register("one"),
  b = await register("two");
const get = async (account = a) =>
  (await call("/api/pantry", undefined, account.cookie)).json();
async function put(products, account = a, revision) {
  const current = await get(account);
  return call(
    "/api/pantry",
    { products, revision: revision ?? current.revision },
    account.cookie,
    "PUT",
  );
}
assert.equal((await call("/api/pantry")).status, 401);
assert.deepEqual(await get(), { products: [], revision: 1 });
assert.equal(
  (await call("/api/pantry", { revision: 0, products: [] }, a.cookie)).status,
  200,
);
assert.equal(
  (await call("/api/pantry", { revision: 0, products: [] }, b.cookie)).status,
  200,
);
assert.equal(
  (
    await call("/api/pantry", { revision: 1, products: [] }, a.cookie, "PUT", {
      origin: "https://evil.test",
    })
  ).status,
  403,
);
assert.equal((await put([], a, 0)).status, 409);
const p = parseFoods(
  "Молоко 500 мл 3 дня; Яблоки 4 шт 7 дней; Куриное филе 600 г 1 день",
  today,
  "parser",
);
assert.equal(p.products.length, 3);
assert.equal(p.products[0].unit, "ml");
assert.equal(p.products[0].amount, 500);
assert.equal(p.products[1].unit, "pcs");
assert.equal(p.products[2].zone, "fresh");
assert.equal(
  parseFoods("Молоко 1,5 л 3 дня", today, "decimal").products[0].amount,
  1.5,
);
assert.equal(
  parseFoods("Сыр, помидоры, хлеб", today, "multi").products.length,
  3,
);
assert.equal(parseFoods("Телефон 3 дня", today, "unknown").products.length, 0);
assert.equal(parseFoods("Яблоки 0 шт", today, "zero").products.length, 0);
assert.equal(parseExpiry("31.02.2027", today).invalid, true);
assert.equal(parseFoods("Бананы", today, "est").estimated.size, 1);
let seq = 100;
const msg = (text, id = 101, update_id = ++seq) => ({
  update_id,
  message: {
    message_id: update_id,
    chat: { id, type: "private" },
    from: { id, first_name: "Тест" },
    text,
  },
});
const cb = (data, id = 101, update_id = ++seq) => ({
  update_id,
  callback_query: {
    id: `cb${update_id}`,
    from: { id },
    data,
    message: { message_id: 1, chat: { id, type: "private" } },
  },
});
const ingress = (update, secret = env.TELEGRAM_INGRESS_SECRET) =>
  call("/api/telegram/update", update, "", "POST", {
    "x-shelf-telegram-secret": secret,
  });
const last = () => sent.at(-1);
const button = (message, text) =>
  message.reply_markup.inline_keyboard.flat().find((b) => b.text.includes(text))
    .callback_data;
assert.equal((await ingress(msg("/start"), "bad")).status, 401);
assert.equal((await ingress(msg("/start"))).status, 200);
assert.match(last().text, /Сначала свяжите/);
const codeURL = async (account) =>
  (await (await call("/api/telegram/link", {}, account.cookie)).json()).url;
let url = await codeURL(a);
assert.equal(new URL(url).hostname, "t.me");
const code = new URL(url).searchParams.get("start");
assert.equal((await ingress(msg("/start " + code))).status, 200);
assert.match(last().text, /Аккаунт подключён/);
assert.equal(last().reply_markup.keyboard.flat().length, 4);
assert.equal(
  (await (await call("/api/telegram/status", undefined, a.cookie)).json())
    .linked,
  true,
);
assert.equal(
  (await (await call("/api/telegram/status", undefined, b.cookie)).json())
    .linked,
  false,
);
await ingress(msg("/start " + code, 102));
assert.match(last().text, /недействительна/);
await ingress(msg("Молоко 500 мл 3 дня"));
const milkReply = last();
let stock = (await get()).products;
assert.equal(stock.length, 1);
assert.equal((await get(b)).products.length, 0);
const countBefore = sent.length;
const repeated = msg("Яблоки 4 шт 7 дней");
await ingress(repeated);
const appleReply = last();
await ingress(repeated);
assert.equal(sent.length, countBefore + 1);
assert.equal((await get()).products.length, 2);
const cancelApple = button(appleReply, "Отменить");
await ingress(cb(cancelApple, 102));
assert.match(last().text, /Сначала свяжите/);
assert.equal((await get()).products.length, 2);
await ingress(cb(cancelApple));
assert.equal((await get()).products.length, 1);
await ingress(cb(cancelApple));
assert.equal((await get()).products.length, 1);
assert.match(last().text, /уже выполнена/);
await ingress(cb(button(milkReply, "Изменить")));
await ingress(msg("5 дней"));
stock = (await get()).products;
assert.equal(stock[0].expiresOn, parseExpiry("5 дней", today).date);
await ingress(cb(button(milkReply, "Отменить")));
assert.match(last().text, /Продукт изменился/);
assert.equal((await get()).products.length, 1);
await ingress(msg("Куриное филе 600 г 1 день"));
stock = (await get()).products;
let chicken = stock.find((p) => p.name.includes("Куриное"));
assert.ok(chicken);
chicken.price = 1200;
assert.equal((await put(stock)).status, 200);
await ingress(msg("Помидоры 4 шт 2 дня; Зелень 60 г 2 дня"));
await ingress(msg("/expiring"));
assert.match(last().text, /Куриное/);
assert.doesNotMatch(last().text, /Молоко/);
await ingress(msg("/recipe"));
assert.match(last().text, /Локальный подбор/);
const recipe = last();
const cook = button(recipe, "Готово");
const beforeCook = await get();
await ingress(cb(cook));
const afterCook = await get();
assert.ok(afterCook.products.find((p) => p.id === chicken.id).amount < 600);
assert.match(last().text, /осталось/);
await ingress(cb(cook));
assert.deepEqual((await get()).products, afterCook.products);
assert.equal(
  (await put(beforeCook.products, a, beforeCook.revision)).status,
  409,
);
await ingress(msg("/test"));
const reminder = last();
assert.match(reminder.text, /ручная демонстрация/);
assert.match(reminder.text, /Куриное/);
await ingress(cb(button(reminder, "Выброшено")));
assert.equal(
  (await get()).products.find((p) => p.id === chicken.id).state,
  "discarded",
);
assert.match(last().text, /Потери/);
// Retry after Telegram delivery failure: stock mutation is committed exactly once.
const retry = msg("Бананы 2 шт 3 дня");
failDelivery = true;
assert.equal((await ingress(retry)).status, 503);
assert.equal(
  (await get()).products.filter((p) => p.name === "Бананы").length,
  1,
);
assert.equal((await ingress(retry)).status, 200);
assert.equal(
  (await get()).products.filter((p) => p.name === "Бананы").length,
  1,
);
const revision = (await get()).revision;
const concurrent = await Promise.all([
  put((await get()).products, a, revision),
  put((await get()).products, a, revision),
]);
assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
const group = msg("Яйца 3 шт");
group.message.chat = { id: -100, type: "group" };
const beforeGroup = sent.length;
await ingress(group);
assert.equal(sent.length, beforeGroup);
await ingress(msg("a".repeat(2000)));
assert.match(last().text, /1500/);
assert.equal((await call("/api/telegram/unlink", {}, a.cookie)).status, 200);
await ingress(cb(cook));
assert.match(last().text, /Сначала свяжите/);

// Disconnect revokes a reply waiting for retry, including its private food data.
await DB.prepare("DELETE FROM ss_auth_limits WHERE id LIKE 'tg:%'").run();
const relinkURL = await codeURL(a);
await ingress(msg("/start " + new URL(relinkURL).searchParams.get("start")));
const waiting = msg("Груши 2 шт 3 дня");
failDelivery = true;
assert.equal((await ingress(waiting)).status, 503);
const sentBeforeUnlink = sent.length;
await call("/api/telegram/unlink", {}, a.cookie);
assert.equal((await ingress(waiting)).status, 200);
assert.equal(sent.length, sentBeforeUnlink);

console.log(
  "Telegram + cloud inventory: auth isolation, parser, pairing, menu, expiry edit, undo, portions, recipe fallback, reminders, stale writes, delivery retry, replay and unlink passed.",
);
