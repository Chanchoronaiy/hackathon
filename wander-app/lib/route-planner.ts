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
  preferUnexplored?: boolean;
  weather?: Pick<WeatherSnapshot, "apparent" | "uvIndex"> | null;
  /** Force this Adelaide place into the wander (e.g. daily quest Go). */
  focusPlaceId?: string;
  /** Custom searched destination (scenic stop along the way). */
  focusDestination?: { name: string; position: LatLng };
  /** Prefer a different set of stops (remix). */
  remixSeed?: number;
  /** Avoid these place ids when remixing scenery. */
  excludePlaceIds?: string[];
};

export type RouteStop = AdelaidePlace & { why: string };

export type WanderRoute = {
  title: string;
  stops: RouteStop[];
  /** Primary coloured path (quest / destination). */
  geometry: LatLng[];
  /** Optional grey scenery path — remixed independently of the primary. */
  optionalGeometry?: LatLng[];
  optionalStops?: RouteStop[];
  optionalDistanceKm?: number;
  optionalWalkingMinutes?: number;
  distanceKm: number;
  walkingMinutes: number;
  shadeEstimate?: number;
  start: AdelaidePlace;
  geometrySource: "grid" | "openrouteservice";
  unavailableReason?: string;
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
  const usefulMinimum = minutes * 0.72;
  for (let count = desiredCount; count >= 1; count -= 1) {
    const valid = combinations(candidates, count)
      .map((group) => {
        const stops = orderAsLoop(start, group.map(({ place }) => place));
        const variety = new Set(stops.map(({ category }) => category)).size * 2.5;
        const score = group.reduce((sum, item) => sum + item.score, 0) + variety;
        return { stops, score, duration: estimatedMinutes(start, stops) };
      })
      .filter(({ duration }) => duration <= minutes)
      .sort((a, b) => {
        const aFillsBudget = a.duration >= usefulMinimum;
        const bFillsBudget = b.duration >= usefulMinimum;
        if (aFillsBudget !== bFillsBudget) return aFillsBudget ? -1 : 1;
        if (aFillsBudget && bFillsBudget) return b.score - a.score;
        return b.duration - a.duration || b.score - a.score;
      });
    if (valid[0]) return valid[0].stops;
  }
  return undefined;
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
  preferUnexplored = true,
  weather = null,
  focusPlaceId,
  focusDestination,
  remixSeed = 0,
  excludePlaceIds = [],
}: WanderPlanInput): WanderRoute {
  const start = resolveStart(startPosition, startName);
  const explored = new Set(exploredIds);
  const excluded = new Set(excludePlaceIds);
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
  const detourWeight = minutes <= 30 ? 1.8 : minutes <= 60 ? 1.2 : minutes <= 90 ? 0.75 : 0.35;
  const knownFocus = focusPlaceId
    ? ADELAIDE_PLACES.find((place) => place.id === focusPlaceId) ?? null
    : null;
  const nearestKnown = focusDestination
    ? ADELAIDE_PLACES
      .map((place) => ({ place, distance: distanceKm(focusDestination.position, place.position) }))
      .sort((a, b) => a.distance - b.distance)[0]
    : null;
  const focusPlace: AdelaidePlace | null = knownFocus ?? (
    focusDestination
      ? nearestKnown && nearestKnown.distance < 0.18
        ? nearestKnown.place
        : {
            id: `search:${focusDestination.position.join(",")}`,
            name: focusDestination.name,
            category: "photo",
            position: focusDestination.position,
            reason: "Your searched destination",
            surprise: 4,
            comfort: 2,
          }
      : null
  );

  if (focusPlace && focusPlace.id !== start.id) {
    const duration = estimatedMinutes(start, [focusPlace]);
    const budget = Math.max(minutes, duration + 12);
    const nearby = ADELAIDE_PLACES
      .filter((place) => place.id !== focusPlace.id && place.id !== start.id && place.category !== "calm")
      .map((place) => {
        const viaStart = distanceKm(start.position, place.position);
        const viaFocus = distanceKm(focusPlace.position, place.position);
        const direct = distanceKm(start.position, focusPlace.position);
        const scenic = place.surprise * 1.6 + (place.category === "green" || place.category === "photo" ? 2.5 : 0);
        const corridor = viaStart + viaFocus - direct;
        const avoid = excluded.has(place.id) ? 8 : 0;
        const remixNudge = ((place.id.charCodeAt(0) + remixSeed * 17) % 7) * 0.45;
        return {
          place,
          score: scenic - corridor * 3.2 - viaStart * 0.35 - avoid + remixNudge,
        };
      })
      .sort((a, b) => b.score - a.score);

    const offset = remixSeed > 0 ? remixSeed % Math.max(nearby.length, 1) : 0;
    const rotated = offset > 0
      ? [...nearby.slice(offset), ...nearby.slice(0, offset)]
      : nearby;

    const scenicPicks: AdelaidePlace[] = [];
    for (const candidate of rotated.slice(0, 12)) {
      const trial = orderAsLoop(start, [...scenicPicks, focusPlace, candidate.place].filter(
        (place, index, list) => list.findIndex((item) => item.id === place.id) === index,
      ));
      if (estimatedMinutes(start, trial) <= budget) {
        scenicPicks.push(candidate.place);
      }
      if (scenicPicks.length >= Math.min(3, Math.max(1, Math.floor(budget / 25)))) break;
    }

    const orderedScenic = orderAsLoop(start, scenicPicks);
    const questStop: RouteStop = {
      ...focusPlace,
      why: focusDestination
        ? `${focusPlace.reason} Your searched stop.`
        : `${focusPlace.reason} Daily quest stop.`,
    };
    const optionalStops: RouteStop[] = orderedScenic.map((place) => ({
      ...place,
      why: explainStop(place, undefined, mode),
    }));

    const directWaypoints: LatLng[] = [start.position, focusPlace.position];
    const optionalWaypoints: LatLng[] = orderedScenic.length > 0
      ? [start.position, ...orderedScenic.map((place) => place.position), focusPlace.position, start.position]
      : [];

    const distance = distanceKm(start.position, focusPlace.position);
    const optionalLoopPlaces = [...orderedScenic, focusPlace];
    const optionalDistance = orderedScenic.length > 0
      ? routeDistance(start, optionalLoopPlaces)
      : undefined;
    return {
      title: focusPlace.name,
      stops: [questStop],
      optionalStops: optionalStops.length > 0 ? optionalStops : undefined,
      geometry: gridLoopGeometry(directWaypoints),
      optionalGeometry: optionalWaypoints.length > 0 ? gridLoopGeometry(optionalWaypoints) : undefined,
      optionalDistanceKm: optionalDistance,
      optionalWalkingMinutes: optionalDistance != null
        ? estimatedMinutes(start, optionalLoopPlaces)
        : undefined,
      distanceKm: distance,
      walkingMinutes: Math.max(1, Math.round((distance / 4.8) * 60)),
      shadeEstimate: estimateShade({ mode, stops: [focusPlace, ...orderedScenic], weather }),
      start,
      geometrySource: "grid",
    };
  }

  const interestPool = ["art", "coffee", "green", "photo"] as Interest[];
  const remixedInterests = remixSeed > 0
    ? new Set<Interest>([
        ...interestPool.filter((_, index) => (index + remixSeed) % 2 === remixSeed % 2),
        ...selectedInterests,
      ])
    : selectedInterests;

  const candidates: ScoredPlace[] = ADELAIDE_PLACES
    .filter((place) => place.category !== "calm")
    .map((place) => {
      const interestBoost = remixedInterests.has(place.category as Interest) ? 5 : 0;
      const noveltyBoost = explored.has(place.id) ? 0 : (preferUnexplored ? 5.2 : 1.2);
      const modeScore = mode === "heat" ? place.comfort * 2.2 : place.surprise * 1.8 + interestBoost;
      const detour = distanceKm(start.position, place.position) * detourWeight;
      const avoid = excluded.has(place.id) ? 12 : 0;
      const remixNudge = remixSeed > 0 ? ((place.id.length + remixSeed * 13) % 9) * 0.55 : 0;
      return {
        place,
        score: modeScore + noveltyBoost - detour - avoid + remixNudge,
        interestBoost,
        noveltyBoost,
        detour,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const chosen = chooseWithinBudget(start, candidates, targetStops, minutes);

  if (!chosen) {
    return {
      title: "No Wander fits yet",
      stops: [],
      geometry: [],
      distanceKm: 0,
      walkingMinutes: 0,
      shadeEstimate: 0,
      start,
      geometrySource: "grid",
      unavailableReason: "Add more time.",
    };
  }
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
