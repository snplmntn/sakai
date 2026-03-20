from __future__ import annotations

import argparse
import csv
import difflib
import heapq
import html
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
NODES_CSV = BASE_DIR / "nodes_supabase.csv"
EDGES_CSV = BASE_DIR / "edges_supabase.csv"
OUTPUT_HTML = BASE_DIR / "route_simulation.html"

MODE_COLORS = {
    "jeep": "#1f77b4",
    "lrt": "#d62728",
    "mrt": "#2ca02c",
    "transfer": "#7f7f7f",
    "walk": "#7f7f7f",
    "unknown": "#9467bd",
}


def normalize_text(value: object) -> str:
    text = str(value or "").strip().lower()
    text = text.replace(".", "")
    text = text.replace("-", " ")
    return " ".join(text.split())


def load_nodes(path: Path = NODES_CSV) -> dict[str, dict[str, Any]]:
    nodes: dict[str, dict[str, Any]] = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            stop_id = row["stop_id"]
            nodes[stop_id] = {
                "stop_id": stop_id,
                "stop_name": row["stop_name"],
                "normalized_name": row["normalized_name"],
                "lat": float(row["lat"]) if row.get("lat") else None,
                "lon": float(row["lon"]) if row.get("lon") else None,
                "mode": (row.get("mode") or "unknown").lower(),
                "line": row.get("line") or "",
                "all_modes": [part for part in (row.get("all_modes") or "").split("|") if part],
                "all_lines": [part for part in (row.get("all_lines") or "").split("|") if part],
                "is_multimodal": str(row.get("is_multimodal", "")).lower() == "true",
                "line_count": int(float(row["line_count"])) if row.get("line_count") else 0,
            }
    return nodes


def load_edges(path: Path = EDGES_CSV) -> dict[str, list[dict[str, Any]]]:
    adjacency: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            edge = {
                "source_stop_id": row["source_stop_id"],
                "target_stop_id": row["target_stop_id"],
                "weight": float(row["weight"]) if row.get("weight") else 1.0,
                "mode": (row.get("mode") or "unknown").lower(),
                "line": row.get("line") or "",
                "route_short_name": row.get("route_short_name") or "",
                "route_long_name": row.get("route_long_name") or "",
                "transfer": str(row.get("transfer", "")).lower() == "true",
                "distance_meters": float(row["distance_meters"]) if row.get("distance_meters") else None,
                "estimated_time_min": float(row["estimated_time_min"]) if row.get("estimated_time_min") else None,
                "data_source": row.get("data_source") or "",
            }
            adjacency[edge["source_stop_id"]].append(edge)
    return adjacency


