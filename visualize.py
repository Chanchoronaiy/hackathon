"""
Render a route (or several, for comparison) onto a real map using Folium.
"""

import folium


def render_routes(G, routes: dict, center_lat: float, center_lon: float, out_path: str = "route_map.html"):
    """
    routes: dict of label -> (path_node_list, color), e.g.
        {"Shortest": (path1, "blue"), "Least sun": (path2, "orange")}
    """
    m = folium.Map(location=[center_lat, center_lon], zoom_start=16)

    for label, (path, color) in routes.items():
        coords = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in path]
        folium.PolyLine(coords, color=color, weight=5, opacity=0.8, tooltip=label).add_to(m)

        folium.Marker(coords[0], popup=f"Start ({label})", icon=folium.Icon(color="green")).add_to(m)
        folium.Marker(coords[-1], popup=f"End ({label})", icon=folium.Icon(color="red")).add_to(m)

    m.save(out_path)
    return out_path
