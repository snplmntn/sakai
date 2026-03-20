from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from copy import deepcopy
from itertools import islice
from pathlib import Path
from typing import Any

from route_simulator import (
    MODE_COLORS,
    build_stop_index,
    group_route_legs,
    load_edges,
    load_nodes,
    normalize_text,
    pick_stop,
    print_route,
    summarize_route,
)


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_HTML = BASE_DIR / "route_simulation_ors.html"
ORS_API_KEY = os.environ.get("ORS_API_KEY", "").strip()

PREFERENCE_OPTIONS = {
    "mix": "Balanced multimodal route",
    "jeepney": "Prefer jeepney and minimize rail where possible",
    "lrt": "Prefer LRT segments",
    "mrt": "Prefer MRT segments",
    "rail": "Prefer rail segments in general",
}

KNOWN_INTERCHANGES = {
    frozenset({"doroteo jose lrt", "recto lrt"}): "LRT-1 to LRT-2 interchange",
    frozenset({"taft ave mrt", "edsa lrt"}): "MRT-3 to LRT-1 interchange",
    frozenset({"araneta center cubao lrt", "cubao mrt"}): "LRT-2 to MRT-3 interchange",
    frozenset({"cubao lrt", "cubao mrt"}): "LRT-2 to MRT-3 interchange",
}

INTERCHANGE_EDGE_SPECS = [
    (("Doroteo Jose LRT",), ("Recto LRT",), 240, 3.5),
    (("EDSA LRT",), ("Taft Ave MRT",), 60, 1.0),
    (("Cubao LRT", "Araneta Center Cubao LRT"), ("Cubao MRT",), 180, 3.0),
]


def edge_cost(edge: dict[str, Any], preference: str) -> float:
    base_cost = edge["estimated_time_min"] or edge["weight"]
    mode = edge["mode"]
    transfer_penalty = 6.0 if edge["transfer"] else 0.0
    hop_penalty = 0.35 if not edge["transfer"] else 0.0
    route_name = f"{edge.get('route_short_name', '')} {edge.get('route_long_name', '')} {edge.get('line', '')}".lower()
    is_lrt = mode == "lrt" or "lrt" in route_name
    is_mrt = mode == "mrt" or "mrt" in route_name
    is_rail = is_lrt or is_mrt

    if preference == "mix":
        return base_cost + transfer_penalty + hop_penalty
    if preference == "jeepney":
        if mode == "jeep":
            return base_cost * 0.86 + transfer_penalty + hop_penalty
        if is_rail:
            return base_cost * 1.75 + transfer_penalty + hop_penalty
        return base_cost + transfer_penalty + hop_penalty
    if preference == "lrt":
        if is_lrt:
            return base_cost * 0.58 + transfer_penalty + hop_penalty
        if is_mrt:
            return base_cost * 0.9 + transfer_penalty + hop_penalty
        if mode == "jeep":
            return base_cost * 2.35 + transfer_penalty + hop_penalty
        return base_cost + transfer_penalty + hop_penalty
    if preference == "mrt":
        if is_mrt:
            return base_cost * 0.58 + transfer_penalty + hop_penalty
        if is_lrt:
            return base_cost * 0.9 + transfer_penalty + hop_penalty
        if mode == "jeep":
            return base_cost * 2.35 + transfer_penalty + hop_penalty
        return base_cost + transfer_penalty + hop_penalty
    if preference == "rail":
        if is_rail:
            return base_cost * 0.54 + transfer_penalty + hop_penalty
        if mode == "jeep":
            return base_cost * 2.6 + transfer_penalty + hop_penalty
        return base_cost + transfer_penalty + hop_penalty
    return base_cost + transfer_penalty + hop_penalty


def station_mode(node: dict[str, Any]) -> str:
    route_blob = " ".join(node.get("all_lines") or []).lower()
    mode = (node.get("mode") or "").lower()
    if mode == "lrt" or "lrt" in route_blob:
        return "lrt"
    if mode == "mrt" or "mrt" in route_blob:
        return "mrt"
    if mode == "jeep":
        return "jeep"
    return mode or "unknown"


