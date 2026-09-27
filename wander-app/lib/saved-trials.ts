import type { LatLng, WanderRoute } from "@/lib/route-planner";

const STORAGE_KEY = "wander:saved-trials";

export type SavedTrial = {
  id: string;
  savedAt: string;
  mode: "discover" | "heat";
  minutes: number;
  interests: string[];
  start?: LatLng;
  geometry?: LatLng[];
  startName?: string;
  stopNames: string[];
  walkingMinutes: number;
  distanceKm: number;
  title?: string;
  /** Plan details needed to bring back the exact same route (e.g. a remixed one). */
  preferUnexplored?: boolean;
  focusPlaceId?: string;
  focusDestination?: { name: string; position: LatLng };
  remixSeed?: number;
  excludePlaceIds?: string[];
  /** Snapshot of the exact route as saved, so reopening it never re-plans different stops. */
  route?: WanderRoute;
  /** Whether the optional scenic stops were switched on when saved. */
  optionalActive?: boolean;
};

/** The saved route snapshot, if it is intact (older saves don't have one). */
export function pinnedRouteFor(trial: SavedTrial): WanderRoute | undefined {
  const route = trial.route;
  if (!route || !Array.isArray(route.stops) || !Array.isArray(route.geometry) || !route.start) return undefined;
  return route;
}

/** Two routes are the same when mode, start and stops match; used to block duplicate saves. */
export function routeKeyFor(route: { mode: string; start?: LatLng; stopNames: string[] }) {
  const start = route.start ? route.start.map((value) => value.toFixed(4)).join(",") : "default-start";
  return `${route.mode}|${start}|${route.stopNames.join(">")}`;
}

export function readSavedTrials(): SavedTrial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedTrial);
  } catch {
    return [];
  }
}

function isSavedTrial(value: unknown): value is SavedTrial {
  if (!value || typeof value !== "object") return false;
  const trial = value as SavedTrial;
  return (
    typeof trial.id === "string"
    && typeof trial.savedAt === "string"
    && (trial.mode === "discover" || trial.mode === "heat")
    && typeof trial.minutes === "number"
    && Array.isArray(trial.interests)
    && (trial.geometry === undefined || (
      Array.isArray(trial.geometry)
      && trial.geometry.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    ))
    && Array.isArray(trial.stopNames)
    && typeof trial.walkingMinutes === "number"
    && typeof trial.distanceKm === "number"
  );
}

export function writeSavedTrials(trials: SavedTrial[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trials));
}

export function saveTrial(trial: Omit<SavedTrial, "id" | "savedAt">): SavedTrial[] {
  const nextTrial: SavedTrial = {
    ...trial,
    id: `trial-${Date.now()}`,
    savedAt: new Date().toISOString(),
  };
  const next = [nextTrial, ...readSavedTrials()].slice(0, 20);
  writeSavedTrials(next);
  return next;
}

export function deleteSavedTrial(id: string): SavedTrial[] {
  const next = readSavedTrials().filter((trial) => trial.id !== id);
  writeSavedTrials(next);
  return next;
}
