import { sqliteTable, text, index, integer } from "drizzle-orm/sqlite-core";
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    expiresOn: text("expires_on").notNull(),
    category: text("category").notNull().default("other"),
    storage: text("storage").notNull().default("fridge"),
    temperature: text("temperature").notNull().default(""),
    notes: text("notes").notNull().default(""),
    state: text("state").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [index("products_user_state_idx").on(table.userId, table.state)],
);

export const accounts = sqliteTable(
  "ss_accounts",
  {
    id: text("id").primaryKey(),
    siteUser: text("site_user").notNull(),
    email: text("email").notNull(),
    nickname: text("nickname").notNull(),
    salt: text("salt").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("accounts_owner_idx").on(t.siteUser)],
);
export const sessions = sqliteTable("ss_sessions", {
  token: text("token").primaryKey(),
  accountId: text("account_id").notNull(),
  siteUser: text("site_user").notNull(),
  expiresAt: text("expires_at").notNull(),
});
export const authLimits = sqliteTable("ss_auth_limits", {
  id: text("id").primaryKey(),
  count: text("count").notNull(),
  until: text("until").notNull(),
});

export const pantries = sqliteTable("ss_pantries", {
  accountId: text("account_id").primaryKey(),
  products: text("products").notNull(),
  revision: integer("revision").notNull().default(1),
  bot: text("bot").notNull().default("{}"),
});
export const telegramLinks = sqliteTable("ss_telegram_links", {
  telegramId: text("telegram_id").primaryKey(),
  accountId: text("account_id").notNull().unique(),
  chatId: text("chat_id").notNull(),
  linkId: text("link_id").notNull(),
  displayName: text("display_name").notNull(),
});
export const telegramCodes = sqliteTable("ss_telegram_codes", {
  hash: text("hash").primaryKey(),
  accountId: text("account_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const telegramUpdates = sqliteTable("ss_telegram_updates", {
  id: integer("id").primaryKey(),
  response: text("response"),
  sent: integer("sent").notNull().default(0),
  leaseUntil: integer("lease_until").notNull(),
  completed: integer("completed").notNull().default(0),
});
export const telegramRuntime = sqliteTable("ss_telegram_runtime", {
  id: text("id").primaryKey(),
  heartbeat: integer("heartbeat").notNull(),
});

export const notificationReads = sqliteTable(
  "ss_notification_reads",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    notificationId: text("notification_id").notNull(),
    readAt: integer("read_at").notNull(),
  },
  (t) => [index("notification_reads_owner_idx").on(t.accountId)],
);
