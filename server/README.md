# server

Express + TypeScript backend for Sakai with a controller/model/route/middleware structure and Supabase-backed auth plus MMDA area-update support.

## Requirements

- Node.js 20+
- A Supabase project with anon and service role keys

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_GOOGLE_REDIRECT_URI`, `AUTH_APP_REDIRECT_URI`, and `AUTH_STATE_SIGNING_SECRET`
3. Run `npm install`
4. In Supabase Auth, enable the Email provider
5. In Supabase Auth, enable the Google provider and add your Google OAuth client credentials
6. Add `AUTH_GOOGLE_REDIRECT_URI` to the Supabase allowed redirect URLs
7. Set `AUTH_APP_REDIRECT_URI` to the app or local web callback that should receive auth results after the backend exchanges the Google code
8. Apply `supabase/schema.sql` to your Supabase database
9. Run `npm run dev`

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

## Internal Route Network Foundation

The backend now includes normalized route-network tables and internal read models for:
- places and aliases
- stops
- routes and route variants
- ordered route legs
- transfer points

These are import-ready foundations for the separate jeepney seed pipeline and future route-query work. Feature 02 does not add public `/api/routes/*` endpoints yet, and it does not ship temporary route seed content.
The separate seed pipeline should write directly into these normalized tables instead of a staging area.

### Google OAuth Callback Behavior

- `GET /api/auth/google/callback` exchanges the Supabase auth code on the backend
- On success, it redirects to `AUTH_APP_REDIRECT_URI` with auth data in the URL fragment
- On failure, it redirects to `AUTH_APP_REDIRECT_URI` with an error fragment instead of returning JSON
