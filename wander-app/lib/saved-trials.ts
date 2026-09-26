import type { LatLng } from "@/lib/route-planner";

const STORAGE_KEY = "wander:saved-trials";

export type SavedTrial = {
  id: string;
  savedAt: string;
  mode: "discover" | "heat";
  minutes: number;
  interests: string[];
  start?: LatLng;
  startName?: string;
  stopNames: string[];
  walkingMinutes: number;
  distanceKm: number;
};

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
