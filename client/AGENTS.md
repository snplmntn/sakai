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

## React Native Expectations
- Favor composable screens and hooks over large monolithic components.
- Keep navigation types accurate as screens evolve.
- Treat permissions, location, notifications, and voice input as typed app states, not boolean shortcuts.
