import { ADELAIDE_PLACES, START, type AdelaidePlace } from "@/lib/adelaide-data";
import type { LatLng } from "@/lib/route-planner";

const STORAGE_KEY = "wander:explored";
const TRAIL_STORAGE_KEY = "wander:explored-trail";
const MIN_TRAIL_SPACING_M = 24;
const MAX_TRAIL_POINTS = 600;

/** Soft clearing radius used for fog holes and viewport % estimates (metres). */
export const EXPLORATION_RADIUS_M = 180;

export function readExploredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function writeExploredIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

export function markExplored(id: string): string[] {
  const next = [...new Set([...readExploredIds(), id])];
  writeExploredIds(next);
  return next;
}

export function readExploredTrail(): LatLng[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRAIL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point): point is LatLng => (
      Array.isArray(point)
      && point.length === 2
      && point.every((value) => typeof value === "number" && Number.isFinite(value))
    ));
  } catch {
    return [];
  }
}

/** Add a GPS point only after the walker has moved far enough to extend the cleared trail. */
export function recordExploredPosition(position: LatLng): LatLng[] {
  const current = readExploredTrail();
  const previous = current.at(-1);
  if (previous && distanceMetres(previous, position) < MIN_TRAIL_SPACING_M) return current;
  const next = [...current, position].slice(-MAX_TRAIL_POINTS);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

const PLACE_INDEX = new Map<string, AdelaidePlace>([
  [START.id, START],
  ...ADELAIDE_PLACES.map((place) => [place.id, place] as const),
]);

export function exploredPositionsFor(ids: string[]): Array<{ id: string; position: LatLng }> {
  return ids
    .map((id) => PLACE_INDEX.get(id))
    .filter((place): place is AdelaidePlace => Boolean(place))
    .map((place) => ({ id: place.id, position: place.position }));
}

export function distanceMetres(a: LatLng, b: LatLng) {
  const latitudeKm = (a[0] - b[0]) * 111;
  const longitudeKm = (a[1] - b[1]) * 91;
  return Math.hypot(latitudeKm, longitudeKm) * 1000;
}

export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Share of the current viewport covered by exploration clearings — rises when you zoom into cleared ground. */
export function estimateViewportExplorationPercent(
  bounds: MapBounds,
  positions: Array<{ position: LatLng }>,
  radiusMetres = EXPLORATION_RADIUS_M,
): number {
  if (positions.length === 0) return 0;
  // A denser sampling grid keeps small explored patches visible in the
  // percentage when the user zooms out over a larger area.
  const rows = 48;
  const cols = 48;
  let covered = 0;
  let total = 0;
  for (let row = 0; row < rows; row += 1) {
    const lat = bounds.south + ((row + 0.5) / rows) * (bounds.north - bounds.south);
    for (let col = 0; col < cols; col += 1) {
      const lng = bounds.west + ((col + 0.5) / cols) * (bounds.east - bounds.west);
      total += 1;
      const sample: LatLng = [lat, lng];
      if (positions.some(({ position }) => distanceMetres(sample, position) <= radiusMetres)) {
        covered += 1;
      }
    }
  }
  return Math.round((covered / total) * 1000) / 10;
}
