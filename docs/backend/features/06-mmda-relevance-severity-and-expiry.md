# Feature 06: MMDA Relevance, Severity, and Expiry

## Goal
Finish the MMDA backend so incidents become route-aware rider signals instead of just scraped records.

The scraper and storage groundwork already exist. This feature aligns the implementation to the PRD by adding severity, display windows, and trip relevance.

## Current State
- The backend already supports:
  - MMDA scraping from configured source URLs
  - raw area update storage
  - list and refresh endpoints
- The backend does not yet fully implement the PRD rules for:
  - `severity`
  - `displayUntil`
  - route-aware incident surfacing
  - rider-facing summaries

## Scope
Extend the MMDA pipeline so route results can surface only active, relevant incidents.

In scope:
- schema extension for severity and expiry
- AI extraction completion
- fixed visibility windows
- relevance matching against route corridors and places
- route-response integration

Out of scope:
- full citywide live traffic feed UX
- predictive traffic duration modeling
- external incident merging beyond MMDA

## Data Model
Extend `public.area_updates`.

Add columns:
- `severity text not null`
- `display_until timestamptz not null`
- `summary text not null`
- `corridor_tags text[] not null default '{}'`
- `normalized_location text not null`

Allowed `severity` values:
- `low | medium | high`

Rules:
- `scraped_at` remains the latest scrape timestamp
- `display_until` is recomputed whenever the same `external_id` is refreshed
- `created_at` remains first-seen time

Relevance helpers:
- `corridor_tags` should store normalized corridor strings such as:
  - `edsa`
  - `ortigas`
  - `roxas-blvd`
  - `c5`
  - `aurora`
  - `sta-mesa`
- `normalized_location` stores a normalized single-string location summary for text matching fallback

Indexes:
- index on `display_until desc`
- GIN index on `corridor_tags`

## Severity and Expiry Rules
Lock the PRD windows exactly:
- `low`: `display_until = scraped_at + 1 hour`
- `medium`: `display_until = scraped_at + 3 hours`
- `high`: `display_until = scraped_at + 5 hours`

Classification guidance:
- `low`: minor obstruction or limited impact
- `medium`: active incident with meaningful slowdown or lane occupation
- `high`: major disruption or likely prolonged traffic effect

Refresh rule:
- when a refreshed scrape matches an existing `external_id`, update:
  - structured fields
  - `scraped_at`
  - `severity`
  - `display_until`
  - `summary`
  - `corridor_tags`

## Route Relevance Rules
Relevance should be computed on read during route query.

A route option is affected by an incident if any of these are true:
- the route option shares at least one `corridor_tag`
- the incident `normalized_location` matches the route origin area
- the incident `normalized_location` matches the route destination area
- the incident `normalized_location` matches the request `currentArea`

Filtering rules:
- only incidents with `display_until > now()` are eligible
- return at most `3` incidents per route option
- sort relevant incidents by:
  - `severity desc`
  - `scraped_at desc`

Route response addition:
- extend each route option with:
  - `relevantIncidents[]`

Incident response shape:
```json
{
  "id": "uuid",
  "alertType": "Road crash incident",
  "location": "Ortigas Avenue before EDSA intersection",
  "direction": "WB",
  "severity": "medium",
  "summary": "Crash near Ortigas-EDSA is occupying one lane and may slow westbound travel.",
  "displayUntil": "2026-03-19T20:29:00.000Z",
  "scrapedAt": "2026-03-19T17:29:00.000Z",
  "sourceUrl": "https://x.com/MMDA"
}
```

## AI Extraction Contract
Use AI to extract and validate:
- `alertType`
- `location`
- `direction`
- `involved`
- `reportedTimeText`
- `laneStatus`
- `trafficStatus`
- `severity`
- `summary`
- `corridorTags`

Guardrails:
- if AI extraction fails validation, keep the raw record for back-office visibility but do not surface it in route results
- use deterministic visibility-window logic after severity is chosen

## Backend Implementation
Add:
- schema migration and database typings
- MMDA extraction result validation
- severity-to-expiry helper
- relevance filter helper consumed by route query

Existing endpoints:
- keep `GET /api/area-updates`
- keep `POST /api/area-updates/refresh`

Behavior changes:
- `GET /api/area-updates` should default to active incidents only unless an explicit admin-style flag is added later
- `POST /api/routes/query` should attach `relevantIncidents` to each route option

## Test Plan
Coverage must include:
- `low`, `medium`, and `high` display-window computation
- refresh of an existing incident extends `displayUntil`
- expired incidents are excluded from route results
- route option receives incidents only when corridor or area match occurs
- at most three incidents are attached to a route option
- invalid AI extraction does not break refresh processing
- summaries and severity are persisted on successful extraction

## Acceptance Criteria
- MMDA incidents shown to riders are active, route-relevant, and severity-labeled.
- The same incident extends its visibility window when refreshed.
- Route results can explain why an incident matters without exposing raw noisy MMDA text as the primary UX.

## Dependencies and Assumptions
- Depends on feature 04 route options exposing corridor tags and origin/destination context.
- Uses AI only for structured extraction and summaries, not for route-impact prediction.
- Keeps MMDA as the only official-source incident feed for MVP.
