import { profileFor, type Lang } from "./catalog";
import { daysUntil, temperatureAlerts, type Product } from "./model";
export type Recipe = {
  id: string;
  ru: string;
  en: string;
  photo: string;
  minutes: number;
  ingredients: { key: string; ru: string; en: string }[];
  steps: { ru: string[]; en: string[] };
};
export const recipes: Recipe[] = [
  {
    id: "salmon",
    ru: "Лосось с томатами и зеленью",
    en: "Salmon with tomatoes & greens",
    photo: "salmon-cooked",
    minutes: 25,
    ingredients: [
      { key: "salmon", ru: "Лосось", en: "Salmon" },
      { key: "tomato", ru: "Томаты", en: "Tomatoes" },
      { key: "greens", ru: "Зелень", en: "Greens" },
    ],
    steps: {
      ru: [
        "Разогрейте духовку до 190°C. Выложите филе в форму, добавьте томаты, немного масла и специи.",
        "Запекайте около 15–20 минут. Проверьте температуру в центре филе термометром: не менее 63°C.",
        "Добавьте промытую зелень и подавайте. Время зависит от толщины филе.",
      ],
      en: [
        "Heat the oven to 190°C. Put the fillet and tomatoes in a baking dish with a little oil and seasoning.",
        "Bake for about 15–20 minutes. Check the centre with a food thermometer: at least 63°C.",
        "Add washed greens and serve. Cooking time depends on the thickness of the fish.",
      ],
    },
  },
  {
    id: "toast",
    ru: "Тост с авокадо и яйцом",
    en: "Avocado & egg toast",
    photo: "toast",
    minutes: 15,
    ingredients: [
      { key: "avocado", ru: "Авокадо", en: "Avocado" },
      { key: "bread", ru: "Хлеб", en: "Bread" },
      { key: "eggs", ru: "Яйца", en: "Eggs" },
    ],
    steps: {
      ru: [
        "Подсушите хлеб на сухой сковороде или в тостере.",
        "Разомните мякоть авокадо, добавьте немного лимонного сока и соли по вкусу.",
        "Приготовьте яйцо до плотного белка и желтка. Выложите авокадо и яйцо на хлеб.",
      ],
      en: [
        "Toast the bread in a toaster or a dry pan.",
        "Mash the avocado and season with a little lemon juice and salt to taste.",
        "Cook the egg until the white and yolk are firm. Spoon the avocado onto the toast and top with the egg.",
      ],
    },
  },
  {
    id: "salad",
    ru: "Тёплый салат с сыром",
    en: "Warm cheese & tomato salad",
    photo: "salad",
    minutes: 15,
    ingredients: [
      { key: "tomato", ru: "Томаты", en: "Tomatoes" },
      { key: "greens", ru: "Зелень", en: "Greens" },
      { key: "cheese", ru: "Сыр", en: "Cheese" },
    ],
    steps: {
      ru: [
        "Промойте зелень и томаты, обсушите. Разрежьте томаты.",
        "Слегка прогрейте томаты на сковороде с каплей масла.",
        "Выложите на зелень, добавьте кусочки сыра и заправку по вкусу.",
      ],
      en: [
        "Wash and dry the greens and tomatoes. Cut the tomatoes.",
        "Warm the tomatoes in a pan with a little oil.",
        "Arrange over the greens, add pieces of cheese and dress to taste.",
      ],
    },
  },
  {
    id: "chicken",
    ru: "Куриная грудка с томатами",
    en: "Chicken with roasted tomatoes",
    photo: "chicken",
    minutes: 30,
    ingredients: [
      { key: "chicken", ru: "Куриная грудка", en: "Chicken breast" },
      { key: "tomato", ru: "Томаты", en: "Tomatoes" },
      { key: "greens", ru: "Зелень", en: "Greens" },
    ],
    steps: {
      ru: [
        "Поместите куриную грудку и томаты в форму, добавьте масло и специи.",
        "Запекайте при 200°C, проверяя готовность термометром: в центре грудки должно быть не менее 74°C.",
        "Подавайте с промытой зеленью. Для сырой курицы и готовых продуктов используйте разные доски.",
      ],
      en: [
        "Place the chicken and tomatoes in a baking dish with oil and seasoning.",
        "Bake at 200°C. Use a food thermometer to check the centre reaches at least 74°C.",
        "Serve with washed greens. Use separate boards for raw chicken and ready-to-eat ingredients.",
      ],
    },
  },
  {
    id: "berries",
    ru: "Клубничный молочный смузи",
    en: "Strawberry milk smoothie",
    photo: "strawberry",
    minutes: 5,
    ingredients: [
      { key: "strawberry", ru: "Клубника", en: "Strawberries" },
      { key: "milk", ru: "Молоко", en: "Milk" },
    ],
    steps: {
      ru: [
        "Промойте клубнику перед приготовлением и удалите хвостики.",
        "Взбейте ягоды с охлаждённым молоком до однородности.",
        "Подавайте сразу. Не используйте ягоды с признаками порчи.",
      ],
      en: [
        "Wash the strawberries just before preparation and remove the stems.",
        "Blend with chilled milk until smooth.",
        "Serve straight away. Do not use berries showing signs of spoilage.",
      ],
    },
  },
];
export function rankRecipes(products: Product[], today?: string) {
  const usable = products.filter(
    (p) =>
      p.state === "active" &&
      daysUntil(p.expiresOn, today) >= 0 &&
      p.temperature !== "frozen" &&
      !temperatureAlerts(p).some((a) => a.level === "warning"),
  );
  return recipes
    .map((recipe) => {
      const matching = recipe.ingredients
        .map(
          (i) =>
            usable
              .filter((p) => profileFor(p.name)?.key === i.key)
              .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0],
        )
        .filter((p): p is Product => !!p);
      const urgent = matching.filter((p) => daysUntil(p.expiresOn, today) <= 5);
      const missing = recipe.ingredients.filter(
        (i) => !matching.some((p) => profileFor(p.name)?.key === i.key),
      );
      const score =
        matching.reduce(
          (n, p) =>
            n +
            3 +
            (daysUntil(p.expiresOn, today) <= 2
              ? 5
              : daysUntil(p.expiresOn, today) <= 5
                ? 2
                : 0),
          0,
        ) -
        missing.length * 4;
      return { recipe, matching, urgent, missing, score };
    })
    .filter((r) => r.matching.length >= 2 && r.urgent.length > 0)
    .sort((a, b) => b.score - a.score);
}
export type RecipeMatch = ReturnType<typeof rankRecipes>[number];
export function productName(p: Product, lang: Lang) {
  return lang === "en" && p.nameEn ? p.nameEn : p.name;
}