def mix_bias_multiplier(
    edge: dict[str, Any],
    start_node: dict[str, Any],
    end_node: dict[str, Any],
) -> float:
    start_mode = station_mode(start_node)
    end_mode = station_mode(end_node)
    route_name = f"{edge.get('route_short_name', '')} {edge.get('route_long_name', '')} {edge.get('line', '')}".lower()
    mode = edge["mode"]
    is_lrt = mode == "lrt" or "lrt" in route_name
    is_mrt = mode == "mrt" or "mrt" in route_name
    is_rail = is_lrt or is_mrt

    if start_mode in {"lrt", "mrt"} and end_mode in {"lrt", "mrt"}:
        if is_rail:
            return 0.68
        if mode == "jeep":
            return 1.85
        if edge["transfer"]:
            return 1.0

    if start_mode == "lrt" and end_mode == "lrt":
        if is_lrt:
            return 0.62
        if mode == "jeep":
            return 2.0

    if start_mode == "mrt" and end_mode == "mrt":
        if is_mrt:
            return 0.62
        if mode == "jeep":
            return 2.0

    if is_rail:
        return 0.92
    return 1.0


def transfer_multiplier(edge: dict[str, Any], nodes: dict[str, dict[str, Any]]) -> float:
    if not edge["transfer"]:
        return 1.0
    source = nodes[edge["source_stop_id"]]
    target = nodes[edge["target_stop_id"]]
    pair = frozenset({normalize_text(source["stop_name"]), normalize_text(target["stop_name"])})
    if pair in KNOWN_INTERCHANGES:
        return 0.65
    distance = edge.get("distance_meters") or 0.0
    if distance <= 35:
        return 0.7
    if distance <= 100:
        return 0.85
    return 1.0


