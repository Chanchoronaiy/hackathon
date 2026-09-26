import { ADELAIDE_PLACES, START, type AdelaidePlace, type Interest } from "@/lib/adelaide-data";
import { gridLoopGeometry } from "@/lib/routing/grid";
import { estimateShade } from "@/lib/shade";
import type { WeatherSnapshot } from "@/lib/weather";

export type PlannerMode = "discover" | "heat";
export type LatLng = [number, number];
export type WanderPlanInput = {
  mode: PlannerMode;
  minutes: number;
  interests: string[];
  start?: LatLng;
  startName?: string;
  exploredIds?: string[];
  weather?: Pick<WeatherSnapshot, "apparent" | "uvIndex"> | null;
};

export type RouteStop = AdelaidePlace & { why: string };

export type WanderRoute = {
  title: string;
  stops: RouteStop[];
  geometry: LatLng[];
  distanceKm: number;
  walkingMinutes: number;
  shadeEstimate?: number;
  start: AdelaidePlace;
  geometrySource: "grid" | "openrouteservice";
};

type ScoredPlace = {
  place: AdelaidePlace;
  score: number;
  interestBoost: number;
  noveltyBoost: number;
  detour: number;
};

export function resolveStart(position?: LatLng, startName?: string): AdelaidePlace {
  if (!position) return START;
  const known = [START, ...ADELAIDE_PLACES];
  const match = known.find((place) => (
    Math.abs(place.position[0] - position[0]) < 1e-5
    && Math.abs(place.position[1] - position[1]) < 1e-5
  ));
  if (match) {
    return { ...match, reason: "Your start and finish" };
  }
  return {
    id: "custom-start",
    name: startName?.trim() || "Your start",
    category: "green",
    position,
    reason: "Your start and finish",
    surprise: 0,
    comfort: 2,
  };
}

function distanceKm(a: LatLng, b: LatLng) {
  const latitudeKm = (a[0] - b[0]) * 111;
  const longitudeKm = (a[1] - b[1]) * 91;
  return Math.hypot(latitudeKm, longitudeKm);
}

function routeDistance(start: AdelaidePlace, stops: AdelaidePlace[]) {
  const points = [start, ...stops, start];
  return points.slice(1).reduce((sum, point, index) => sum + distanceKm(points[index].position, point.position), 0);
}

function orderAsLoop(start: AdelaidePlace, stops: AdelaidePlace[]) {
  return [...stops].sort((a, b) => {
    const angleA = Math.atan2(a.position[0] - start.position[0], a.position[1] - start.position[1]);
    const angleB = Math.atan2(b.position[0] - start.position[0], b.position[1] - start.position[1]);
    return angleA - angleB;
  });
}

function combinations<T>(items: T[], size: number, start = 0, picked: T[] = [], output: T[][] = []): T[][] {
  if (picked.length === size) {
    output.push([...picked]);
    return output;
  }
  for (let index = start; index <= items.length - (size - picked.length); index += 1) {
    picked.push(items[index]);
    combinations(items, size, index + 1, picked, output);
    picked.pop();
  }
  return output;
}

function estimatedMinutes(start: AdelaidePlace, stops: AdelaidePlace[]) {
  return Math.ceil(routeDistance(start, stops) / 4.8 * 60 + stops.length * 1.5);
}

function chooseWithinBudget(start: AdelaidePlace, candidates: ScoredPlace[], desiredCount: number, minutes: number) {
  for (let count = desiredCount; count >= 1; count -= 1) {
    const valid = combinations(candidates, count)
      .map((group) => {
        const stops = orderAsLoop(start, group.map(({ place }) => place));
        const variety = new Set(stops.map(({ category }) => category)).size * 2.5;
        const score = group.reduce((sum, item) => sum + item.score, 0) + variety;
        return { stops, score, duration: estimatedMinutes(start, stops) };
      })
      .filter(({ duration }) => duration <= minutes)
      .sort((a, b) => b.score - a.score);
    if (valid[0]) return valid[0].stops;
  }
  return [candidates[0].place];
}

function explainStop(place: AdelaidePlace, scored: ScoredPlace | undefined, mode: PlannerMode): string {
  const bits = [place.reason];
  if (scored?.interestBoost) bits.push("Matches one of your selected interests.");
  if (mode === "heat" && place.comfort >= 4) bits.push("High comfort score for Beat the Heat.");
  if (scored?.noveltyBoost) bits.push("Still unexplored on your fog map.");
  if (scored && scored.detour < 0.35) bits.push("A short detour from your start.");
  else if (scored && scored.detour > 0.9) bits.push("Worth a longer detour for the payoff.");
  return bits.join(" ");
}

export function planWanderRoute({
  mode,
  minutes,
  interests,
  start: startPosition,
  startName,
  exploredIds = [],
  weather = null,
}: WanderPlanInput): WanderRoute {
  const start = resolveStart(startPosition, startName);
  const explored = new Set(exploredIds);
  // More available time should produce a meaningfully longer wander. The old
  // fixed count made 60+ minute selections look almost identical to 30 mins.
  const targetStops = minutes <= 15
    ? 2
    : minutes <= 30
      ? 4
      : minutes <= 45
        ? 5
        : minutes <= 60
          ? 6
          : minutes <= 90
            ? 7
            : 8;
  const selectedInterests = new Set(interests as Interest[]);
  const candidates: ScoredPlace[] = ADELAIDE_PLACES
    .filter((place) => place.category !== "calm")
    .map((place) => {
      const interestBoost = selectedInterests.has(place.category as Interest) ? 5 : 0;
      const noveltyBoost = explored.has(place.id) ? 0 : 2.4;
      const modeScore = mode === "heat" ? place.comfort * 2.2 : place.surprise * 1.8 + interestBoost;
      const detour = distanceKm(start.position, place.position) * 1.8;
      return {
        place,
        score: modeScore + noveltyBoost - detour,
        interestBoost,
        noveltyBoost,
        detour,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const chosen = chooseWithinBudget(start, candidates, targetStops, minutes);
  const byId = new Map(candidates.map((item) => [item.place.id, item]));
  const stops: RouteStop[] = chosen.map((place) => ({
    ...place,
    why: explainStop(place, byId.get(place.id), mode),
  }));

  const waypoints: LatLng[] = [start.position, ...stops.map((stop) => stop.position), start.position];
  const distance = routeDistance(start, chosen);
  return {
    title: mode === "discover" ? "Laneways & little surprises" : "Arcades & leafy squares",
    stops,
    geometry: gridLoopGeometry(waypoints),
    distanceKm: distance,
    walkingMinutes: estimatedMinutes(start, chosen),
    shadeEstimate: estimateShade({ mode, stops: chosen, weather }),
    start,
    geometrySource: "grid",
  };
}
