# Feature 01: User Preferences and Passenger Profile

## Goal
Persist the authenticated rider settings the rest of the backend needs for route ranking and fare discount logic.

This feature exists so later route-query and fare-engine work can read stable user defaults instead of relying on frontend-only state.

## Current State
- Backend auth already exists through Supabase.
- There is no backend table or endpoint for route preference or passenger type.
- The PRD requires:
  - default route preference: `Fastest`, `Cheapest`, or `Balanced`
  - support for passenger or discount profile where fare rules make that relevant

## Scope
Implement a single preferences resource for the signed-in user.

In scope:
- default route preference
- passenger type
- timestamps
- authenticated read and update endpoints
- deterministic defaults when no row exists

Out of scope:
- frontend onboarding UI
- per-trip overrides beyond request-level route query payloads
- notification settings
- active trip persistence

## Data Model
Create `public.user_preferences`.

Required columns:
- `user_id uuid primary key`
- `default_preference text not null`
- `passenger_type text not null`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

Allowed values:
- `default_preference`: `fastest | cheapest | balanced`
- `passenger_type`: `regular | student | senior | pwd`

Constraints:
- `user_id` must reference `auth.users(id)`
- add `check` constraints for both enum-like text fields
- update `updated_at` on every write

Default behavior when no row exists:
- treat the user as:
  - `defaultPreference = balanced`
  - `passengerType = regular`
- `GET /api/me/preferences` should return those defaults even if no row has been inserted yet

## API Contract
### `GET /api/me/preferences`
Auth:
- requires `Authorization: Bearer <access_token>`

Success response:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "defaultPreference": "balanced",
    "passengerType": "regular",
    "isPersisted": false,
    "createdAt": null,
    "updatedAt": null
  }
}
```

### `PUT /api/me/preferences`
Auth:
- requires `Authorization: Bearer <access_token>`

Request body:
```json
{
  "defaultPreference": "cheapest",
  "passengerType": "student"
}
```

Rules:
- both fields are required on update for v1
- invalid enum values return `400`
- endpoint performs upsert by `user_id`

Success response:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "defaultPreference": "cheapest",
    "passengerType": "student",
    "isPersisted": true,
    "createdAt": "2026-03-19T00:00:00.000Z",
    "updatedAt": "2026-03-19T00:00:00.000Z"
  }
}
```

## Backend Implementation
Add:
- Supabase schema migration and generated database typing
- model for fetching and upserting preferences
- request schema validation
- controller and routes mounted under `/api/me`

Suggested server structure:
- `server/src/models/user-preference.model.ts`
- `server/src/schemas/user-preference.schema.ts`
- `server/src/controllers/user-preference.controller.ts`
- `server/src/routes/me.routes.ts`

Auth handling:
- reuse existing bearer-token user lookup from auth feature
- derive `user_id` from the token, never from client input

Integration rules:
- route-query feature must read these values when request overrides are absent
- fare-engine feature must use `passengerType`

## Test Plan
Unit and integration coverage must include:
- `GET /api/me/preferences` returns defaults for a user with no row
- `PUT /api/me/preferences` inserts a new row
- second `PUT` updates the same row instead of creating duplicates
- invalid `defaultPreference` is rejected
- invalid `passengerType` is rejected
- missing bearer token returns `401`
- route-query integration can consume returned defaults later

## Acceptance Criteria
- The backend can persist and return a signed-in user's default ranking preference.
- The backend can persist and return a signed-in user's passenger type.
- Consumers can treat the resource as always available because default values are returned even before first save.

## Dependencies and Assumptions
- Depends on the existing auth endpoints and bearer-token validation.
- Uses PRD defaults of `Fastest`, `Cheapest`, and `Balanced`.
- Uses only the passenger types explicitly needed by PRD fare logic for MVP.
