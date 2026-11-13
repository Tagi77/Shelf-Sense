# OpenAI connection

The server key is configured as a Sites secret. The live smoke check on 13 November 2026 returned HTTP 429 with `credit_balance_exhausted`. Add API credits in the OpenAI Platform billing settings to enable live answers and image generation. This is a billing condition, not a transient request-rate limit. Local food guidance and recipes remain available. No successful paid generation is claimed.

## Enable on Sites

1. Obtain a billed OpenAI project API key with access to the chosen text and image models. In Codex, enable the **OpenAI Developers** plugin and use its `openai-platform-api-key` skill when available; do not paste the key into chat or source code.
2. Configure `OPENAI_API_KEY` as a **secret** runtime variable for the existing Shelf Sense Site through Sites environment settings/tools. Do not use a `NEXT_PUBLIC_` variable. Optionally set non-secret `OPENAI_TEXT_MODEL` (default `gpt-5.4-mini`) and `OPENAI_IMAGE_MODEL` (default `gpt-image-2.5-flare`).
3. Deploy a saved version to apply the environment revision. Reload the site; the connection status changes to OpenAI. Test a product guide, one recipe and one image with the actual account. The configured account must have available credits and access to these models.

API endpoints: authenticated `GET /api/ai/status`; same-origin, authenticated `POST /api/ai/guide`, `/kitchen`, `/advice`, `/image`, `/chat`. Sites supplies verified request identity. Server secrets never appear in browser bundles, localStorage, backups or AI responses. This Site remains owner-private.

## Local development

Copy `.env.example` to ignored `.env.local` and set the key locally. `npm run dev` runs Next on 127.0.0.1:5173 and the local gateway on 127.0.0.1:5175. Both development and built preview adapters are loopback-only and provide a local test identity; they are **not** deployed. `npm run build && npm start` previews the complete built app with its API gateway on port 5173 (override `PORT` if needed).

Quota exhaustion is shown explicitly; the Worker pauses provider attempts for five minutes after a quota failure. Refresh after adding credits. For simple experiments, `gpt-6-luna` is an optional starter model; changing models does not resolve an empty balance.

## Behaviour and limits

- Guide generation debounces names. Reviewed catalogue ranges override model guesses; unknown results cannot be applied. Cut produce uses a conservative chilled range. Estimates are not guarantees of safety and do not reveal the product's actual age or condition.
- Unknown food images are generated automatically only after AI recognises a food; known foods use bundled images. Manual generation is also available. One request per name is deduplicated in the browser session; generated JPEGs are cached in IndexedDB. Clearing browser data removes them. JSON backups contain image cache IDs, not generated image bytes.
- Recipe suggestions prioritise soon-expiring eligible stock and exclude expired/frozen/incompatible-temperature items. Strict schemas validate responses. Ingredient IDs, units and available amounts are verified server-side and again when cooking is confirmed.
- AI never edits stock. Only **Done** commits the user's reviewed quantities as one local transaction. An undo restores the entire latest cooking transaction.
- Names, quantities, expiry/storage details and the user's request are sent to OpenAI. History/waste advice also receives a limited weekly waste summary. API requests use `store:false`; this is not a claim of zero provider retention.
- No-key, denied access, quota, timeout, refusal and malformed-response states retain usable local fallback UI. Provider error bodies and credentials are never returned to the client.
- There are timeouts, request-size limits, output validation and per-isolate hourly rate guards (120 text requests / 12 images per user). These guards are best-effort and reset with isolates; set project billing/rate limits in OpenAI before broader deployment. Existing owner-only access is preserved.

Implementation references (kept in documentation, not the app footer):
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/resources/images/methods/generate
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
