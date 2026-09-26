"""
End-to-end demo using a synthetic street grid (no live OSM connection needed).

Swap build_demo_graph(...) for graph_utils.load_real_graph("Your City") once
you're running this somewhere with normal internet access, and everything
else below works unchanged - annotate_sun_exposure/find_route/render_routes
only care that the graph has 'y', 'x', 'length', and 'bearing' on it, which
OSMnx also provides.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from graph_utils import build_demo_graph
from routing import annotate_sun_exposure, find_route
from visualize import render_routes

# Adelaide-ish coordinates, just as an example center point
CENTER_LAT, CENTER_LON = -34.9285, 138.6007

print("Building synthetic street grid...")
G = build_demo_graph(CENTER_LAT, CENTER_LON, size=6, spacing_deg=0.001, jitter=0.4)
print(f"  {G.number_of_nodes()} intersections, {G.number_of_edges()} street segments")

# pick a time of day - try changing the hour to see routes shift
# IMPORTANT: astral needs a timezone-aware datetime, or it silently assumes UTC
when = datetime(2026, 9, 26, 15, 0, tzinfo=ZoneInfo("Australia/Adelaide"))  # 3pm local time
print(f"\nComputing sun position for {when}...")
sun_az, sun_el = annotate_sun_exposure(G, when)
print(f"  sun azimuth={sun_az:.1f}°, elevation={sun_el:.1f}°")

start_node = 0
end_node = G.number_of_nodes() - 1

print("\nFinding shortest route (ignores sun)...")
shortest_path, shortest_cost = find_route(G, start_node, end_node, sun_weight=0.0)
print(f"  path: {shortest_path}")

print("\nFinding least-sun route (heavily avoids exposure)...")
shade_path, shade_cost = find_route(G, start_node, end_node, sun_weight=10.0)
print(f"  path: {shade_path}")

if shortest_path == shade_path:
    print("\n  (Same path in this demo grid/time - try a different hour or a bigger grid!)")

print("\nRendering both routes to route_map.html...")
out_file = render_routes(
    G,
    routes={
        "Shortest": (shortest_path, "blue"),
        "Least sun": (shade_path, "orange"),
    },
    center_lat=CENTER_LAT,
    center_lon=CENTER_LON,
)
print(f"  saved to {out_file}")
