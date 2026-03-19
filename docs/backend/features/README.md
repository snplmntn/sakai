# Backend Feature Plans

These docs break the post-auth backend work into implementation-ready features that can be tackled one by one.

Planning source of truth:
- Product behavior: `sakai-prd.md`
- Current backend baseline: `server/`
- Existing completed backend work: Supabase auth, MMDA scraping/storage, starter sample `courses`

Execution order:
1. `01-user-preferences-and-passenger-profile.md`
2. `02-route-network-foundation.md`
3. `03-fare-engine-and-fare-tables.md`
4. `04-route-query-and-ranking-api.md`
5. `05-ai-intent-and-route-explanations.md`
6. `06-mmda-relevance-severity-and-expiry.md`
7. `07-community-submissions-and-moderation.md`
8. `08-demo-seed-data-ops-and-backend-hardening.md`

Priority rationale:
- The PRD says Sakai must not use AI to invent routes or fares.
- That makes deterministic route and fare data the critical path after auth.
- MMDA relevance and AI summaries become valuable only once route options exist.
- Community submissions matter once there is a trusted route and fare baseline to improve.

Definition of done for the backend track:
- Authenticated users can save route preference and passenger type.
- The backend can return at least one deterministic, leg-based route for common demo destinations.
- Each route returns fare totals and fare-confidence labeling.
- Route results can surface route-relevant MMDA incidents with severity and expiry handling.
- Authenticated users can submit missing route or fare corrections.
- A fresh Supabase project can run the backend with documented env, schema, and seed data.

Working rules:
- Keep route generation, fare calculation, and ranking deterministic.
- Use AI only for query interpretation, MMDA structuring, and summary generation.
- Clearly label official, estimated, stale, partial, and community-sourced data.
- Remove or isolate the starter `courses` example once real commute resources are active.
