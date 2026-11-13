const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { build } = require("esbuild");
(async () => {
  await build({
    entryPoints: ["app/lib/demo.ts"],
    outfile: "work/demo-fixture.mjs",
    bundle: true,
    platform: "node",
    format: "esm",
  });
  const { createDemo } = await import("../work/demo-fixture.mjs");
  const url = "http://127.0.0.1:5173";
  const b = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const fixture = { ...createDemo()[0], id: "legacy-kept", demo: false };
  const raw = JSON.stringify({ version: 2, products: [fixture] });
  const profile = async (ctx, suffix) => {
    const r = await ctx.request.post(url + "/api/auth/register", {
      headers: { origin: url },
      data: {
        nickname: "MigrationQA",
        email: `migration-${Date.now()}-${suffix}@example.com`,
        password: "OnlyForLocalTests!2026",
      },
    });
    assert.equal(r.status(), 200);
    return (await r.json()).user;
  };
  const ctx = await b.newContext();
  const user = await profile(ctx, "valid");
  const p = await ctx.newPage();
  await p.addInitScript((raw) => {
    if (!localStorage.getItem("qa-seeded")) {
      localStorage.clear();
      localStorage.setItem("shelf-sense.desktop.v2", raw);
      localStorage.setItem("qa-seeded", "1");
    }
  }, raw);
  await p.goto(url);
  await p.waitForSelector(".empty-kitchen");
  assert.deepEqual(
    (await (await ctx.request.get(url + "/api/pantry")).json()).products,
    [],
  );
  let values = await p.evaluate(() => ({ ...localStorage }));
  assert.equal(values["shelf-sense.desktop.v2"], raw);
  assert.equal(
    JSON.parse(values[`shelf-sense.desktop.v2.${user.id}`]).products.length,
    0,
  );
  const pantry = await (await ctx.request.get(url + "/api/pantry")).json();
  await ctx.request.put(url + "/api/pantry", {
    headers: { origin: url },
    data: { revision: pantry.revision, products: [fixture] },
  });
  await p.reload();
  await p.waitForSelector('[data-product-id="legacy-kept"]');
  const state = await ctx.storageState();
  const reopened = await b.newContext({ storageState: state });
  const freshPage = await reopened.newPage();
  await freshPage.goto(url);
  await freshPage.waitForSelector('[data-product-id="legacy-kept"]');
  assert.equal(
    (await (await reopened.request.get(url + "/api/pantry")).json()).products[0]
      .id,
    fixture.id,
  );
  await reopened.close();
  await ctx.request.post(url + "/api/auth/logout", {
    headers: { origin: url },
  });
  await profile(ctx, "second");
  await p.reload();
  await p.waitForSelector(".empty-kitchen");
  assert.equal(await p.locator('[data-product-id="legacy-kept"]').count(), 0);
  assert.equal(
    await p.evaluate(() => localStorage.getItem("shelf-sense.desktop.v2")),
    raw,
  );
  await ctx.close();
  const c = await b.newContext();
  await profile(c, "corrupt");
  const page = await c.newPage();
  const malformed = JSON.stringify({ version: 2, products: [{ bad: true }] });
  await page.addInitScript((raw) => {
    localStorage.clear();
    localStorage.setItem("shelf-sense.desktop.v2", raw);
  }, malformed);
  await page.goto(url);
  await page.waitForSelector(".empty-kitchen");
  assert.equal(await page.locator(".storage-error").count(), 0);
  assert.equal(await page.locator("[data-product-id]").count(), 0);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("shelf-sense.desktop.v2")),
    malformed,
  );
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) =>
        k.startsWith("shelf-sense.desktop.v2."),
      ),
    ),
    true,
  );
  await c.close();
  await b.close();
  console.log(
    "PASS: new accounts ignore unscoped legacy data; cloud inventory survives a fresh browser context; second account stays empty; malformed legacy data is preserved without blocking a new account.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
