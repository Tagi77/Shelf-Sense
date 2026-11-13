// Local preview adapter only. Hosted persistence uses the Sites D1 binding.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
mkdirSync("work", { recursive: true });
const sqlite = new DatabaseSync(
  process.env.SHELF_TEST_DB || "work/shelf-auth.sqlite",
);
sqlite.exec(
  "CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)",
);
for (const f of readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (
    !sqlite.prepare("SELECT name FROM local_migrations WHERE name=?").get(f)
  ) {
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(readFileSync(`drizzle/${f}`, "utf8"));
      sqlite.prepare("INSERT INTO local_migrations VALUES(?)").run(f);
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  }
}
export const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...values) {
        args = values;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...args) ?? null;
      },
      async run() {
        const r = sqlite.prepare(sql).run(...args);
        return { success: true, meta: { changes: Number(r.changes) } };
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...args) };
      },
    };
  },
};