// Extra catalogue ideas for common produce; AI can build custom combinations later.
recipes.push({
  id: "vegetables",
  ru: "Овощи в духовке с травами",
  en: "Herb-roasted vegetables",
  photo: "broccoli",
  minutes: 35,
  ingredients: [
    { key: "carrot", ru: "Морковь", en: "Carrot" },
    { key: "potato", ru: "Картофель", en: "Potatoes" },
    { key: "broccoli", ru: "Брокколи", en: "Broccoli" },
  ],
  steps: {
    ru: [
      "Промойте овощи, картофель очистите при необходимости. Нарежьте кусочками похожего размера.",
      "Смешайте картофель и морковь с небольшим количеством масла. Запекайте при 200°C около 20 минут.",
      "Добавьте соцветия брокколи, перемешайте и готовьте ещё 10–15 минут до мягкости. Приправьте по вкусу.",
    ],
    en: [
      "Wash the vegetables and peel potatoes if needed. Cut into similarly sized pieces.",
      "Toss potatoes and carrots with a little oil. Roast at 200°C for about 20 minutes.",
      "Add broccoli florets, toss and cook for 10–15 more minutes until tender. Season to taste.",
    ],
  },
});
recipes.push({
  id: "fruit",
  ru: "Фруктовый салат с яблоком и бананом",
  en: "Apple & banana fruit bowl",
  photo: "apple",
  minutes: 5,
  ingredients: [
    { key: "apple", ru: "Яблоко", en: "Apple" },
    { key: "banana", ru: "Банан", en: "Banana" },
    { key: "orange", ru: "Апельсин", en: "Orange" },
  ],
  steps: {
    ru: [
      "Промойте яблоко и апельсин. Очистите банан и апельсин.",
      "Нарежьте фрукты небольшими кусочками, перемешайте.",
      "Подавайте сразу. Оставшуюся нарезку уберите в закрытом контейнере в холодильник.",
    ],
    en: [
      "Wash the apple and orange. Peel the banana and orange.",
      "Cut the fruit into small pieces and combine.",
      "Serve immediately. Refrigerate any cut leftovers in a covered container.",
    ],
  },
});
