# Sun-Aware Route Planner — Backend

Routes between two points optimizing for something other than pure distance
or time — in this case, minimizing sun exposure along the way.

## How it works

Real shadow-casting needs 3D building geometry, which is out of scope for a
weekend build. Instead this approximates shade using each street segment's
compass **bearing** relative to the sun's **azimuth**: streets running
roughly parallel to the sun's direction tend to sit in the shadow of
buildings alongside them, while perpendicular streets catch more direct
light. Low sun (near the horizon) amplifies the effect since shadows are
longer at those times.

This gets combined with plain distance into one edge cost:

```
cost = distance * (1 + sun_weight * sun_exposure)
```

`sun_weight = 0` gives the ordinary shortest path. Raising it increasingly
favors shaded routes, even if longer.

## Files

| File | Purpose |
|---|---|
| `graph_utils.py` | Loads a street network — either a real city via OSMnx, or a synthetic grid for offline testing |
| `sun.py` | Computes sun position (azimuth/elevation) and the shade-score heuristic |
| `routing.py` | Combines distance + sun exposure into edge weights and runs the weighted shortest path |
| `visualize.py` | Renders route(s) onto a real map using Folium |
| `demo.py` | End-to-end example — run this first |

## Setup

```bash
pip install -r requirements.txt
python demo.py
```

`demo.py` runs on a synthetic street grid so it works without live internet
access to OpenStreetMap. Open the generated `route_map.html` in a browser to
see the shortest route vs. the least-sun route plotted side by side.

## Using a real city

Swap the synthetic grid for real OSM data once you have normal internet
access — everything downstream (sun scoring, routing, rendering) works
unchanged, since it only relies on `y`, `x`, `length`, and `bearing`
attributes, which OSMnx also provides:

```python
from graph_utils import load_real_graph
G = load_real_graph("Adelaide, Australia")
```

## Known limitations / next steps

- Shade is a bearing-based heuristic, not true shadow-casting from building
  geometry — a deliberate scoping decision for the timeframe, worth stating
  plainly in a demo rather than implying it's physically exact.
- `annotate_sun_exposure()` computes one sun position for the whole graph's
  center point — fine for a city-sized area, since the sun's angle barely
  changes across a few km.
- `get_sun_position()` requires a **timezone-aware** datetime. A naive one
  is silently treated as UTC by the underlying library and will produce a
  wrong (sometimes nonsensical, e.g. "night" at 3pm) result. Always pass
  `tzinfo=ZoneInfo("Your/Timezone")`.
- No web API yet — this is pure Python logic, ready to be wrapped in a
  Flask/FastAPI endpoint for the frontend branch to call.
