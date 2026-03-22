# server

Express + TypeScript backend for Sakai with a controller/model/route/middleware structure and Supabase-backed auth plus MMDA area-update support.

## Requirements

- Node.js 20+
- A Supabase project with anon and service role keys

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_APP_REDIRECT_URI`, and `AUTH_STATE_SIGNING_SECRET`
   Optional auth override:
   - `AUTH_GOOGLE_REDIRECT_URI` if you want to force a fixed backend callback URL instead of using the current request origin
   Optional AI envs:
   - `AI_PROVIDER=vertex_express` with `VERTEX_API_KEY`
   - `AI_PROVIDER=gemini_developer` with `GEMINI_API_KEY`
   - `GOOGLE_API_KEY` for Gemini-based speech transcription
   - optional shared model envs: `GEMINI_MODEL_PRIMARY` and `GEMINI_MODEL_LIGHT`
   Optional MMDA refresh envs:
   - `MMDA_REFRESH_ENABLED=true` to run background refreshes automatically
   - `MMDA_REFRESH_INTERVAL_MINUTES=15` for the refresh cadence; lower values are allowed, but anything below `1` minute is clamped up
   - `MMDA_BROWSER_FALLBACK_ENABLED=true` to allow Playwright fallback when fetch returns Cloudflare, bot checks, or empty content
   - `MMDA_BROWSER_EXECUTABLE_PATH` if Chromium is installed in a non-standard location on your server
   - `MMDA_BROWSER_TIMEOUT_MS=20000` for browser navigation timeout
3. Run `npm install`
4. Install Chromium for Playwright with `npx playwright install chromium`, or point `MMDA_BROWSER_EXECUTABLE_PATH` at an existing Chromium binary
5. In Supabase Auth, enable the Email provider
6. In Supabase Auth, enable the Google provider and add your Google OAuth client credentials
7. Add your backend Google callback URL to the Supabase allowed redirect URLs.
   For local dev that is usually `http://localhost:3000/api/auth/google/callback`.
   For a deployed backend it should be your deployed API origin plus `/api/auth/google/callback`.
8. Set `AUTH_APP_REDIRECT_URI` to the app callback that should receive auth results after the backend exchanges the Google code.
   For the current Expo app this should be `sakai://auth/callback`.
9. Apply `supabase/schema.sql` to your Supabase database
   The schema is designed to upgrade the legacy one-table `public.routes(stop_id, stop_name, latitude, longitude)` import automatically, so you can run this directly on both fresh and older projects.
   If MMDA refresh still fails with `permission denied for table area_updates`, run:
   `supabase/fix-mmda-permissions.sql`.
10. Apply `supabase/seeds/fare-baseline.sql` for the feature 03 fare baseline
   This seeds fare versions, fare products, local LRT-1 and LRT-2 station places and stops, and deterministic train-fare lookups. LRT-1 is seeded as a full estimated station-step baseline, while LRT-2 currently seeds the exact Recto/Legarda/Pureza slice covered by the provided demo formula.
11. Import simulator transit graph coverage into `transit_stops` and `transit_stop_edges`:
   `npm run import:transit-graph`
12. Apply `supabase/seeds/alabang-pasay-route.sql` to import the current Alabang-to-Pasay jeepney line into the normalized route graph
13. Run `npm run dev`

### Importing A Route CSV

Use the route importer when you have an ordered stop CSV like `Ruta.csv`:

```bash
npm run import:route-csv -- --file ..\\Ruta.csv --route-code JEEP-ALABANG-PASAY --route-name "Alabang - Pasay" --variant-code JEEP-ALABANG-PASAY:OUTBOUND --variant-name "Alabang to Pasay via SLEX" --direction-label "Alabang to Pasay"
```

The importer writes to:
- `route_stop_import_rows` for the raw ordered stop import
- `places` for searchable routeable destinations
- `stops` for boarding and alighting nodes
- `routes` and `route_variants` for the logical route family and direction
- `route_legs` for the ordered ride sequence used by `POST /api/routes/query`

### Importing Transit Graph CSVs

Use the transit graph importer to load simulator coverage into the transit planner tables:

```bash
npm run import:transit-graph -- --nodes ..\\simulator\\nodes_supabase.csv --edges ..\\simulator\\edges_supabase.csv
```

The importer writes to:
- `transit_stops`
- `transit_stop_edges`

It is safe to re-run and uses deterministic upserts.

CSV requirements:
- header must be exactly `id,name,lat,lng`
- rows must be ordered in travel sequence
- every row must have valid coordinates

Defaults are tuned for the current `Ruta.csv`, but every route-level field can be overridden through CLI flags.

## Scripts

- `npm run dev`: start the development server with `tsx`
- `npm run build`: compile TypeScript to `dist`
- `npm start`: run the compiled server
- `npm run typecheck`: run TypeScript checks without emitting files
- `npm test`: run the test suite
- `npm run import:transit-graph`: import simulator transit graph CSV coverage into `transit_stops` and `transit_stop_edges`

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
  schema.sql    Supabase schema for Sakai backend tables; also upgrades legacy route-stop imports in place
  migrations/
    20260319_normalize_legacy_routes.sql  Historical/manual recovery migration; `schema.sql` now performs this upgrade automatically
  seeds/
    fare-baseline.sql  Feature 03 fare baseline plus local LRT-1/LRT-2 station manifests and deterministic train fares
    alabang-pasay-route.sql  Seeds the current Alabang-to-Pasay jeepney route into normalized places, stops, route variants, and route legs
