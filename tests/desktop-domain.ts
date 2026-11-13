import assert from "node:assert/strict";
import {
  addDays,
  daysUntil,
  freshness,
  temperatureAlerts,
  remainingPercent,
  impact,
  productSchema,
  storedSchema,
} from "../app/lib/model";
import { createDemo, mergeDemo } from "../app/lib/demo";
import { inferPhoto } from "../app/lib/catalog";
import { rankRecipes } from "../app/lib/recipes";
const today = "2026-11-12";
const demo = createDemo(today);
const active = demo.filter((p) => p.state === "active");
for (const [days, state] of [
  [-1, "expired"],
  [0, "urgent"],
  [2, "urgent"],
  [3, "soon"],
  [5, "soon"],
  [6, "fresh"],
] as const)
  assert.equal(freshness(addDays(days, today), today), state);
assert.equal(daysUntil("2028-03-01", "2028-02-28"), 2);
assert.equal(daysUntil("2026-03-09", "2026-03-08"), 1);
assert.equal(active.length, 11);
assert.equal(mergeDemo(demo, today).length, demo.length);
assert.equal(
  storedSchema.safeParse({ version: 2, products: demo }).success,
  true,
);
assert.equal(inferPhoto("Филе лосося", "protein"), "salmon-fillet");
assert.equal(inferPhoto("Greek milk", "dairy"), "milk-alt");
assert.equal(inferPhoto("новый овощ", "produce"), "avocado");
for (const category of ["dairy", "protein", "prepared"] as const)
  assert(
    temperatureAlerts({
      name: "Test",
      category,
      zone: "pantry",
      temperature: "room",
    }).some((a) => a.kind === "temperature"),
  );
assert(
  temperatureAlerts({
    name: "Курица",
    category: "protein",
    zone: "shelf",
    temperature: "cool",
  }).some((a) => a.kind === "temperature"),
);
assert.equal(
  temperatureAlerts({
    name: "Томаты",
    category: "produce",
    zone: "pantry",
    temperature: "room",
  }).length,
  0,
);
assert(
  temperatureAlerts({
    name: "Нарезанные томаты",
    category: "produce",
    zone: "pantry",
    temperature: "room",
  }).some((a) => a.kind === "temperature"),
);
assert(
  temperatureAlerts({
    name: "Молоко",
    category: "dairy",
    zone: "door",
    temperature: "chilled",
  }).some((a) => a.kind === "door"),
);
assert(
  temperatureAlerts({
    name: "Филе лосося",
    category: "protein",
    zone: "freezer",
    temperature: "chilled",
  }).some((a) => a.kind === "zone"),
);
assert(
  temperatureAlerts({
    name: "Яйца",
    category: "dairy",
    zone: "freezer",
    temperature: "frozen",
  }).some((a) => a.kind === "temperature"),
);
const ranks = rankRecipes(demo, today);
assert(ranks.length >= 3);
assert(ranks.every((r) => r.urgent.length > 0));
const unsafe = demo.map((p) => ({ ...p, expiresOn: addDays(-1, today) }));
assert.equal(rankRecipes(unsafe, today).length, 0);
const misStored = demo.map((p) => ({
  ...p,
  zone: "pantry" as const,
  temperature: "frozen" as const,
}));
assert.equal(rankRecipes(misStored, today).length, 0);
assert.equal(impact(demo).money, 2480);
assert.equal(impact(demo).kg, 2);
assert.equal(impact(demo).demo, true);
const real = {
  ...demo[0],
  id: "real",
  demo: false,
  state: "eaten" as const,
  amount: 500,
  price: 2000,
};
assert.equal(impact([...demo, real]).money, 2000);
assert.equal(impact([...demo, real]).kg, 0.5);
assert.equal(impact([...demo, real]).demo, false);
assert.equal(
  remainingPercent({ ...demo[0], expiresOn: addDays(-1, today) }, today),
  0,
);
assert.equal(productSchema.safeParse({ ...demo[0], amount: 0 }).success, false);
assert.equal(
  productSchema.safeParse({ ...demo[0], expiresOn: "2026-02-30" }).success,
  false,
);
console.log(
  "Passed expiry boundaries, temperature/zone rules, food matching, demo idempotence, local schema, impact and recipe exclusion assertions.",
);