def build_stop_index(nodes: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = defaultdict(list)
    for stop_id, node in nodes.items():
        index[node["normalized_name"]].append(stop_id)
    return index


def pick_stop(query: str, nodes: dict[str, dict[str, Any]], index: dict[str, list[str]]) -> str:
    normalized_query = normalize_text(query)
    if normalized_query in index:
        matches = index[normalized_query]
        if len(matches) == 1:
            return matches[0]
        matches.sort(key=lambda stop_id: (nodes[stop_id]["mode"], nodes[stop_id]["stop_name"]))
        return matches[0]

    scored: list[tuple[float, str]] = []
    for stop_id, node in nodes.items():
        name = node["normalized_name"]
        ratio = difflib.SequenceMatcher(a=normalized_query, b=name).ratio()
        if normalized_query in name:
            ratio += 0.25
        scored.append((ratio, stop_id))
    scored.sort(reverse=True)
    best_ratio, best_id = scored[0]
    if best_ratio < 0.45:
        suggestions = [nodes[stop_id]["stop_name"] for _, stop_id in scored[:5]]
        raise ValueError(f"No close stop found for '{query}'. Closest matches: {', '.join(suggestions)}")
    return best_id


def shortest_path(
    adjacency: dict[str, list[dict[str, Any]]],
    start_stop_id: str,
    end_stop_id: str,
) -> tuple[list[str], list[dict[str, Any]], float]:
    queue: list[tuple[float, str]] = [(0.0, start_stop_id)]
    distances: dict[str, float] = {start_stop_id: 0.0}
    previous: dict[str, tuple[str, dict[str, Any]]] = {}

    while queue:
        current_cost, current_stop_id = heapq.heappop(queue)
        if current_stop_id == end_stop_id:
            break
        if current_cost > distances.get(current_stop_id, math.inf):
            continue

        for edge in adjacency.get(current_stop_id, []):
            next_stop_id = edge["target_stop_id"]
            candidate_cost = current_cost + edge["weight"]
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


def group_route_legs(
    stop_ids: list[str],
    edges: list[dict[str, Any]],
    nodes: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    if not edges:
        return []

    legs: list[dict[str, Any]] = []
    current_leg = make_leg(edges[0], stop_ids[0], stop_ids[1], nodes)

    for index in range(1, len(edges)):
        edge = edges[index]
        source_stop_id = stop_ids[index]
        target_stop_id = stop_ids[index + 1]
        same_leg = (
            edge["mode"] == current_leg["mode"]
            and edge["line"] == current_leg["line"]
            and edge["transfer"] == current_leg["transfer"]
        )
        if same_leg:
            extend_leg(current_leg, edge, target_stop_id, nodes)
            continue
        legs.append(current_leg)
        current_leg = make_leg(edge, source_stop_id, target_stop_id, nodes)

    legs.append(current_leg)
    return legs


def make_leg(edge: dict[str, Any], source_stop_id: str, target_stop_id: str, nodes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "mode": edge["mode"],
        "line": edge["line"],
        "route_name": edge["route_short_name"] or edge["route_long_name"] or edge["line"] or edge["mode"],
        "transfer": edge["transfer"],
        "from_stop_id": source_stop_id,
        "to_stop_id": target_stop_id,
        "from_stop_name": nodes[source_stop_id]["stop_name"],
        "to_stop_name": nodes[target_stop_id]["stop_name"],
        "stop_ids": [source_stop_id, target_stop_id],
        "estimated_time_min": edge["estimated_time_min"] or edge["weight"],
        "distance_meters": edge["distance_meters"] or 0.0,
        "segments": 1,
    }


def extend_leg(leg: dict[str, Any], edge: dict[str, Any], target_stop_id: str, nodes: dict[str, dict[str, Any]]) -> None:
    leg["to_stop_id"] = target_stop_id
    leg["to_stop_name"] = nodes[target_stop_id]["stop_name"]
    leg["stop_ids"].append(target_stop_id)
    leg["estimated_time_min"] += edge["estimated_time_min"] or edge["weight"]
    leg["distance_meters"] += edge["distance_meters"] or 0.0
    leg["segments"] += 1


def summarize_route(
    stop_ids: list[str],
    edges: list[dict[str, Any]],
    legs: list[dict[str, Any]],
    nodes: dict[str, dict[str, Any]],
    total_cost: float,
) -> dict[str, Any]:
    total_distance = sum((edge["distance_meters"] or 0.0) for edge in edges)
    total_time = sum((edge["estimated_time_min"] or edge["weight"]) for edge in edges)
    transfer_count = sum(1 for edge in edges if edge["transfer"])
    return {
        "start_stop": nodes[stop_ids[0]]["stop_name"],
        "end_stop": nodes[stop_ids[-1]]["stop_name"],
        "stop_count": len(stop_ids),
        "total_cost": round(total_cost, 2),
        "total_time_min": round(total_time, 2),
        "total_distance_m": round(total_distance, 2),
        "transfer_count": transfer_count,
        "modes_used": list(dict.fromkeys(edge["mode"] for edge in edges)),
        "legs": legs,
        "stop_sequence": [
            {
                "order": index + 1,
                "stop_id": stop_id,
                "stop_name": nodes[stop_id]["stop_name"],
                "mode": nodes[stop_id]["mode"],
                "lat": nodes[stop_id]["lat"],
                "lon": nodes[stop_id]["lon"],
            }
            for index, stop_id in enumerate(stop_ids)
        ],
    }


def generate_route_html(route: dict[str, Any], nodes: dict[str, dict[str, Any]]) -> str:
    points = [nodes[item["stop_id"]] for item in route["stop_sequence"]]
    valid_points = [point for point in points if point["lat"] is not None and point["lon"] is not None]
    if not valid_points:
        raise ValueError("The selected route does not have coordinates to plot.")

    lats = [point["lat"] for point in valid_points]
    lons = [point["lon"] for point in valid_points]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    lat_span = max(max_lat - min_lat, 0.002)
    lon_span = max(max_lon - min_lon, 0.002)
    padding_ratio = 0.15
    min_lat -= lat_span * padding_ratio
    max_lat += lat_span * padding_ratio
    min_lon -= lon_span * padding_ratio
    max_lon += lon_span * padding_ratio

    width = 1000
    height = 680

    def project(lat: float, lon: float) -> tuple[float, float]:
        x = ((lon - min_lon) / (max_lon - min_lon)) * width
        y = height - ((lat - min_lat) / (max_lat - min_lat)) * height
        return round(x, 2), round(y, 2)

    projected = {point["stop_id"]: project(point["lat"], point["lon"]) for point in valid_points}

    polyline_parts: list[str] = []
    for leg in route["legs"]:
        leg_points = []
        for stop_id in leg["stop_ids"]:
            point = nodes[stop_id]
            if point["lat"] is None or point["lon"] is None:
                continue
            x, y = projected[stop_id]
            leg_points.append(f"{x},{y}")
        if len(leg_points) < 2:
            continue
        color = MODE_COLORS.get(leg["mode"], MODE_COLORS["unknown"])
        label = f"{leg['mode'].upper()} | {leg['route_name']} | {leg['from_stop_name']} -> {leg['to_stop_name']}"
        polyline_parts.append(
            f"<polyline class=\"route-line\" data-label=\"{html.escape(label)}\" "
            f"points=\"{' '.join(leg_points)}\" stroke=\"{color}\" />"
        )

    stop_marker_parts: list[str] = []
    for sequence_index, point in enumerate(valid_points, start=1):
        x, y = projected[point["stop_id"]]
        escaped_name = html.escape(point["stop_name"])
        stop_marker_parts.append(
            f"<g class=\"stop-marker\" data-label=\"{sequence_index}. {escaped_name}\">"
            f"<circle cx=\"{x}\" cy=\"{y}\" r=\"7\"></circle>"
            f"<text x=\"{x + 10}\" y=\"{y - 10}\">{sequence_index}. {escaped_name}</text>"
            "</g>"
        )

    legend_parts = []
    seen_modes = []
    for mode in route["modes_used"]:
        if mode in seen_modes:
            continue
        seen_modes.append(mode)
        legend_parts.append(
            f"<div class=\"legend-row\"><span class=\"legend-swatch\" style=\"background:{MODE_COLORS.get(mode, MODE_COLORS['unknown'])}\"></span>{html.escape(mode.upper())}</div>"
        )

    details_json = html.escape(json.dumps(route, indent=2))
    legs_html = "".join(
        "<li>"
        f"<strong>{html.escape(leg['mode'].upper())}</strong> via {html.escape(leg['route_name'])}: "
        f"{html.escape(leg['from_stop_name'])} to {html.escape(leg['to_stop_name'])} "
        f"({leg['segments']} segment(s), {leg['estimated_time_min']:.2f} min)"
        "</li>"
        for leg in route["legs"]
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sakai Route Simulation</title>
  <style>
    :root {{
      --bg: #f4efe7;
      --panel: rgba(255, 252, 247, 0.96);
      --ink: #1f252b;
      --muted: #56616c;
      --line: rgba(31, 37, 43, 0.12);
      --accent: #d95d39;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(217, 93, 57, 0.14), transparent 28rem),
        linear-gradient(180deg, #f8f3ec 0%, var(--bg) 100%);
    }}
    .layout {{
      display: grid;
      grid-template-columns: minmax(280px, 380px) 1fr;
      min-height: 100vh;
      gap: 1.25rem;
      padding: 1.25rem;
    }}
    .panel {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 1.1rem 1.2rem;
      box-shadow: 0 18px 60px rgba(48, 38, 30, 0.08);
      backdrop-filter: blur(10px);
    }}
    h1 {{
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }}
    h2 {{
      margin: 1.2rem 0 0.6rem 0;
      font-size: 1rem;
    }}
    p, li, pre {{
      color: var(--muted);
      line-height: 1.45;
    }}
    ul {{
      margin: 0;
      padding-left: 1.1rem;
    }}
    .metrics {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }}
    .metric {{
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 0.8rem;
      background: rgba(255,255,255,0.7);
    }}
    .metric-label {{
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }}
    .metric-value {{
      display: block;
      font-size: 1.25rem;
      color: var(--ink);
      margin-top: 0.2rem;
    }}
    .legend-row {{
      display: flex;
      align-items: center;
      gap: 0.55rem;
      margin: 0.35rem 0;
      color: var(--muted);
    }}
    .legend-swatch {{
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.08);
    }}
    .map-shell {{
      position: relative;
      overflow: hidden;
    }}
    #tooltip {{
      position: absolute;
      display: none;
      pointer-events: none;
      background: rgba(31, 37, 43, 0.92);
      color: white;
      padding: 0.45rem 0.55rem;
      border-radius: 10px;
      font-size: 0.82rem;
      max-width: 22rem;
      z-index: 2;
    }}
    svg {{
      width: 100%;
      height: calc(100vh - 2.5rem);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,243,236,0.92)),
        repeating-linear-gradient(
          90deg,
          rgba(31,37,43,0.03) 0,
          rgba(31,37,43,0.03) 1px,
          transparent 1px,
          transparent 64px
        ),
        repeating-linear-gradient(
          0deg,
          rgba(31,37,43,0.03) 0,
          rgba(31,37,43,0.03) 1px,
          transparent 1px,
          transparent 64px
        );
      border-radius: 20px;
      border: 1px solid var(--line);
      cursor: grab;
    }}
    .route-line {{
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.95;
    }}
    .stop-marker circle {{
      fill: white;
      stroke: var(--ink);
      stroke-width: 2;
    }}
    .stop-marker text {{
      font-size: 13px;
      fill: var(--ink);
      paint-order: stroke;
      stroke: rgba(255,255,255,0.95);
      stroke-width: 5px;
      stroke-linejoin: round;
    }}
    pre {{
      max-height: 18rem;
      overflow: auto;
      background: rgba(255,255,255,0.65);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 0.8rem;
      font-size: 0.76rem;
    }}
    @media (max-width: 980px) {{
      .layout {{
        grid-template-columns: 1fr;
      }}
      svg {{
        height: 32rem;
      }}
    }}
  </style>
