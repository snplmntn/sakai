# Client Agent Guide

## Purpose
This folder contains the React Native client for Sakai. The app should feel like a voice-first, local commute assistant that helps riders search, compare routes, understand fares, and navigate with confidence.

Product reference: `../sakai-prd.md`

## Frontend Rules
- Never use `any` in components, hooks, navigation params, or API client code.
- Type component props, screen params, async results, and local state explicitly.
- Prefer typed view models and helpers over embedding raw API response shaping inside components.
- Keep business logic out of presentation components when it can live in a typed helper or hook.
- Handle loading, empty, error, and permission-denied states intentionally.
- Keep copy concise and plain-language, matching the product tone in the PRD.

## Sakai-Specific Guardrails
- Preserve the voice-first and jeepney-first product framing from the PRD.
- Route cards and trip details should clearly communicate time, cost, transfers, and route relevance.
- Show estimated or incomplete data honestly instead of implying certainty.
- MMDA alerts should be concise and obviously relevant to the current route or trip context.
- Do not let UI code fabricate route logic or fare data that should come from typed backend/domain logic.

## Design System
- Treat `client/src/constants/theme.ts` as the source of truth for reusable colors, spacing, and typography.
- Preserve the current core palette and usage:
  - Primary Blue `#007AFF` for links, chips, badges, and action highlights
  - Midnight Navy `#102033` for branded hero cards and trust-building premium surfaces
  - Soft app background gradient `#F7FBFE -> #DDEBF4` for global screen atmosphere
  - Stark Black `#000000` for primary buttons with strong contrast
- Prefer light, breathable layouts with soft backgrounds and clear visual hierarchy.
- Use dark hero surfaces sparingly and intentionally to anchor important Sakai-branded content.
- Keep CTA styling bold and obvious rather than subtle.
- Reuse theme tokens before introducing one-off colors, spacing values, or typography sizes.

## React Native Expectations
- Favor composable screens and hooks over large monolithic components.
- Keep navigation types accurate as screens evolve.
- Treat permissions, location, notifications, and voice input as typed app states, not boolean shortcuts.
