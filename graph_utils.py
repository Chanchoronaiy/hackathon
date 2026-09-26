"""
Street network loading.

load_real_graph() pulls an actual city's streets from OpenStreetMap via
OSMnx. This needs normal internet access to OSM's servers, so it will
work on your own machine but not in a locked-down sandbox.

build_demo_graph() builds a small synthetic grid with real lat/lon
coordinates and bearings, so the rest of the pipeline (sun scoring,
weighted routing, map rendering) can be built and tested without needing
a live OSM connection.
"""

import math
import networkx as nx


def load_real_graph(place_name: str):
    """
    Load a real street network for a place (e.g. "Adelaide, Australia")
    using OSMnx. Returns a NetworkX MultiDiGraph with 'bearing' already
    computed on every edge.

    Note: this geocodes place_name to a boundary polygon first, which only
    works for names OSM actually recognizes as an administrative area
    (e.g. a suburb or city name) - it will fail for informal names like
    "Adelaide CBD". For a small area around a specific point instead
    (faster, and doesn't depend on geocoding), use load_real_graph_near_point().
    """
    import osmnx as ox
    import networkx as nx

    G = ox.graph_from_place(place_name, network_type="walk")
    G = ox.add_edge_bearings(G)  # adds a 'bearing' attribute to every edge
    G.remove_edges_from(nx.selfloop_edges(G))  # not real walkable paths, and have no defined bearing
    return G


def load_real_graph_near_point(lat: float, lon: float, dist_m: int = 800):
    """
    Load a real street network within dist_m meters of a lat/lon point.
    Faster and more reliable than load_real_graph() for a small demo area,
    since it skips geocoding a place name to a boundary polygon entirely -
    just downloads whatever's within the given radius of the point.
    """
    import osmnx as ox
    import networkx as nx

    G = ox.graph_from_point((lat, lon), dist=dist_m, network_type="walk")
    G = ox.add_edge_bearings(G)
    G.remove_edges_from(nx.selfloop_edges(G))  # not real walkable paths, and have no defined bearing
    return G


def build_demo_graph(center_lat: float, center_lon: float, size: int = 5, spacing_deg: float = 0.001, jitter: float = 0.2, seed: int = 42):
    """
    Build a synthetic size x size street grid centered on (center_lat, center_lon),
    for local testing without OSM access. Adds 'length' and 'bearing' to each
    edge, matching what OSMnx would give us on a real graph.

    jitter randomly nudges each intersection off the perfect grid (as a
    fraction of spacing_deg), so streets end up with varied bearings like a
    real city - a perfect grid gives every route the exact same total sun
    exposure regardless of path taken, which makes for a boring demo.
    """
    import random
    rng = random.Random(seed)

    G = nx.Graph()

    # create grid nodes with real-ish lat/lon offsets, lightly jittered
    for row in range(size):
        for col in range(size):
            node_id = row * size + col
            lat = center_lat + (row - size // 2) * spacing_deg + rng.uniform(-jitter, jitter) * spacing_deg
            lon = center_lon + (col - size // 2) * spacing_deg + rng.uniform(-jitter, jitter) * spacing_deg
            G.add_node(node_id, y=lat, x=lon)

    # connect horizontal and vertical neighbors (a simple street grid)
    for row in range(size):
        for col in range(size):
            node_id = row * size + col
            if col < size - 1:
                _add_edge_with_geometry(G, node_id, node_id + 1)
            if row < size - 1:
                _add_edge_with_geometry(G, node_id, node_id + size)

    return G


def _add_edge_with_geometry(G, u, v):
    """Add an edge between u and v with computed length (meters) and bearing (degrees)."""
    y1, x1 = G.nodes[u]["y"], G.nodes[u]["x"]
    y2, x2 = G.nodes[v]["y"], G.nodes[v]["x"]

    length = _haversine_m(y1, x1, y2, x2)
    bearing = _bearing_deg(y1, x1, y2, x2)

    G.add_edge(u, v, length=length, bearing=bearing)


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Great-circle distance in meters between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _bearing_deg(lat1, lon1, lat2, lon2) -> float:
    """Compass bearing in degrees (0=North) from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360