# Business workspace redesign QA

The new UI replaces the cream/green/turquoise style with graphite navigation, white surfaces, a neutral `#F5F6FA` canvas and cobalt `#4354EC` actions. Inter is used throughout. The CSS was consolidated rather than adding another copy of the old design. The favicon and browser theme colour match the new identity.

The dashboard adds stock, urgent-expiry and weekly-waste metrics backed by current inventory. Storage cards expose product previews and zone filters. Existing profile authentication, per-profile browser stock, partial use/discard, cooking, undo, history and AI connection are retained. No credentials, access policies, account schema or backend API behavior changed in this redesign.

Build: Next production export + Worker and TypeScript pass. All 56 browser audits pass, with no horizontal overflow, broken loaded images or unexpected browser errors. Browser coverage uses the built artifact with paid AI disabled and an isolated local profile database. `tests/business-flow.cjs` covers RU/EN at 320, 390, 430, 1440 and 1920 px: login, product configuration, automatic temperature, native date field, pieces, save, expandable details, partial usage/discard, overdraw prevention, persistence and losses. Desktop covers storage previews, cooking/undo, chat fallback and rejected-password/re-login. Mobile forms are also checked in a 430px-high viewport; physical device keyboard and OS date-picker appearance are not verified.

Motion includes section entry, shared active navigation/pills, card entry/hover and expanding storage previews. The 320px tests use reduced motion. Screenshots and the detailed report are generated under ignored `outputs/business-qa/`; the recorded audit report is kept beside this document. Earlier premium and desktop reports describe superseded styles.

Server API credentials are absent from browser bundles. The existing OpenAI connection is preserved; this UI-only change makes no paid provider request and does not re-verify the account balance or live model output.
