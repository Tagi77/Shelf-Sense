import { profileFor, type Lang } from "./catalog";
import { rankRecipes, productName } from "./recipes";
import { daysUntil, temperatureAlerts, type Product } from "./model";
import type { Dish, Advice } from "./ai-contract";
import { weeklyWaste } from "./inventory";
const serving: Record<string, number> = {
  salmon: 200,
  chicken: 250,
  beef: 200,
  tomato: 150,
  greens: 30,
  bread: 80,
  avocado: 180,
  eggs: 120,
  milk: 200,
  cheese: 60,
  strawberry: 150,
  carrot: 150,
  potato: 200,
  broccoli: 150,
  apple: 180,
  banana: 120,
};
export function localDishes(
  products: Product[],
  lang: Lang,
  today: string,
  prompt = "",
): Dish[] {
  const named = profileFor(prompt);
  const exclusions: Record<string, RegExp> = {
    milk: /без (молока|молоч)|no (milk|dairy)|dairy.free/i,
    cheese: /без (сыра|молоч)|no (cheese|dairy)|dairy.free/i,
    eggs: /без яиц|no eggs|egg.free/i,
  };
  const ranked = rankRecipes(products, today).filter(
    (r) =>
      (!named || r.recipe.ingredients.some((i) => i.key === named.key)) &&
      !r.recipe.ingredients.some((i) => exclusions[i.key]?.test(prompt)),
  );
  return ranked.slice(0, 3).map(({ recipe, matching, urgent, missing }) => ({
    id: recipe.id,
    title: recipe[lang],
    minutes: recipe.minutes,
    reason:
      lang === "ru"
        ? `Используем первыми: ${urgent.map((p) => productName(p, lang)).join(", ")}.`
        : `Use first: ${urgent.map((p) => productName(p, lang)).join(", ")}.`,
    ingredients: matching.map((p) => {
      const key = profileFor(p.name)?.key ?? "";
      const grams = serving[key] ?? 100;
      const desired =
        p.unit === "pcs"
          ? key === "eggs"
            ? 2
            : 1
          : p.unit === "g" || p.unit === "ml"
            ? grams
            : grams / 1000;
      return {
        productId: p.id,
        name: productName(p, lang),
        amount: Math.min(p.amount, desired),
        unit: p.unit,
      };
    }),
    extras: [
      ...missing.map((i) => i[lang]),
      lang === "ru"
        ? "Масло и приправы — по вкусу"
        : "Oil and seasoning to taste",
    ],
    steps: recipe.steps[lang],
    improvement:
      lang === "ru"
        ? "Добавьте немного свежей зелени или лимонного сока перед подачей, если это подходит блюду."
        : "Add a little fresh herb or lemon juice before serving, if it suits the dish.",
  }));
}
export function localAdvice(
  products: Product[],
  lang: Lang,
  section: string,
  today: string,
): Advice {
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const active = products.filter((p) => p.state === "active");
  const due = active
    .filter(
      (p) =>
        daysUntil(p.expiresOn, today) >= 0 &&
        daysUntil(p.expiresOn, today) <= 2 &&
        !temperatureAlerts(p).some((a) => a.level === "warning"),
    )
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  const waste = weeklyWaste(products, today).at(-1)!;
  if (section === "history" || section === "waste")
    return {
      title: l("Меньше потерь на следующей неделе", "Less waste next week"),
      tips: [
        waste.value > 0
          ? l(
              `За эту неделю списано на ${Math.round(waste.value)} ₸. Покупайте меньшими порциями то, что чаще остаётся.`,
              `Discarded value this week: ${Math.round(waste.value)} ₸. Buy smaller portions of items often left over.`,
            )
          : l(
              "Указывайте стоимость покупки: тогда график покажет реальные потери.",
              "Enter purchase prices so the chart can show your actual losses.",
            ),
        l(
          "Отмечайте использованные порции сразу после готовки — остатки будут точнее.",
          "Log portions after cooking to keep stock accurate.",
        ),
      ],
    };
  if (section === "freezer")
    return {
      title: l("Планируйте разморозку", "Plan your thawing"),
      tips: [
        l(
          "Размораживайте в холодильнике. Замороженные продукты не включаются в быстрые рецепты, пока вы не обновите их состояние и срок.",
          "Thaw in the refrigerator. Frozen items are excluded from quick recipes until you update their storage and expiry.",
        ),
      ],
    };
  return {
    title: due.length
      ? l("Начните с ближайших сроков", "Start with what expires first")
      : l("Небольшой план на сегодня", "A little plan for today"),
    tips: [
      due.length
        ? l(
            `${due
              .slice(0, 3)
              .map((p) => productName(p, lang))
              .join(
                ", ",
              )} — используйте в ближайшие два дня при правильном хранении.`,
            `${due
              .slice(0, 3)
              .map((p) => productName(p, lang))
              .join(", ")} — use within two days if stored correctly.`,
          )
        : l(
            "Перед покупками посмотрите остатки на полке.",
            "Check what is left on your shelf before shopping.",
          ),
      section === "pantry"
        ? l(
            "Картофель и лук храните раздельно в сухом, тёмном, проветриваемом месте.",
            "Keep potatoes and onions apart in a dry, dark, ventilated place.",
          )
        : l(
            "Сырое мясо и рыбу держите в закрытых контейнерах ниже готовой еды.",
            "Keep raw meat and fish in sealed containers below ready-to-eat food.",
          ),
    ],
  };
}
