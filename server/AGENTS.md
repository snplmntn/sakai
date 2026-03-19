# Server Agent Guide

## Purpose
This folder contains the backend for Sakai. It should support deterministic route data, fare calculation, MMDA alert ingestion and structuring, community submissions, and the APIs the mobile client needs.

Product reference: `../sakai-prd.md`

## Backend Rules
- Keep controllers thin. Put business logic in typed service or model layers.
- Validate all request bodies, params, query strings, and external payloads at the boundary.
- Never use `any`. Use `unknown` for external data and narrow with Zod or explicit guards.
- Keep API response shapes stable and explicitly typed.
- Prefer pure helpers for ranking, fare, parsing, and severity logic so they are easy to test.
- Do not mix parsing, persistence, and formatting concerns in one function.
- Fail loudly on invalid upstream data instead of silently coercing it into partial shapes.

## Sakai-Specific Guardrails
- Route generation and fare computation must remain deterministic and traceable to stored data or rules.
- MMDA ingestion should store both raw text and structured fields, matching the PRD requirements.
- Severity and `displayUntil` logic should follow the PRD rules exactly.
- AI output should be treated as structured assistance, not as source-of-truth transit data.

## Testing Expectations
- Add or update tests for business rules, especially route ranking, fare calculations, parsing, and MMDA severity behavior.
- Prefer typed fixtures over ad hoc object literals with missing fields.
