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

## Working Style
- Check the PRD before adding or changing product behavior.
- When making a product-facing change, reference the relevant PRD section in your reasoning or implementation notes when useful.
- Prefer clear, maintainable code over clever abstractions.
