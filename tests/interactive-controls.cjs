const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const errors = [];
  for (const width of [320, 390, 430, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem("shelf-theme", "dark");
      localStorage.setItem("shelf-lang", "ru");
    });
    await page.goto("http://127.0.0.1:5173");
    await page.locator("#nickname").fill("Tester");
    await page
      .locator("#email")
      .fill(`controls-${width}-${Date.now()}@example.com`);
    await page.locator("#password").fill("LocalControls!2026");
    await page.locator(".auth-submit").click();
    await page.waitForSelector(".gf-hit");
    await page.locator(".gf-hit").first().focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".folder-files button");
    await page.waitForTimeout(700);
    assert.equal(
      await page.locator(".gf-hit").first().getAttribute("aria-expanded"),
      "true",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `outputs/interactive-qa/${width}-open-folder.png`,
    });
    await page.locator(".folder-files button").first().click();
    await page.waitForSelector("dialog");
    await page.getByRole("button", { name: "Закрыть", exact: true }).click();
    await page.locator(".storage-folder-foot button").nth(2).click();
    assert.ok(
      (await page.locator(".breadcrumb strong").textContent()).includes(
        "Морозилка",
      ),
    );
    await page.locator(".notification-button").click();
    const first = await page.locator(".notification-card").textContent();
    await page.getByRole("button", { name: "Следующее сообщение" }).click();
    await page.waitForTimeout(650);
    assert.notEqual(
      await page.locator(".notification-card").textContent(),
      first,
    );
    await page.locator(".notification-card").click();
    await page.waitForSelector(".product-modal");
    await page.getByRole("button", { name: "Закрыть", exact: true }).click();
    // The request assertion below uses a deterministic UI fixture; real provider calls are verified separately.
    let chat = [];
    await page.route("**/api/ai/status", (r) =>
      r.fulfill({
        json: {
          connected: true,
          configured: true,
          provider: "Gemini",
          images: true,
        },
      }),
    );
    await page.route("**/api/ai/chat", (r) => {
      chat.push(r.request().postDataJSON());
      return r.fulfill({
        json: { data: { message: "Проверенный ответ помощника." } },
      });
    });
    await page.route("**/api/ai/kitchen", (r) =>
      r.fulfill({ json: { data: { message: "", dishes: [] } } }),
    );
    await page.route("**/api/ai/advice", (r) =>
      r.fulfill({
        json: {
          data: {
            title: "Совет",
            tips: ["Используйте продукты с ближайшим сроком."],
          },
        },
      }),
    );
    await page.reload();
    await page.waitForSelector(".ai-connection");
    await page.waitForFunction(() =>
      document.querySelector(".ai-connection")?.textContent.includes("Gemini"),
    );
    await page
      .getByRole("button", { name: "Идеи вопросов", exact: true })
      .click();
    await page.locator(".composer-prompts button").first().click();
    assert.ok(await page.locator("#assistant-question").inputValue());
    await page
      .getByRole("button", { name: "Учитывать мои продукты", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Отправить вопрос", exact: true })
      .click();
    await page.waitForSelector(".chat-bubble.assistant");
    assert.equal(chat[0].products.length, 0);
    await page
      .getByRole("button", { name: "Учитывать мои продукты", exact: true })
      .click();
    await page.locator("#assistant-question").fill("Что на моей кухне?");
    await page
      .getByRole("button", { name: "Отправить вопрос", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".chat-bubble.assistant").length === 2,
    );
    assert.ok(chat[1].products.length > 0);
    await page.screenshot({
      path: `outputs/interactive-qa/${width}-composer.png`,
    });
    assert.equal(
      await page.evaluate(() => localStorage.getItem("shelf-theme")),
      "dark",
    );
    await context.close();
    console.log(`PASS controls ${width}`);
  }
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
