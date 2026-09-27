<p align="center">
  <img src="banner.png" alt="Wander — clear the fog, one walk at a time." width="100%">
</p>

# Wander

**Turn spare minutes into a walk through somewhere you have never explored before.**

Wander is a mobile-first walking app for Adelaide. Pick a start point, walking time and interests, then receive a walkable route with local places, history and optional quests. Completing walks clears your exploration fog, saves memories and earns points on the leaderboard.

## What it does

- Builds walking loops from the user’s location, with Victoria Square as a fallback.
- Uses foot-walking directions when an openrouteservice key is available; otherwise it uses a local route fallback.
- Lets people tailor a walk around art, coffee and green space, or use the Beat the Heat mode.
- Shows local history, saved walks, before-and-after place memories, friend requests and leaderboards.
- Awards **10 points for each minute walked** when a walk is finished.
- Creates daily optional quests and lets users add an optional stop to their route.
- Supports camera uploads for walk memories and optional Google Street View previews.

## Tech stack

### Languages

| TypeScript | CSS | SQL (PostgreSQL) |
| :---: | :---: | :---: |
| <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/typescript/typescript-original.svg" alt="TypeScript" width="48" height="48"> | <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/css3/css3-original.svg" alt="CSS" width="48" height="48"> | <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/postgresql/postgresql-original.svg" alt="PostgreSQL" width="48" height="48"> |
| App and server logic | Interface styling | Database schema and functions |

### Frameworks and tools

<p>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/react/react-original.svg" alt="React" title="React" width="40" height="40">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/vitejs/vitejs-original.svg" alt="Vite" title="Vite" width="40" height="40">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/tailwindcss/tailwindcss-original.svg" alt="Tailwind CSS" title="Tailwind CSS" width="40" height="40">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/supabase/supabase-original.svg" alt="Supabase" title="Supabase" width="40" height="40">
</p>

Icons from [Devicon](https://devicon.dev/).

| Area | Technology |
| --- | --- |
| App | React 19, TypeScript, Vinext/Vite |
| Maps | Leaflet and OpenStreetMap tiles |
| Walking directions | openrouteservice, called through a server route |
| Weather | Open-Meteo |
| Database, accounts and shared scores | Supabase |
| Street View and place search (optional) | Google Maps Embed API and Places API (New) |
| Deployment | Cloudflare/Vercel-compatible web app |

## Run it locally

```bash
git clone https://github.com/Chanchoronaiy/hackathon.git
cd hackathon/wander-app
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `wander-app/.env.example` to `wander-app/.env.local`, then add only the services you are using:

```bash
OPENROUTESERVICE_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Restart `pnpm dev` after saving `.env.local`. Never commit `.env.local`, a Google server key, or a Supabase service-role key.

## Set up shared data with Supabase

Wander works locally without Supabase. To enable profiles, saved routes, photos, points, leaderboards and friends:

1. Create a Supabase project and enable **Anonymous Sign-Ins** in Authentication → Providers.
2. In the Supabase SQL Editor, run the files in `wander-app/supabase/migrations` in this order: `001_wander.sql`, `002_walk_completion_points.sql`, `002_walk_memories.sql`, `003_walk_capture_bonus.sql`, then `004_friend_requests.sql`.
3. Add the project URL and publishable/anon key to `.env.local`.

## Data and acknowledgements

- Map data and tiles: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Place records: curated OpenStreetMap data.
- Weather: [Open-Meteo](https://open-meteo.com/).
- Pedestrian directions: [openrouteservice](https://openrouteservice.org/).

## Project structure

`wander-app/` contains the app. Its own [README](wander-app/README.md) has deeper setup and data notes. Supabase SQL lives in `wander-app/supabase/migrations/`.
