# Wander

Wander turns spare time into a discovery loop through Adelaide CBD. Choose a 15, 30 or 45 minute walk, boost the kinds of places you enjoy, or switch to Beat the Heat to favour comfort stops.

## What works now

- Responsive full-screen Adelaide map (Leaflet + OpenStreetMap tiles) with Discover and Beat the Heat modes.
- MapLibre / OpenFreeMap kept as an optional later branch in `components/wander-map.maplibre.tsx` until it renders reliably.
- Deterministic loop planner that scores a curated OpenStreetMap POI set, rewards variety and novelty, and rejects routes over the selected time budget.
- Browser geolocation for the user’s start position, with Victoria Square as fallback if permission is denied.
- Art, coffee and green-space preference boosts.
- Current modelled Adelaide conditions from Open-Meteo (temperature, apparent temperature, weather code, wind, UV, precipitation probability), with the provider timestamp shown in the UI.
- Honest data labels for cached POIs and estimated shade (comfort attributes + modelled weather — not live shade sensing).
- localStorage exploration state: clicking a stop marks it explored and clears a soft fog patch.
- About this route panel explaining why each stop was selected.
- Routing adapter: local grid geometry by default; optional OpenRouteService foot-walking via a server proxy when `OPENROUTESERVICE_API_KEY` is set.
- A one-tap calm-place card, intentionally independent of route generation.
- `configure_wander` WebMCP action for supported browsers and agents.

Do not call Overpass or other public OSM search endpoints when generating a route — POIs stay in `lib/adelaide-data.ts`.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional walking geometry: copy `.env.example` to `.env.local` and set `OPENROUTESERVICE_API_KEY`. The key is read only by `/api/directions` and never sent to the browser. Without it, Wander keeps the local grid fallback.

## Supabase persistence

Wander continues to work from local browser storage when Supabase is not configured. To turn on shared profiles, saved routes, check-in photos, points and the global leaderboard:

1. Create a Supabase project and enable **Anonymous Sign-Ins** under Authentication → Providers.
2. Run the SQL files in `supabase/migrations` in number order in the Supabase SQL editor.
3. Copy the project URL and publishable/anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Never place the service-role or secret key in `.env.local` or browser code. Restart the development server after changing environment variables.

## Validate

```bash
pnpm lint
pnpm build
```

## Data

- Raster basemap: OpenStreetMap tiles via Leaflet.
- Optional later branch: MapLibre + OpenFreeMap Liberty (`components/wander-map.maplibre.tsx`).
- Cached place records: OpenStreetMap contributors, ODbL.
- Current modelled weather: Open-Meteo.
- Curated Adelaide POI extract timestamp: 31 May 2026.
- Optional pedestrian directions: openrouteservice (server-proxied).

Research queries and the original extract are kept in `../research/`. Product scope, source caveats and team ownership are documented in `../docs/WANDER_BUILD_PLAN.md`.
