import { z } from "zod";
import { accountSession } from "./auth";
import { storedSchema, type Product } from "../app/lib/model";
export type Outgoing = {
  method: "sendMessage";
  body: Record<string, unknown>;
  linkId?: string;
};
export type BotAction = {
  kind: "cancel" | "edit" | "eat" | "discard" | "cook";
  products: Product[];
  portions?: { productId: string; amount: number; unit: Product["unit"] }[];
  title?: string;
  linkId: string;
  expires: number;
  used?: boolean;
};
export type BotState = {
  actions?: Record<string, BotAction>;
  receipts?: Record<string, Outgoing[]>;
  pending?: {
    productId: string;
    linkId: string;
    expires: number;
    snapshot: Product;
  };
};
export type Pantry = { products: Product[]; revision: number; bot: BotState };
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function readJSON(request: Request, limit = 2_000_000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw Error("invalid_input");
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid_input");
  const decoder = new TextDecoder();
  let raw = "",
    size = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw Error("too_large");
    }
    raw += decoder.decode(r.value, { stream: true });
  }
  return JSON.parse(raw + decoder.decode());
}
export async function getPantry(
  db: D1Database,
  account: string,
): Promise<Pantry | null> {
  const row = await db
    .prepare("SELECT products,revision,bot FROM ss_pantries WHERE account_id=?")
    .bind(account)
    .first<{ products: string; revision: number; bot: string }>();
  return row
    ? {
        products: storedSchema.parse({
          version: 2,
          products: JSON.parse(row.products),
        }).products,
        revision: row.revision,
        bot: JSON.parse(row.bot),
      }
    : null;
}
export async function writePantry(
  db: D1Database,
  account: string,
  current: Pantry,
  products: Product[],
  bot = current.bot,
  linkId?: string,
) {
  const valid = storedSchema.parse({ version: 2, products }).products;
  if (new Set(valid.map((p) => p.id)).size !== valid.length)
    throw Error("duplicate_id");
  const r = await db
    .prepare(
      "UPDATE ss_pantries SET products=?,bot=?,revision=revision+1 WHERE account_id=? AND revision=? AND (? IS NULL OR EXISTS(SELECT 1 FROM ss_telegram_links WHERE account_id=ss_pantries.account_id AND link_id=?))",
    )
    .bind(
      JSON.stringify(valid),
      JSON.stringify(bot),
      account,
      current.revision,
      linkId ?? null,
      linkId ?? null,
    )
    .run();
  return !!r.meta.changes;
}
export async function handlePantry(request: Request, env: { DB?: D1Database }) {
  const user = await accountSession(request, env);
  if (!user) return json({ error: "sign_in_required" }, 401);
  const db = env.DB!;
  if (request.method === "GET") {
    const p = await getPantry(db, user.id);
    return json(
      p
        ? { products: p.products, revision: p.revision }
        : { products: null, revision: 0 },
    );
  }
  if (!["POST", "PUT"].includes(request.method))
    return json({ error: "method_not_allowed" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "origin_not_allowed" }, 403);
  try {
    const data = z
      .object({
        revision: z.number().int().nonnegative(),
        products: storedSchema.shape.products,
      })
      .parse(await readJSON(request));
    if (new Set(data.products.map((p) => p.id)).size !== data.products.length)
      return json({ error: "duplicate_id" }, 400);
    if (request.method === "POST") {
      if (data.revision !== 0) return json({ error: "invalid_input" }, 400);
      await db
        .prepare(
          "INSERT INTO ss_pantries(account_id,products,revision,bot) VALUES(?,?,1,'{}') ON CONFLICT(account_id) DO NOTHING",
        )
        .bind(user.id, JSON.stringify(data.products))
        .run();
    } else {
      const p = await getPantry(db, user.id);
      if (
        !p ||
        p.revision !== data.revision ||
        !(await writePantry(db, user.id, p, data.products))
      )
        return json({ error: "inventory_conflict" }, 409);
    }
    const p = (await getPantry(db, user.id))!;
    return json({ products: p.products, revision: p.revision });
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
}
