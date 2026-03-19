# Feature 03: Fare Engine and Fare Tables

## Goal
Build a deterministic fare engine that can price each route leg and total trip cost using versioned fare data and explicit trust labeling.

This is a core PRD differentiator. Sakai should not present cost as static UI text or model-generated estimates without provenance.

## Current State
- No fare tables or pricing engine exist in the backend.
- The PRD already defines required MVP fare policies and transparency rules.
- Route legs in feature 02 will expose `mode`, `distance_km`, and `fare_product_code`, which are enough to price a seeded demo network deterministically.

## Scope
Implement versioned fare storage and a fare-calculation module for demo-supported modes.

In scope:
- fare rule versions
- fare products for jeepney and UV pricing
- train station fare tables
- discount handling
- fare provenance labels
- stale-data signaling

Out of scope:
- live fare scraping from government sites
- tricycle and bus pricing
- dynamic toll and parking calculations beyond a simple config
- fare disputes or moderation workflow

## Data Model
Create the following tables.

### `public.fare_rule_versions`
Purpose:
- version and label every official or fallback fare ruleset

Columns:
- `id uuid primary key`
- `mode text not null`
- `version_name text not null`
- `source_name text not null`
- `source_url text not null`
- `effectivity_date date not null`
- `verified_at timestamptz not null`
- `is_active boolean not null default false`
- `trust_level text not null`
- `created_at timestamptz not null default timezone('utc', now())`

Allowed `trust_level` values:
- `official | estimated | demo_fallback`

### `public.fare_products`
Purpose:
- store distance-based fare logic for non-train modes

Columns:
- `id uuid primary key`
- `fare_rule_version_id uuid not null references public.fare_rule_versions(id) on delete cascade`
- `product_code text not null unique`
- `mode text not null`
- `vehicle_class text not null`
- `minimum_distance_km numeric(6,2) not null`
- `minimum_fare_regular numeric(8,2) not null`
- `minimum_fare_discounted numeric(8,2) null`
- `succeeding_distance_km numeric(6,2) not null`
- `succeeding_fare_regular numeric(8,2) not null`
- `succeeding_fare_discounted numeric(8,2) null`
- `notes text null`

Use these MVP products:
- `puj_traditional`
- `puj_modern_non_aircon`
- `puj_modern_aircon`
- `uv_traditional`
- `uv_modern`
- `car_estimated`

### `public.train_stations`
Columns:
- `id uuid primary key`
- `line_code text not null`
- `station_code text not null unique`
- `display_name text not null`
- `created_at timestamptz not null default timezone('utc', now())`

### `public.train_station_fares`
Columns:
- `id uuid primary key`
- `fare_rule_version_id uuid not null references public.fare_rule_versions(id) on delete cascade`
- `origin_station_id uuid not null references public.train_stations(id)`
- `destination_station_id uuid not null references public.train_stations(id)`
- `regular_fare numeric(8,2) not null`
- `discounted_fare numeric(8,2) not null`

Constraint:
- unique `(fare_rule_version_id, origin_station_id, destination_station_id)`

## Fare Logic
Implement fare engine behavior as a backend service, not as controller logic.

Input:
- ordered route legs
- passenger type
- active fare-rule version set

Output per leg:
- `amount`
- `pricingType`: `official | estimated | community_estimated`
- `fareProductCode`
- `ruleVersionName`
- `effectivityDate`
- `isDiscountApplied`
- `assumptionText`

Output per route:
- `totalFare`
- `fareConfidence`: `official | estimated | partially_estimated`
- `fareAssumptions`

Distance-based rules:
- for PUJ and UV, use:
  - minimum fare for distance up to `minimum_distance_km`
  - then ceil of remaining distance divided by `succeeding_distance_km`
  - multiply by succeeding fare
- walking legs are always `0.00`
- car legs use an estimated config and must always return `pricingType = estimated`
- train legs use exact station-to-station lookup

Passenger-type rules:
- `regular`: use regular pricing
- `student | senior | pwd`: use discounted pricing when the fare product supports it
- if a discounted amount is unavailable for a mode, fall back to regular pricing and add an assumption note

MVP fare baselines from the PRD:
- traditional PUJ:
  - regular minimum `13.00` for first `4 km`
  - discounted minimum `10.40`
  - regular succeeding `1.80`
  - discounted succeeding `1.44`
- modern/electric PUJ non-aircon:
  - minimum `15.00`
  - succeeding `1.80`
- modern/electric PUJ aircon:
  - minimum `15.00`
  - succeeding `2.20`
- UV Express:
  - traditional `2.40/km`
  - modern `2.50/km`
  - with 20% discount handling when applicable

Staleness policy:
- if an active fare version is older than the current product policy threshold, do not fail the query
- instead return the route with assumption text noting the fare table is stale

## Backend Implementation
Add:
- schema and types
- fare engine service
- fare version lookup model
- seed data for initial fare products and train fares

Suggested modules:
- `fare.model`
- `fare-engine.service`
- `fare.types`

Route-query integration:
- feature 04 must call the fare engine after composing candidate routes
- route responses must include leg-by-leg fare breakdown and route-level confidence

## Test Plan
Coverage must include:
- traditional PUJ regular and discounted cases
- modern aircon and non-aircon cases
- UV pricing cases
- train fare lookup success and missing lookup handling
- walking leg zero fare
- car estimated labeling
- total route fare equals sum of leg fares
- stale fare-version warning behavior
- partially-estimated route labeling when any leg is not official

## Acceptance Criteria
- The same route with the same rider profile always produces the same fare output.
- Route responses can explain whether totals are official, estimated, or partial.
- Distance-based public transport fares follow the PRD baseline rules for MVP.

## Dependencies and Assumptions
- Depends on feature 02 route legs exposing enough metadata to map each leg to a fare product or train lookup.
- Uses the PRD fare baselines as the locked MVP default.
- Community-submitted fare updates are stored later in feature 07 and do not override trusted fare tables automatically.
