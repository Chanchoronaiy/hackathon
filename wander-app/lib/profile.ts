import { exploredPositionsFor, estimateViewportExplorationPercent, readExploredIds, readExploredTrail, type MapBounds } from "@/lib/exploration";
import { readWalkHistory } from "@/lib/walk-history";

const PROFILE_STORAGE_KEY = "wander:profile";

export type WanderProfile = {
  name: string;
  handle: string;
};

export type ProfileStats = {
  walks: number;
  walksThisMonth: number;
  kmWalked: number;
  discoveries: number;
  adelaideExploredPercent: number;
};

const DEFAULT_PROFILE: WanderProfile = { name: "Alex Sullivan", handle: "alexwanders" };

/** Adelaide city centre, bounded by the four Terraces. */
export const ADELAIDE_CBD_BOUNDS: MapBounds = {
  north: -34.9205,
  south: -34.9380,
  west: 138.5865,
  east: 138.6135,
};

export function readProfile(): WanderProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? "null") as Partial<WanderProfile> | null;
    return {
      name: typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name.trim() : DEFAULT_PROFILE.name,
      handle: typeof parsed?.handle === "string" && parsed.handle.trim() ? parsed.handle.trim().replace(/^@/, "") : DEFAULT_PROFILE.handle,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function writeProfile(profile: WanderProfile) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode: the profile falls back to defaults next time.
  }
}

export function profileInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "W";
}

/** Totals from finished walks (walk history) and explored places/trail (the fog map). */
export function readProfileStats(now = new Date()): ProfileStats {
  const history = readWalkHistory();
  const exploredIds = readExploredIds();
  const positions = [
    ...exploredPositionsFor(exploredIds),
    ...readExploredTrail().map((position, index) => ({ id: `trail-${index}`, position })),
  ];
  const walksThisMonth = history.filter((walk) => {
    const ended = new Date(walk.endedAt);
    return ended.getFullYear() === now.getFullYear() && ended.getMonth() === now.getMonth();
  }).length;
  return {
    walks: history.length,
    walksThisMonth,
    kmWalked: Math.round(history.reduce((sum, walk) => sum + walk.distanceKm, 0) * 10) / 10,
    discoveries: new Set(exploredIds).size,
    adelaideExploredPercent: estimateViewportExplorationPercent(ADELAIDE_CBD_BOUNDS, positions),
  };
}
