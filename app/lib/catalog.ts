export type Lang = "ru" | "en";
export type Category = "dairy" | "protein" | "produce" | "prepared" | "pantry";
export type Zone = "shelf" | "fresh" | "door" | "drawer" | "freezer" | "pantry";
export type Temperature = "fresh" | "chilled" | "cool" | "room" | "frozen";
export type Unit = "g" | "kg" | "ml" | "l" | "pcs";
export const categories: Record<
  Category,
  { ru: string; en: string; photos: string[]; icon: string }
> = {
  dairy: {
    ru: "Молочные продукты",
    en: "Dairy & eggs",
    photos: ["milk-alt", "dairy", "cheese", "eggs"],
    icon: "🥛",
  },
  protein: {
    ru: "Мясо и рыба",
    en: "Meat & fish",
    photos: ["chicken", "salmon-fillet", "beef"],
    icon: "🐟",
  },
  produce: {
    ru: "Овощи и фрукты",
    en: "Fruit & vegetables",
    photos: ["avocado", "strawberry", "tomato", "greens"],
    icon: "🥑",
  },
  prepared: {
    ru: "Готовая еда",
    en: "Prepared meals",
    photos: ["salad", "pasta", "toast"],
    icon: "🥗",
  },
  pantry: {
    ru: "Бакалея и выпечка",
    en: "Pantry & bakery",
    photos: ["bread", "grains", "bread-detail"],
    icon: "🥖",
  },
};
export const zones: Record<
  Zone,
  {
    ru: string;
    en: string;
    shortRu: string;
    shortEn: string;
    temp: Temperature;
  }
> = {
  shelf: {
    ru: "Основная полка холодильника",
    en: "Main fridge shelf",
    shortRu: "Основная полка",
    shortEn: "Fridge shelf",
    temp: "chilled",
  },
  fresh: {
    ru: "Зона свежести (0°C)",
    en: "Fresh zone (0°C)",
    shortRu: "Зона свежести",
    shortEn: "Fresh zone",
    temp: "fresh",
  },
  door: {
    ru: "Дверца холодильника",
    en: "Fridge door",
    shortRu: "Дверца холодильника",
    shortEn: "Fridge door",
    temp: "chilled",
  },
  drawer: {
    ru: "Нижний ящик для овощей",
    en: "Vegetable drawer",
    shortRu: "Овощной ящик",
    shortEn: "Produce drawer",
    temp: "cool",
  },
  freezer: {
    ru: "Морозильная камера",
    en: "Freezer",
    shortRu: "Морозилка",
    shortEn: "Freezer",
    temp: "frozen",
  },
  pantry: {
    ru: "Кладовая / Полка",
    en: "Pantry / Shelf",
    shortRu: "Кладовая",
    shortEn: "Pantry",
    temp: "room",
  },
};
export const temperatures: Record<
  Temperature,
  { label: string; ru: string; en: string }
> = {
  fresh: {
    label: "0°C … +2°C",
    ru: "Зона свежести · мясо, рыба",
    en: "Fresh zone · meat, fish",
  },
  chilled: {
    label: "+2°C … +4°C",
    ru: "Холодильник · молочка, готовая еда, яйца",
    en: "Fridge · dairy, meals, eggs",
  },
  cool: {
    label: "+4°C … +7°C",
    ru: "Овощной ящик · цельные овощи и фрукты",
    en: "Produce drawer · whole fruit & vegetables",
  },
  room: {
    label: "+15°C … +20°C",
    ru: "Кладовая · крупы, хлеб, цельные томаты",
    en: "Pantry · grains, bread, whole tomatoes",
  },
  frozen: { label: "−18°C", ru: "Морозильная камера", en: "Freezer" },
};
export const photoIds: Record<string, string> = {
  apple: "1560806887-1e4cd0b6cbd6",
  banana: "1571771894821-ce9b6c11b08e",
  orange: "1547514701-42782101795e",
  carrot: "1445282768818-728615cc910a",
  potato: "1518977676601-b53f82aba655",
  broccoli: "1459411621453-7b03977f4bfc",
  pepper: "1563565375-f3fdfdbefa83",
  cucumber: "1604977042946-1eecc30f269e",
  pear: "1514756331096-242fdeb70d4a",
  grape: "1537640538966-79f369143f8f",
  lemon: "1610833805553-43556a0f821d",
  onion: "1508747703725-719777637510",

  "milk-alt": "1639151082235-406d8eb262b9",
  "bread-detail": "1509440159596-0249088772ff",
  milk: "1563636619-e9143da7973b",
  dairy: "1550583724-b2692b85b150",
  avocado: "1634075281468-6980d76be8f7",
  chicken: "1604503468506-a8da13d82791",
  "salmon-fillet": "1763062550082-2c9f94096abb",
  "salmon-cooked": "1467003909585-2f8a72700288",
  strawberry: "1464965911861-746a04b4bca6",
  tomato: "1546094096-0df4bcaaa337",
  cheese: "1486297678162-eb2a19b0a32d",
  bread: "1509440159596-0249088772ff",
  eggs: "1518569656558-1f25e69d93d7",
  greens: "1576045057995-568f588f82fb",
  toast: "1525351484163-7529414344d8",
  salad: "1512621776951-a57141f2eefd",
  pasta: "1473093295043-cdd812d0e601",
  beef: "1603048297172-c92544798d5a",
  grains: "1515543904379-3d757afe72e4",
};
export const photoUrl = (key: string) =>
  `https://images.unsplash.com/photo-${photoIds[key] ?? photoIds.salad}?auto=format&fit=crop&w=800&q=85&fm=jpg`;
