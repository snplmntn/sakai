# Feature 02: Route Network Foundation

## Goal
Create the deterministic route graph and seed data layer that all trip planning, ranking, and fare calculation will depend on.

This is the main backend foundation after auth. Without it, the product would fall back to hand-written demos or model-generated route guesses, which the PRD explicitly rejects.

## Current State
- The backend currently has auth, MMDA, and starter scaffolding only.
- There is no real route graph, stop store, or route normalization model.
- The PRD requires jeepney-first multimodal routes with understandable leg-by-leg guidance.

## Scope
Build the storage and read models for a small but real route network covering demo corridors.

In scope:
- canonical places and aliases
- stops
- route definitions
- route variants
- ride legs
- transfer points
- small seed dataset for high-confidence demo routes

Out of scope:
- full Metro Manila coverage
- dynamic crowd-sourced route merging
- map polyline generation
- background syncing from third-party route feeds

## Data Model
Create the following tables.

### `public.places`
Purpose:
- canonical destination, landmark, area, or station records used for search normalization

Columns:
- `id uuid primary key`
- `canonical_name text not null`
- `city text not null`
- `kind text not null`
- `latitude double precision not null`
- `longitude double precision not null`
- `google_place_id text null`
- `created_at timestamptz not null default timezone('utc', now())`

Allowed `kind` values:
- `landmark | station | area | campus | mall | terminal`

### `public.place_aliases`
Purpose:
- support natural destination wording and local abbreviations

Columns:
- `id uuid primary key`
- `place_id uuid not null references public.places(id) on delete cascade`
- `alias text not null`
- `normalized_alias text not null`

Indexes:
- unique index on `(place_id, normalized_alias)`
- index on `normalized_alias`

### `public.stops`
Purpose:
- concrete boarding/alighting points used by ride legs and transfers

Columns:
- `id uuid primary key`
- `place_id uuid null references public.places(id)`
- `stop_name text not null`
- `mode text not null`
- `area text not null`
- `latitude double precision not null`
- `longitude double precision not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default timezone('utc', now())`

Allowed `mode` values:
- `jeepney | uv | mrt3 | lrt1 | lrt2 | walk_anchor`

### `public.routes`
Purpose:
- logical transport lines or named route families

Columns:
- `id uuid primary key`
- `code text not null unique`
- `display_name text not null`
- `primary_mode text not null`
- `operator_name text null`
- `source_name text not null`
- `source_url text null`
- `trust_level text not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default timezone('utc', now())`

Allowed `trust_level` values:
- `trusted_seed | community_reviewed | demo_fallback`

### `public.route_variants`
Purpose:
- directional or branching variants of a route

Columns:
- `id uuid primary key`
- `route_id uuid not null references public.routes(id) on delete cascade`
- `display_name text not null`
- `direction_label text not null`
- `origin_place_id uuid null references public.places(id)`
- `destination_place_id uuid null references public.places(id)`
- `is_active boolean not null default true`
- `created_at timestamptz not null default timezone('utc', now())`

### `public.route_legs`
Purpose:
- ordered ride segments used to compose an option

Columns:
- `id uuid primary key`
- `route_variant_id uuid not null references public.route_variants(id) on delete cascade`
- `sequence integer not null`
- `mode text not null`
- `from_stop_id uuid not null references public.stops(id)`
- `to_stop_id uuid not null references public.stops(id)`
- `route_label text not null`
- `distance_km numeric(6,2) not null`
- `duration_minutes integer not null`
- `fare_product_code text null`
- `corridor_tag text not null`
- `created_at timestamptz not null default timezone('utc', now())`

Constraints:
- unique `(route_variant_id, sequence)`

### `public.transfer_points`
Purpose:
- deterministic walk transfers between stops or stations

Columns:
- `id uuid primary key`
- `from_stop_id uuid not null references public.stops(id)`
- `to_stop_id uuid not null references public.stops(id)`
- `walking_distance_m integer not null`
- `walking_duration_minutes integer not null`
- `is_accessible boolean not null default true`
- `created_at timestamptz not null default timezone('utc', now())`

Constraint:
- unique `(from_stop_id, to_stop_id)`

## Seed Strategy
Seed only a narrow, demo-friendly dataset in v1.

Required demo destinations:
- one university corridor
- one mall or business district corridor
- one train-linked corridor

Recommended seed corridors:
- Cubao to PUP Sta. Mesa
- Ortigas to Guadalupe or Ayala
- EDSA rail-linked corridor with a jeepney transfer

Seed rules:
- every route must have explicit ride legs
- every transfer must be an explicit transfer point
- no route may rely on AI-generated stop sequences
- every place used in a demo query must have aliases for common local phrasing

## Search and Normalization Rules
- destination lookup first checks exact `place_id`
- then `normalized_alias`
- then normalized `canonical_name`
- origin can be:
  - a known `place_id`
  - coordinates that map to the nearest eligible stop or place
- if multiple places resolve with similar confidence, route-query should return a deterministic ambiguity error rather than guessing

## Backend Implementation
Add:
- schema changes and TypeScript database types
- route graph models for place lookup, stop lookup, route-variant loading, and transfer loading
- seed script or SQL seed file for demo corridors

Suggested server modules:
- `place.model`
- `route.model`
- `transfer-point.model`
- `seed` script for demo data

Existing starter cleanup:
- keep `courses` until route endpoints exist
- once `POST /api/routes/query` is shipped, remove or isolate `courses` from README and route index

## Test Plan
Coverage must include:
- alias resolution for common destination phrasing
- route variant loads ordered legs by `sequence`
- transfer points can connect two ride legs deterministically
- unsupported place search returns a controlled error
- seeded demo routes exist and are queryable by their aliases

## Acceptance Criteria
- The backend can represent jeepney-only and mixed-mode routes without hand-coded controller logic.
- A route option can be built from stored legs and transfer points.
- Demo destinations resolve from local aliases and not only exact place names.

## Dependencies and Assumptions
- Depends on feature 01 only for preference-aware consumption later, not for schema correctness.
- Seed data should favor high-confidence demo coverage over breadth.
- Route graph shape is optimized for deterministic query assembly, not full GIS sophistication.
