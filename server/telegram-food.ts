import { profileFor, inferPhoto, zones, type Unit } from "../app/lib/catalog";
import { foodGuide, type Condition } from "../app/lib/food-guide";
import {
  addDays,
  validDate,
  daysUntil,
  productSchema,
  type Product,
} from "../app/lib/model";

export const botToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function parseExpiry(text: string, today: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const dotted = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  const relative = text.match(
    /(?:^|\s)(-?\d{1,3})\s*(?:день|дня|дней|дн\.?|days?)(?=\s|$)/i,
  );
  const date =
    iso?.[1] ??
    (dotted
      ? `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`
      : relative
        ? addDays(Number(relative[1]), today)
        : null);
  if (
    date &&
    (!validDate(date) ||
      daysUntil(date, today) < 0 ||
      daysUntil(date, today) > 365)
  )
    return { invalid: true, date: null, match: "" };
  return {
    date,
    invalid: false,
    match: iso?.[0] ?? dotted?.[0] ?? relative?.[0] ?? "",
  };
}
export function parseFoods(text: string, today: string, prefix: string) {
  const parts = text
    .split(/(?<!\d),(?!\d)|;|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length || parts.length > 10 || text.length > 1500)
    throw Error("too_many_foods");
  const products: Product[] = [],
    rejected: string[] = [],
    estimated = new Set<string>();
  for (const [index, part] of parts.entries()) {
    const expiry = parseExpiry(part, today);
    if (expiry.invalid) {
      rejected.push(part);
      continue;
    }
    const qty = part.match(
      /(?:^|\s)(-?\d+(?:[.,]\d+)?)\s*(кг|kg|г|g|мл|ml|л|l|шт\.?|pcs)(?=\s|$)/i,
    );
    const condition: Condition = /открыт|вскрыт|opened/i.test(part)
      ? "opened"
      : /нарез|разрез|cut/i.test(part)
        ? "cut"
        : "whole";
    const name = part
      .replace(expiry.match, " ")
      .replace(qty?.[0] ?? /^$/, " ")
      .replace(/\s+/g, " ")
      .trim();
    const profile = profileFor(name);
    if (!profile || name.length < 2 || name.length > 100) {
      rejected.push(part);
      continue;
    }
    const guide = foodGuide(name, condition, "ru");
    const zone =
      guide?.zone ??
      (profile.category === "protein"
        ? "fresh"
        : profile.category === "pantry"
          ? "pantry"
          : "shelf");
    const unitMap: Record<string, Unit> = {
      кг: "kg",
      kg: "kg",
      г: "g",
      g: "g",
      мл: "ml",
      ml: "ml",
      л: "l",
      l: "l",
      шт: "pcs",
      "шт.": "pcs",
      pcs: "pcs",
    };
    const amount = qty ? Number(qty[1].replace(",", ".")) : 1;
    const unit: Unit = qty ? unitMap[qty[2].toLowerCase()] : "pcs";
    if (
      !(amount > 0 && amount <= 100000) ||
      (unit === "pcs" && !Number.isInteger(amount))
    ) {
      rejected.push(part);
      continue;
    }
    const estimate =
      condition === "opened"
        ? 1
        : (guide?.daysMin ??
          (profile.key === "eggs" ? 7 : profile.category === "pantry" ? 3 : 2));
    const id = `${prefix}-${index}`;
    if (!expiry.date) estimated.add(id);
    products.push(
      productSchema.parse({
        id,
        name: name[0].toUpperCase() + name.slice(1),
        category: profile.category,
        zone,
        temperature: guide?.temperature ?? zones[zone].temp,
        expiresOn: expiry.date ?? addDays(estimate, today),
        addedOn: today,
        amount,
        unit,
        price: 0,
        photo: inferPhoto(name, profile.category),
        visual: "photo",
        condition,
        notes: [
          "Добавлено через Telegram.",
          !expiry.date
            ? "Срок — ориентир; дата на упаковке имеет приоритет."
            : "Срок указан пользователем.",
          !qty
            ? "Количество не указано: 1 шт. / упаковка. Уточните при необходимости."
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        state: "active",
        archivedOn: null,
        demo: false,
      }),
    );
  }
  return { products, rejected, estimated };
}
