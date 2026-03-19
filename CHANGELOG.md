# Sakai Change Log

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
