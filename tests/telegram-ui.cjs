const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const base = process.env.BASE_URL || "http://127.0.0.1:5173";
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  fs.mkdirSync("outputs/telegram-qa", { recursive: true });
  const results = [],
    errors = [];
  for (const width of [320, 390, 430, 1440])
    for (const lang of ["ru", "en"]) {
      const context = await browser.newContext({
          viewport: { width, height: 850 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        ({ lang, width }) => {
          localStorage.setItem("shelf-lang", lang);
          localStorage.setItem("shelf-theme", width === 390 ? "dark" : "light");
        },
        { lang, width },
      );
      const register = await context.request.post(base + "/api/auth/register", {
        headers: { origin: base },
        data: {
          nickname: "TelegramQA",
          email: `tg-${width}-${lang}-${Date.now()}@example.com`,
          password: "LocalTelegram!2026",
        },
      });
      assert.equal(register.status(), 200);
      await page.goto(base);
      await page.waitForSelector("[data-product-id]");
      if (width < 500) await page.locator(".bottom-nav button").last().click();
      else
        await page
          .getByRole("button", {
            name: lang === "ru" ? "Telegram-бот" : "Telegram bot",
            exact: true,
          })
          .click();
      await page.waitForSelector(".telegram-connect");
      const connect = page.getByRole("button", {
        name: lang === "ru" ? "Связать аккаунт" : "Connect account",
        exact: true,
      });
      await connect.click();
      const link = page.locator(".telegram-connect a.primary");
      await link.waitFor();
      const href = await link.getAttribute("href");
      const u = new URL(href);
      assert.equal(u.hostname, "t.me");
      assert.match(u.searchParams.get("start"), /^[a-f0-9]{48}$/);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(
        await page
          .locator("dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      const box = await link.boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44);
      await page.screenshot({
        path: `outputs/telegram-qa/${width}-${lang}.png`,
      });
      await page
        .getByRole("button", {
          name: lang === "ru" ? "Закрыть" : "Close",
          exact: true,
        })
        .click();
      // Simulate another authenticated client updating the same cloud pantry.
      const snapshot = await (
        await context.request.get(base + "/api/pantry")
      ).json();
      const product = {
        ...snapshot.products.find((p) => p.state === "active"),
        id: "cloud-shared",
        name: lang === "ru" ? "Общее яблоко" : "Shared apple",
        nameEn: "Shared apple",
        photo: "apple",
        category: "produce",
        amount: 4,
        unit: "pcs",
        demo: false,
        price: 800,
        portions: [],
        initialAmount: 4,
      };
      assert.equal(
        (
          await context.request.put(base + "/api/pantry", {
            headers: { origin: base },
            data: {
              revision: snapshot.revision,
              products: [product, ...snapshot.products],
            },
          })
        ).status(),
        200,
      );
      await page.waitForSelector('[data-product-id="cloud-shared"]', {
        timeout: 12000,
      });
      const latest = await (
        await context.request.get(base + "/api/pantry")
      ).json();
      const change = latest.products.map((p) =>
        p.id === "cloud-shared" ? { ...p, amount: 3 } : p,
      );
      assert.equal(
        (
          await context.request.put(base + "/api/pantry", {
            headers: { origin: base },
            data: { revision: latest.revision, products: change },
          })
        ).status(),
        200,
      );
      await page.waitForFunction(
        () => {
          const k = Object.keys(localStorage).find(
            (k) =>
              k.startsWith("shelf-sense.desktop.v2.") &&
              !k.endsWith(".pre-cloud"),
          );
          return (
            JSON.parse(localStorage.getItem(k)).products.find(
              (p) => p.id === "cloud-shared",
            )?.amount === 3
          );
        },
        { timeout: 12000 },
      );
      const second = await context.newPage();
      await second.goto(base);
      await second.waitForSelector('[data-product-id="cloud-shared"]');
      assert.ok(
        (
          await second.locator('[data-product-id="cloud-shared"]').innerText()
        ).includes("3"),
      );
      results.push({
        width,
        lang,
        overflow: false,
        link: true,
        cloudRefresh: true,
      });
      await context.close();
    }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "outputs/telegram-qa/report.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
  console.log(
    `${results.length} Telegram responsive and shared-inventory checks passed.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
