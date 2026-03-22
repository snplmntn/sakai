# Sakai

Sakai is a voice-first commute assistant for the Philippines. The product is jeepney-first but multimodal, with practical route combinations, fare visibility, route-relevant MMDA updates, and community-powered route improvement.

The canonical product reference lives in [sakai-prd.md](./sakai-prd.md).

## Repository layout

- `client/` Expo React Native app for trip search, route viewing, onboarding, auth, saved places, and navigation flows
- `server/` Express + TypeScript backend with Supabase auth, route query APIs, fare logic, MMDA ingestion, and saved-place support
- `web/` Next.js marketing and guide site
- `simulator/` Transit graph and route-simulator assets used for route experimentation and data import
- `docs/` backend feature specs and simulator support files

## Prerequisites

- Node.js 20+
- npm
- Python 3.11+ for simulator scripts
- A Supabase project for backend data and auth
- Google Maps / Places keys for the mobile app map and place search experience
- Optional: `ORS_API_KEY` if you want OpenRouteService geometry in the simulator

## Quick start

Sakai does not use a single root package. Install and run each app from its own folder.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Fill in the required Supabase, auth, and AI values in `server/.env`, then run:

```bash
npm run dev
```

Useful backend commands:

```bash
npm run typecheck
npm test
npm run import:transit-graph
```

For backend setup, schema import, route CSV import, and API details, see [server/README.md](./server/README.md).

### 2. Mobile client

```bash
cd client
npm install
cp .env.example .env
npm start
```

Client envs:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`

Useful client commands:

```bash
npm run typecheck
npm run android
npm run android:release:local
npm run ios
npm run web
```

Local Android release APK:

```bash
cd client
npm run android:release:local
```

Notes:

- The release command reads values from `client/.env` and fails if any required `EXPO_PUBLIC_*` value is missing or still uses a placeholder.
- `EXPO_PUBLIC_API_BASE_URL` must point to a reachable backend URL for device testing. Local-only hosts like `localhost` and `10.0.2.2` are rejected.
- The generated APK is written to `client/android/app/build/outputs/apk/release/app-release.apk`.
- This local release build is signed with `client/android/app/debug.keystore`, so it is intended for direct install and testing, not Play Store distribution.
- If Google Maps does not render in the APK, verify the Google Maps Android app restriction matches package `com.anonymous.sakaiapp` and the debug-keystore SHA-1 printed by the release script.

### 3. Web site

```bash
cd web
npm install
npm run dev
```

Useful web commands:

```bash
npm run build
npm run start
```

## Data and simulator

The `simulator/` folder contains the current transit graph exports, GTFS-derived artifacts, and local route simulation tools.

To run the ORS-enhanced simulator:

```bash
cd simulator
$env:ORS_API_KEY="your-openrouteservice-key"
python route_simulator_ors.py "EDSA LRT" "Pureza LRT" --preference mix
```

Notes:

- `ORS_API_KEY` is optional. If it is unset, the simulator still runs and falls back to non-ORS geometry.
- `simulator/SUPABASE_IMPORT.md` documents the generated CSV import order for Supabase-backed transit tables.
- The backend transit graph importer expects `simulator/nodes_supabase.csv` and `simulator/edges_supabase.csv`.

## Product and engineering notes

- Sakai should stay deterministic for routes, stops, fares, and ranking.
- AI is used for intent parsing, MMDA structuring, and rider-facing summaries rather than inventing route data.
- User-facing copy should stay practical and clear, aligned with the PRD.

## Related docs

- [sakai-prd.md](./sakai-prd.md)
- [server/README.md](./server/README.md)
- [docs/backend/features/README.md](./docs/backend/features/README.md)
