import assert from "node:assert/strict";
import { build } from "esbuild";
process.env.SHELF_TEST_DB = ":memory:";
const { DB } = await import("../scripts/local-db.mjs");
await build({
  entryPoints: ["server/auth.ts"],
  outfile: "work/auth-test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { handleAuth } = await import("../work/auth-test.mjs");
const url = "https://shelf.test";
const data = {
  nickname: "darbanov_8",
  email: "auth@example.com",
  password: "OnlyForLocalTests!2026",
};
const req = (path, input, opts = {}) =>
  new Request(`${url}/api/auth/${path}`, {
    method: input === undefined ? "GET" : "POST",
    headers: {
      "oai-authenticated-user-id": opts.uid ?? "owner",
      origin: opts.origin ?? url,
      "content-type": "application/json",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
assert.equal(
  (await handleAuth(new Request(url + "/api/auth/session"), { DB })).status,
  401,
);
assert.equal(
  (
    await handleAuth(
      req("register", data, { origin: "https://attacker.test" }),
      { DB },
    )
  ).status,
  403,
);
const register = await handleAuth(req("register", data), { DB });
assert.equal(register.status, 200);
const user = (await register.json()).user;
const cookie = register.headers.get("set-cookie");
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /Secure/);
assert.match(cookie, /SameSite=Strict/);
const stored = await DB.prepare("SELECT * FROM ss_accounts WHERE id=?")
  .bind(user.id)
  .first();
assert.notEqual(stored.password_hash, data.password);
assert.equal(stored.password_hash.length, 64);
assert.equal(stored.salt.length, 64);
assert.equal((await handleAuth(req("register", data), { DB })).status, 409);
assert.equal(
  (
    await handleAuth(req("login", { ...data, password: "WrongPassword" }), {
      DB,
    })
  ).status,
  401,
);
assert.equal(
  (
    await (
      await handleAuth(req("session", undefined, { cookie }), { DB })
    ).json()
  ).user.id,
  user.id,
);
assert.equal(
  (
    await (
      await handleAuth(
        req("session", undefined, { cookie, uid: "another-owner" }),
        { DB },
      )
    ).json()
  ).user,
  null,
);
await handleAuth(req("logout", {}, { cookie }), { DB });
assert.equal(
  (
    await (
      await handleAuth(req("session", undefined, { cookie }), { DB })
    ).json()
  ).user,
  null,
);
const login = await handleAuth(req("login", { ...data, nickname: "NewNick" }), {
  DB,
});
assert.equal(login.status, 200);
assert.equal((await login.json()).user.nickname, "NewNick");
const newCookie = login.headers.get("set-cookie");
await DB.prepare("UPDATE ss_sessions SET expires_at=?")
  .bind("2000-01-01T00:00:00.000Z")
  .run();
assert.equal(
  (
    await (
      await handleAuth(req("session", undefined, { cookie: newCookie }), { DB })
    ).json()
  ).user,
  null,
);
for (let i = 0; i < 21; i++)
  await handleAuth(req("login", { ...data, password: "WrongPassword" }), {
    DB,
  });
assert.equal((await handleAuth(req("login", data), { DB })).status, 429);
console.log(
  "PASS: real registration/login, password hashes, secure cookies, duplicate and wrong-password rejection, owner isolation, logout, expiry and throttling.",
);
