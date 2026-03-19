# server

Express + TypeScript backend starter for Sakai with a controller/model/route/middleware structure and Supabase-backed example resource.

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
  schema.sql    starter schema for the sample resource
tests/
  app.test.ts
  course.model.test.ts
```

## API

- `GET /api/health`
- `GET /api/area-updates`
- `POST /api/area-updates/refresh`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/refresh`
- `POST /api/auth/sign-out`
- `GET /api/auth/me`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/courses`
- `GET /api/courses/:id`
- `POST /api/courses`

### Google OAuth Callback Behavior

- `GET /api/auth/google/callback` exchanges the Supabase auth code on the backend
- On success, it redirects to `AUTH_APP_REDIRECT_URI` with auth data in the URL fragment
- On failure, it redirects to `AUTH_APP_REDIRECT_URI` with an error fragment instead of returning JSON

### Sample `POST /api/courses` body

```json
{
  "code": "CS101",
  "title": "Introduction to Sakai",
  "description": "Course starter record"
}
```