</head>
<body>
  <div class="layout">
    <aside class="panel">
      <h1>{html.escape(route["start_stop"])} to {html.escape(route["end_stop"])}</h1>
      <p>Generated from <code>nodes_supabase.csv</code> and <code>edges_supabase.csv</code>.</p>
      <div class="metrics">
        <div class="metric">
          <span class="metric-label">Estimated Time</span>
          <span class="metric-value">{route["total_time_min"]:.2f} min</span>
        </div>
        <div class="metric">
          <span class="metric-label">Path Cost</span>
          <span class="metric-value">{route["total_cost"]:.2f}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Distance</span>
          <span class="metric-value">{route["total_distance_m"]:.0f} m</span>
        </div>
        <div class="metric">
          <span class="metric-label">Transfers</span>
          <span class="metric-value">{route["transfer_count"]}</span>
        </div>
      </div>
      <h2>Legs</h2>
      <ul>{legs_html}</ul>
      <h2>Modes</h2>
      {''.join(legend_parts)}
      <h2>Raw Route Data</h2>
      <pre>{details_json}</pre>
    </aside>
    <section class="panel map-shell">
      <div id="tooltip"></div>
      <svg id="map" viewBox="0 0 {width} {height}">
        <g id="viewport">
          {''.join(polyline_parts)}
          {''.join(stop_marker_parts)}
        </g>
      </svg>
    </section>
  </div>
  <script>
    const svg = document.getElementById('map');
    const viewport = document.getElementById('viewport');
    const tooltip = document.getElementById('tooltip');
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    function renderTransform() {{
      viewport.setAttribute('transform', `translate(${{translateX}} ${{translateY}}) scale(${{scale}})`);
    }}

    svg.addEventListener('wheel', (event) => {{
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1.12 : 0.9;
      scale = Math.min(8, Math.max(0.6, scale * direction));
      renderTransform();
    }});

    svg.addEventListener('pointerdown', (event) => {{
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      svg.style.cursor = 'grabbing';
    }});

    window.addEventListener('pointermove', (event) => {{
      if (!isDragging) {{
        return;
      }}
      translateX += (event.clientX - startX) / scale;
      translateY += (event.clientY - startY) / scale;
      startX = event.clientX;
      startY = event.clientY;
      renderTransform();
    }});

    window.addEventListener('pointerup', () => {{
      isDragging = false;
      svg.style.cursor = 'grab';
    }});

    document.querySelectorAll('[data-label]').forEach((element) => {{
      element.addEventListener('pointerenter', (event) => {{
        tooltip.style.display = 'block';
        tooltip.textContent = element.getAttribute('data-label');
      }});
      element.addEventListener('pointermove', (event) => {{
        tooltip.style.left = `${{event.offsetX + 24}}px`;
        tooltip.style.top = `${{event.offsetY + 24}}px`;
      }});
      element.addEventListener('pointerleave', () => {{
        tooltip.style.display = 'none';
      }});
    }});

    renderTransform();
  </script>
