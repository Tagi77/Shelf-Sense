import { DB } from "./local-db.mjs";
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env.local")) loadEnvFile(".env.local");
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
await build({
  entryPoints: ["server/worker.ts"],
  outfile: "work/gateway.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
});
const { handleRequest } = await import(
  pathToFileURL(path.resolve("work/gateway.mjs")).href
);
createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    headers.set("oai-authenticated-user-id", "local-development");
    const origin = "http://127.0.0.1:5173";
    const r = new Request(origin + req.url, {
      method: req.method,
      headers,
      ...(req.method === "GET" ? {} : { body: Buffer.concat(chunks) }),
    });
    const response = await handleRequest(r, {
      DB,
      OPENAI_API_KEY:
        process.env.SHELF_AI_DISABLED === "1"
          ? undefined
          : process.env.OPENAI_API_KEY,
      GEMINI_API_KEY:
        process.env.SHELF_AI_DISABLED === "1"
          ? undefined
          : process.env.GEMINI_API_KEY,
      GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL,
      GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL,
      AI_PROVIDER: process.env.AI_PROVIDER,
      TELEGRAM_BOT_TOKEN:
        process.env.SHELF_TELEGRAM_DISABLED === "1"
          ? undefined
          : process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
      TELEGRAM_INGRESS_SECRET: process.env.TELEGRAM_INGRESS_SECRET,
      SHELF_PUBLIC_URL: process.env.SHELF_PUBLIC_URL,
      OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
      OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('{"error":"development_error"}');
  }
}).listen(5175, "127.0.0.1", () =>
  console.log("Local AI gateway: http://127.0.0.1:5175"),
);
