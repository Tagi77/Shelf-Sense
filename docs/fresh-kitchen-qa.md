# Fresh kitchen QA — 13 November 2026

User story: a person registers into an empty kitchen, adds food, returns later to updated calendar counts, dismisses notifications, navigates storage zones and asks Krosh for help.

## Verified

- Production build and TypeScript compilation passed.
- `tests/fresh-kitchen.cjs`: **16 complete scenarios** — 320, 390, 430, 1440 px × RU/EN × light/dark. No browser JavaScript errors or document/modal horizontal overflow.
- New registration: empty cloud inventory, no automatic demo products and no import of unscoped browser inventory.
- Purchase date 2026-11-10 + 7 days = expiry 2026-11-17. With the clock at 2026-11-14 the card shows 3 days; on 2026-11-15 it shows 2 days without editing the product.
- Product form remains savable in a 430 px tall viewport. Native date inputs retained.
- Read notification: 1/9 → 1/8; dismissed item stays absent after reload. Server ownership and idempotency checked with two accounts; product inventory is unchanged.
- All four storage views show only their products, update the hash, survive reload and support Back/return.
- Krosh opens from the header in every size/theme. Chat fallback and recipe input work. Recipe-input text contrast is at least **13.56:1**.
- `tests/pantry-migration.cjs`: account data survives a fresh browser context; a second account remains empty; malformed unscoped legacy data does not leak or block signup.
- `tests/pantry-delivery-retry.cjs`: dropping a successful write response then retrying records one portion exactly once.
- `tests/notification-server.mjs`, `tests/auth-server.mjs` and `tests/telegram-server.mjs`: authentication, request origin, account isolation, acknowledgements and prepared Telegram operations.
- Visual inspection after entry animations completed: populated desktop in both themes and mobile robot recipe drawer. Fixed narrow header overflow, hidden mobile logout control and light filter backgrounds in dark mode.

## Scope

Browser tests use Chrome and an isolated local SQLite database running the built Worker. AI and Telegram outbound requests were disabled; no real chats were messaged. Physical phone keyboard/date-picker behavior is approximated by a short viewport, not verified on iOS/Android devices. The actual AI provider was not re-billed for this UI change. Existing Telegram delivery still points to BotHelp; no new webhook was activated.

Screenshots and machine-readable matrix results are generated in ignored `outputs/fresh-kitchen/`. Earlier QA reports describe superseded designs.
