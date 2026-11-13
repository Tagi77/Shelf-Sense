import { addDays, dayKey, daysUntil, weightKg, type Product } from "./model";
import type { Lang, Unit } from "./catalog";
export type Portion = { productId: string; amount: number; unit: Unit };
export class InventoryConflict extends Error {}
const round = (n: number) => Math.round(n * 1000000) / 1000000;
export const unitLabel = (unit: Unit, lang: Lang) =>
  lang === "ru"
    ? { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "шт." }[unit]
    : unit;
export const amountLabel = (amount: number, unit: Unit, lang: Lang) =>
  `${new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB", { maximumFractionDigits: 3 }).format(amount)} ${unitLabel(unit, lang)}`;
export function usePortions(
  products: Product[],
  portions: Portion[],
  kind: "eaten" | "discarded",
  batchId: string,
  note = "",
  at = dayKey(),
): Product[] {
  if (products.some((p) => p.portions?.some((e) => e.batchId === batchId)))
    return products;
  if (
    !portions.length ||
    new Set(portions.map((p) => p.productId)).size !== portions.length
  )
    throw new InventoryConflict("Invalid selection");
  for (const entry of portions) {
    const p = products.find((p) => p.id === entry.productId);
    if (
      !p ||
      p.state !== "active" ||
      p.unit !== entry.unit ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0 ||
      entry.amount > p.amount
    )
      throw new InventoryConflict("Stock changed. Review quantities.");
  }
  return products.map((p) => {
    const entry = portions.find((x) => x.productId === p.id);
    if (!entry) return p;
    const amount = round(p.amount - entry.amount);
    const initialAmount = p.initialAmount ?? p.amount;
    const event = {
      id: `${batchId}:${p.id}`,
      batchId,
      kind,
      amount: entry.amount,
      value: (p.price * entry.amount) / initialAmount,
      kg: weightKg({ ...p, amount: entry.amount }),
      at,
      note: note.slice(0, 200),
    };
    return {
      ...p,
      initialAmount,
      amount,
      state: amount === 0 ? kind : "active",
      archivedOn: amount === 0 ? at : null,
      portions: [...(p.portions ?? []), event],
    };
  });
}
export function undoPortions(products: Product[], batchId: string): Product[] {
  const affected = products.filter((p) =>
    p.portions?.some((e) => e.batchId === batchId),
  );
  if (!affected.length) return products;
  // Undo only a latest operation, so it cannot overwrite later edits or cooking.
  if (affected.some((p) => p.portions?.at(-1)?.batchId !== batchId))
    throw new InventoryConflict("A later operation exists.");
  return products.map((p) => {
    const e = p.portions?.find((e) => e.batchId === batchId);
    return e
      ? {
          ...p,
          amount: round(p.amount + e.amount),
          state: "active",
          archivedOn: null,
          portions: p.portions!.filter((x) => x.batchId !== batchId),
        }
      : p;
  });
}
export function ledger(products: Product[]) {
  return products
    .flatMap((p) =>
      p.portions?.length
        ? p.portions.map((e) => ({ ...e, product: p }))
        : p.state !== "active"
          ? [
              {
                id: `legacy:${p.id}`,
                batchId: `legacy:${p.id}`,
                kind: p.state as "eaten" | "discarded",
                amount: p.amount,
                value: p.price,
                kg: weightKg(p),
                at: p.archivedOn ?? p.addedOn,
                note: "",
                product: p,
              },
            ]
          : [],
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}
export function weekStart(today = dayKey()) {
  const dow = new Date(`${today}T12:00:00`).getDay();
  return addDays(-((dow + 6) % 7), today);
}
export function weeklyWaste(
  products: Product[],
  today = dayKey(),
  includeDemo = false,
) {
  const records = ledger(products).filter(
    (e) => e.kind === "discarded" && (includeDemo || !e.product.demo),
  );
  const start = weekStart(today);
  return Array.from({ length: 8 }, (_, i) => {
    const from = addDays((i - 7) * 7, start),
      to = addDays(6, from);
    const entries = records.filter(
      (e) => e.at >= from && e.at <= to && e.at <= today,
    );
    return {
      from,
      to,
      value: entries.reduce((v, e) => v + e.value, 0),
      kg: entries.reduce((v, e) => v + e.kg, 0),
      entries,
      unpriced: entries.filter((e) => e.product.price === 0).length,
    };
  });
}
export function convertAmount(
  amount: number,
  from: Unit,
  to: Unit,
): number | null {
  if (from === to) return amount;
  if ((from === "kg" && to === "g") || (from === "l" && to === "ml"))
    return amount * 1000;
  if ((from === "g" && to === "kg") || (from === "ml" && to === "l"))
    return amount / 1000;
  return null; // A piece is not an exact weight; ask the cook instead of inventing it.
}
