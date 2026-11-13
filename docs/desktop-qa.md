# Shelf Sense verification — 12 November 2026

Passed on the production artifact served by the loopback-only Worker adapter:

- Next.js webpack production build + TypeScript.
- Expiry boundaries, valid dates, storage/temperature rules, demo idempotence and recipe exclusion domain tests.
- Legacy version-2 data parsing; partial portions, all-used archive, proportional price accounting, atomic multi-product cooking, duplicate transaction idempotence, latest-only undo and weekly boundaries.
- Protected AI gateway using mocked upstream responses: authentication, origin checks, no-key status, structured response requests, conservative guide override, expired ingredient exclusion, stock/ID/unit validation and redacted provider failures. No real paid API request was made.
- Browser scenario: add 6 apples at 1200 ₸, eat 2, reload, discard 1, confirm 200 ₸ weekly loss, undo discard, cook from multiple stock items, undo the batch, fully use the apples and inspect history.
- Mocked connected browser flow: recognise an unfamiliar food, generate/cache an image, apply guidance, submit a custom meal request and deduct confirmed ingredients.
- 31 responsive audits: RU/EN at 320/390/430/1440/1920 px (inventory, form and saved item), plus dark theme. No horizontal overflow in the document or open modal, broken images, running animations or JS errors.
- Browser bundle scan found no OPENAI_API_KEY reference, direct OpenAI endpoint, or test credential.

`desktop-qa-report.json` is the latest browser audit. Screenshots are ignored under `outputs/portions-qa/`. Tests use fresh isolated browser contexts and localhost only.

Limitations: live model quality, API account access/billing and real generated images await an API key. Physical phone keyboards and native date-picker appearance were not tested on a device. In-memory API rate guards are per isolate rather than a durable global billing cap.
