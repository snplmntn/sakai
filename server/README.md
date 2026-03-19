# server

Express + TypeScript backend for Sakai with a controller/model/route/middleware structure and Supabase-backed auth plus MMDA area-update support.

## Requirements

- Node.js 20+
- A Supabase project with anon and service role keys

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_GOOGLE_REDIRECT_URI`, `AUTH_APP_REDIRECT_URI`, and `AUTH_STATE_SIGNING_SECRET`
   Optional AI envs:
   - `AI_PROVIDER=gemini_developer` with `GEMINI_API_KEY`
   - `AI_PROVIDER=vertex_express` with `VERTEX_API_KEY`
   - optional shared model envs: `GEMINI_MODEL_PRIMARY` and `GEMINI_MODEL_LIGHT`
3. Run `npm install`
4. In Supabase Auth, enable the Email provider
5. In Supabase Auth, enable the Google provider and add your Google OAuth client credentials
6. Add `AUTH_GOOGLE_REDIRECT_URI` to the Supabase allowed redirect URLs
7. Set `AUTH_APP_REDIRECT_URI` to the app or local web callback that should receive auth results after the backend exchanges the Google code
8. Apply `supabase/schema.sql` to your Supabase database
9. Apply `supabase/seeds/fare-baseline.sql` for the feature 03 fare baseline
   This always seeds fare versions and fare products. The seeded LRT-2 train fares only load after matching LRT-2 station stops already exist in `public.stops`, so re-run the seed after route-network stop data is loaded.
10. Run `npm run dev`

## Scripts

- `npm run dev`: start the development server with `tsx`
- `npm run build`: compile TypeScript to `dist`
- `npm start`: run the compiled server
- `npm run typecheck`: run TypeScript checks without emitting files
- `npm test`: run the test suite

## Project Structure

```text
src/
  config/       environment and Supabase client setup
  controllers/  request handlers
  middlewares/  validation and error handling
  models/       Supabase query modules
  routes/       route definitions
  schemas/      Zod request schemas
  types/        shared TypeScript types
  app.ts        Express app assembly
  server.ts     process entrypoint
supabase/
  schema.sql    Supabase schema for Sakai backend tables
  seeds/
    fare-baseline.sql  Minimal fare baseline for feature 03; train fares require matching seeded train stops
tests/
  app.test.ts
```

## API

- `GET /api/health`
- `GET /api/area-updates`
- `POST /api/area-updates/refresh` (auth required)
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/refresh`
- `POST /api/auth/sign-out`
- `GET /api/auth/me`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/me/preferences` (auth required)
- `PUT /api/me/preferences` (auth required)
- `POST /api/routes/query` (auth optional)

## Internal Route Network Foundation

The backend now includes normalized route-network tables and internal read models for:
- places and aliases
- stops
- routes and route variants
- ordered route legs
- transfer points

These normalized tables back the current deterministic route-query endpoint and the separate jeepney seed pipeline.
The separate seed pipeline should write directly into these normalized tables instead of a staging area.

## Route Query Notes

- `POST /api/routes/query` accepts structured origin and destination input, optional `queryText`, or both
- if `queryText` is used without explicit points, an AI provider must be configured so the backend can parse origin and destination hints first
- coordinates are optional and are used to find nearby boarding or alighting stops within `500m`
- auth is optional; when a valid bearer token is present, the backend uses saved preferences if request overrides are absent
- queryText ambiguity returns `400` clarification details instead of guessing
- explicit structured place ambiguity or unresolved places return `422`
- valid but unsupported trips return `200` with `options: []` and a coverage message
- v1 route composition supports direct routes and routes with one explicit transfer point
- Google Maps remains place and map infrastructure only; the backend does not delegate route generation to Google

## Internal Fare Engine Foundation

The backend now also includes versioned fare tables and an internal fare-pricing service for:
- active fare-rule version lookup by mode
- product-backed jeepney, UV, and car-estimate pricing
- stop-to-stop train fare lookups
- route-level fare confidence and assumption reporting

Feature 03 does not add public `/api/fares/*` endpoints yet. Route-query work should compose ride legs and transfer walks first, then call the internal fare engine to attach leg-by-leg fare breakdowns and totals.

## AI Route Parsing And Summaries

The backend now supports optional Gemini-powered intent parsing and route summaries for `POST /api/routes/query`.

- Supported provider modes:
  - `AI_PROVIDER=gemini_developer` with `GEMINI_API_KEY`
  - `AI_PROVIDER=vertex_express` with `VERTEX_API_KEY`
- Shared model envs still default to `gemini-2.5-flash` and `gemini-2.5-flash-lite`.
- Explicit request fields still win over AI hints.
- If the selected AI provider is unavailable and the request already has explicit origin and destination fields, route query continues deterministically.
- Route summaries fall back to a deterministic template when AI is disabled or unavailable.

### Google OAuth Callback Behavior

- `GET /api/auth/google/callback` exchanges the Supabase auth code on the backend
- On success, it redirects to `AUTH_APP_REDIRECT_URI` with auth data in the URL fragment
- On failure, it redirects to `AUTH_APP_REDIRECT_URI` with an error fragment instead of returning JSON
