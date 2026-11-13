# Telegram + shared inventory

The integration connects `@aalitm_bot` to the same account inventory as the website.

**Delivery status (13 November 2026):** the bot handler and shared inventory are implemented. Runtime secrets are configured. The external Telegram delivery process has not been activated; no real user chat received test messages.
Telegram `getMe` verified the token and `setMyCommands` saved the seven commands.
An existing webhook points to BotHelp (`tghook.bothelp.io`); it remains configured.
Switch it only after the replacement server is published and verified.
No bot token is included in client code. Production configuration is stored as
Sites secrets; `.env.local` is ignored by Git.

## User flow

1. Sign into Shelf Sense, open Telegram, click **Связать аккаунт**.
2. Open the generated link and press **Start**. The random single-use link expires
   after ten minutes. Only its SHA-256 hash is stored. One Telegram user maps to
   one application account, and one account to one Telegram user. Group messages
   are ignored. Disconnecting on the site revokes the link and old action buttons.
3. Send `Молоко 500 мл 3 дня`, `Яблоки 4 шт 7 дней`, or `Сыр, помидоры, хлеб`.
   The reviewed local catalogue identifies foods. Unknown foods require the web
   form. Omitted amounts become **1 piece/package**, explicitly labelled; no
   mass is invented. Omitted dates are conservative estimates, not safety claims.
4. Inline buttons allow changing an expiry date or undoing an unchanged addition.
   Expiry input accepts `5 дней`, `16.11.2026`, or `2026-11-16`. `/cancel` exits.
5. Fridge lists are paginated and include remaining amounts and storage conditions.
   Expiring means calendar dates today through today + 2 (Asia/Almaty), not an exact
   hour-level countdown. Expired products are reported separately.
6. Recipes use the existing AI gateway when available, with a clearly labelled
   local recipe fallback. Only eligible stock is used; expired, frozen and
   unsuitable-temperature items are excluded. Amounts and units are validated.
   **Готово** deducts the listed amounts only. Extras are not deducted. Changed
   stock invalidates an old button, and repeated callbacks do not deduct twice.
7. **Тест уведомления** is a manual demonstration using actual stock. Eaten/discard
   buttons explicitly deduct the whole displayed remainder; partial portions can
   be recorded on the site. No automatic daily schedule is enabled.

Costs use each product's recorded purchase price, prorated to its portion.
Unpriced and demo products do not inflate Telegram savings. Discards feed the
existing weekly loss chart.

## Storage and concurrency

D1 tables are declared in `db/schema.ts`; append-only migration `0002` creates
pantries, hashed pairing codes, links, update delivery receipts and bridge status.
Browser reads require the app session AND the trusted Sites user identity.
New accounts are initialized with empty cloud inventory. Existing account-scoped browser data imports only when cloud inventory is absent; unscoped legacy data never transfers to a new account.
The original local copy is kept in `<storageKey>.pre-cloud`; the legacy key remains
intact. Existing cloud inventory wins on another device. No offline edit is
reported as saved. Generated image bytes remain device-local; catalogue photos
are portable.

All inventory writes use a revision compare-and-swap. A bot inventory mutation
and its reply receipt are committed in the same write. Pending outgoing replies
survive delivery failures. Telegram updates are deduplicated for seven days;
private pantry receipts and action histories are bounded. Telegram sendMessage
has no idempotency key: a crash exactly after delivery but before recording the
sent cursor can repeat a reply, **never its inventory deduction**. Stale forms and
buttons reject changed products. Unlink is checked again inside the inventory SQL
write. Recipe/text actions are throttled to 30 per minute per linked user.

The open site polls every five seconds and on focus/online. A hidden/offline page
updates when reopened/reconnected. Do not describe this as instantaneous realtime.

## Running the bot

The current main Site is owner-private. Telegram cannot supply Sites' service
access header directly. Do not set its webhook to this private URL or make the
pantry public to bypass this restriction.

An external Node 24 process can long-poll Telegram and forward authenticated
updates to the private Site:

```sh
npm run telegram:start
```

Required environment variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_INGRESS_SECRET`,
`SHELF_PUBLIC_URL`, `SHELF_SITES_SERVICE_TOKEN`. Keep the last two secrets in a
server secret manager. The service token is sent only to the configured Site.
`node scripts/telegram-bridge.mjs --stdin --setup` accepts sensitive runtime
configuration over hidden stdin and sets the command menu. It refuses to poll if
an existing webhook is present. Run just one polling instance. Updates are only
acknowledged after delivery succeeds. Ctrl+C stops the process.

A local process depends on this computer, its network connection and process
lifetime. It is not 24/7 hosting. For continuous operation deploy the process to
an always-on server, or deploy `deploy/telegram-gateway/worker.mjs` as a separate
public HTTPS service, then register that URL with Telegram `setWebhook`, setting
`secret_token` to `TELEGRAM_INGRESS_SECRET` and limiting `max_connections` to 1.
Never run polling and a webhook simultaneously. Preserve the existing Site's
private audience. Public gateway deployment requires its own hosting access.
Creating a new gateway Site was unavailable in this client during this change;
no public gateway has been created or enabled.

Protocol references: [Telegram Bot API](https://core.telegram.org/bots/api) and
[deep links](https://core.telegram.org/bots/features#deep-linking).

## Verification

`node tests/telegram-server.mjs` uses a temporary SQLite database and a mocked
Telegram transport; no real user receives test messages. It verifies pairing,
isolation, parsing, menu, edits, undo, fallback recipes, portion accounting,
reminders, replay protection, retry after delivery failure, stale revision
rejection, group isolation and disconnect. `tests/interactive-flow.cjs` checks
mobile and desktop account/add/card/portion/history flows against the real local
HTTP server. `tests/telegram-ui.cjs` checks the responsive connection panel and
cross-context cloud refresh. Real Telegram delivery must additionally be verified
by the user linking their account and pressing Start.

Browser checks completed: 84 mobile audits at 320/390/430 px (RU/EN, light/dark),
24 desktop audits at 1440 px, and 8 Telegram panel/cross-context refresh cases.
Those historical checks used the previous demo-on-registration behavior. Current empty-account and browser-reopen checks are documented in `docs/fresh-kitchen-qa.md`.
`tests/pantry-delivery-retry.cjs` additionally drops a successful HTTP write response
and checks that retrying the same portion form does not deduct twice.
Physical phone keyboard/picker behavior was approximated with a short viewport,
not tested on real iOS/Android hardware.
