import { z } from "zod";
import {
  photoIds,
  profileFor,
  temperatures,
  zones,
  type Category,
  type Temperature,
  type Zone,
} from "./catalog";
export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function addDays(days: number, base = dayKey()) {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}
export const daysUntil = (expiry: string, today = dayKey()) =>
  Math.round(
    (Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
export function freshness(expiry: string, today = dayKey()) {
  const days = daysUntil(expiry, today);
  return days < 0
    ? "expired"
    : days <= 2
      ? "urgent"
      : days <= 5
        ? "soon"
        : "fresh";
}
export const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  v >= "2000-01-01" &&
  v <= "2100-12-31" &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export const portionSchema = z.object({
  id: z.string().min(1),
  batchId: z.string().min(1),
  kind: z.enum(["eaten", "discarded"]),
  amount: z.number().positive(),
  value: z.number().nonnegative(),
  kg: z.number().nonnegative(),
  at: z.string().refine(validDate),
  note: z.string().max(200),
});
export const productSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    nameEn: z.string().max(100).optional(),
    category: z.enum(["dairy", "protein", "produce", "prepared", "pantry"]),
    zone: z.enum(["shelf", "fresh", "door", "drawer", "freezer", "pantry"]),
    temperature: z.enum(["fresh", "chilled", "cool", "room", "frozen"]),
    expiresOn: z.string().refine(validDate),
    addedOn: z.string().refine(validDate),
    amount: z.number().min(0).max(100000),
    initialAmount: z.number().positive().max(100000).optional(),
    portions: z.array(portionSchema).max(5000).optional(),
    productType: z.enum(["perishable", "chilled", "frozen", "dry"]).optional(),
    condition: z.enum(["whole", "ripe", "unripe", "cut", "opened"]).optional(),
    unit: z.enum(["g", "kg", "ml", "l", "pcs"]),
    price: z.number().min(0).max(10000000),
    photo: z
      .string()
      .refine((p) => p in photoIds || /^ai:[a-z0-9-]{1,100}$/.test(p)),
    visual: z.enum(["photo", "icon"]),
    notes: z.string().max(1000),
    state: z.enum(["active", "eaten", "discarded"]),
    archivedOn: z.string().nullable(),
    demo: z.boolean(),
  })
  .superRefine((p, ctx) => {
    if (p.state === "active" && p.amount <= 0)
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Active stock must be positive",
      });
    if (p.initialAmount !== undefined && p.amount > p.initialAmount + 0.000001)
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Remaining exceeds original quantity",
      });
  });
export type Product = z.infer<typeof productSchema>;
export const storedSchema = z.object({
  version: z.literal(2),
  products: z.array(productSchema).max(5000),
});
export type StoredData = z.infer<typeof storedSchema>;
export const STORAGE_KEY = "shelf-sense.desktop.v2";
export type Alert = {
  kind: "temperature" | "zone" | "door";
  level: "warning" | "advice";
  recommended: Temperature;
  zone?: Zone;
};
export function temperatureAlerts(
  p: Pick<Product, "name" | "category" | "zone" | "temperature" | "condition">,
): Alert[] {
  const profile = profileFor(p.name);
  const category = profile?.category ?? p.category;
  const cut = p.condition === "cut" || /нарез|разрез|cut|sliced/i.test(p.name);
  let recommended: Temperature =
    category === "protein"
      ? "fresh"
      : category === "pantry"
        ? "room"
        : category === "produce"
          ? "cool"
          : "chilled";
  let allowed: Temperature[] =
    category === "protein"
      ? ["fresh", "chilled", "frozen"]
      : category === "dairy" || category === "prepared"
        ? ["fresh", "chilled", "frozen"]
        : category === "pantry"
          ? ["room", "chilled", "frozen"]
          : ["fresh", "chilled", "cool", "frozen"];
  if (profile?.key === "tomato" && !cut) {
    recommended = "room";
    allowed = ["room", "cool", "chilled", "frozen"];
  }
  if (profile?.key === "avocado" && !cut) allowed.push("room");
  if (profile && ["banana", "potato", "onion"].includes(profile.key) && !cut) {
    recommended = "room";
    allowed = ["room", "chilled", "frozen"];
  }
  if (
    p.condition === "unripe" &&
    profile &&
    ["avocado", "pear", "banana", "tomato"].includes(profile.key) &&
    !cut
  ) {
    recommended = "room";
    if (!allowed.includes("room")) allowed.push("room");
  }
  if (
    cut ||
    profile?.key === "greens" ||
    profile?.key === "strawberry" ||
    profile?.key === "eggs"
  ) {
    recommended = "chilled";
    allowed = ["fresh", "chilled", "frozen"];
  }
  if (profile?.key === "eggs") allowed = ["fresh", "chilled"];
  const result: Alert[] = [];
  if (!allowed.includes(p.temperature))
    result.push({ kind: "temperature", level: "warning", recommended });
  const zoneAllowed: Record<Zone, Temperature[]> = {
    shelf: ["chilled"],
    fresh: ["fresh", "chilled"],
    door: ["chilled", "cool"],
    drawer: ["cool", "chilled"],
    freezer: ["frozen"],
    pantry: ["room"],
  };
  if (!zoneAllowed[p.zone].includes(p.temperature))
    result.push({
      kind: "zone",
      level: "warning",
      recommended: zones[p.zone].temp,
    });
  if (
    p.zone === "door" &&
    (category === "dairy" || category === "protein" || category === "prepared")
  )
    result.push({
      kind: "door",
      level: "advice",
      recommended: "chilled",
      zone: "shelf",
    });
  return result;
}
export function remainingPercent(p: Product, today = dayKey()) {
  const full = Math.max(1, daysUntil(p.expiresOn, p.addedOn));
  return Math.max(
    0,
    Math.min(100, (daysUntil(p.expiresOn, today) / full) * 100),
  );
}
export function weightKg(p: Product) {
  return p.unit === "kg" || p.unit === "l"
    ? p.amount
    : p.unit === "g" || p.unit === "ml"
      ? p.amount / 1000
      : (p.amount * (profileFor(p.name)?.grams ?? 100)) / 1000;
}
export function impact(products: Product[]) {
  const real = products.filter(
    (p) =>
      !p.demo &&
      (p.state === "eaten" || p.portions?.some((e) => e.kind === "eaten")),
  );
  const demo =
    real.length === 0 &&
    products.some(
      (p) =>
        p.demo &&
        (p.state === "eaten" || p.portions?.some((e) => e.kind === "eaten")),
    );
  const used = demo
    ? products.filter(
        (p) =>
          p.demo &&
          (p.state === "eaten" || p.portions?.some((e) => e.kind === "eaten")),
      )
    : real;
  return {
    money: used.reduce(
      (n, p) =>
        n +
        (p.portions?.length
          ? p.portions
              .filter((e) => e.kind === "eaten")
              .reduce((v, e) => v + e.value, 0)
          : p.price),
      0,
    ),
    kg: used.reduce(
      (n, p) =>
        n +
        (p.portions?.length
          ? p.portions
              .filter((e) => e.kind === "eaten")
              .reduce((v, e) => v + e.kg, 0)
          : weightKg(p)),
      0,
    ),
    count: used.length,
    demo,
  };
}
export function blankProduct(): Product {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "dairy",
    zone: "shelf",
    temperature: "chilled",
    expiresOn: addDays(5),
    addedOn: dayKey(),
    amount: 1,
    unit: "pcs",
    price: 0,
    photo: "milk-alt",
    visual: "photo",
    notes: "",
    state: "active",
    archivedOn: null,
    demo: false,
  };
}
