import assert from "node:assert/strict";
import {
  blankProduct,
  productSchema,
  storedSchema,
  addDays,
  impact,
  dayKey,
} from "../app/lib/model";
import {
  usePortions,
  undoPortions,
  weeklyWaste,
  weekStart,
  convertAmount,
  ledger,
} from "../app/lib/inventory";
import { foodGuide } from "../app/lib/food-guide";
import { inferPhoto } from "../app/lib/catalog";
import { localDishes } from "../app/lib/local-kitchen";
import { createDemo } from "../app/lib/demo";
import { handleRequest } from "../server/worker";
const today = "2026-11-12";
const apple = {
  ...blankProduct(),
  id: "apple",
  name: "Яблоки",
  category: "produce" as const,
  photo: "apple",
  amount: 6,
  unit: "pcs" as const,
  price: 1200,
  zone: "shelf" as const,
  temperature: "chilled" as const,
  expiresOn: addDays(2, today),
};
assert.equal(
  storedSchema.parse({ version: 2, products: [apple] }).products[0].amount,
  6,
);
assert.equal(productSchema.safeParse({ ...apple, amount: 0 }).success, false);
let products = usePortions(
  [apple],
  [{ productId: "apple", amount: 2, unit: "pcs" }],
  "eaten",
  "batch1",
  "",
  today,
);
assert.equal(products[0].amount, 4);
assert.equal(impact(products).money, 400);
assert.equal(products[0].initialAmount, 6);
assert.deepEqual(
  usePortions(
    products,
    [{ productId: "apple", amount: 2, unit: "pcs" }],
    "eaten",
    "batch1",
  ),
  products,
);
products = usePortions(
  products,
  [{ productId: "apple", amount: 1, unit: "pcs" }],
  "discarded",
  "batch2",
  "",
  today,
);
assert.equal(weeklyWaste(products, today).at(-1)!.value, 200);
assert.equal(products[0].amount, 3);
assert.equal(ledger(products).length, 2);
assert.throws(() => undoPortions(products, "batch1"));
products = undoPortions(products, "batch2");
assert.equal(products[0].amount, 4);
assert.equal(weeklyWaste(products, today).at(-1)!.value, 0);
products = usePortions(
  products,
  [{ productId: "apple", amount: 4, unit: "pcs" }],
  "eaten",
  "batch3",
  "",
  today,
);
assert.equal(products[0].amount, 0);
assert.equal(products[0].state, "eaten");
assert.equal(impact(products).money, 1200);
assert.equal(productSchema.safeParse(products[0]).success, true);
assert.throws(() =>
  usePortions(
    [apple],
    [{ productId: "apple", amount: 7, unit: "pcs" }],
    "eaten",
    "bad",
  ),
);
assert.throws(() =>
  usePortions(
    [apple],
    [{ productId: "apple", amount: 1, unit: "g" }],
    "eaten",
    "bad",
  ),
);
const second = { ...apple, id: "second" };
assert.throws(() =>
  usePortions(
    [apple, second],
    [
      { productId: "apple", amount: 1, unit: "pcs" },
      { productId: "second", amount: 7, unit: "pcs" },
    ],
    "eaten",
    "bad",
  ),
);
const cooked = usePortions(
  [apple, second],
  [
    { productId: "apple", amount: 2, unit: "pcs" },
    { productId: "second", amount: 3, unit: "pcs" },
  ],
  "eaten",
  "cooked",
  "Fruit bowl",
  today,
);
assert.deepEqual(
  undoPortions(cooked, "cooked").map((p) => p.amount),
  [6, 6],
);
assert.equal(convertAmount(250, "g", "kg"), 0.25);
assert.equal(convertAmount(2, "pcs", "g"), null);
assert.equal(weekStart("2026-11-15"), "2026-11-09");
assert.equal(weekStart("2026-11-16"), "2026-11-16");
assert.equal(
  weeklyWaste([{ ...products[0], demo: true }], today).at(-1)!.value,
  0,
);
assert.equal(foodGuide("Морковь", "whole", "ru")!.daysMin, 7);
assert.equal(foodGuide("Морковь", "cut", "ru")!.daysMin, 2);
assert.equal(foodGuide("авокадо", "unripe", "ru")!.temperature, "room");
assert.equal(foodGuide("unknown non food", "whole", "ru"), null);
for (const [name, photo] of [
  ["яблоки", "apple"],
  ["banana", "banana"],
  ["огурец", "cucumber"],
  ["Морковь", "carrot"],
])
  assert.equal(inferPhoto(name, "produce"), photo);
