# Feature 07: Community Submissions and Moderation

## Goal
Let authenticated users contribute missing route and fare knowledge without contaminating trusted route and fare data directly.

This feature supports the PRD's community-powered data strategy and creates a path for coverage to improve over time.

## Current State
- There is no submission or moderation resource in the backend.
- The PRD requires users to submit:
  - missing routes
  - route corrections
  - fare updates
  - route notes

## Scope
Implement one generic submission pipeline with moderation status and per-user listing.

In scope:
- authenticated submission creation
- storage of structured proposal payloads
- moderation-state tracking
- user-owned listing endpoint

Out of scope:
- reviewer UI
- automatic merge into trusted route graph
- public community feed
- attachments and media uploads

## Data Model
Create `public.community_submissions`.

Columns:
- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `submission_type text not null`
- `status text not null default 'pending'`
- `title text not null`
- `payload jsonb not null`
- `source_context jsonb null`
- `review_notes text null`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

Allowed `submission_type` values:
- `missing_route`
- `route_correction`
- `fare_update`
- `route_note`

Allowed `status` values:
- `pending`
- `reviewed`
- `approved`
- `rejected`

Payload guidance by type:
- `missing_route`:
  - origin text
  - destination text
  - known ride modes
  - optional suggested stops
- `route_correction`:
  - target route or place id
  - incorrect detail
  - proposed correction
- `fare_update`:
  - affected mode or product
  - proposed amount
  - optional source note
- `route_note`:
  - free-form commute note tied to a route or area

## API Contract
### `POST /api/community/submissions`
Auth:
- required

Request body:
```json
{
  "submissionType": "fare_update",
  "title": "Modern jeep fare seems outdated on Cubao route",
  "payload": {
    "routeCode": "CUBAO-PUP",
    "proposedAmount": 17,
    "passengerType": "regular",
    "note": "Driver charged 17 today."
  },
  "sourceContext": {
    "routeQueryId": "optional-debug-id"
  }
}
```

Rules:
- `title` required and capped to a reasonable length
- `payload` required and validated as an object
- `submissionType` drives additional payload validation

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "submissionType": "fare_update",
    "status": "pending",
    "title": "Modern jeep fare seems outdated on Cubao route",
    "payload": {},
    "sourceContext": {},
    "createdAt": "2026-03-19T00:00:00.000Z"
  }
}
```

### `GET /api/community/submissions/mine`
Auth:
- required

Behavior:
- returns only the current user's submissions
- newest first
- optional query param `status` may filter by moderation state

## Moderation Rules
For MVP, moderation is data-state only.

Behavior:
- new submissions always start as `pending`
- no user-facing endpoint may mutate to `approved` or `rejected`
- trusted route and fare data must not auto-update from community submissions

Optional later admin scope:
- `PATCH /api/community/submissions/:id/status`
- keep this out of MVP unless an actual reviewer workflow is built

## Backend Implementation
Add:
- schema and type updates
- submission request validation with type-specific payload checks
- authenticated create and list models
- routes mounted under `/api/community`

Suggested modules:
- `community-submission.model`
- `community-submission.schema`
- `community-submission.controller`
- `community.routes`

Integration hooks:
- `source_context` may store route or fare context from the current screen so reviewers can reproduce the report later

## Test Plan
Coverage must include:
- authenticated create success for each submission type
- invalid submission type rejected
- malformed payload rejected
- missing bearer token rejected
- `GET /mine` returns only the current user's records
- filtering by `status` works
- new submissions are always persisted as `pending`

## Acceptance Criteria
- Authenticated users can submit route and fare contributions through one stable backend contract.
- Community data is stored separately from trusted route and fare datasets.
- Users can review their own submitted records later.

## Dependencies and Assumptions
- Depends on auth for `user_id`.
- Does not depend on route-query shipping first, but becomes more useful once route ids and route context are available.
- Moderation remains manual/offline for MVP.