def clone_adjacency(adjacency: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    return {source: [dict(edge) for edge in edges] for source, edges in adjacency.items()}


def find_stop_ids_by_names(nodes: dict[str, dict[str, Any]], names: tuple[str, ...]) -> list[str]:
    normalized_names = {normalize_text(name) for name in names}
    matches = []
    for stop_id, node in nodes.items():
        if normalize_text(node["stop_name"]) in normalized_names:
            matches.append(stop_id)
    return matches


def add_manual_interchanges(
    nodes: dict[str, dict[str, Any]],
    adjacency: dict[str, list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    augmented = clone_adjacency(adjacency)
    seen_keys = {
        (edge["source_stop_id"], edge["target_stop_id"], edge["mode"], edge["line"])
        for edges in augmented.values()
        for edge in edges
    }
    for source_names, target_names, distance_meters, minutes in INTERCHANGE_EDGE_SPECS:
        source_ids = find_stop_ids_by_names(nodes, source_names)
        target_ids = find_stop_ids_by_names(nodes, target_names)
        for source_id in source_ids:
            for target_id in target_ids:
                if source_id == target_id:
                    continue
                for left, right in ((source_id, target_id), (target_id, source_id)):
                    key = (left, right, "transfer", "manual_interchange")
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    augmented.setdefault(left, []).append(
                        {
                            "source_stop_id": left,
                            "target_stop_id": right,
                            "weight": minutes,
                            "mode": "transfer",
                            "line": "manual_interchange",
                            "route_short_name": "transfer",
                            "route_long_name": "manual interchange",
                            "transfer": True,
                            "distance_meters": float(distance_meters),
                            "estimated_time_min": float(minutes),
                            "data_source": "manual_interchange",
                        }
                    )
    return augmented


def shortest_path_with_preference(
    adjacency: dict[str, list[dict[str, Any]]],
    nodes: dict[str, dict[str, Any]],
    start_stop_id: str,
    end_stop_id: str,
    preference: str,
    banned_edges: set[tuple[str, str, str, str]] | None = None,
) -> tuple[list[str], list[dict[str, Any]], float]:
    import heapq
    import math

    banned_edges = banned_edges or set()
    queue: list[tuple[float, str]] = [(0.0, start_stop_id)]
    distances: dict[str, float] = {start_stop_id: 0.0}
    previous: dict[str, tuple[str, dict[str, Any]]] = {}
    start_node = nodes[start_stop_id]
    end_node = nodes[end_stop_id]

    while queue:
        current_cost, current_stop_id = heapq.heappop(queue)
        if current_stop_id == end_stop_id:
            break
        if current_cost > distances.get(current_stop_id, math.inf):
            continue

        for edge in adjacency.get(current_stop_id, []):
            edge_key = (
                edge["source_stop_id"],
                edge["target_stop_id"],
                edge["mode"],
                edge["line"],
            )
            if edge_key in banned_edges:
                continue
            next_stop_id = edge["target_stop_id"]
            segment_cost = edge_cost(edge, preference)
            segment_cost *= transfer_multiplier(edge, nodes)
            if preference == "mix":
                segment_cost *= mix_bias_multiplier(edge, start_node, end_node)
            candidate_cost = current_cost + segment_cost
            if candidate_cost >= distances.get(next_stop_id, math.inf):
                continue
            distances[next_stop_id] = candidate_cost
            previous[next_stop_id] = (current_stop_id, edge)
            heapq.heappush(queue, (candidate_cost, next_stop_id))

    if end_stop_id not in distances:
        raise ValueError("No route found between those stops in the current graph.")

    stop_ids: list[str] = [end_stop_id]
    edges: list[dict[str, Any]] = []
    current = end_stop_id
    while current != start_stop_id:
        prev_stop_id, edge = previous[current]
        edges.append(edge)
        stop_ids.append(prev_stop_id)
        current = prev_stop_id

    stop_ids.reverse()
    edges.reverse()
    return stop_ids, edges, distances[end_stop_id]


def edge_key(edge: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        edge["source_stop_id"],
        edge["target_stop_id"],
        edge["mode"],
        edge["line"],
    )


def route_signature(edges: list[dict[str, Any]]) -> tuple[tuple[str, str, str, str], ...]:
    return tuple(edge_key(edge) for edge in edges)


def compute_top_routes(
    adjacency: dict[str, list[dict[str, Any]]],
    nodes: dict[str, dict[str, Any]],
    start_stop_id: str,
    end_stop_id: str,
    preference: str,
    limit: int = 6,
) -> list[dict[str, Any]]:
    routes: list[dict[str, Any]] = []
    seen_signatures: set[tuple[tuple[str, str, str, str], ...]] = set()
    candidate_bans: list[set[tuple[str, str, str, str]]] = [set()]

    while candidate_bans and len(routes) < limit:
        banned = candidate_bans.pop(0)
        try:
            stop_ids, edges, weighted_cost = shortest_path_with_preference(
                adjacency,
                nodes,
                start_stop_id,
                end_stop_id,
                preference,
                banned_edges=banned,
            )
        except ValueError:
            continue

        signature = route_signature(edges)
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)
        routes.append(
            {
                "stop_ids": stop_ids,
                "edges": edges,
                "weighted_cost": weighted_cost,
            }
        )

        for edge in edges:
            new_ban = set(banned)
            new_ban.add(edge_key(edge))
            candidate_bans.append(new_ban)

        candidate_bans.sort(key=len)

    return routes


def ride_hop_count(route: dict[str, Any]) -> int:
    return sum(1 for leg in route["legs"] if not leg["transfer"])


def commute_hop_signature(route: dict[str, Any]) -> tuple[tuple[str, str, str, str], ...]:
    signature = []
    for leg in route["legs"]:
        if leg["transfer"]:
            signature.append(("transfer", "transfer", leg["from_stop_name"], leg["to_stop_name"]))
            continue
        signature.append(
            (
                leg["mode"],
                leg["route_name"],
                leg["from_stop_name"],
                leg["to_stop_name"],
            )
        )
    return tuple(signature)


def route_edge_weight(route: dict[str, Any]) -> float:
    return route["total_cost"]


def awkward_micro_ride_penalty(route: dict[str, Any]) -> float:
    penalty = 0.0
    legs = route["legs"]
    for index, leg in enumerate(legs):
        if leg["transfer"] or leg["mode"] not in {"jeep", "bus", "uv"}:
            continue
        short_leg = leg["estimated_time_min"] <= 4.0 or leg["distance_meters"] <= 900
        if not short_leg:
            continue
        prev_leg = legs[index - 1] if index > 0 else None
        next_leg = legs[index + 1] if index + 1 < len(legs) else None
        if prev_leg and next_leg and prev_leg["transfer"] and next_leg["transfer"]:
            penalty += 2.5
        elif prev_leg and prev_leg["transfer"]:
            penalty += 1.2
        elif next_leg and next_leg["transfer"]:
            penalty += 1.2
        else:
            penalty += 0.6
    return penalty


def route_rank_score(route: dict[str, Any]) -> float:
    return route["total_cost"] + awkward_micro_ride_penalty(route)


def commuter_efficiency_score(route: dict[str, Any]) -> float:
    return (
        route["total_time_min"]
        + (route["transfer_count"] * 12.0)
        + (ride_hop_count(route) * 4.0)
        + awkward_micro_ride_penalty(route)
    )


def efficiency_sort_key(route: dict[str, Any]) -> tuple[float, float, float, float, float]:
    return (
        commuter_efficiency_score(route),
        route["transfer_count"],
        ride_hop_count(route),
        route["total_time_min"],
        route_rank_score(route),
    )


def dominates(route_a: dict[str, Any], route_b: dict[str, Any]) -> bool:
    metrics_a = (
        commuter_efficiency_score(route_a),
        route_a["transfer_count"],
        ride_hop_count(route_a),
        route_a["total_time_min"],
        route_rank_score(route_a),
    )
    metrics_b = (
        commuter_efficiency_score(route_b),
        route_b["transfer_count"],
        ride_hop_count(route_b),
        route_b["total_time_min"],
        route_rank_score(route_b),
    )
    return all(a <= b for a, b in zip(metrics_a, metrics_b)) and any(a < b for a, b in zip(metrics_a, metrics_b))


def filter_dominated_routes(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for candidate in routes:
        if any(dominates(existing, candidate) for existing in kept):
            continue
        kept = [existing for existing in kept if not dominates(candidate, existing)]
        kept.append(candidate)
    return kept


def generate_candidate_routes(
    adjacency: dict[str, list[dict[str, Any]]],
    nodes: dict[str, dict[str, Any]],
    start_stop_id: str,
    end_stop_id: str,
    preference: str,
    limit: int = 3,
) -> list[dict[str, Any]]:
    raw_candidates = compute_top_routes(adjacency, nodes, start_stop_id, end_stop_id, preference, limit=30)
    if not raw_candidates:
        return []

    summaries = []
    seen_signatures: set[tuple[tuple[str, str, str, str], ...]] = set()
    all_modes: list[str] = []

    for raw_route in raw_candidates:
        legs = group_route_legs(raw_route["stop_ids"], raw_route["edges"], nodes)
        summary = summarize_route(raw_route["stop_ids"], raw_route["edges"], legs, nodes, raw_route["weighted_cost"])
        signature = commute_hop_signature(summary)
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)
        summary["map_legs"] = deepcopy(legs)
        for mode in summary["modes_used"]:
            if mode not in all_modes:
                all_modes.append(mode)
        summaries.append(summary)

    summaries.sort(key=lambda route: (*efficiency_sort_key(route), route_edge_weight(route)))
    filtered = filter_dominated_routes(summaries)
    top = list(islice(filtered or summaries, limit))
    for rank, route_summary in enumerate(top, start=1):
        route_summary["rank"] = rank
        for index, leg in enumerate(route_summary["map_legs"], start=1):
            leg["index"] = index
    return top


def coordinates_for_stop_ids(stop_ids: list[str], nodes: dict[str, dict[str, Any]]) -> list[list[float]]:
    coordinates = []
    for stop_id in stop_ids:
        stop = nodes[stop_id]
        if stop["lat"] is None or stop["lon"] is None:
            continue
        coordinates.append([stop["lon"], stop["lat"]])
    deduped: list[list[float]] = []
    for coord in coordinates:
        if not deduped or deduped[-1] != coord:
            deduped.append(coord)
    return deduped


def ors_profile_for_mode(mode: str) -> str | None:
    if mode == "transfer":
        return "foot-walking"
    if mode == "jeep":
        return "driving-car"
    return None


def fetch_ors_geometry(coordinates: list[list[float]], profile: str) -> list[list[float]] | None:
    if not ORS_API_KEY or len(coordinates) < 2:
        return None

    url = f"https://api.openrouteservice.org/v2/directions/{profile}/geojson"
    payload = json.dumps({"coordinates": coordinates}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": ORS_API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    features = data.get("features") or []
    if not features:
        return None
    geometry = features[0].get("geometry") or {}
    if geometry.get("type") != "LineString":
        return None
    return geometry.get("coordinates")


def build_leg_geometries(route: dict[str, Any], nodes: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    leg_features = []
    for index, leg in enumerate(route["legs"], start=1):
        stop_coordinates = coordinates_for_stop_ids(leg["stop_ids"], nodes)
        profile = ors_profile_for_mode(leg["mode"])
        geometry = fetch_ors_geometry(stop_coordinates, profile) if profile else None
        if not geometry:
            geometry = stop_coordinates
        latlngs = [[coord[1], coord[0]] for coord in geometry]
        leg_features.append(
            {
                "index": index,
                "route_rank": route["rank"],
                "mode": leg["mode"],
                "route_name": leg["route_name"],
                "from_stop_name": leg["from_stop_name"],
                "to_stop_name": leg["to_stop_name"],
                "estimated_time_min": round(leg["estimated_time_min"], 2),
                "segments": leg["segments"],
                "color": MODE_COLORS.get(leg["mode"], MODE_COLORS["unknown"]),
                "latlngs": latlngs,
            }
        )
    return leg_features


def generate_leaflet_html(route: dict[str, Any], nodes: dict[str, dict[str, Any]], output_path: Path = OUTPUT_HTML) -> Path:
    routes = route["routes"]
    leg_features = []
    marker_data = []
    for route_option in routes:
        leg_features.extend(build_leg_geometries(route_option, nodes))
        marker_data.extend(
            {
                "route_rank": route_option["rank"],
                "index": item["order"],
                "stop_name": item["stop_name"],
                "lat": item["lat"],
                "lon": item["lon"],
                "mode": item["mode"],
            }
            for item in route_option["stop_sequence"]
            if item["lat"] is not None and item["lon"] is not None
        )
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sakai ORS Route Simulation</title>
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <style>
    body {{
      margin: 0;
      font-family: "Segoe UI", sans-serif;
      background: #f3efe8;
      color: #1c232b;
    }}
    .layout {{
      display: grid;
      grid-template-columns: 360px 1fr;
      min-height: 100vh;
    }}
    .sidebar {{
      padding: 20px;
      border-right: 1px solid rgba(0,0,0,0.08);
      background: rgba(255,255,255,0.92);
      overflow: auto;
    }}
    .title {{
      margin: 0 0 8px 0;
      font-size: 1.35rem;
    }}
    .subtle {{
      color: #5a6571;
      line-height: 1.45;
    }}
    .stats {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 16px 0;
    }}
    .stat {{
      background: #f8f5ef;
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 14px;
      padding: 12px;
    }}
    .stat strong {{
      display: block;
      font-size: 1.1rem;
      margin-top: 4px;
    }}
    .legend-row, .leg-row {{
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin: 10px 0;
    }}
    .route-card {{
      margin: 14px 0;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.08);
      background: #faf7f2;
    }}
    .swatch {{
      width: 14px;
      height: 14px;
      border-radius: 999px;
      margin-top: 4px;
      flex: 0 0 auto;
    }}
    .leg-name {{
      font-weight: 600;
    }}
    #map {{
      width: 100%;
      min-height: 100vh;
    }}
    code {{
      background: #f3efe8;
      padding: 2px 6px;
      border-radius: 6px;
    }}
    @media (max-width: 960px) {{
      .layout {{
        grid-template-columns: 1fr;
      }}
      #map {{
        min-height: 65vh;
      }}
    }}
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <h1 class="title">{route["start_stop"]} to {route["end_stop"]}</h1>
      <p class="subtle">Preference: <strong>{route["preference"].upper()}</strong></p>
      <p class="subtle">Visualization uses OpenRouteService directions for jeep and walking segments when <code>ORS_API_KEY</code> is set. Rail segments are drawn from the transit graph.</p>
      <div class="stats">
        <div class="stat">Routes shown<strong>{len(routes)}</strong></div>
        <div class="stat">Preference<strong>{route["preference"].upper()}</strong></div>
        <div class="stat">Best time<strong>{routes[0]["total_time_min"]:.2f} min</strong></div>
        <div class="stat">Best score<strong>{routes[0]["total_cost"]:.2f}</strong></div>
      </div>
      <h2>Modes</h2>
      {"".join(f'<div class="legend-row"><span class="swatch" style="background:{MODE_COLORS.get(mode, MODE_COLORS["unknown"])}"></span><div>{mode.upper()}</div></div>' for mode in route["modes_used"])}
      <h2>Top Routes</h2>
      {"".join(f'<div class="route-card"><div class="leg-name">Route {option["rank"]}</div><div class="subtle">{option["total_time_min"]:.2f} min, score {option["total_cost"]:.2f}, {option["transfer_count"]} transfer(s), {option["total_distance_m"]:.0f} m</div>' + "".join(f'<div class=\"leg-row\"><span class=\"swatch\" style=\"background:{MODE_COLORS.get(leg["mode"], MODE_COLORS["unknown"])}\"></span><div><div class=\"leg-name\">{leg["index"]}. {leg["mode"].upper()} via {leg["route_name"]}</div><div class=\"subtle\">{leg["from_stop_name"]} to {leg["to_stop_name"]}<br>{leg["estimated_time_min"]:.2f} min, {leg["segments"]} segment(s)</div></div></div>' for leg in option["map_legs"]) + '</div>' for option in routes)}
    </aside>
    <div id="map"></div>
  </div>
  <script>
    const legFeatures = {json.dumps(leg_features)};
    const markerData = {json.dumps(marker_data)};
  </script>
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
  ></script>
  <script>
    const map = L.map('map', {{ zoomControl: true }});
    L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }}).addTo(map);

    const bounds = [];
    legFeatures.forEach((leg) => {{
      if (!leg.latlngs.length) {{
        return;
      }}
      leg.latlngs.forEach((point) => bounds.push(point));
      L.polyline(leg.latlngs, {{
        color: leg.color,
        weight: leg.route_rank === 1 ? 7 : 5,
        opacity: leg.route_rank === 1 ? 0.95 : 0.55
      }}).addTo(map).bindPopup(
        `<strong>Route ${{leg.route_rank}}</strong><br><strong>${{leg.mode.toUpperCase()}}</strong><br>${{leg.route_name}}<br>${{leg.from_stop_name}} to ${{leg.to_stop_name}}<br>${{leg.estimated_time_min}} min`
      );
    }});

    markerData.forEach((marker) => {{
      const circle = L.circleMarker([marker.lat, marker.lon], {{
        radius: marker.index === 1 ? 7 : 5,
        color: '#17202a',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: marker.route_rank === 1 ? 1 : 0.7
      }}).addTo(map);
      circle.bindPopup(`Route ${{marker.route_rank}}<br>${{marker.index}}. ${{marker.stop_name}}<br>Mode: ${{(marker.mode || 'unknown').toUpperCase()}}`);
    }});

    if (bounds.length) {{
      map.fitBounds(bounds, {{ padding: [30, 30] }});
    }} else {{
      map.setView([14.5995, 120.9842], 12);
    }}
  </script>
