const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const url = "http://127.0.0.1:5173";
  const b = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const c = await b.newContext({ viewport: { width: 390, height: 850 } });
  const r = await c.request.post(url + "/api/auth/register", {
    headers: { origin: url },
    data: {
      nickname: "RetryQA",
      email: `retry-${Date.now()}@example.com`,
      password: "LocalRetry!2026",
    },
  });
  assert.equal(r.status(), 200);
  const p = await c.newPage();
  await p.goto(url);
  await p.waitForSelector(".empty-kitchen");
  await p.locator(".demo-button").click();
  await p.waitForSelector("[data-product-id]");
  const get = async () => (await c.request.get(url + "/api/pantry")).json();
  let snapshot = await get();
  const product = {
    ...snapshot.products.find((p) => p.state === "active"),
    id: "retry-item",
    name: "Яблоки",
    nameEn: "Apples",
    photo: "apple",
    category: "produce",
    amount: 4,
    unit: "pcs",
    demo: false,
    price: 800,
    portions: [],
    initialAmount: 4,
  };
  await c.request.put(url + "/api/pantry", {
    headers: { origin: url },
    data: { revision: snapshot.revision, products: [product] },
  });
  await p.reload();
  await p.waitForSelector('[data-product-id="retry-item"]');
  await p.locator(".eaten-button").click();
  await p.locator("#portion-amount").fill("1");
  let interrupted = false;
  await p.route("**/api/pantry", async (route) => {
    if (route.request().method() === "PUT" && !interrupted) {
      interrupted = true;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await p.locator(".modal-footer .primary").click();
  await p.waitForSelector(".portion-modal .field-error");
  assert.equal((await get()).products[0].amount, 3);
  await p.locator(".modal-footer .primary").click();
  await p.waitForSelector(".portion-modal", { state: "detached" });
  assert.equal((await get()).products[0].amount, 3);
  assert.equal((await get()).products[0].portions.length, 1);
  await b.close();
  console.log(
    "PASS: lost HTTP save response followed by retry deducts one portion exactly once.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
