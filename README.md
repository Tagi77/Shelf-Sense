# Shelf Sense

Food Waste at Home MVP: Next.js App Router, TypeScript, Tailwind CSS, Lucide and Framer Motion. Food-focused paper-white, tomato and charcoal palette with light/dark themes. RU/EN; one-column mobile inventory and five-tab bottom navigation. Motion respects reduced-motion preferences.

## Experience

- Server-backed email/password accounts, custom nicknames and a personal greeting. New accounts start with **an empty kitchen**; demo products are added only with the explicit demo button.
- Four photographic storage tiles open dedicated, animated inventory views with URL hashes, browser Back support and a return button. A product added from a zone uses that zone by default.
- Product cards show remaining quantity, expiry date and status; storage and notes expand on demand. Portions and purchase costs are recorded; zero stock moves to history.
- Native purchase/addition and expiry date inputs. Day chips count from the purchase date. Remaining days recalculate from the current local calendar on entry, every minute and when the tab becomes visible. For example, 10 November + 7 days expires on 17 November; on 14 November there are 3 days left.
- Notifications have **Read · dismiss** and **Open item** actions. Dismissal removes one item from the queue, updates the counter and is persisted per account in D1. The product itself is retained. A new daily expiry reminder can appear on a subsequent date.
- **Krosh / Крош**, the small robot in the top-right corner, opens a compact question/recipe drawer. It retains the conversation while navigating and displays a thinking animation. The previous large assistant sidebar and repeated explanation text are removed.
- Meal ideas prioritise eligible food approaching expiry. Reviewed ingredient quantities are deducted atomically by **Done**, with batch undo. AI never silently changes stock. Recipe inputs use explicit contrasting foreground/background colors in both themes.
- Eight-week waste chart uses recorded portion costs and distinguishes unpriced products and demo data. No sources footer; maintenance references remain in documentation.
- Gemini is the configured text provider; existing catalogue logic remains available without live AI. Image generation has a separate quota and bundled food photos remain available. Credentials are server-only.

## Persistence and access

Sites retains owner-private access and supplies trusted visitor identity. D1 stores profile records and session hashes, with salted PBKDF2 password hashes, seven-day HttpOnly/Secure/SameSite cookies, origin validation and a durable login attempt limit. Profiles are scoped to the Sites visitor. Email is a login identifier; verification and password recovery are not implemented in this hackathon MVP.

Inventory is stored per account in D1 (`ss_pantries`) with revision-checked writes. The website refreshes every 5 seconds while visible, and on focus/online. Closing the browser does not delete inventory. Existing account-scoped browser inventory can migrate if that account has no cloud record; unscoped legacy data is preserved but never imported into a new account. A pre-cloud copy is kept in localStorage. Offline edits are not reported as saved. Generated image bytes remain device-local in IndexedDB; catalogue photos work across devices. Notification acknowledgements live in `ss_notification_reads`.

The legacy products table is unchanged. Migration 0000 is preserved byte-for-byte, 0001 adds authentication, 0002 adds shared inventory and Telegram, and 0003 adds notification acknowledgements. Migrations run during deployment/local startup, never in request handlers. See [Telegram integration](docs/telegram.md) for delivery and hosting constraints.

## Run

Node >=22.13, npm. `npm ci`, then `npm run dev`. Next runs on http://127.0.0.1:5173 and the development API gateway on 5175. `npm run build` exports Next and builds a Cloudflare Worker; `npm start` previews the built artifact. `PORT=5174 npm start` uses another port.

Local preview uses a SQLite D1 adapter in ignored `work/`. Both adapters supply a development identity on loopback only; they are not deployed. Ignored `.env.local` can provide server credentials. `SHELF_AI_DISABLED=1` disables paid requests for functional testing; `SHELF_TEST_DB=work/qa.sqlite` isolates preview profiles.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit
node tests/auth-server.mjs
node tests/notification-server.mjs
node tests/telegram-server.mjs
node tests/fresh-kitchen.cjs
node tests/pantry-migration.cjs
node tests/pantry-delivery-retry.cjs
```

Browser checks require Playwright and Chrome (`PLAYWRIGHT_MODULE` supplies the module path). Start the loopback production preview with `SHELF_AI_DISABLED=1 SHELF_TELEGRAM_DISABLED=1` and an isolated `SHELF_TEST_DB`. Use separate databases for the main matrix and persistence checks to respect real authentication throttling.

`fresh-kitchen.cjs` covers 320, 390, 430 and 1440 px, RU/EN and light/dark: registration, empty inventory, purchase-date expiry arithmetic, adding a product, short viewport save access, 1/9 → 1/8 acknowledgement persistence, all four storage routes, robot chat/recipe input contrast and calendar rollover. `pantry-migration.cjs` checks legacy-data isolation and a fresh browser context; `pantry-delivery-retry.cjs` verifies that a lost write response does not deduct a portion twice. Server tests cover authentication, ownership, notification acknowledgements and the prepared Telegram flow without sending real messages.

Reports for previous business/premium/interactive designs are historical; their selectors and palettes have been superseded by the current fresh-kitchen matrix. Phone keyboards are approximated using a short viewport, not real iOS/Android hardware. See [current QA](docs/fresh-kitchen-qa.md).
