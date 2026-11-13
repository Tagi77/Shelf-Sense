import { z } from "zod";
type AuthEnv = { DB?: D1Database };
const reply = (data: unknown, status = 200, cookie?: string) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async (s: string) =>
  hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
function equal(a: string, b: string) {
  let n = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
const token = (r: Request) =>
  (r.headers.get("cookie") ?? "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("ss_session="))
    ?.slice(11) ?? "";
const cookie = (r: Request, t: string, age: number) =>
  `ss_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
export async function accountSession(request: Request, env: AuthEnv) {
  const uid = request.headers.get("oai-authenticated-user-id");
  const t = token(request);
  if (!env.DB || !uid || !/^[a-f0-9]{64}$/.test(t)) return null;
  return env.DB.prepare(
    "SELECT a.id,a.nickname,a.email FROM ss_accounts a JOIN ss_sessions s ON s.account_id=a.id WHERE s.token=? AND s.site_user=? AND a.site_user=? AND s.expires_at>?",
  )
    .bind(await digest(t), uid, uid, new Date().toISOString())
    .first<{ id: string; nickname: string; email: string }>();
}
export async function handleAuth(request: Request, env: AuthEnv) {
  const uid = request.headers.get("oai-authenticated-user-id");
  if (!uid) return reply({ error: "sign_in_required" }, 401);
  if (!env.DB) return reply({ error: "storage_unavailable" }, 503);
  const db = env.DB;
  const path = new URL(request.url).pathname.split("/").at(-1);
  if (path === "session" && request.method === "GET")
    return reply({ user: await accountSession(request, env) });
  if (request.method !== "POST")
    return reply({ error: "method_not_allowed" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "origin_not_allowed" }, 403);
  if (path === "logout") {
    const t = token(request);
    if (t)
      await db
        .prepare("DELETE FROM ss_sessions WHERE token=? AND site_user=?")
        .bind(await digest(t), uid)
        .run();
    return reply({ ok: true }, 200, cookie(request, "", 0));
  }
  if (!["login", "register"].includes(path ?? ""))
    return reply({ error: "not_found" }, 404);
  try {
    if (!request.headers.get("content-type")?.includes("application/json"))
      return reply({ error: "invalid_input" }, 400);
    const reader = request.body?.getReader();
    let raw = "";
    if (!reader) return reply({ error: "invalid_input" }, 400);
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      raw += new TextDecoder().decode(r.value);
      if (raw.length > 4000) {
        await reader.cancel();
        return reply({ error: "invalid_input" }, 413);
      }
    }
    const input = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((s) => s.toLowerCase()),
        password: z.string().min(8).max(128),
        nickname: z.string().trim().min(2).max(32),
      })
      .safeParse(JSON.parse(raw));
    if (!input.success) return reply({ error: "invalid_input" }, 400);
    const now = Date.now(),
      bucket = Math.floor(now / 900000);
    const limitId = uid + ":" + bucket;
    await db
      .prepare(
        "INSERT INTO ss_auth_limits(id,count,until) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CAST(count AS INTEGER)+1",
      )
      .bind(limitId, String(now + 900000))
      .run();
    const rate = await db
      .prepare("SELECT count FROM ss_auth_limits WHERE id=?")
      .bind(limitId)
      .first<{ count: string }>();
    if (Number(rate?.count) > 20)
      return reply({ error: "too_many_attempts" }, 429);
    await db
      .prepare("DELETE FROM ss_auth_limits WHERE CAST(until AS INTEGER)<?")
      .bind(now)
      .run();
    const { email, password, nickname } = input.data;
    let user = await db
      .prepare("SELECT * FROM ss_accounts WHERE site_user=? AND email=?")
      .bind(uid, email)
      .first<{
        id: string;
        email: string;
        nickname: string;
        salt: string;
        password_hash: string;
      }>();
    if (path === "register") {
      if (user) return reply({ error: "account_exists" }, 409);
      const id = crypto.randomUUID(),
        salt = random(),
        passwordHash = await hash(password, salt);
      const result = await db
        .prepare(
          "INSERT INTO ss_accounts(id,site_user,email,nickname,salt,password_hash,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM ss_accounts WHERE site_user=? AND email=?)",
        )
        .bind(
          id,
          uid,
          email,
          nickname,
          salt,
          passwordHash,
          new Date().toISOString(),
          uid,
          email,
        )
        .run();
      if (!result.meta.changes) return reply({ error: "account_exists" }, 409);
      await db
        .prepare(
          "INSERT INTO ss_pantries(account_id,products,revision,bot) VALUES(?,'[]',1,'{}') ON CONFLICT(account_id) DO NOTHING",
        )
        .bind(id)
        .run();
      user = { id, email, nickname, salt, password_hash: passwordHash };
    } else {
      const actual = await hash(
        password,
        user?.salt ?? "dummy_salt_to_equalize_missing_accounts",
      );
      if (!user || !equal(actual, user.password_hash))
        return reply({ error: "invalid_credentials" }, 401);
      await db
        .prepare("UPDATE ss_accounts SET nickname=? WHERE id=? AND site_user=?")
        .bind(nickname, user.id, uid)
        .run();
      user.nickname = nickname;
    }
    const t = random();
    await db
      .prepare("DELETE FROM ss_sessions WHERE expires_at<?")
      .bind(new Date().toISOString())
      .run();
    await db
      .prepare(
        "INSERT INTO ss_sessions(token,account_id,site_user,expires_at) VALUES(?,?,?,?)",
      )
      .bind(
        await digest(t),
        user.id,
        uid,
        new Date(now + 7 * 86400000).toISOString(),
      )
      .run();
    return reply(
      { user: { id: user.id, nickname: user.nickname, email: user.email } },
      200,
      cookie(request, t, 604800),
    );
  } catch {
    return reply({ error: "auth_unavailable" }, 500);
  }
}