export const profileRules: {
  key: string;
  match: RegExp;
  category: Category;
  photo: string;
  grams: number;
}[] = [
  {
    key: "apple",
    match: /яблок|\bapples?\b/i,
    category: "produce",
    photo: "apple",
    grams: 180,
  },
  {
    key: "banana",
    match: /банан|\bbananas?\b/i,
    category: "produce",
    photo: "banana",
    grams: 120,
  },
  {
    key: "orange",
    match: /апельсин|мандарин|\b(?:oranges?|mandarins?)\b/i,
    category: "produce",
    photo: "orange",
    grams: 150,
  },
  {
    key: "carrot",
    match: /морков|\bcarrots?\b/i,
    category: "produce",
    photo: "carrot",
    grams: 80,
  },
  {
    key: "potato",
    match: /картоф|\bpotato(?:es)?\b/i,
    category: "produce",
    photo: "potato",
    grams: 150,
  },
  {
    key: "broccoli",
    match: /брокколи|broccoli/i,
    category: "produce",
    photo: "broccoli",
    grams: 300,
  },
  {
    key: "pepper",
    match: /перец|перц|bell pepper/i,
    category: "produce",
    photo: "pepper",
    grams: 150,
  },
  {
    key: "cucumber",
    match: /огур|cucumber/i,
    category: "produce",
    photo: "cucumber",
    grams: 150,
  },
  {
    key: "pear",
    match: /груш|\bpears?\b/i,
    category: "produce",
    photo: "pear",
    grams: 170,
  },
  {
    key: "grape",
    match: /виноград|\bgrapes?\b/i,
    category: "produce",
    photo: "grape",
    grams: 5,
  },
  {
    key: "lemon",
    match: /лимон|lemon/i,
    category: "produce",
    photo: "lemon",
    grams: 100,
  },
  {
    key: "onion",
    match: /лук|\bonions?\b/i,
    category: "produce",
    photo: "onion",
    grams: 100,
  },

  {
    key: "salmon",
    match: /лосос|сёмг|семг|salmon/i,
    category: "protein",
    photo: "salmon-fillet",
    grams: 200,
  },
  {
    key: "chicken",
    match: /куриц|курин|грудк|chicken/i,
    category: "protein",
    photo: "chicken",
    grams: 250,
  },
  {
    key: "beef",
    match: /говяд|стейк|beef|steak/i,
    category: "protein",
    photo: "beef",
    grams: 250,
  },
  {
    key: "milk",
    match: /молок|milk/i,
    category: "dairy",
    photo: "milk-alt",
    grams: 1000,
  },
  {
    key: "cheese",
    match: /сыр|cheese/i,
    category: "dairy",
    photo: "cheese",
    grams: 200,
  },
  {
    key: "eggs",
    match: /яйц|яиц|egg/i,
    category: "dairy",
    photo: "eggs",
    grams: 60,
  },
  {
    key: "avocado",
    match: /авокад|avocado/i,
    category: "produce",
    photo: "avocado",
    grams: 180,
  },
  {
    key: "strawberry",
    match: /клубник|strawber/i,
    category: "produce",
    photo: "strawberry",
    grams: 15,
  },
  {
    key: "tomato",
    match: /томат|помидор|tomato/i,
    category: "produce",
    photo: "tomato",
    grams: 100,
  },
  {
    key: "greens",
    match: /зелень|шпинат|петруш|укроп|руккол|spinach|herb|greens|lettuce/i,
    category: "produce",
    photo: "greens",
    grams: 100,
  },
  {
    key: "bread",
    match: /хлеб|булк|багет|bread|baguette/i,
    category: "pantry",
    photo: "bread",
    grams: 400,
  },
  {
    key: "pasta",
    match: /паста|макарон|pasta/i,
    category: "prepared",
    photo: "pasta",
    grams: 250,
  },
  {
    key: "salad",
    match: /салат|salad/i,
    category: "prepared",
    photo: "salad",
    grams: 250,
  },
  {
    key: "grains",
    match: /нут|круп|рис|chickpea|rice|grain/i,
    category: "pantry",
    photo: "grains",
    grams: 100,
  },
];
export function profileFor(name: string) {
  return profileRules.find((p) => p.match.test(name));
}
export function inferPhoto(name: string, category: Category) {
  const p = profileFor(name);
  return p?.category === category ? p.photo : categories[category].photos[0];
}
