import { DB } from "./local-db.mjs";
// Loopback-only preview. Hosted identity is supplied by Sites, never this adapter.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import path from "node:path";
import worker from "../dist/server/index.js";
if (existsSync(".env.local")) loadEnvFile(".env.local");
const port = Number(process.env.PORT || 5173);
const root = path.resolve("dist/client");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const assets = {
  async fetch(request) {
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      let file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep) && file !== root)
        return new Response("Forbidden", { status: 403 });
      if ((await stat(file).catch(() => null))?.isDirectory())
        file = path.join(file, "index.html");
      else if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
      const bytes = await readFile(file);
      return new Response(bytes, {
        headers: {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
};
createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const origin = `http://127.0.0.1:${port}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    headers.set("oai-authenticated-user-id", "local-preview");
    const request = new Request(origin + req.url, {
      method: req.method,
      headers,
      ...(req.method === "GET" || req.method === "HEAD"
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const response = await worker.fetch(request, {
      ASSETS: assets,
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
    res.end("Preview error");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Production preview: http://127.0.0.1:${port}`),
);
