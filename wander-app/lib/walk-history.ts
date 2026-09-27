import type { LatLng } from "@/lib/route-planner";

const STORAGE_KEY = "wander:walk-history";
export const WALK_HISTORY_EVENT = "wander-walk-history-updated";

export type WalkCapture = {
  stopName: string;
  capturedAt: string;
};

export type WalkHistoryEntry = {
  id: string;
  startedAt: string;
  endedAt: string;
  mode: "discover" | "heat";
  title: string;
  startName?: string;
  start?: LatLng;
  stopNames: string[];
  walkingMinutes: number;
  distanceKm: number;
  captures: WalkCapture[];
};

export function readWalkHistory(): WalkHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is WalkHistoryEntry => (
      Boolean(entry)
      && typeof entry.id === "string"
      && typeof entry.startedAt === "string"
      && typeof entry.endedAt === "string"
      && (entry.mode === "discover" || entry.mode === "heat")
      && typeof entry.title === "string"
      && Array.isArray(entry.stopNames)
      && typeof entry.walkingMinutes === "number"
      && typeof entry.distanceKm === "number"
      && Array.isArray(entry.captures)
    ));
  } catch {
    return [];
  }
}

export function recordWalkHistory(entry: Omit<WalkHistoryEntry, "id" | "endedAt">) {
  if (typeof window === "undefined") return;
  const nextEntry: WalkHistoryEntry = {
    ...entry,
    id: `walk-${Date.now()}`,
    endedAt: new Date().toISOString(),
  };
  const history = [nextEntry, ...readWalkHistory()].slice(0, 50);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event(WALK_HISTORY_EVENT));
}