</body>
</html>
"""
    output_path.write_text(html_body, encoding="utf-8")
    return output_path


def run_simulation(start_query: str, end_query: str, preference: str) -> dict[str, Any]:
    if preference not in PREFERENCE_OPTIONS:
        raise ValueError(f"Unsupported preference '{preference}'. Use one of: {', '.join(PREFERENCE_OPTIONS)}")

    nodes = load_nodes()
    adjacency = add_manual_interchanges(nodes, load_edges())
    stop_index = build_stop_index(nodes)
    start_stop_id = pick_stop(start_query, nodes, stop_index)
    end_stop_id = pick_stop(end_query, nodes, stop_index)

    routes = generate_candidate_routes(adjacency, nodes, start_stop_id, end_stop_id, preference, limit=3)
    if not routes:
        raise ValueError("No route found between those stops in the current graph.")
    all_modes: list[str] = []
    for route_summary in routes:
        for mode in route_summary["modes_used"]:
            if mode not in all_modes:
                all_modes.append(mode)

    payload = {
        "start_stop": routes[0]["start_stop"],
        "end_stop": routes[0]["end_stop"],
        "preference": preference,
        "routes": routes,
        "modes_used": all_modes,
    }
    output_path = generate_leaflet_html(payload, nodes)

    for route_option in routes:
        print(f"\n=== Route {route_option['rank']} ===")
        print_route(route_option)
    print(f"Preference: {preference}")
    if ORS_API_KEY:
        print("OpenRouteService enrichment: enabled")
    else:
        print("OpenRouteService enrichment: skipped (set ORS_API_KEY to enable live walking/road geometry)")
    print(f"HTML map saved to: {output_path}")
    return payload


def prompt_preference() -> str:
    print("Preferred commute mode:")
    for index, (key, description) in enumerate(PREFERENCE_OPTIONS.items(), start=1):
        print(f"  {index}. {key} - {description}")
    choice = input("Choose preference [mix]: ").strip().lower()
    if not choice:
        return "mix"
    if choice.isdigit():
        index = int(choice) - 1
        keys = list(PREFERENCE_OPTIONS)
        if 0 <= index < len(keys):
            return keys[index]
    normalized_choice = normalize_text(choice)
    if normalized_choice in PREFERENCE_OPTIONS:
        return normalized_choice
    raise ValueError(f"Unsupported preference '{choice}'.")


def interactive_prompt() -> None:
    print("Sakai ORS route simulator")
    print("Example: EDSA LRT -> Pureza LRT")
    while True:
        start_query = input("\nStart stop: ").strip()
        if not start_query:
            continue
        end_query = input("End stop: ").strip()
        if not end_query:
            continue
        try:
            preference = prompt_preference()
            run_simulation(start_query, end_query, preference)
        except ValueError as error:
            print(error)
        except KeyboardInterrupt:
            print("\nExiting.")
            return

        again = input("\nRun another route? [y/N]: ").strip().lower()
        if again != "y":
            return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simulate Sakai routes with preference-aware transit routing and a map-style HTML output.")
    parser.add_argument("start", nargs="?", help="Start stop name, for example 'EDSA LRT'")
    parser.add_argument("end", nargs="?", help="End stop name, for example 'Pureza LRT'")
    parser.add_argument("--preference", default="mix", choices=list(PREFERENCE_OPTIONS), help="Routing preference")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.start and arguments.end:
        run_simulation(arguments.start, arguments.end, arguments.preference)
    else:
        interactive_prompt()
