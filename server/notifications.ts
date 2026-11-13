import { z } from "zod";
import { accountSession } from "./auth";
import { json, readJSON } from "./pantry";
export async function handleNotifications(
  request: Request,
  env: { DB?: D1Database },
) {
  const user = await accountSession(request, env);
  if (!user) return json({ error: "sign_in_required" }, 401);
  const db = env.DB!;
  if (request.method === "GET") {
    const rows = await db
      .prepare(
        "SELECT notification_id FROM ss_notification_reads WHERE account_id=? ORDER BY read_at DESC LIMIT 5000",
      )
      .bind(user.id)
      .all<{ notification_id: string }>();
    return json({ read: rows.results.map((r) => r.notification_id) });
  }
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "origin_not_allowed" }, 403);
  try {
    const { id } = z
      .object({ id: z.string().min(1).max(300) })
      .parse(await readJSON(request, 2000));
    await db
      .prepare(
        "INSERT INTO ss_notification_reads(id,account_id,notification_id,read_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(`${user.id}:${id}`, user.id, id, Date.now())
      .run();
    return json({ ok: true });
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
}
