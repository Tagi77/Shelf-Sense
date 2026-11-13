const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const base = "http://127.0.0.1:5173",
    browser = await chromium.launch({
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });
  fs.mkdirSync("outputs/fresh-kitchen", { recursive: true });
  const results = [],
    errors = [];
  for (const width of (process.env.TEST_WIDTHS || "320,390,430,1440")
    .split(",")
    .map(Number))
    for (const lang of ["ru", "en"])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
            viewport: { width, height: 900 },
            timezoneId: "Asia/Almaty",
            reducedMotion: width === 320 ? "reduce" : "no-preference",
          }),
          page = await context.newPage();
        page.on("pageerror", (e) => errors.push(e.message));
        await page.clock.setFixedTime(new Date("2026-11-14T10:00:00+05:00"));
        await page.addInitScript(
          ({ lang, theme }) => {
            localStorage.setItem("shelf-lang", lang);
            localStorage.setItem("shelf-theme", theme);
            localStorage.setItem(
              "shelf-sense.desktop.v2",
              JSON.stringify({
                version: 2,
                products: [{ name: "OTHER ACCOUNT LEGACY" }],
              }),
            );
          },
          { lang, theme },
        );
        const audit = async (label) => {
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${width}/${lang}/${theme} ${label} overflow`,
          );
          const d = page.locator("dialog[open]");
          if (await d.count())
            assert.ok(
              await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
              `${label} dialog overflow`,
            );
        };
        const email = `fresh-${width}-${lang}-${theme}-${Date.now()}@example.com`,
          password = "FreshKitchen!2026";
        await page.goto(base);
        await page.locator("#nickname").fill("TasteTester");
        await page.locator("#email").fill(email);
        await page.locator("#password").fill(password);
        await page.locator(".auth-submit").click();
        await page.waitForSelector(".empty-kitchen");
        await audit("empty");
        const get = async () =>
          (await context.request.get(base + "/api/pantry")).json();
        assert.deepEqual((await get()).products, []);
        assert.equal(await page.locator("[data-product-id]").count(), 0);
        assert.equal(await page.locator(".assistant-panel").count(), 0);
        assert.equal(await page.locator(".storage-tile").count(), 4);
        await page.screenshot({
          path: `outputs/fresh-kitchen/${width}-${lang}-${theme}-empty.png`,
        });
        await page
          .getByRole("button", {
            name:
              lang === "ru" ? "Добавить первый продукт" : "Add your first item",
            exact: true,
          })
          .click();
        await page
          .locator("#product-name")
          .fill(lang === "ru" ? "Филе лосося" : "Salmon fillet");
        await page.locator("#product-added").fill("2026-11-10");
        await page.locator(".date-chips button").nth(2).click();
        assert.equal(
          await page.locator("#product-expiry").inputValue(),
          "2026-11-17",
        );
        await page.locator("#product-amount").fill("600");
        await page.locator(".quantity-input select").selectOption("g");
        if (width < 500) {
          await page.setViewportSize({ width, height: 430 });
          await page.locator("#product-notes").fill("Fresh fish");
          await page.locator(".modal-footer .primary").scrollIntoViewIfNeeded();
          const box = await page
            .locator(".modal-footer .primary")
            .boundingBox();
          assert.ok(box.y >= 0 && box.y + box.height <= 431);
          await audit("keyboard");
        }
        await page.locator(".modal-footer .primary").click();
        await page.waitForSelector(".product-modal", { state: "detached" });
        await page.setViewportSize({ width, height: 900 });
        await page.waitForSelector("[data-product-id]");
        let snapshot = await get(),
          fish = snapshot.products[0];
        assert.equal(fish.expiresOn, "2026-11-17");
        assert.equal(fish.addedOn, "2026-11-10");
        assert.ok(
          (await page.locator("[data-product-id]").innerText()).includes(
            lang === "ru" ? "Ещё 3 дн." : "3 days left",
          ),
        );
        await audit("card");
        // Give each storage zone an item, and nine messages for the dismiss-count test.
        const foods = Array.from({ length: 9 }, (_, i) => ({
          ...fish,
          id: `fixture-${i}`,
          name: `${lang === "ru" ? "Лосось" : "Salmon"} ${i + 1}`,
          zone: ["shelf", "fresh", "freezer", "pantry"][i % 4],
          temperature: ["chilled", "fresh", "frozen", "room"][i % 4],
          demo: false,
        }));
        // Avoid storage mismatch notices in the exact-count fixture; these all use the fresh zone.
        const notesFoods = foods.map((p) => ({
          ...p,
          zone: "fresh",
          temperature: "fresh",
        }));
        assert.equal(
          (
            await context.request.put(base + "/api/pantry", {
              headers: { origin: base },
              data: { revision: snapshot.revision, products: notesFoods },
            })
          ).status(),
          200,
        );
        await page.reload();
        await page.waitForSelector('[data-product-id="fixture-0"]');
        await page.locator(".notification-button").click();
        await page.waitForSelector(".notification-player");
        assert.equal(
          (await page.locator(".notification-player>span").innerText()).trim(),
          "1 / 9",
        );
        await page
          .getByRole("button", {
            name: lang === "ru" ? "Прочитал · убрать" : "Read · dismiss",
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () =>
            document
              .querySelector(".notification-player>span")
              ?.textContent.trim() === "1 / 8",
        );
        await audit("notifications");
        await page.screenshot({
          path: `outputs/fresh-kitchen/${width}-${lang}-${theme}-notification.png`,
        });
        await page
          .locator(".notifications-modal .modal-heading .icon-button")
          .click();
        await page.reload();
        await page.waitForSelector(".notification-button");
        await page.locator(".notification-button").click();
        await page.waitForFunction(
          () =>
            document
              .querySelector(".notification-player>span")
              ?.textContent.trim() === "1 / 8",
        );
        await page
          .locator(".notifications-modal .modal-heading .icon-button")
          .click();
        snapshot = await get();
        await context.request.put(base + "/api/pantry", {
          headers: { origin: base },
          data: { revision: snapshot.revision, products: foods },
        });
        await page.reload();
        await page.waitForSelector(".storage-tile-open");
        const routes = ["fridge", "fresh", "freezer", "pantry"];
        for (let i = 0; i < 4; i++) {
          await page.locator(".storage-tile-open").nth(i).click();
          await page.waitForFunction(
            (expected) => location.hash === `#${expected}`,
            routes[i],
          );
          await page.waitForSelector(".zone-page-intro");
          const ids = await page
            .locator("[data-product-id]")
            .evaluateAll((es) => es.map((e) => e.dataset.productId));
          assert.ok(ids.length > 0);
          assert.ok(ids.every((id) => Number(id.split("-")[1]) % 4 === i));
          await audit("zone");
          await page.locator(".zone-back").click();
          await page.waitForSelector(".storage-tile-open");
        }
        await page.locator(".storage-tile-open").nth(2).click();
        await page.reload();
        await page.waitForSelector(".zone-page-intro");
        assert.equal(await page.locator("[data-product-id]").count(), 2);
        await page.goBack();
        await page.waitForSelector(".storage-tile-open");
        await page.locator(".robot-launcher").click();
        await page.waitForSelector(".robot-drawer[open]");
        await page.locator(".robot-tabs button").nth(1).click();
        await page
          .locator("#chef-request")
          .fill(lang === "ru" ? "Ужин с рыбой" : "Fish for dinner");
        await audit("robot");
        const contrast = await page.locator("#chef-request").evaluate((el) => {
          const s = getComputedStyle(el);
          const lum = (c) => {
            const a = c
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((n) => {
                n /= 255;
                return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
              });
            return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
          };
          const a = lum(s.color),
            b = lum(s.backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        assert.ok(contrast >= 4.5, `contrast ${contrast}`);
        await page.screenshot({
          path: `outputs/fresh-kitchen/${width}-${lang}-${theme}-robot.png`,
        });
        await page.locator(".robot-tabs button").first().click();
        await page
          .locator("#assistant-question")
          .fill(lang === "ru" ? "Как хранить рыбу?" : "How to store fish?");
        await page.locator(".chat-send").click();
        await page.waitForSelector(".chat-bubble.assistant");
        assert.ok(
          (await page.locator(".chat-bubble.assistant").innerText()).length >
            15,
        );
        await page.locator(".robot-drawer .modal-heading .icon-button").click();
        await page.clock.setFixedTime(new Date("2026-11-15T10:00:00+05:00"));
        await page.evaluate(() =>
          document.dispatchEvent(new Event("visibilitychange")),
        );
        await page.waitForFunction(
          (expected) =>
            document
              .querySelector("[data-product-id]")
              ?.textContent.includes(expected),
          lang === "ru" ? "Ещё 2 дн." : "2 days left",
        );
        if (width === 320 && lang === "ru" && theme === "light") {
          await page.locator(".profile-button").click();
          await page.waitForSelector("#nickname");
          await page.locator("#password").fill(password);
          await page.locator(".auth-submit").click();
          await page.waitForSelector("[data-product-id]");
          assert.equal((await get()).products.length, 9);
        }
        results.push({
          width,
          lang,
          theme,
          emptyAccount: true,
          expiry: true,
          dismiss: true,
          zones: true,
          robot: true,
          contrast,
        });
        await context.close();
        console.log(`PASS ${width} ${lang} ${theme}`);
      }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "outputs/fresh-kitchen/report.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
  console.log(`${results.length} complete kitchen scenarios passed.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
