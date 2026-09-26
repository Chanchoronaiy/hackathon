"""
End-to-end demo using the REAL Adelaide street network from OpenStreetMap.
Requires a working internet connection to OSM's servers.
"""
 
from datetime import datetime
from zoneinfo import ZoneInfo
 
import osmnx as ox
 
from graph_utils import load_real_graph_near_point
from routing import annotate_sun_exposure, find_route
from visualize import render_routes
 
# Adelaide-ish coordinates, just as an example center point
CENTER_LAT, CENTER_LON = -34.9285, 138.6007
 
print("Loading real Adelaide CBD street network from OpenStreetMap (small radius)...")
G = load_real_graph_near_point(CENTER_LAT, CENTER_LON, dist_m=800)
print(f"  {G.number_of_nodes()} intersections, {G.number_of_edges()} street segments")
 
# pick a time of day - try changing the hour to see routes shift
# IMPORTANT: astral needs a timezone-aware datetime, or it silently assumes UTC
when = datetime(2026, 9, 26, 15, 0, tzinfo=ZoneInfo("Australia/Adelaide"))  # 3pm local time
print(f"\nComputing sun position for {when}...")
sun_az, sun_el = annotate_sun_exposure(G, when)
print(f"  sun azimuth={sun_az:.1f}°, elevation={sun_el:.1f}°")
 
# pick real start/end points by lat/lon, then snap to the nearest real intersection
# (replace these with two real points you actually want to route between)
start_lat, start_lon = -34.9295, 138.5990   # example: near Central Market
end_lat, end_lon = -34.9265, 138.6015       # example: near Victoria Square
 
start_node = ox.distance.nearest_nodes(G, start_lon, start_lat)
end_node = ox.distance.nearest_nodes(G, end_lon, end_lat)
 
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
 