</body>
</html>
"""


def save_html(route: dict[str, Any], nodes: dict[str, dict[str, Any]], output_path: Path = OUTPUT_HTML) -> Path:
    output_path.write_text(generate_route_html(route, nodes), encoding="utf-8")
    return output_path


def print_route(route: dict[str, Any]) -> None:
    print()
    print(f"Route: {route['start_stop']} -> {route['end_stop']}")
    print(f"Estimated time: {route['total_time_min']:.2f} min")
    print(f"Path cost: {route['total_cost']:.2f}")
    print(f"Distance: {route['total_distance_m']:.0f} m")
    print(f"Transfers: {route['transfer_count']}")
    print("Legs:")
    for index, leg in enumerate(route["legs"], start=1):
        print(
            f"  {index}. {leg['mode'].upper()} via {leg['route_name']} | "
            f"{leg['from_stop_name']} -> {leg['to_stop_name']} | "
            f"{leg['estimated_time_min']:.2f} min"
        )


def run_simulation(start_query: str, end_query: str) -> dict[str, Any]:
    nodes = load_nodes()
    adjacency = load_edges()
    stop_index = build_stop_index(nodes)

    start_stop_id = pick_stop(start_query, nodes, stop_index)
    end_stop_id = pick_stop(end_query, nodes, stop_index)

    stop_ids, edges, total_cost = shortest_path(adjacency, start_stop_id, end_stop_id)
    legs = group_route_legs(stop_ids, edges, nodes)
    route = summarize_route(stop_ids, edges, legs, nodes, total_cost)
    output_path = save_html(route, nodes)

    print_route(route)
    print(f"HTML visualization saved to: {output_path}")
    return route


def interactive_prompt() -> None:
    print("Sakai route simulator")
    print("Type stop names from nodes_supabase.csv. Example: EDSA LRT -> Pureza LRT")
    while True:
        start_query = input("\nStart stop: ").strip()
        if not start_query:
            continue
        end_query = input("End stop: ").strip()
        if not end_query:
            continue

        try:
            run_simulation(start_query, end_query)
        except ValueError as error:
            print(error)
        except KeyboardInterrupt:
            print("\nExiting.")
            return

        again = input("\nRun another route? [y/N]: ").strip().lower()
        if again != "y":
            return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simulate Sakai routes using nodes_supabase.csv and edges_supabase.csv.")
    parser.add_argument("start", nargs="?", help="Start stop name, for example 'EDSA LRT'")
    parser.add_argument("end", nargs="?", help="End stop name, for example 'Pureza LRT'")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.start and arguments.end:
        run_simulation(arguments.start, arguments.end)
    else:
        interactive_prompt()
