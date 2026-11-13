import {
  profileFor,
  type Category,
  type Lang,
  type Temperature,
  type Zone,
  type Unit,
} from "./catalog";
export type Condition = "whole" | "ripe" | "unripe" | "cut" | "opened";
export type FoodGuide = {
  name: string;
  category: Category;
  zone: Zone;
  temperature: Temperature;
  daysMin: number;
  daysMax: number;
  tip: string;
  confidence: "known" | "estimate" | "unknown";
  unit: Unit;
};
const ranges: Record<
  string,
  [number, number, Zone, Temperature, string, string]
> = {
  apple: [
    7,
    14,
    "shelf",
    "chilled",
    "Держите отдельно от зелени и овощей, чувствительных к этилену.",
    "Keep apart from greens and ethylene-sensitive vegetables.",
  ],
  banana: [
    2,
    5,
    "pantry",
    "room",
    "При комнатной температуре бананы продолжают созревать. Проверяйте ежедневно.",
    "Bananas keep ripening at room temperature. Check daily.",
  ],
  orange: [
    7,
    14,
    "shelf",
    "chilled",
    "Целые цитрусовые дольше сохраняются в холодильнике.",
    "Whole citrus keeps longer in the refrigerator.",
  ],
  lemon: [
    7,
    14,
    "shelf",
    "chilled",
    "Храните целиком; разрезанный лимон уберите в закрытый контейнер.",
    "Keep whole; refrigerate a cut lemon in a covered container.",
  ],
  pear: [
    3,
    5,
    "shelf",
    "chilled",
    "Спелые груши держите в холодильнике; твёрдые сначала дозрейте на столе.",
    "Refrigerate ripe pears; let firm pears ripen on the counter first.",
  ],
  grape: [
    3,
    7,
    "shelf",
    "chilled",
    "Храните сухим, мойте перед едой. Удаляйте испорченные ягоды.",
    "Keep dry and wash before eating. Remove spoiled berries.",
  ],
  carrot: [
    7,
    14,
    "shelf",
    "chilled",
    "Удалите ботву. Держите в овощном отделении при температуре до +4°C.",
    "Remove leafy tops. Keep in the produce compartment at 4°C or below.",
  ],
  potato: [
    14,
    28,
    "pantry",
    "room",
    "Тёмное, сухое, проветриваемое место. Храните отдельно от лука.",
    "Keep in a dark, dry, ventilated place, apart from onions.",
  ],
  onion: [
    14,
    28,
    "pantry",
    "room",
    "Целый сухой лук храните в проветриваемом месте; нарезанный — в холодильнике.",
    "Keep whole dry onions ventilated; refrigerate cut onion.",
  ],
  broccoli: [
    3,
    6,
    "shelf",
    "chilled",
    "Храните сухой в пакете с отверстиями, отдельно от созревающих фруктов.",
    "Store dry in a perforated bag, apart from ripening fruit.",
  ],
  pepper: [
    3,
    5,
    "shelf",
    "chilled",
    "Держите сухим, мойте перед приготовлением.",
    "Keep dry and wash just before preparation.",
  ],
  cucumber: [
    1,
    3,
    "drawer",
    "cool",
    "Используйте в ближайшие дни; целые огурцы чувствительны к сильному холоду.",
    "Use within a few days; whole cucumbers are sensitive to very cold storage.",
  ],
  avocado: [
    2,
    4,
    "shelf",
    "chilled",
    "Спелое авокадо уберите в холодильник. Неспелое оставьте дозревать на столе.",
    "Refrigerate ripe avocado. Let unripe fruit ripen on the counter.",
  ],
  strawberry: [
    2,
    3,
    "shelf",
    "chilled",
    "Не мойте до еды, держите сухой; ягоды с плесенью выбрасывайте.",
    "Keep dry and unwashed until eating; discard mouldy berries.",
  ],
  tomato: [
    2,
    5,
    "pantry",
    "room",
    "Для целых спелых томатов. Нарезанные сразу уберите в холодильник.",
    "For whole ripe tomatoes. Refrigerate cut tomatoes promptly.",
  ],
  greens: [
    2,
    4,
    "shelf",
    "chilled",
    "Храните сухой, отдельно от томатов и созревающих фруктов.",
    "Keep dry, apart from tomatoes and ripening fruit.",
  ],
  salmon: [
    1,
    2,
    "fresh",
    "fresh",
    "Для свежей сырой рыбы: закрытый контейнер ниже готовой еды.",
    "For fresh raw fish: a sealed container below ready-to-eat food.",
  ],
  chicken: [
    1,
    2,
    "fresh",
    "fresh",
    "Для сырой курицы. Если не приготовите вовремя, заморозьте до истечения срока.",
    "For raw chicken. Freeze before its use-by date if you will not cook it in time.",
  ],
  beef: [
    3,
    5,
    "fresh",
    "fresh",
    "Для цельного сырого отруба. Фарш хранится меньше: 1–2 дня.",
    "For a whole raw cut. Ground meat keeps less: 1–2 days.",
  ],
  bread: [
    3,
    5,
    "pantry",
    "room",
    "В сухой хлебнице. Излишки можно заморозить порциями.",
    "Keep in a dry bread bin. Freeze extra slices in portions.",
  ],
};
export function foodGuide(
  name: string,
  condition: Condition,
  lang: Lang,
): FoodGuide | null {
  const p = profileFor(name);
  if (!p) return null;
  const range = ranges[p.key];
  if (!range) return null;
  let [daysMin, daysMax, zone, temperature, ru, en] = range;
  if (condition === "cut" && p.category === "produce") {
    daysMin = 2;
    daysMax = 3;
    zone = "shelf";
    temperature = "chilled";
    ru =
      "Нарезанный продукт храните в закрытом контейнере при +2…+4°C. Срок отсчитывайте с момента нарезки.";
    en =
      "Keep cut produce covered at 2–4°C. Count the storage time from cutting.";
  }
  if (
    condition === "unripe" &&
    ["avocado", "pear", "banana", "tomato"].includes(p.key)
  ) {
    daysMin = 2;
    daysMax = 4;
    zone = "pantry";
    temperature = "room";
    ru =
      "Оставьте дозревать при комнатной температуре, проверяйте каждый день. После созревания условия меняются.";
    en =
      "Ripen at room temperature and check daily. Storage conditions change once ripe.";
  }
  if (
    condition === "opened" &&
    p.category !== "produce" &&
    p.category !== "pantry"
  )
    return null;
  return {
    name,
    category: p.category,
    zone,
    temperature,
    daysMin,
    daysMax,
    tip: lang === "ru" ? ru : en,
    confidence: "known",
    unit:
      p.category === "produce" && !["strawberry", "greens"].includes(p.key)
        ? "pcs"
        : p.category === "protein"
          ? "g"
          : "pcs",
  };
}
export const guideNote = (lang: Lang) =>
  lang === "ru"
    ? "Ориентир для свежего продукта при указанных условиях, не гарантия безопасности. Учитывайте дату покупки, зрелость и упаковку."
    : "An estimate for fresh food in these conditions, not a safety guarantee. Consider purchase date, ripeness and packaging.";
