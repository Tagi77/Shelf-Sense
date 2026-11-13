const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.env.BASE_URL || "http://127.0.0.1:5173";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
const dir = "outputs/portions-qa";
fs.mkdirSync(dir, { recursive: true });
const localDay = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(
    new Date(),
  );
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const errors = [];
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Almaty",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector("[data-product-id]");
  const state = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("shelf-sense.desktop.v2")).products,
    );
  assert.equal(
    await page.getByRole("button", { name: "Источники", exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Добавить продукт", exact: true })
    .click();
  await page.locator("#product-name").fill("Яблоки");
  await page.locator("#product-amount").fill("6");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Единица измерения", exact: true })
      .inputValue(),
    "pcs",
  );
  assert.equal(
    await page.locator(".photo-preview img").getAttribute("src"),
    "/images/apple.jpg",
  );
  await page
    .getByRole("button", {
      name: "Применить условия и короткий срок",
      exact: true,
    })
    .click();
  assert.equal(await page.locator("#product-zone").inputValue(), "shelf");
  await page.locator("#product-price").fill("1200");
  await page.screenshot({ path: path.join(dir, "product-guide.png") });
  await page
    .getByRole("button", { name: "Добавить на полку", exact: true })
    .click();
  await page.waitForSelector("dialog", { state: "detached" });
  let products = await state();
  const apple = products.find((p) => p.name === "Яблоки");
  assert.ok(apple);
  const card = page.locator(`[data-product-id="${apple.id}"]`);
  await card.getByRole("button", { name: "Съедено", exact: true }).click();
  await page.locator("#portion-amount").fill("2");
  await page.screenshot({ path: path.join(dir, "partial-portion.png") });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.waitForSelector("dialog", { state: "detached" });
  assert.equal((await state()).find((p) => p.id === apple.id).amount, 4);
  assert.ok((await card.textContent()).includes("Осталось: 4 шт."));
  assert.ok((await card.textContent()).includes("Использовано: 2 шт."));
  await page.reload();
  await page.waitForSelector("[data-product-id]");
  assert.equal((await state()).find((p) => p.id === apple.id).amount, 4);
  await card.getByRole("button", { name: "Выбросить", exact: true }).click();
  await page.locator("#portion-amount").fill("5");
  assert.equal(
    await page
      .getByRole("button", { name: "Сохранить", exact: true })
      .isDisabled(),
    true,
  );
  await page.locator("#portion-amount").fill("1");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  assert.equal((await state()).find((p) => p.id === apple.id).amount, 3);
  await page
    .getByRole("button", { name: "Потери по неделям", exact: true })
    .click();
  await page.waitForSelector(".waste-panel");
  assert.ok(
    (await page.locator(".waste-summary").textContent()).includes("200"),
  );
  await page.screenshot({ path: path.join(dir, "weekly-losses.png") });
  await page
    .getByRole("button", { name: "История продуктов", exact: true })
    .click();
  assert.equal(
    await page.locator(".history-entry").filter({ hasText: "Яблоки" }).count(),
    2,
  );
  await page
    .locator(".history-entry")
    .filter({ hasText: "Яблоки" })
    .filter({ hasText: "Выброшено" })
    .getByRole("button", { name: "Отменить", exact: true })
    .click();
  assert.equal((await state()).find((p) => p.id === apple.id).amount, 4);
  await page.getByRole("button", { name: /Все зоны/ }).click();
  await page.locator(".recipe-card").first().click();
  await page.waitForSelector(".cooking-modal");
  const before = await state();
  const inputs = page.locator(".cooking-ingredients input");
  for (let i = 0; i < (await inputs.count()); i++)
    await inputs.nth(i).fill("1");
  await page.screenshot({ path: path.join(dir, "cooking.png") });
  await page
    .getByRole("button", { name: "Готово · списать продукты", exact: true })
    .click();
  await page.waitForSelector("dialog", { state: "detached" });
  const after = await state();
  const changed = after.filter(
    (p) => p.amount !== before.find((b) => b.id === p.id).amount,
  );
  assert.ok(changed.length >= 2);
  for (const p of changed)
    assert.equal(before.find((b) => b.id === p.id).amount - p.amount, 1);
  await page
    .locator(".toast")
    .getByRole("button", { name: "Отменить", exact: true })
    .click();
  assert.deepEqual(
    (await state()).map((p) => p.amount),
    before.map((p) => p.amount),
  );
  await card.getByRole("button", { name: "Съедено", exact: true }).click();
  await page.getByRole("button", { name: "Всё", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  assert.equal((await state()).find((p) => p.id === apple.id).state, "eaten");
  assert.equal((await state()).find((p) => p.id === apple.id).amount, 0);
  await page.getByRole("button", { name: /Локальный режим/ }).click();
  assert.ok(
    (await page.locator("dialog").textContent()).includes(
      "Всё готово к подключению",
    ),
  );
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  const audits = [];
  async function audit(label) {
    await page.waitForTimeout(120);
    const result = await page.evaluate(() => ({
      overflow:
        document.documentElement.scrollWidth > innerWidth ||
        [
          ...document.querySelectorAll(
            "dialog,.modal-scroll,.recipe-modal-scroll",
          ),
        ].some((e) => e.scrollWidth > e.clientWidth + 1),
      broken: [...document.images]
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => i.src),
      animations: document.getAnimations().length,
    }));
    assert.equal(result.overflow, false, label);
    assert.deepEqual(result.broken, [], label);
    assert.equal(result.animations, 0);
    audits.push({ label, ...result });
  }
  for (const width of [1440, 1920, 320, 390, 430])
    for (const lang of ["ru", "en"]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await page
        .getByRole("button", { name: lang.toUpperCase(), exact: true })
        .click();
      await audit(`${width}-${lang}-inventory`);
      await page
        .getByRole("button", {
          name: lang === "ru" ? "Добавить продукт" : "Add a product",
          exact: true,
        })
        .click();
      await page
        .locator("#product-name")
        .fill(lang === "ru" ? "Морковь" : "Carrots");
      await page.locator("#product-condition").selectOption("cut");
      await audit(`${width}-${lang}-form`);
      await page.screenshot({
        path: path.join(dir, `${width}-${lang}-form.png`),
      });
      await page
        .getByRole("button", {
          name: lang === "ru" ? "Добавить на полку" : "Add to shelf",
          exact: true,
        })
        .click();
      await page.waitForSelector("dialog", { state: "detached" });
      await audit(`${width}-${lang}-saved`);
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await page.getByRole("button", { name: "Тёмная тема", exact: true }).click();
  await audit("1440-dark");
  await page.screenshot({ path: path.join(dir, "dark.png") });
  assert.deepEqual(errors, []);
  // Mock the API boundary, not application state: exercise the connected UI without a paid key.
  const aiCtx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Almaty",
  });
  const ai = await aiCtx.newPage();
  let imageCalls = 0;
  await ai.route("**/api/ai/**", async (route) => {
    const r = route.request();
    const action = new URL(r.url()).pathname.split("/").pop();
    if (action === "status")
      return route.fulfill({ json: { connected: true } });
    if (action === "guide") {
      const body = r.postDataJSON();
      return route.fulfill({
        json: {
          data: {
            name: body.name,
            category: "produce",
            zone: "shelf",
            temperature: "chilled",
            daysMin: 3,
            daysMax: 5,
            tip: "Спелый манго храните охлаждённым.",
            confidence: "estimate",
            unit: "pcs",
          },
        },
      });
    }
    if (action === "image") {
      imageCalls++;
      return route.fulfill({
        json: {
          image:
            "data:image/jpeg;base64," +
            fs.readFileSync("public/images/orange.jpg").toString("base64"),
        },
      });
    }
    if (action === "advice")
      return route.fulfill({
        json: {
          data: {
            title: "Совет ИИ",
            tips: ["Используйте продукты с ближайшими сроками."],
          },
        },
      });
    if (action === "kitchen") {
      const data = r.postDataJSON();
      const p =
        data.products.find((p) => p.name.includes("лосося")) ||
        data.products[0];
      return route.fulfill({
        json: {
          data: {
            message: "Учитываю ваши пожелания.",
            dishes: [
              {
                id: "mock-recipe",
                title: "Блюдо по вашему запросу",
                minutes: 20,
                reason: "Сначала ближайший срок.",
                ingredients: [
                  { productId: p.id, name: p.name, amount: 1, unit: p.unit },
                ],
                extras: ["Лимон по желанию"],
                steps: [
                  "Подготовьте ингредиенты.",
                  "Приготовьте до готовности.",
                ],
                improvement: "Добавьте зелень.",
              },
            ],
          },
        },
      });
    }
    return route.abort();
  });
  await ai.goto(url);
  await ai.waitForSelector("[data-product-id]");
  await ai
    .getByRole("button", { name: "Добавить продукт", exact: true })
    .click();
  await ai.locator("#product-name").fill("Манго");
  await ai.waitForFunction(() =>
    document
      .querySelector(".photo-preview img")
      ?.getAttribute("src")
      ?.startsWith("data:image/jpeg"),
  );
  assert.equal(imageCalls, 1);
  await ai
    .getByRole("button", {
      name: "Применить условия и короткий срок",
      exact: true,
    })
    .click();
  await ai
    .getByRole("button", { name: "Добавить на полку", exact: true })
    .click();
  await ai.waitForSelector("dialog", { state: "detached" });
  assert.ok(
    (
      await ai.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("shelf-sense.desktop.v2"),
          ).products.find((p) => p.name === "Манго").photo,
      )
    ).startsWith("ai:"),
  );
  await ai.locator("#chef-request").fill("Хочу ужин с лимоном");
  await ai
    .getByRole("button", { name: "Предложить варианты", exact: true })
    .click();
  await ai.getByRole("button", { name: /Блюдо по вашему запросу/ }).click();
  await ai
    .getByRole("button", { name: "Готово · списать продукты", exact: true })
    .click();
  await ai.waitForSelector("dialog", { state: "detached" });
  assert.ok(
    await ai.evaluate(() =>
      JSON.parse(localStorage.getItem("shelf-sense.desktop.v2")).products.some(
        (p) => p.portions?.length,
      ),
    ),
  );
  await aiCtx.close();
  await ctx.close();
  await browser.close();
  fs.writeFileSync(
    path.join(dir, "report.json"),
    JSON.stringify({ status: "passed", audits, errors, imageCalls }, null, 2),
  );
  console.log(
    `PASS: partial portions, weekly costs, atomic recipe use/undo, persistence, history, keyless mode, mocked AI/photo flow and ${audits.length} responsive audits.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
