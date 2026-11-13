import assert from "node:assert/strict";
import { build } from "esbuild";
process.env.SHELF_TEST_DB = ":memory:";
const { DB } = await import("../scripts/local-db.mjs");
await build({
  entryPoints: ["server/worker.ts"],
  outfile: "work/notification-test.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
});
const { handleRequest } = await import("../work/notification-test.mjs");
const env = { DB };
const req = (path, body, cookie = "", origin = "https://shelf.test") =>
  new Request("https://shelf.test" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      origin,
      "oai-authenticated-user-id": "test-owner",
      cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const user = async (email) => {
  const r = await handleRequest(
    req("/api/auth/register", {
      nickname: "Tester",
      email,
      password: "TestingOnly!2026",
    }),
    env,
  );
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie");
};
const a = await user("a@test.test"),
  b = await user("b@test.test");
const call = (...args) => handleRequest(req(...args), env);
assert.deepEqual(
  (await (await call("/api/pantry", null, a)).json()).products,
  [],
);
assert.deepEqual(
  (await (await call("/api/pantry", null, b)).json()).products,
  [],
);
assert.equal((await call("/api/notifications")).status, 401);
assert.equal(
  (await call("/api/notifications", { id: "note1" }, a, "https://evil.test"))
    .status,
  403,
);
assert.equal(
  (await call("/api/notifications", { id: "note1" }, a)).status,
  200,
);
assert.equal(
  (await call("/api/notifications", { id: "note1" }, a)).status,
  200,
);
assert.deepEqual(
  (await (await call("/api/notifications", null, a)).json()).read,
  ["note1"],
);
assert.deepEqual(
  (await (await call("/api/notifications", null, b)).json()).read,
  [],
);
assert.deepEqual(
  (await (await call("/api/pantry", null, a)).json()).products,
  [],
);
assert.equal(
  (await call("/api/notifications", { id: "x".repeat(500) }, a)).status,
  400,
);
console.log(
  "PASS: empty new accounts, persistent idempotent notification dismissal, isolation, origin and authentication.",
);
