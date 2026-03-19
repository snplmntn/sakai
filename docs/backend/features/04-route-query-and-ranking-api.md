# Feature 04: Route Query and Ranking API

## Goal
Ship the main backend route-planning endpoint that turns normalized origin and destination inputs into ranked, fare-aware route options.

This is the product's main backend capability and the first feature that should make the backend feel like Sakai instead of a starter Express app. It must stay Sakai-owned and deterministic rather than outsourcing route generation to Google Maps or an LLM.

## Current State
- Features 01 to 03 will provide the preference data, route graph, and fare engine.
- The trip-planning endpoint is now implemented as `POST /api/routes/query`.
- The PRD requires:
  - multiple route combinations when available
  - jeepney-first multimodal suggestions
  - total time, total cost, and transfer count
  - ranking by `Fastest`, `Cheapest`, and `Balanced`

## Scope
Implement one primary route-query endpoint for deterministic route composition and ranking.

In scope:
- route request normalization
- user preference fallback
- route candidate assembly from seeded graph data
- fare attachment
- ranking and recommendation labels
- graceful incomplete-data behavior

Out of scope:
- turn-by-turn navigation state
- live traffic-based ETA recalculation
- advanced map polyline generation
- route persistence or route history

## API Contract
### `POST /api/routes/query`
Auth:
- optional for v1
- when a valid bearer token is present, the backend may load saved user preferences
- when an auth header is present but invalid, the endpoint returns `401`

Request body:
```json
{
  "origin": {
    "placeId": "optional-place-uuid",
    "label": "Cubao",
    "latitude": 14.6195,
    "longitude": 121.0537
  },
  "destination": {
    "placeId": "optional-place-uuid",
    "label": "PUP Sta. Mesa"
  },
  "preference": "cheapest",
  "passengerType": "student"
}
```

Normalization rules:
- `origin` and `destination` each require either `placeId` or a `label`
- coordinates are optional and are used to add nearby access or egress stops within `500m`
- `preference` and `passengerType` are optional request overrides
- if omitted, use saved user preferences when authenticated
- if still unavailable, use defaults from feature 01
- `queryText` is intentionally out of scope for v1

Success response:
```json
{
  "success": true,
  "data": {
    "normalizedQuery": {
      "origin": {
        "placeId": "uuid",
        "label": "Cubao",
        "matchedBy": "alias"
      },
      "destination": {
        "placeId": "uuid",
        "label": "PUP Sta. Mesa",
        "matchedBy": "canonicalName"
      },
      "preference": "cheapest",
      "passengerType": "student",
      "preferenceSource": "saved_preference",
      "passengerTypeSource": "saved_preference"
    },
    "options": [
      {
        "id": "stable-option-id",
        "summary": "Ride Cubao - PUP from Cubao Terminal to PUP Main Gate",
        "recommendationLabel": "Cheapest option",
        "highlights": ["Fewest transfers"],
        "totalDurationMinutes": 27,
        "totalFare": 13.28,
        "fareConfidence": "official",
        "fareAssumptions": [],
        "transferCount": 0,
        "corridorTags": ["cubao", "sta-mesa"],
        "legs": [
          {
            "id": "leg-1",
            "type": "ride",
            "mode": "jeepney",
            "fare": {
              "amount": 13,
              "pricingType": "official",
              "fareProductCode": "puj_traditional",
              "ruleVersionName": "LTFRB PUJ Baseline 2026",
              "effectivityDate": "2026-01-01",
              "isDiscountApplied": false,
              "assumptionText": null
            }
          }
        ],
        "relevantIncidents": []
      }
    ]
  }
}
```

Empty-result response:
- return `200` with `options: []`
- include a plain-language message such as `No supported route found for the current demo coverage`
- do not fabricate routes
- unresolved or ambiguous places should return `422` instead of guessing

## Route Composition Rules
Candidate assembly for v1:
1. resolve origin and destination places
2. collect place-linked stops and nearby coordinate-based stops within `500m`
3. find direct routes or routes connected by one explicit transfer point
4. compose ride legs and walk legs in sequence
4. compute total duration from leg durations plus transfer walking durations
5. compute fares using feature 03
6. rank candidates
7. attach MMDA relevance later in feature 06
8. generate route summaries later in feature 05

Transfer count:
- count each transition from one ride leg to another ride leg
- pure walk segments between legs do not increment separately
- v1 supports direct routes and routes with exactly one explicit transfer point only

Graceful degradation:
- if fare data is mixed official and estimated but still resolvable, return the route with `fareConfidence = partially_estimated`
- if a candidate cannot be priced because required fare data is missing, exclude that candidate instead of inventing a fare
- if route coverage is incomplete, do not guess missing stops or transfers

## Ranking Logic
Lock the ranking rules to avoid implementation drift.

Primary sort keys:
- `fastest`: `totalDurationMinutes asc`, then `totalFare asc`, then `transferCount asc`
- `cheapest`: `totalFare asc`, then `totalDurationMinutes asc`, then `transferCount asc`
- `balanced`: weighted score where:
  - normalized duration weight = `0.45`
  - normalized fare weight = `0.35`
  - normalized transfer count weight = `0.20`

Balanced normalization:
- normalize each metric against the candidate set min and max
- if all candidates have the same value for a metric, that metric contributes `0` to every candidate

Recommendation labels:
- first route in the selected ranking gets:
  - `Fastest option`
  - `Cheapest option`
  - `Balanced option`
- secondary labels may be attached only when true:
  - `Fewest transfers`
  - `Most jeepney-friendly`

For `Most jeepney-friendly`:
- choose the candidate with the largest count of jeepney ride legs
- only add the label when it is unique across candidates

## Backend Implementation
Add:
- route query request schema
- route orchestration service
- route ranking service or helper
- route response mapping types
- route routes mounted under `/api/routes`

Suggested modules:
- `route-query.service`
- `route-ranking.service`
- `route-query.schema`
- `route.routes`
- `fare-engine.service`

Temporary starter cleanup:
- once this endpoint is live and tested, remove `courses` from the public README API list

## Test Plan
Coverage must include:
- authenticated request falls back to saved preferences when overrides are absent
- unauthenticated request uses defaults
- invalid optional auth headers return `401`
- fastest, cheapest, and balanced rankings produce expected order for a seeded candidate set
- transfer counts are computed correctly
- one-transfer options include an explicit walk leg
- empty coverage returns no routes without erroring
- route options include fare totals and fare confidence values
- route options include leg-level fare breakdowns alongside totals
- ambiguous place resolution returns `422`
- duplicate candidates are not returned

## Acceptance Criteria
- The backend can return at least one real route for seeded demo destinations.
- Every route option has durations, fare totals, transfer counts, and a recommendation label.
- Ranking stays deterministic across repeated calls for the same request.

## Dependencies and Assumptions
- Depends on features 01 to 03.
- AI query parsing can be integrated later without changing the public response shape.
- MMDA incidents can be appended later without breaking the core route contract.
- Google Maps remains place and map infrastructure only and is not used as the routing engine.
