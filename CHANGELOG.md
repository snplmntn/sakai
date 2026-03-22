# Sakai Change Log

## 2026-03-22

### Client: Route Search Voice UI
- Removed the floating tab-bar microphone from [CustomTabBar.tsx](/E:/sakai/client/src/components/CustomTabBar.tsx) and simplified the tab bar back to Home/Profile navigation only.
- Moved voice capture control into [RoutesScreen.tsx](/E:/sakai/client/src/screens/RoutesScreen.tsx) with a hold-to-speak microphone button inside the route search card.
- Removed the route-screen dependency on `VoiceSearchContext` tab-bar trigger tokens and localised the voice interaction to the screen that owns route search.
- Cleaned up several malformed route-screen text glyphs in [RoutesScreen.tsx](/E:/sakai/client/src/screens/RoutesScreen.tsx) so arrows and separators render correctly.

### Client: Public Env Handling
- Simplified public env reads in [env.ts](/E:/sakai/client/src/config/env.ts) by normalizing `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` once and reusing the normalized values for required and optional checks.
- Kept the existing fallback behavior where Places uses the Maps key when a dedicated Places key is absent.

### Backend: Fare Policy
- Updated fare rounding in [fare-engine.service.ts](/E:/sakai/server/src/services/fare-engine.service.ts), [route-query.service.ts](/E:/sakai/server/src/services/route-query.service.ts), [transit-route-query.service.ts](/E:/sakai/server/src/services/transit-route-query.service.ts), and [google-route-fallback.service.ts](/E:/sakai/server/src/services/google-route-fallback.service.ts) to always round fare outputs up to the next whole peso instead of keeping decimal currency amounts.
- Updated runtime train discount handling in [fare-engine.service.ts](/E:/sakai/server/src/services/fare-engine.service.ts), [transit-route-query.service.ts](/E:/sakai/server/src/services/transit-route-query.service.ts), and [google-route-fallback.service.ts](/E:/sakai/server/src/services/google-route-fallback.service.ts) so discounted train pricing is calculated as 50% of the regular fare.
- Updated generated rail fare references in [rail-fare-reference.ts](/E:/sakai/server/src/services/rail-fare-reference.ts) so seeded and formula-based discounted train fares follow the same 50%-off, round-up policy.

### Tests
- Updated fare expectations in [fare-engine.service.test.ts](/E:/sakai/server/tests/fare-engine.service.test.ts), [route-query.service.test.ts](/E:/sakai/server/tests/route-query.service.test.ts), and [rail-fare-reference.test.ts](/E:/sakai/server/tests/rail-fare-reference.test.ts) to match whole-peso rounding and 50%-off train pricing.
- Verified pricing-focused coverage with:
  - `npm test -- fare-engine.service.test.ts google-route-fallback.service.test.ts rail-fare-reference.test.ts`
- The broader `route-query.service.test.ts` and `transit-route-query.service.test.ts` suites currently have separate pre-existing test drift in this branch and were not fully brought back to green as part of this change.

## 2026-03-19

### Product Requirements
- Expanded [sakai-prd.md](/E:/sakai/sakai-prd.md) to include MMDA-based route-relevant area updates.
- Added PRD guidance for AI extraction of MMDA alert fields, severity classification, and alert visibility windows.

### Backend: MMDA Area Updates
- Added MMDA scraping and parsing support in [mmda-alert.service.ts](/E:/sakai/server/src/services/mmda-alert.service.ts).
- Added area update model, controller, schemas, routes, and tests for listing and refreshing MMDA-backed area updates.
- Mounted `GET /api/area-updates` and `POST /api/area-updates/refresh`.
- Added `area_updates` database typing and Supabase schema definitions with unique `external_id` and `scraped_at` indexes.
- Added `MMDA_SOURCE_URLS` env support with documented defaults.

### Backend: Auth
- Added email/password auth endpoints:
  - `POST /api/auth/sign-up`
  - `POST /api/auth/sign-in`
  - `POST /api/auth/refresh`
  - `POST /api/auth/sign-out`
  - `GET /api/auth/me`
- Added Google OAuth endpoints:
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
- Added Supabase anon-client auth support alongside the service-role admin client.
- Normalized backend auth responses to return typed `user` and `session` payloads for the mobile app.

### OAuth Hardening
- Replaced process-local PKCE state storage with signed stateless OAuth state validation.
- Added redirect-based Google callback handoff to `AUTH_APP_REDIRECT_URI` using URL fragments for auth results.
- Added `AUTH_STATE_SIGNING_SECRET` and `AUTH_APP_REDIRECT_URI` env requirements.

### Docs and Repo Guidance
- Expanded [server/README.md](/E:/sakai/server/README.md) with auth endpoints, MMDA routes, and Supabase provider setup steps.
- Added repo, client, and server `AGENTS.md` guides to align future work with the PRD and typed backend/frontend guardrails.

### Verification
- `npm run typecheck`
- `npm test`
