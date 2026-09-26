"""
Render a route (or several, for comparison) onto a real map using Folium.
"""

import folium


def _edge_coords(G, u, v):
    """
    Get the (lat, lon) points tracing the ACTUAL street between two connected
    nodes, following its real curve where OSMnx has that geometry stored -
    rather than a straight line between the two intersections, which can
    visibly cut across blocks or through buildings on a bendy street.
    """
    if not G.has_edge(u, v):
        return [(G.nodes[u]["y"], G.nodes[u]["x"]), (G.nodes[v]["y"], G.nodes[v]["x"])]

    data = G.get_edge_data(u, v)

    # MultiGraph/MultiDiGraph (what OSMnx returns) stores parallel edges as
    # {key: attr_dict, ...}; a plain Graph/DiGraph just gives one attr_dict.
    # Detect which shape we've got and pick the shortest parallel edge if there
    # are several (matches what the weighted shortest path would have used).
    if data and all(isinstance(k, int) for k in data.keys()):
        edge_data = min(data.values(), key=lambda d: d.get("length", float("inf")))
    else:
        edge_data = data

    if edge_data and "geometry" in edge_data:
        # Shapely LineString stores points as (lon, lat) - flip to (lat, lon) for Folium
        return [(lat, lon) for lon, lat in edge_data["geometry"].coords]

    # No stored curve (e.g. our synthetic demo grid, or a straight real segment)
    # - a direct line between the two intersections is accurate in that case.
    return [(G.nodes[u]["y"], G.nodes[u]["x"]), (G.nodes[v]["y"], G.nodes[v]["x"])]


def _path_coords(G, path):
    """Build the full lat/lon polyline for a path, following real street curves."""
    coords = []
    for u, v in zip(path[:-1], path[1:]):
        segment = _edge_coords(G, u, v)
        # avoid a duplicated point where consecutive segments join
        if coords and coords[-1] == segment[0]:
            segment = segment[1:]
        coords.extend(segment)
    return coords


def render_routes(G, routes: dict, center_lat: float, center_lon: float, out_path: str = "route_map.html"):
    """
    routes: dict of label -> (path_node_list, color), e.g.
        {"Shortest": (path1, "blue"), "Least sun": (path2, "orange")}
    """
    m = folium.Map(location=[center_lat, center_lon], zoom_start=16)

    for label, (path, color) in routes.items():
        coords = _path_coords(G, path)
        folium.PolyLine(coords, color=color, weight=5, opacity=0.8, tooltip=label).add_to(m)

        folium.Marker(coords[0], popup=f"Start ({label})", icon=folium.Icon(color="green")).add_to(m)
        folium.Marker(coords[-1], popup=f"End ({label})", icon=folium.Icon(color="red")).add_to(m)

    m.save(out_path)
    return out_path