// Run on an always-on Node 24 server. No bot keys belong in browser code.
// The private Site's service credential is sent ONLY to SHELF_PUBLIC_URL.
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env.local")) loadEnvFile(".env.local");
let config = { ...process.env };
if (process.argv.includes("--stdin")) {
  process.stdout.write("Ready for bridge credentials (hidden).\n");
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  config = {
    ...config,
    ...(await new Promise((resolve) => {
      let input = "";
      const read = (c) => {
        input += c.toString();
        if (!input.includes("\n")) return;
        process.stdin.off("data", read);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(JSON.parse(input));
      };
      process.stdin.on("data", read);
    })),
  };
}
const {
  TELEGRAM_BOT_TOKEN: token,
  TELEGRAM_INGRESS_SECRET: secret,
  SHELF_SITES_SERVICE_TOKEN: service,
} = config;
const site = new URL(
  config.SHELF_PUBLIC_URL || "https://shelf-sense.a-khassenov28.chatgpt.site",
);
if (!token || !secret || (!service && site.hostname.endsWith("chatgpt.site")))
  throw Error("Missing bot/ingress/private Site credentials");
if (
  site.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(site.hostname)
)
  throw Error("HTTPS required");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const telegram = async (method, body) => {
  let r;
  try {
    r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
      redirect: "error",
    });
  } catch {
    throw Error("telegram_network");
  }
  const data = await r.json();
  if (!r.ok || !data.ok) throw Error(`telegram_status_${r.status}`);
  return data.result;
};
const deliver = async (path, body) => {
  let r;
  try {
    r = await fetch(new URL(path, site), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shelf-Telegram-Secret": secret,
        ...(service ? { "OAI-Sites-Authorization": `Bearer ${service}` } : {}),
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(150000),
    });
  } catch {
    throw Error("site_network");
  }
  if (!r.ok) throw Error(`site_status_${r.status}`);
  return r.json();
};
try {
  const me = await telegram("getMe", {});
  const hook = await telegram("getWebhookInfo", {});
  if (hook.url) throw Error("webhook_already_set_stop_polling");
  if (process.argv.includes("--setup"))
    await telegram("setMyCommands", {
      commands: [
        { command: "start", description: "Начать и подключить холодильник" },
        { command: "fridge", description: "Мой холодильник" },
        { command: "expiring", description: "Скоро испортится" },
        { command: "recipe", description: "Рецепт из остатков" },
        { command: "test", description: "Тест уведомления" },
        { command: "cancel", description: "Отменить ввод срока" },
        { command: "help", description: "Как пользоваться" },
      ],
    });
  console.log(`Telegram bridge running: @${me.username}. Stop with Ctrl+C.`);
  let offset = 0,
    stopping = false;
  process.on("SIGTERM", () => {
    stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  while (!stopping) {
    try {
      await deliver("/api/telegram/heartbeat", {});
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 25,
        limit: 20,
        allowed_updates: ["message", "callback_query"],
      });
      for (const update of updates) {
        if (stopping) break;
        await deliver("/api/telegram/update", update);
        offset = update.update_id + 1;
        console.log(`Processed update ${update.update_id}`);
      }
    } catch (e) {
      console.log(`Bridge retry: ${e.message}`);
      await sleep(5000);
    }
  }
} catch (e) {
  console.error(`Bridge stopped: ${e.message}`);
  process.exitCode = 1;
}
