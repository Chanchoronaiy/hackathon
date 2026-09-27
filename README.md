<p align="center">
  <img src="banner.png" alt="Wander — clear the fog, one walk at a time." width="100%">
</p>

# Wander

**Turn spare minutes into a walk through exciting spots to wind your mind down.**

Wander is a mobile app that curates routes for users through multiple places using their interest and their time available. Wander includes random daily quests for user to earn extra points that determines their ranking on the friends and global leaderboard. Completing walks clears your exploration fog, capture moments, saves memories and use it's cute mascot to get a street view of where you could potentially head to next. 

## What it does

- Builds walking routes from the user’s location.
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


| Area | Technology |
| --- | --- |
| App | React 19, TypeScript, Vinext/Vite |
| Maps | Leaflet and OpenStreetMap tiles |
| Walking directions | openrouteservice, called through a server route |
| Weather | Open-Meteo |
| Database, accounts and shared scores | Supabase |
| Street View and place search (optional) | Google Maps Embed API and Places API (New) |
| Deployment | Cloudflare/Vercel-compatible web app |


## Data and acknowledgements

- Map data and tiles: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Place records: curated OpenStreetMap data.
- Weather: [Open-Meteo](https://open-meteo.com/).
- Pedestrian directions: [openrouteservice](https://openrouteservice.org/).
