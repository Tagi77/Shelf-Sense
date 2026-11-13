// Optional public HTTPS relay. Deploy separately from the private Shelf Sense site.
// Secrets: TELEGRAM_INGRESS_SECRET, SHELF_SITES_SERVICE_TOKEN.
// Config: SHELF_PUBLIC_URL (the exact private Site origin).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/telegram" || request.method !== "POST")
      return new Response("Not found", { status: 404 });
    const expected = env.TELEGRAM_INGRESS_SECRET,
      actual = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!expected || !env.SHELF_SITES_SERVICE_TOKEN || !env.SHELF_PUBLIC_URL)
      return new Response("Unavailable", { status: 503 });
    let mismatch = actual.length ^ expected.length;
    for (let i = 0; i < expected.length; i++)
      mismatch |= (actual.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
    if (mismatch) return new Response("Unauthorized", { status: 401 });
    const reader = request.body?.getReader();
    if (!reader) return new Response("Bad request", { status: 400 });
    let bytes = 0;
    const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 64000) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let cursor = 0;
    for (const chunk of chunks) {
      body.set(chunk, cursor);
      cursor += chunk.length;
    }
    const origin = new URL(env.SHELF_PUBLIC_URL);
    if (origin.protocol !== "https:")
      return new Response("Unavailable", { status: 503 });
    try {
      const result = await fetch(new URL("/api/telegram/update", origin), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shelf-Telegram-Secret": expected,
          "OAI-Sites-Authorization": `Bearer ${env.SHELF_SITES_SERVICE_TOKEN}`,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(150000),
      });
      return new Response(result.ok ? "OK" : "Retry", {
        status: result.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return new Response("Retry", { status: 503 });
    }
  },
};
