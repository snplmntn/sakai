# server

Express + TypeScript backend starter for Sakai with a controller/model/route/middleware structure and Supabase-backed example resource.

## Requirements

- Node.js 20+
- A Supabase project with a service role key

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Run `npm install`
4. Apply `supabase/schema.sql` to your Supabase database
5. Run `npm run dev`

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
- `GET /api/courses`
- `GET /api/courses/:id`
- `POST /api/courses`

### Sample `POST /api/courses` body

```json
{
  "code": "CS101",
  "title": "Introduction to Sakai",
  "description": "Course starter record"
}
```
