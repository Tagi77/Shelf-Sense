const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.env.BASE_URL || "http://127.0.0.1:5173";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
(async () => {
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const errors = [],
    audits = [];
  const email = `business-${Date.now()}@example.com`;
  const password = "LocalPreview!2026";
  fs.mkdirSync("outputs/business-qa", { recursive: true });
  let registered = false;
  for (const width of process.env.TEST_WIDTHS
    ? process.env.TEST_WIDTHS.split(",").map(Number)
    : [320, 390, 430, 1440, 1920])
    for (const lang of ["ru", "en"]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        timezoneId: "Asia/Almaty",
        reducedMotion: width === 320 ? "reduce" : "no-preference",
      });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !m.text().includes("401 (Unauthorized)"))
          errors.push(m.text());
      });
      await page.addInitScript(
        (lang) => localStorage.setItem("shelf-lang", lang),
        lang,
      );
      await page.goto(url);
      await page.waitForFunction(() => {
        const b = document.querySelector(".auth-submit");
        return b && !b.disabled;
      });
      const audit = async (label) => {
        await page.waitForTimeout(150);
        const val = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          bg: getComputedStyle(document.body).backgroundColor,
          broken: [...document.images]
            .filter((i) => i.complete && i.naturalWidth === 0)
            .map((i) => i.src),
        }));
        assert.ok(
          val.scroll <= val.width + 1,
          `${width}/${lang}/${label} overflow ${val.scroll}`,
        );
        assert.equal(val.bg, "rgb(245, 246, 250)");
        assert.deepEqual(val.broken, []);
        audits.push({ width, lang, label, ...val });
      };
      await page.waitForTimeout(650);
      await audit("login");
      await page.screenshot({
        path: `outputs/business-qa/${width}-${lang}-login.png`,
      });
      if (registered) await page.locator(".auth-tabs button").nth(1).click();
      await page.locator("#nickname").fill("darbanov_8");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.locator(".auth-submit").click();
      await page.waitForSelector("[data-product-id]");
      registered = true;
      await page.waitForTimeout(450);
      assert.ok(
        (await page.locator(".personal-greeting").textContent()).includes(
          "darbanov_8",
        ),
      );
      assert.equal(await page.locator(".theme-button").count(), 0);
      await audit("dashboard");
      await page.screenshot({
        path: `outputs/business-qa/${width}-${lang}-dashboard.png`,
      });
      const state = () =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem(
                Object.keys(localStorage).find((k) =>
                  k.startsWith("shelf-sense.desktop.v2."),
                ),
              ),
            ).products,
        );
      await page
        .getByRole("button", {
          name: lang === "ru" ? "Добавить продукт" : "Add a product",
          exact: true,
        })
        .click();
      await page
        .locator("#product-name")
        .fill(lang === "ru" ? "Яблоки" : "Apples");
      await page.locator("#product-amount").fill("6");
      await page.locator("#product-price").fill("1200");
      assert.equal(
        await page.locator(".quantity-input select").inputValue(),
        "pcs",
      );
      await page.locator("#product-zone button").last().click();
      assert.ok(
        (
          await page
            .locator("#product-temperature [aria-pressed=true]")
            .textContent()
        ).includes("+15"),
      );
      await page.locator("#product-zone button").first().click();
      assert.ok(
        (
          await page
            .locator("#product-temperature [aria-pressed=true]")
            .textContent()
        ).includes("+2"),
      );
      await page.locator("#product-type button").nth(1).click();
      await page.locator("#product-condition button").nth(1).click();
      assert.equal(
        await page.locator("#product-expiry").getAttribute("type"),
        "date",
      );
      await audit("form");
      await page.screenshot({
        path: `outputs/business-qa/${width}-${lang}-form.png`,
      });
      if (width < 500) {
        await page.setViewportSize({ width, height: 430 });
        await page
          .locator("#product-notes")
          .fill("Testing the keyboard viewport");
        await page.waitForTimeout(180);
        const box = await page.locator(".modal-footer .primary").boundingBox();
        assert.ok(
          box.y >= 0 && box.y + box.height <= 430,
          `Save obscured ${JSON.stringify(box)}`,
        );
        await audit("keyboard-height");
      }
      await page.locator(".modal-footer .primary").click();
      await page.waitForSelector("dialog", { state: "detached" });
      await page.setViewportSize({ width, height: 900 });
      let p = (await state()).find(
        (p) => !p.demo && /Яблок|Apples/.test(p.name),
      );
      assert.ok(p);
      assert.equal(p.productType, "chilled");
      assert.equal(p.condition, "ripe");
      const card = page.locator(`[data-product-id="${p.id}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator("summary").click();
      assert.ok(await card.locator(".storage-tags").isVisible());
      await audit("card");
      await page.screenshot({
        path: `outputs/business-qa/${width}-${lang}-card.png`,
      });
      await card.locator(".eaten-button").click();
      await page.locator("#portion-amount").fill("2");
      await page.locator(".modal-footer .primary").click();
      await page.waitForSelector("dialog", { state: "detached" });
      assert.equal((await state()).find((x) => x.id === p.id).amount, 4);
      await card.locator(".discard-button").click();
      await page.locator("#portion-amount").fill("5");
      assert.ok(await page.locator(".modal-footer button").last().isDisabled());
      await page.locator("#portion-amount").fill("1");
      await page.locator(".modal-footer button").last().click();
      await page.waitForSelector("dialog", { state: "detached" });
      assert.equal((await state()).find((x) => x.id === p.id).amount, 3);
      await page.reload();
      await page.waitForSelector("[data-product-id]");
      assert.equal((await state()).find((x) => x.id === p.id).amount, 3);
      if (width < 500) {
        await page.locator(".bottom-nav button").nth(3).click();
      } else {
        await page.locator(".secondary-nav button").first().click();
      }
      assert.ok(
        (await page.locator(".waste-summary").textContent()).includes("200"),
      );
      await audit("history");
      await page.screenshot({
        path: `outputs/business-qa/${width}-${lang}-history.png`,
      });
      if (width === 1440 && lang === "ru") {
        await page.locator(".zone-nav button").first().click();
        await page.locator(".folder-trigger").first().click();
        await page.locator(".folder-files button").first().click();
        await page.waitForSelector("dialog");
        await page
          .getByRole("button", { name: "Закрыть", exact: true })
          .click();
        await page.locator(".recipe-card").first().click();
        const before = await state();
        await page
          .getByRole("button", {
            name: "Готово · списать продукты",
            exact: true,
          })
          .click();
        await page.waitForSelector("dialog", { state: "detached" });
        const after = await state();
        assert.ok(
          after.some(
            (x) => x.amount < before.find((y) => y.id === x.id).amount,
          ),
        );
        await page
          .locator(".toast")
          .getByRole("button", { name: "Отменить", exact: true })
          .click();
        assert.deepEqual(
          (await state()).map((x) => [x.id, x.amount]),
          before.map((x) => [x.id, x.amount]),
        );
        await page.locator("#assistant-question").fill("Как хранить зелень?");
        await page.getByRole("button", { name: "Отправить вопрос" }).click();
        await page.waitForSelector(".chat-bubble.assistant");
        assert.ok(
          (await page.locator(".chat-bubble.assistant").textContent()).includes(
            "справочник",
          ),
        );
        await page.getByRole("button", { name: "Выйти", exact: true }).click();
        await page.waitForSelector("#nickname");
        assert.equal(await page.locator("#email").inputValue(), email);
        assert.equal(
          await page.locator("#nickname").inputValue(),
          "darbanov_8",
        );
        await page.locator("#password").fill("IncorrectPassword");
        await page.locator(".auth-submit").click();
        await page.waitForSelector(".auth-card-content [role=alert]");
        assert.equal(await page.locator(".app-shell").count(), 0);
        await page.locator("#password").fill(password);
        await page.locator(".auth-submit").click();
        await page.waitForSelector("[data-product-id]").catch(async (e) => {
          console.log(
            "LOGIN FAILURE",
            await page.locator(".auth-card-content").innerText(),
          );
          throw e;
        });
        assert.equal((await state()).find((x) => x.id === p.id).amount, 3);
      }
      assert.equal(
        await page.evaluate(
          (p) => JSON.stringify(localStorage).includes(p),
          password,
        ),
        false,
      );
      await ctx.close();
      console.log(`PASS ${width}px ${lang}`);
    }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "outputs/business-qa/report.json",
    JSON.stringify({ audits, errors }, null, 2),
  );
  await browser.close();
  console.log(`${audits.length} audits passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
