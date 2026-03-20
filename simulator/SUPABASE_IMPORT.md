Use these generated files for import:

- `nodes_supabase.csv`
- `edges_supabase.csv`
- `supabase_schema.sql`

Import order:

1. Run `supabase_schema.sql` in the Supabase SQL editor.
2. Import `nodes_supabase.csv` into `public.transit_stops`.
3. Import `edges_supabase.csv` into `public.transit_stop_edges`.

Notes:

- `weight` is now an estimated generalized travel cost in minutes.
- `estimated_time_min` is a frontend/backend-friendly travel-time estimate.
- `distance_meters` is filled for both ride edges and transfer edges.
- `transfer=true` rows represent walk-transfer connections between nearby stops or stations.
- `data_source` distinguishes direct GTFS-derived travel edges from transfer edges synthesized by the generator.

Current limitations:

- Fare data is not yet part of this import set.
- `estimated_time_min` is heuristic, not real-time.
- Route geometry and place-to-stop aliasing still need separate tables if you want richer maps and landmark search.
