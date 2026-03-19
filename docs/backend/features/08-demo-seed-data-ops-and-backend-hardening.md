# Feature 08: Demo Seed Data, Ops, and Backend Hardening

## Goal
Make the backend reproducible, demoable, and operationally sane once the core route, fare, AI, MMDA, and community features exist.

This feature is the closing pass that turns isolated features into a backend another engineer can boot and demonstrate from a fresh setup.

## Current State
- Auth and MMDA basics are already in place.
- The backend still contains starter scaffolding such as `courses`.
- There is no docs or seed-data system for a full PRD demo flow yet.

## Scope
Package the backend for repeatable local setup and hackathon demo readiness.

In scope:
- seed data workflow
- env documentation
- refresh job guidance
- API verification expectations
- starter cleanup
- runtime logging expectations

Out of scope:
- production deployment automation
- full admin dashboard
- advanced metrics stack
- large-scale job orchestration

## Seed Data Strategy
Create one explicit demo dataset version and keep it narrow.

Required coverage:
- at least one route to a university destination
- at least one route with a train transfer
- at least one route where a jeepney-heavy option and a faster multimodal option both exist
- at least one MMDA incident corridor relevant to the seeded route set

Seed assets to maintain:
- places and aliases
- stops
- routes and route variants
- route legs
- transfer points
- fare rule versions and products
- train station fares
- optional sample community submission records for manual QA only

Seed execution:
- prefer checked-in SQL or deterministic scripts
- do not rely on manual dashboard inserts
- seed scripts must be safe to re-run in development

## Env and Runtime Config
Document all required backend env in one place.

Existing env already in use:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_GOOGLE_REDIRECT_URI`
- `AUTH_APP_REDIRECT_URI`
- `AUTH_STATE_SIGNING_SECRET`
- `MMDA_SOURCE_URLS`

Additional env for the planned features:
- `GEMINI_API_KEY`
- `GEMINI_MODEL_PRIMARY`
- `GEMINI_MODEL_LIGHT`
- `MMDA_REFRESH_INTERVAL_MINUTES`
- `DEMO_DATASET_VERSION`
- optional `GOOGLE_MAPS_API_KEY` if backend geocoding or place enrichment is implemented

Operational defaults:
- MMDA refresh interval: `10` minutes
- route query should not fail just because MMDA refresh has not run recently
- AI provider failures should degrade to deterministic fallbacks where possible

## Backend Cleanup
Once core route resources exist:
- remove `courses` from the README API list
- remove `courses` route mounting from the main route index
- delete starter `course` model, controller, schema, and tests

Do not remove starter resources before real route APIs are merged and verified.

## Logging and Failure Handling
Add structured logs for:
- route query parse failures
- route query no-coverage results
- fare-table lookup failures
- MMDA refresh failures
- AI extraction validation failures
- community submission validation failures

Log rules:
- include request correlation id when available
- never log raw auth tokens
- avoid logging full personal payloads from community submissions unless needed for debugging

## Verification Expectations
Automated verification after the full backend feature set should include:
- `npm run typecheck`
- `npm test`
- route query contract tests
- fare engine tests
- MMDA refresh and relevance tests
- authenticated preferences and community tests

Manual QA checklist:
1. Sign in with email/password.
2. Save `Cheapest` and `Student` preferences.
3. Query a seeded trip such as Cubao to PUP Sta. Mesa.
4. Confirm multiple route options appear with totals and labels.
5. Confirm one route shows a relevant MMDA incident when seed and refresh data support it.
6. Submit a community route or fare correction.

## Acceptance Criteria
- A new engineer can configure env, apply schema, seed data, and run the backend without undocumented steps.
- The backend supports the PRD demo scenario with deterministic route and fare outputs.
- Starter sample resources no longer distract from the real product API surface.

## Dependencies and Assumptions
- Depends on features 01 through 07 being implemented or at least structurally present.
- Seed data remains intentionally narrow for the hackathon.
- Production-scale jobs, metrics, and admin tooling stay out of scope for MVP.