tests/
  app.test.ts
```

## API

- `GET /api/health`
- `GET /api/area-updates`
- `POST /api/area-updates/relevant`
- `POST /api/area-updates/refresh` (auth required)
- `GET /api/places/search`
- `POST /api/speech/transcribe`
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
- raw route-stop import rows
- stops
- routes and route variants
- ordered route legs
- transfer points

These normalized tables back the current deterministic route-query endpoint and the separate jeepney seed pipeline.
The separate seed pipeline should write directly into these normalized tables instead of a staging area.

`route_stop_import_rows` preserves ordered raw stop imports such as the legacy Alabang-to-Pasay line. Runtime route queries should read only from normalized `places`, `stops`, `routes`, `route_variants`, `route_legs`, and `transfer_points`.

## Route Query Notes

- `POST /api/routes/query` accepts structured origin and destination input, optional `queryText`, optional `originFallback`, or both
- if `queryText` is used without explicit points, an AI provider must be configured so the backend can parse origin and destination hints first
- `GET /api/places/search` returns Sakai-known searchable places so the client can show routeable suggestions before Google Places results
- route points may include `placeId`, `googlePlaceId`, `label`, and optional coordinates
- coordinates are optional and are used to find nearby boarding or alighting stops with walk access within `500m` and drive access within `3km`
- route resolution prefers `placeId`, then `googlePlaceId`, then Sakai alias/canonical-name search, then nearby coordinate fallback
- auth is optional; when a valid bearer token is present, the backend uses saved preferences if request overrides are absent
- queryText ambiguity returns `400` clarification details instead of guessing
- explicit structured place ambiguity or unresolved places return `422`
- valid but unsupported trips return `200` with `options: []` and a coverage message
- v1 route composition supports direct routes and routes with one explicit transfer point
- Sakai transit graph (`transit_stops`/`transit_stop_edges`) is the primary route source; Google route fallback runs only when Sakai planners return zero options
- `POST /api/speech/transcribe` uses `GOOGLE_API_KEY` for backend speech-to-text and feeds the same route-query flow as typed search

## Internal Fare Engine Foundation

The backend now also includes versioned fare tables and an internal fare-pricing service for:
- active fare-rule version lookup by mode
- product-backed jeepney, UV, and car-estimate pricing
- stop-to-stop train fare lookups
- route-level fare confidence and assumption reporting

Feature 03 does not add public `/api/fares/*` endpoints yet. Route-query work should compose ride legs and transfer walks first, then call the internal fare engine to attach leg-by-leg fare breakdowns and totals.

## AI Route Parsing, MMDA Structuring, And Summaries

The backend now supports optional Vertex/Gemini-powered route intent parsing, MMDA alert structuring, and rider-facing route summaries.

- Supported provider modes:
  - `AI_PROVIDER=vertex_express` with `VERTEX_API_KEY`
  - `AI_PROVIDER=gemini_developer` with `GEMINI_API_KEY`
- The backend defaults to `vertex_express` when `AI_PROVIDER` is omitted.
- Shared model envs still default to `gemini-2.5-flash` and `gemini-2.5-flash-lite`.
- Explicit request fields still win over AI hints.
- If the selected AI provider is unavailable and the request already has explicit origin and destination fields, route query continues deterministically.
- Route summaries fall back to a deterministic template when AI is disabled or unavailable.
- MMDA refresh uses AI to classify `severity`, build a short `summary`, normalize `corridorTags`, and compute `displayUntil`.
- The server now also runs MMDA refresh automatically on startup and then on a repeating interval when `MMDA_REFRESH_ENABLED=true`.
- Automatic MMDA refresh is enabled by default in `development` and `production`, and disabled by default in `test`.
- The default automatic MMDA cadence is every `15` minutes. You can lower it if you want fresher alerts, but keep in mind that more frequent scraping means more source requests and more AI calls.
- MMDA source fetching now tries plain `fetch` first and falls back to Playwright Chromium when a page looks blocked by Cloudflare, bot checks, or JS-only rendering.
- If MMDA refresh fails, the backend keeps serving the last stored alerts that have not yet expired.

### Google OAuth Callback Behavior

- `GET /api/auth/google/start` accepts an optional `appRedirectUri` query string so the client can tell the backend which deep link should receive the auth result
- Browser requests to `GET /api/auth/google/start` redirect directly to the Supabase Google authorize URL so mobile auth can survive backend cold starts
- API callers can still request `Accept: application/json` to receive the authorize URL in the existing JSON envelope
- The backend derives its own Google callback URL from the current request origin unless `AUTH_GOOGLE_REDIRECT_URI` is explicitly set as an override
- `GET /api/auth/google/callback` exchanges the Supabase auth code on the backend
- On success, it redirects to the signed app redirect URI with auth data in the URL fragment
- On failure, it redirects to the same app redirect URI with an error fragment instead of returning JSON
