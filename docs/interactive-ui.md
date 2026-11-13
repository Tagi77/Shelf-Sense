# Storage cards, assistant composer and night mode

The app already used shadcn/ui (`components.json`), Tailwind CSS 4.2 and TypeScript 5.9. The component path remains `components/ui`; global styles are `app/globals.css` and `app/enhancements.css`.

- Four glass folder cards adapt the full component provided by the user. The original art renderer and hinge/fan interactions are retained in `glass-folder-art.tsx`. The wrapper binds them to current inventory, quantities, product editing and zone filtering. Colours remain cobalt, slate and warm neutral. On touch, tapping opens the folder; a readable product list supplies the same actions.
- The assistant composer is inspired by Cobp’s Uiverse example. Its controls actually toggle inventory context and choose prompts. Dinner suggestions still use recipe review and explicit stock confirmation. Retries retain the question without duplicating it.
- Animated notifications use actual expiry dates, storage alerts and portion events. Demo events are labelled. Read state is stored per profile. The stack can be paused, navigated manually, or read as a full list; reduced-motion users get a static stack.
- `next-themes` persists the appearance in `shelf-theme`, with a system default. The optional View Transition reveal has a reduced-motion fallback. Both account and inventory screens use dark surface tokens.
- Aceternity’s registry cube grid is integrated on the welcome panel, with its Three.js dependencies. Motion imports reuse the installed framer-motion runtime. It is lazy-loaded, stops while offscreen or hidden, and falls back to a static pattern when WebGL or motion is unavailable.

Component reference: https://ui.aceternity.com/registry/background-cubes-grid-demo.json
The attached Glass Folder source supplied by the user is adapted for food photos, localisation and live stock updates. No unrelated demo file-manager content is rendered.

## AI

Gemini is preferred when `GEMINI_API_KEY` exists, unless `AI_PROVIDER=openai`. Production runtime secrets are stored in Sites; local development uses ignored `.env.local`. No key is included in client code. Defaults are `gemini-flash-lite-latest` for text and `gemini-3.1-flash-image` for images. Each can be overridden with `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL`.

The existing identity checks, same-origin checks, payload limits, JSON schemas and inventory validation remain enforced. The adapter supports Gemini JSON schema output and PNG/JPEG/WebP image responses; partial responses and malformed data are rejected. Private reasoning parts are never returned. No automatic requests are made to OpenAI as a fallback.

Live verification on 13 November 2026: chat, kitchen recipe, product guide and section advice returned HTTP 200 through the actual gateway using Gemini Flash Lite. The Flash alias returned provider overload (503), so the working Lite model was selected. Image generation returned a provider quota/rate limit (429); catalogue photos remain usable and the form explains this limitation.

API references: https://aistudio.google.com/api-reference/generate-content and https://aistudio.google.com/docs/structured-output

## Verification

Production build and TypeScript pass. 132 browser layout/flow audits passed across 320, 390, 430, 1440 and 1920 px, both RU/EN and both light/dark themes: account access, product entry with a native date field, card display, portion consumption/discard, history and loss totals. Desktop checks also exercise cooking/undo and logout/login. No page errors, horizontal overflow or broken loaded images were reported. Separate control checks passed at 320, 390, 430 and 1440 px for folder keyboard/touch access, zone filters, notification actions and composer payloads with/without inventory. Reduced motion was tested at 320 px. Source and client bundles were scanned for the configured secrets; none were found.

Physical iOS/Android keyboards and native date-picker UI were not available; shortened browser viewports and responsive layouts were tested. Authentication throttling is retained; QA databases were isolated between groups.
