"""
Diagnostic: print what OSM actually calls each street segment in a path,
so we can spot 'edges' that shouldn't really exist as a walkable route
(e.g. a straight line cutting through a building block).

Usage: after computing a path with find_route(), pass the same graph and
path into inspect_path() to see each segment's real tags.
"""


def inspect_path(G, path, label=""):
    print(f"\n--- Inspecting path: {label} ---")
    for u, v in zip(path[:-1], path[1:]):
        if not G.has_edge(u, v):
            print(f"  {u} -> {v}: NO EDGE FOUND (this would be a bug)")
            continue

        data = G.get_edge_data(u, v)

        # MultiDiGraph gives {key: attrs}; pick the first/cheapest one to inspect
        if data and all(isinstance(k, int) for k in data.keys()):
            attrs = min(data.values(), key=lambda d: d.get("length", float("inf")))
        else:
            attrs = data

        highway = attrs.get("highway", "MISSING")
        length = attrs.get("length", "?")
        has_geometry = "geometry" in attrs
        name = attrs.get("name", "(unnamed)")

        # flag anything suspicious
        flag = ""
        if highway in ("service", "MISSING") or not has_geometry:
            flag = "  <-- SUSPICIOUS: check this one"

        print(f"  {u} -> {v}: highway={highway!r}, name={name!r}, length={length:.1f}m, has_geometry={has_geometry}{flag}")
