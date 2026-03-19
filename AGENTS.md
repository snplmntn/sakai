# Sakai Agent Guide

## Purpose
Build Sakai as a voice-first commute assistant for the Philippines. The product is jeepney-first but multimodal, and it should help riders find understandable route combinations with fare visibility, route-relevant MMDA updates, and community-powered route improvements.

Canonical product reference: `./sakai-prd.md`

Use the PRD whenever feature scope, behavior, naming, or tradeoffs are unclear. Prefer aligning changes to the PRD over inventing new product behavior.

## TypeScript Standards
- Always preserve `strict` TypeScript compatibility.
- Never use `any` as a type. If a boundary is unknown, use `unknown` and narrow it.
- Prefer explicit domain types, discriminated unions, utility types, and shared interfaces over loose object shapes.
- Model nullable and optional fields honestly. Do not hide missing data behind unsafe casts.
- Avoid `as` assertions unless they are unavoidable at a boundary and immediately justified by validation or narrowing.
- Validate untrusted input at the boundary, then pass typed values inward.
- Prefer small typed helpers over repeated inline shape manipulation.

## Product Guardrails
- Do not let AI invent route options, fares, stops, or rankings. Those must remain deterministic and data-backed.
- Use AI for intent understanding, summarization, and MMDA incident structuring as described in the PRD.
- Keep user-facing language practical, local, and easy to understand.
- Be explicit when data is estimated, incomplete, or community-submitted.

## Design Language
- Keep the app visually clean, airy, and modern, consistent with the Sakai commute-assistant positioning in the PRD.
- Preserve the established mobile design system in `client/src/constants/theme.ts` when adding or revising UI.
- Use the blue-led palette intentionally:
  - Primary Blue `#007AFF` for links, badges, and focused highlights
  - Midnight Navy `#102033` for premium Sakai-branded surfaces such as hero cards
  - Soft background gradient `#F7FBFE -> #DDEBF4` for the main app atmosphere
  - Stark Black `#000000` for high-contrast primary buttons and strong calls to action
- Favor high-clarity layouts, soft backgrounds, bold key actions, and trust-building dark feature surfaces over noisy or overly playful styling.

## Working Style
- Check the PRD before adding or changing product behavior.
- When making a product-facing change, reference the relevant PRD section in your reasoning or implementation notes when useful.
- Prefer clear, maintainable code over clever abstractions.

## Commit Message Rules
- Use commit message subject in Conventional format: `type(scope): message`.
- Keep `type` to established scopes such as `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`, `perf`, etc.
- When a change adds or updates any API endpoint, the commit message body must list each affected endpoint.
- Include a clear summary section in every commit body with "What changed", "Why", and "How to verify".
- For each listed endpoint, include a brief context line describing what it does or what changed.
- Do not use a vague commit body like `update auth routes`; spell out the endpoint paths and their purpose.
- Enable local commit-message enforcement with:
  - `git config core.hooksPath .githooks`
  - `.githooks/commit-msg` validates subject format and required body sections.
- Required body sections for hook validation:
  - `What changed:`
  - `Why:`
  - `Endpoints:`
  - `Validation:`
- Example body:
  - What changed:
  - `feat(commute): improve route search resolution`
- Why:
  - Added merged Google/Sakai search fallback with stable request scoping
- Endpoints:
  - `GET /api/places/search` — search autocomplete from Sakai and Google Maps
  - `POST /api/routes/query` — route query now resolves Google place IDs before nearest-stop fallback
- Validation:
  - `npm run typecheck`
  - `npm test`
