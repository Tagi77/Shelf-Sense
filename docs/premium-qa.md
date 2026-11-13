# Premium redesign QA — 13 November 2026

Production build and TypeScript pass. `tests/desktop-domain.ts`, `tests/inventory-ai.ts`, `tests/auth-server.mjs`, `tests/premium-flow.cjs` and `tests/pantry-migration.cjs` pass.

## Browser coverage

Headless Google Chrome against the actual Next export + Worker preview, with paid AI disabled. Ten RU/EN combinations at 320, 390, 430, 1440 and 1920 px; 56 recorded audits in `premium-qa-report.json`.

On every combination: actual profile login, greeting, product form, category/type/condition selectors, automatic temperature selection, native date input, pieces, save, expandable card, partial use, overdraw rejection, partial discard, persistence after reload and proportional weekly losses. Background is exactly `rgb(244, 234, 213)`; no horizontal page overflow, broken loaded images, browser exceptions or unexpected console errors. Expected wrong-password HTTP 401 is excluded from error counting.

Desktop also verifies folder previews, cooking/atomic stock changes/undo, chat fallback, logout, rejected password and re-login with preserved inventory. At mobile widths the form remains usable in a 430px-high viewport and the Save button stays inside it; native dialogs overlay the bottom navigation. The 320px cases run with reduced motion. Regular-motion cases check interactive controls without forced clicks.

`pantry-migration.cjs` verifies existing v2 inventory is copied intact once, a second profile does not inherit it, and malformed legacy records remain unchanged with a visible error. Original SQL migration bytes remain unchanged. Authentication tests cover server hashing, secure cookie attributes, duplicate accounts, wrong passwords, Sites-owner isolation, expiration, logout and attempt throttling.

## API and limits

The provided OpenAI key is configured as a secret runtime variable, environment revision 1. A live smoke check returned `credit_balance_exhausted`; no successful live text/image generation is claimed. Structured chat and quota handling are tested with mocked provider responses. Browser bundles were checked for API keys/direct provider requests: none found.

Physical iOS/Android keyboard and OS date-picker rendering were not inspected; reduced-height browser tests cover layout only. Profile email verification/password recovery and cross-device inventory sync are outside this MVP. Earlier `desktop-qa` and `portions-flow` reports describe the superseded mint/theme interface.

Screenshots are local ignored artifacts in `outputs/premium-qa/`.