const dishes = localDishes(createDemo(), "ru", dayKey());
assert.ok(dishes.length);
for (const d of dishes)
  for (const i of d.ingredients)
    assert.ok(
      i.amount <= createDemo().find((p) => p.id === i.productId)!.amount,
    );
assert.ok(
  localDishes(createDemo(), "ru", dayKey(), "без молока").every(
    (d) => !d.ingredients.some((i) => /молок/i.test(i.name)),
  ),
);
const request = (
  path: string,
  data?: unknown,
  extra: Record<string, string> = {},
) =>
  new Request("https://shelf.test/api/ai/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      "oai-authenticated-user-id": "test-user",
      Origin: "https://shelf.test",
      "Content-Type": "application/json",
      ...extra,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
const env = { OPENAI_API_KEY: "test-only-not-a-real-key" };
assert.equal(
  (await handleRequest(new Request("https://shelf.test/api/ai/status"), {}))
    .status,
  401,
);
assert.deepEqual(await (await handleRequest(request("status"), {})).json(), {
  connected: false,
  configured: false,
  reason: null,
  provider: "OpenAI",
  images: false,
});
assert.equal(
  (
    await handleRequest(
      request("guide", { name: "apple", lang: "en", condition: "whole" }),
      {},
    )
  ).status,
  503,
);
assert.equal(
  (
    await handleRequest(
      request("guide", { name: "apple" }, { Origin: "https://evil.test" }),
      env,
    )
  ).status,
  403,
);
let captured: any;
const original = globalThis.fetch;
const result = (data: unknown) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(data) }],
      },
    ],
  });
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(String(options?.body));
  assert.ok(
    new Headers(options?.headers).get("Authorization")?.includes("test-only"),
  );
  return result({
    name: "Apple",
    category: "produce",
    zone: "pantry",
    temperature: "room",
    daysMin: 300,
    daysMax: 300,
    tip: "unreliable",
    confidence: "estimate",
    unit: "pcs",
  });
};
let response = await handleRequest(
  request("guide", { name: "apple", lang: "en", condition: "whole" }),
  env,
);
assert.equal(response.status, 200);
let data: any = await response.json();
assert.equal(data.data.daysMin, 7);
assert.equal(captured.store, false);
assert.equal(captured.text.format.type, "json_schema");
const usable = {
  id: "apple",
  name: "apple",
  category: "produce",
  amount: 6,
  unit: "pcs",
  expiresOn: "2026-11-14",
  zone: "shelf",
  temperature: "chilled",
};
const dish = {
  id: "x",
  title: "Fruit",
  minutes: 5,
  reason: "Use apple",
  ingredients: [{ productId: "apple", name: "Apple", amount: 2, unit: "pcs" }],
  extras: [],
  steps: ["Wash and cut."],
  improvement: "Serve fresh.",
};
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(String(options?.body));
  return result({ message: "Idea", dishes: [dish] });
};
response = await handleRequest(
  request("kitchen", {
    products: [usable, { ...usable, id: "expired", expiresOn: "2026-11-11" }],
    lang: "en",
    today,
  }),
  env,
);
assert.equal(response.status, 200);
assert.equal(JSON.parse(captured.input).products.length, 1);
globalThis.fetch = async () =>
  result({
    message: "Bad",
    dishes: [
      { ...dish, ingredients: [{ ...dish.ingredients[0], amount: 99 }] },
    ],
  });
assert.equal(
  (
    await handleRequest(
      request("kitchen", { products: [usable], lang: "en", today }),
      env,
    )
  ).status,
  502,
);
globalThis.fetch = async () =>
  new Response("secret provider error", { status: 401 });
response = await handleRequest(
  request("advice", { products: [usable], lang: "en", today }),
  env,
);
assert.deepEqual(await response.json(), { error: "provider_access" });
globalThis.fetch = async () =>
  result({ message: "Store herbs chilled and dry." });
response = await handleRequest(
  request("chat", {
    products: [usable],
    lang: "en",
    today,
    prompt: "How to store herbs?",
    messages: [{ role: "user", content: "How to store herbs?" }],
  }),
  env,
);
assert.equal(response.status, 200);
assert.equal(
  ((await response.json()) as any).data.message,
  "Store herbs chilled and dry.",
);
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({ error: { code: "credit_balance_exhausted" } }),
    { status: 429 },
  );
response = await handleRequest(
  request("advice", { products: [usable], lang: "en", today }),
  env,
);
assert.deepEqual(await response.json(), { error: "provider_quota" });
assert.equal(
  ((await (await handleRequest(request("status"), env)).json()) as any).reason,
  "credits",
);
globalThis.fetch = original;
console.log(
  "PASS: legacy data, partial use/discard, cost allocation, atomic cooking, undo, weeks, guides, photo matching, local recipes and protected AI gateway.",
);
