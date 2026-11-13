import assert from "node:assert/strict";
import { handleRequest } from "../server/worker";
const env = {
  GEMINI_API_KEY: "test-gemini-secret",
  OPENAI_API_KEY: "unused-openai-secret",
};
const origin = "https://shelf.test",
  original = globalThis.fetch;
const request = (action: string, data?: unknown) =>
  new Request(origin + "/api/ai/" + action, {
    method: data ? "POST" : "GET",
    headers: {
      "oai-authenticated-user-id": "gemini-test",
      origin,
      "content-type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
const payload = {
  lang: "ru",
  today: "2026-11-13",
  products: [],
  prompt: "Как хранить яблоки?",
};
let captured: any;
globalThis.fetch = async (url, options) => {
  assert.ok(
    String(url).startsWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:",
    ),
  );
  assert.equal(
    new Headers(options?.headers).get("x-goog-api-key"),
    env.GEMINI_API_KEY,
  );
  captured = JSON.parse(String(options?.body));
  return Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            { thought: true, text: "not visible" },
            { text: JSON.stringify({ message: "Совет по хранению." }) },
          ],
        },
      },
    ],
  });
};
let res = await handleRequest(request("chat", payload), env);
assert.equal(res.status, 200);
assert.equal(((await res.json()) as any).data.message, "Совет по хранению.");
assert.equal(captured.generationConfig.responseMimeType, "application/json");
assert.deepEqual(captured.generationConfig.responseJsonSchema.required, [
  "message",
]);
assert.ok(captured.systemInstruction.parts[0].text.includes("untrusted"));
assert.equal(
  ((await (await handleRequest(request("status"), env)).json()) as any)
    .provider,
  "Gemini",
);
assert.equal(
  (await handleRequest(new Request(origin + "/api/ai/status"), env)).status,
  401,
);
for (const [status, code] of [
  [503, "provider_unavailable"],
  [429, "provider_limit"],
  [403, "provider_access"],
] as const) {
  globalThis.fetch = async () =>
    Response.json(
      {
        error: { message: "DO NOT EXPOSE test-gemini-secret", status: "ERROR" },
      },
      { status },
    );
  res = await handleRequest(request("chat", payload), env);
  assert.deepEqual(await res.json(), { error: code });
}
globalThis.fetch = async () =>
  Response.json({
    candidates: [
      {
        finishReason: "MAX_TOKENS",
        content: { parts: [{ text: '{"message":"partial"}' }] },
      },
    ],
  });
res = await handleRequest(request("chat", payload), env);
assert.deepEqual(await res.json(), { error: "incomplete_response" });
globalThis.fetch = async () =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: '{"wrong":"shape"}' }] },
      },
    ],
  });
res = await handleRequest(request("chat", payload), env);
assert.equal(res.status, 502);
globalThis.fetch = async (url) => {
  assert.ok(String(url).includes("gemini-3.1-flash-image"));
  return Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [{ inlineData: { mimeType: "image/png", data: "aGVsbG8=" } }],
        },
      },
    ],
  });
};
res = await handleRequest(
  request("image", { lang: "ru", name: "Яблоко" }),
  env,
);
assert.deepEqual(await res.json(), { image: "data:image/png;base64,aGVsbG8=" });
globalThis.fetch = original;
console.log(
  "PASS: Gemini routing, server-only credentials, structured output, no thought leakage, safe errors, partial response rejection and PNG images.",
);
