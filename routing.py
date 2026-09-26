"""
Weighted shortest-path routing that trades off distance against sun exposure.
"""

from datetime import datetime
import networkx as nx

from sun import get_sun_position, shade_score


def annotate_sun_exposure(G, when: datetime):
    """
    Compute sun_exposure (0=full shade, 1=full sun) for every edge in G,
    based on the current sun position and each edge's bearing.
    Stores it as an edge attribute so it can be reused for multiple queries
    at the same point in time without recomputing.
    """
    # use the graph's rough center to get one sun position for the whole area
    # (fine for a city-sized graph - the sun's angle doesn't meaningfully
    # change across a few km)
    lats = [data["y"] for _, data in G.nodes(data=True)]
    lons = [data["x"] for _, data in G.nodes(data=True)]
    center_lat, center_lon = sum(lats) / len(lats), sum(lons) / len(lons)

    sun_azimuth, sun_elevation = get_sun_position(center_lat, center_lon, when)

    for u, v, data in G.edges(data=True):
        exposure = 1 - shade_score(data["bearing"], sun_azimuth, sun_elevation)
        data["sun_exposure"] = exposure

    return sun_azimuth, sun_elevation


def route_cost(u, v, data, sun_weight: float) -> float:
    """
    Edge cost combining physical distance with sun exposure.

    sun_weight = 0   -> pure shortest path, ignores sun entirely
    sun_weight = 1   -> distance and sun exposure matter about equally
    sun_weight > 1   -> increasingly prioritizes avoiding sun over being short
    """
    length = data["length"]
    exposure = data.get("sun_exposure", 0)
    return length * (1 + sun_weight * exposure)


def find_route(G, start_node, end_node, sun_weight: float = 1.0):
    """
    Find the best path from start_node to end_node, trading off distance
    against sun exposure according to sun_weight.

    Returns (path_node_list, total_cost).
    """
    def weight_fn(u, v, data):
        return route_cost(u, v, data, sun_weight)

    path = nx.shortest_path(G, start_node, end_node, weight=weight_fn)
    cost = nx.shortest_path_length(G, start_node, end_node, weight=weight_fn)
    return path, cost
