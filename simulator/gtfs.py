from __future__ import annotations

import math
from collections import defaultdict
from pathlib import Path

import networkx as nx
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
GTFS_DIR = BASE_DIR / "gtfs"
NODES_CSV = BASE_DIR / "nodes.csv"
EDGES_CSV = BASE_DIR / "edges.csv"
NODES_IMPORT_CSV = BASE_DIR / "nodes_supabase.csv"
EDGES_IMPORT_CSV = BASE_DIR / "edges_supabase.csv"
SUPABASE_SQL = BASE_DIR / "supabase_schema.sql"

TRANSFER_DISTANCE_METERS = 250
GRID_SIZE_DEGREES = 0.003
MODE_SPEED_KPH = {
    "jeep": 18.0,
    "lrt": 32.0,
    "mrt": 32.0,
    "transfer": 4.5,
}
BOARDING_TIME_MINUTES = {
    "jeep": 1.5,
    "lrt": 0.75,
    "mrt": 0.75,
    "transfer": 0.0,
}


def normalize_text(value: object) -> str:
    text = str(value or "").strip().lower()
    text = text.replace(".", "")
    text = text.replace("-", " ")
    return " ".join(text.split())


def clean_display_text(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def load_gtfs_tables(gtfs_dir: Path = GTFS_DIR) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    stops = pd.read_csv(gtfs_dir / "stops.txt", dtype={"stop_id": str})
    routes = pd.read_csv(gtfs_dir / "routes.txt", dtype={"route_id": str})
    trips = pd.read_csv(gtfs_dir / "trips.txt", dtype={"trip_id": str, "route_id": str})
    stop_times = pd.read_csv(
        gtfs_dir / "stop_times.txt",
        dtype={"trip_id": str, "stop_id": str},
        low_memory=False,
    )

    stops["normalized_name"] = stops["stop_name"].map(normalize_text)
    routes["route_type"] = pd.to_numeric(routes["route_type"], errors="coerce")
    stop_times["stop_sequence"] = pd.to_numeric(stop_times["stop_sequence"], errors="coerce")
    stop_times = stop_times.dropna(subset=["stop_sequence"]).copy()
    stop_times["stop_sequence"] = stop_times["stop_sequence"].astype(int)
    return stops, routes, trips, stop_times


def classify_mode(route_row: pd.Series) -> str:
    route_type = int(route_row["route_type"])
    short_name = normalize_text(route_row.get("route_short_name"))
    long_name = normalize_text(route_row.get("route_long_name"))
    route_id = normalize_text(route_row.get("route_id"))

    if route_type == 2:
        if "mrt" in short_name or "mrt" in long_name or "mrt" in route_id:
            return "mrt"
        return "lrt"
    if route_type == 3:
        return "jeep"
    return "unknown"


def build_route_lookup(routes: pd.DataFrame) -> dict[str, dict]:
    supported = routes[routes["route_type"].isin([2, 3])].copy()
    route_lookup: dict[str, dict] = {}
    for _, row in supported.iterrows():
        route_id = str(row["route_id"])
        route_lookup[route_id] = {
            "route_id": route_id,
            "route_short_name": None if pd.isna(row.get("route_short_name")) else clean_display_text(row.get("route_short_name")),
            "route_long_name": None if pd.isna(row.get("route_long_name")) else clean_display_text(row.get("route_long_name")),
            "mode": classify_mode(row),
        }
    return route_lookup


def build_multimodal_graph(
    stops: pd.DataFrame,
    routes: pd.DataFrame,
    trips: pd.DataFrame,
    stop_times: pd.DataFrame,
    transfer_distance_meters: int = TRANSFER_DISTANCE_METERS,
) -> nx.DiGraph:
    route_lookup = build_route_lookup(routes)
    supported_route_ids = set(route_lookup)

    filtered_trips = trips[trips["route_id"].isin(supported_route_ids)].copy()
    filtered_stop_times = stop_times[stop_times["trip_id"].isin(filtered_trips["trip_id"])].copy()
    filtered_stop_times = filtered_stop_times.sort_values(["trip_id", "stop_sequence"])
    trip_route_lookup = filtered_trips.set_index("trip_id")["route_id"].to_dict()

    relevant_stop_ids = set(filtered_stop_times["stop_id"].astype(str))
    relevant_stops = stops[stops["stop_id"].isin(relevant_stop_ids)].copy()

    graph = nx.DiGraph()
    stop_attributes: dict[str, dict] = {}

    for _, row in relevant_stops.iterrows():
        stop_id = str(row["stop_id"])
        stop_attributes[stop_id] = {
            "stop_id": stop_id,
            "stop_name": clean_display_text(row["stop_name"]),
            "normalized_name": row["normalized_name"],
            "lat": float(row["stop_lat"]) if pd.notna(row["stop_lat"]) else None,
            "lon": float(row["stop_lon"]) if pd.notna(row["stop_lon"]) else None,
            "modes": set(),
            "lines": set(),
        }

    for trip_id, group in filtered_stop_times.groupby("trip_id", sort=False):
        route_id = trip_route_lookup.get(str(trip_id))
        if not route_id:
            continue

        route_meta = route_lookup[route_id]
        stop_ids = group["stop_id"].tolist()

        for stop_id in stop_ids:
            if stop_id not in stop_attributes:
                continue
            stop_attributes[stop_id]["modes"].add(route_meta["mode"])
            stop_attributes[stop_id]["lines"].add(route_id)

        for source_stop_id, target_stop_id in zip(stop_ids, stop_ids[1:]):
            if source_stop_id not in stop_attributes or target_stop_id not in stop_attributes:
                continue
            source_stop = stop_attributes[source_stop_id]
            target_stop = stop_attributes[target_stop_id]
            distance = None
            if (
                source_stop.get("lat") is not None
                and source_stop.get("lon") is not None
                and target_stop.get("lat") is not None
                and target_stop.get("lon") is not None
            ):
                distance = round(
                    haversine_meters(
                        source_stop["lat"],
                        source_stop["lon"],
                        target_stop["lat"],
                        target_stop["lon"],
                    ),
                    2,
                )
            travel_time = estimate_edge_time_minutes(route_meta["mode"], distance)
            graph.add_edge(
                source_stop_id,
                target_stop_id,
                source_stop_id=source_stop_id,
                target_stop_id=target_stop_id,
                weight=travel_time,
                mode=route_meta["mode"],
                line=route_id,
                route_short_name=route_meta["route_short_name"],
                route_long_name=route_meta["route_long_name"],
                transfer=False,
                distance_meters=distance,
                estimated_time_min=travel_time,
                data_source="gtfs",
            )

    for stop_id, data in stop_attributes.items():
        modes = sorted(data["modes"])
        lines = sorted(data["lines"])
        graph.add_node(
            stop_id,
            stop_id=stop_id,
            stop_name=data["stop_name"],
            normalized_name=data["normalized_name"],
            lat=data["lat"],
            lon=data["lon"],
            mode=modes[0] if modes else None,
            line=lines[0] if lines else None,
            all_modes="|".join(modes),
            all_lines="|".join(lines),
            is_multimodal=len(modes) > 1,
            line_count=len(lines),
        )

    add_transfer_edges(graph, transfer_distance_meters)
    return graph


def add_transfer_edges(graph: nx.DiGraph, transfer_distance_meters: int) -> None:
    node_items = [
        (node_id, data)
        for node_id, data in graph.nodes(data=True)
        if data.get("lat") is not None and data.get("lon") is not None
    ]
    grid: dict[tuple[int, int], list[tuple[str, dict]]] = defaultdict(list)

    for node_id, data in node_items:
        cell = (int(data["lat"] / GRID_SIZE_DEGREES), int(data["lon"] / GRID_SIZE_DEGREES))
        grid[cell].append((node_id, data))

    seen_pairs: set[tuple[str, str]] = set()

    for cell, entries in grid.items():
        nearby_entries: list[tuple[str, dict]] = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nearby_entries.extend(grid.get((cell[0] + dx, cell[1] + dy), []))

        for node_id, data in entries:
            node_modes = set(filter(None, str(data.get("all_modes", "")).split("|")))
            for other_id, other_data in nearby_entries:
                if node_id == other_id:
                    continue
                pair_key = tuple(sorted((node_id, other_id)))
                if pair_key in seen_pairs:
                    continue

                other_modes = set(filter(None, str(other_data.get("all_modes", "")).split("|")))
                if not node_modes or not other_modes or node_modes == other_modes:
                    continue

                distance = haversine_meters(data["lat"], data["lon"], other_data["lat"], other_data["lon"])
                if distance > transfer_distance_meters:
                    continue

                seen_pairs.add(pair_key)
                transfer_time = estimate_edge_time_minutes("transfer", distance)
                payload = {
                    "source_stop_id": node_id,
                    "target_stop_id": other_id,
                    "weight": transfer_time,
                    "mode": "transfer",
                    "line": "transfer",
                    "route_short_name": "transfer",
                    "route_long_name": "transfer",
                    "transfer": True,
                    "distance_meters": round(distance, 2),
                    "estimated_time_min": transfer_time,
                    "data_source": "derived_transfer",
                }
                graph.add_edge(node_id, other_id, **payload)
                reverse_payload = payload.copy()
                reverse_payload["source_stop_id"] = other_id
                reverse_payload["target_stop_id"] = node_id
                graph.add_edge(other_id, node_id, **reverse_payload)


def estimate_edge_time_minutes(mode: str, distance_meters: float | None) -> float:
    if distance_meters is None:
        return round(BOARDING_TIME_MINUTES.get(mode, 2.0), 2)

    speed_kph = MODE_SPEED_KPH.get(mode, 18.0)
    travel_minutes = (distance_meters / 1000) / speed_kph * 60
    boarding_minutes = BOARDING_TIME_MINUTES.get(mode, 2.0)
    return round(max(0.5, travel_minutes + boarding_minutes), 2)


def export_nodes_csv(graph: nx.DiGraph, output_path: Path = NODES_IMPORT_CSV) -> None:
    rows = []
    for _, data in graph.nodes(data=True):
        rows.append(
            {
                "stop_id": data.get("stop_id"),
                "stop_name": data.get("stop_name"),
                "normalized_name": data.get("normalized_name"),
                "lat": data.get("lat"),
                "lon": data.get("lon"),
                "mode": data.get("mode"),
                "line": data.get("line"),
                "all_modes": data.get("all_modes"),
                "all_lines": data.get("all_lines"),
                "is_multimodal": data.get("is_multimodal"),
                "line_count": data.get("line_count"),
            }
        )

    pd.DataFrame(rows).sort_values(["stop_name", "stop_id"]).to_csv(output_path, index=False, encoding="utf-8-sig")


def export_edges_csv(graph: nx.DiGraph, output_path: Path = EDGES_IMPORT_CSV) -> None:
    rows = []
    for _, _, data in graph.edges(data=True):
        rows.append(
            {
                "source_stop_id": data.get("source_stop_id"),
                "target_stop_id": data.get("target_stop_id"),
                "weight": data.get("weight", 1),
                "mode": data.get("mode"),
                "line": data.get("line"),
                "route_short_name": data.get("route_short_name"),
                "route_long_name": data.get("route_long_name"),
                "transfer": data.get("transfer", False),
                "distance_meters": data.get("distance_meters"),
                "estimated_time_min": data.get("estimated_time_min"),
                "data_source": data.get("data_source"),
            }
        )

    pd.DataFrame(rows).sort_values(["source_stop_id", "target_stop_id", "mode", "line"]).to_csv(output_path, index=False, encoding="utf-8-sig")


def export_supabase_schema(output_path: Path = SUPABASE_SQL) -> None:
    output_path.write_text(
        """create table if not exists public.stops (
  stop_id text primary key,
  stop_name text not null,
  normalized_name text not null,
  lat double precision,
  lon double precision,
  mode text,
  line text,
  all_modes text,
  all_lines text,
  is_multimodal boolean not null default false,
  line_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stop_edges (
  source_stop_id text not null references public.stops(stop_id) on delete cascade,
  target_stop_id text not null references public.stops(stop_id) on delete cascade,
  weight numeric not null,
  mode text not null,
  line text not null,
  route_short_name text,
  route_long_name text,
  transfer boolean not null default false,
  distance_meters numeric,
  estimated_time_min numeric,
  data_source text,
  created_at timestamptz not null default now(),
  primary key (source_stop_id, target_stop_id, mode, line)
);

create index if not exists idx_stops_normalized_name on public.stops (normalized_name);
create index if not exists idx_stops_mode on public.stops (mode);
create index if not exists idx_stop_edges_source on public.stop_edges (source_stop_id);
create index if not exists idx_stop_edges_target on public.stop_edges (target_stop_id);
create index if not exists idx_stop_edges_mode on public.stop_edges (mode);
create index if not exists idx_stop_edges_line on public.stop_edges (line);
create index if not exists idx_stop_edges_transfer on public.stop_edges (transfer);
""",
        encoding="utf-8",
    )


def main() -> int:
    stops, routes, trips, stop_times = load_gtfs_tables()
    graph = build_multimodal_graph(stops, routes, trips, stop_times)
    export_nodes_csv(graph)
    export_edges_csv(graph)
    export_supabase_schema()

    print(f"Nodes exported: {graph.number_of_nodes()}")
    print(f"Edges exported: {graph.number_of_edges()}")
    print(f"Files: {NODES_IMPORT_CSV.name}, {EDGES_IMPORT_CSV.name}, {SUPABASE_SQL.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
