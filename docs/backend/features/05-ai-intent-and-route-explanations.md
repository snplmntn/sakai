# Feature 05: AI Intent and Route Explanations

## Goal
Use AI only where the PRD allows it: understanding rider phrasing and explaining deterministic route outputs in simpler language.

This feature should improve usability without turning the backend into a black box for route generation.

## Current State
- The backend has no AI provider integration yet.
- The PRD recommends Gemini-family models for trip understanding and MMDA structuring.
- Route generation and fare logic must stay deterministic and data-backed.

## Scope
Add an AI integration layer for:
- parsing natural-language route requests into structured query hints
- generating concise route summaries from already-computed results

In scope:
- provider interface
- env configuration
- prompt contracts
- structured response validation
- ambiguity fallback behavior

Out of scope:
- AI-generated routes
- AI-generated fare amounts
- free-form chat memory
- fully conversational trip agent state

## Provider and Config
Use a provider abstraction rather than placing model calls inside controllers.

Required env:
- `GEMINI_API_KEY`
- optional `GEMINI_MODEL_PRIMARY`
- optional `GEMINI_MODEL_LIGHT`

Locked defaults:
- primary: `gemini-2.5-flash`
- lightweight background model: `gemini-2.5-flash-lite`

Suggested server modules:
- `ai/client.ts`
- `ai/intent-parser.ts`
- `ai/route-summary.ts`
- `ai/types.ts`

## Intent Parsing Contract
Do not expose a separate public parsing endpoint in v1.

Route-query behavior:
- `POST /api/routes/query` may accept `queryText`
- if `queryText` is present, the backend runs AI parsing before route composition
- the AI output must be validated into a strict structure before use

Validated intent shape:
```json
{
  "originText": "Cubao",
  "destinationText": "PUP Sta. Mesa",
  "preference": "cheapest",
  "passengerType": null,
  "requiresClarification": false,
  "confidence": "high"
}
```

Rules:
- AI may extract only:
  - origin text
  - destination text
  - ranking preference hint
  - passenger type hint if directly stated
- AI must not output route names, stop sequences, or price estimates
- if `requiresClarification = true`, the backend should return a controlled `400` parse response instead of guessing

Example ambiguous cases:
- `How do I get to Gateway?`
- `Take me to PUP`

If ambiguity exists and multiple places match:
- return a response that includes candidate destinations
- do not auto-pick one

## Route Summary Contract
AI summary input:
- selected route option from feature 04
- computed legs
- computed total fare and duration
- relevant incidents from feature 06 when available

AI summary output:
- one concise rider-facing paragraph
- no unsupported claims
- no invented travel-time or fare changes

Summary rules:
- describe the leg sequence plainly
- mention transfer count only if useful
- mention a relevant disruption only if already attached to the route option
- keep output compact enough for route-card display

Fallback behavior:
- if AI fails, build a deterministic template summary from route legs

## Backend Implementation
Add:
- provider client with timeout and retry boundaries
- prompt templates stored near the AI modules
- strict zod validation for AI outputs
- feature flag or env toggle to disable AI in local development if needed

Recommended flow in `POST /api/routes/query`:
1. if `queryText` exists, parse it into normalized hints
2. merge parsed hints with explicit request fields, where explicit request fields win
3. run deterministic route composition
4. generate summary for each route option
5. if summary generation fails, fall back to template summaries

## Test Plan
Coverage must include:
- valid parsing of `cheapest way to PUP Sta. Mesa from Cubao`
- preference extraction from phrases like `fastest route`
- passenger-type extraction only when explicit
- ambiguous destination handling without auto-guessing
- validation failure when AI returns malformed JSON
- route-summary fallback when AI provider errors or times out
- summary content does not exceed supported route facts

## Acceptance Criteria
- The backend can accept natural-language commute requests without surrendering route truth to the model.
- Every route option can have a concise explanation even when the AI provider is unavailable.
- Ambiguous user phrasing results in controlled clarification behavior, not silent guesses.

## Dependencies and Assumptions
- Depends on feature 04 route query response shape.
- Assumes Gemini remains the selected MVP provider from the PRD.
- Explicit request fields always override parsed AI hints.
