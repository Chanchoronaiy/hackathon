import type { LatLng } from "@/lib/route-planner";

const METRES_PER_DEGREE = 111_320;

type Point = [number, number];

export type RouteMeasure = {
  points: Point[];
  cumulative: number[];
  total: number;
  originLat: number;
};

function toMetres(position: LatLng, originLat: number): Point {
  return [
    position[1] * METRES_PER_DEGREE * Math.cos((originLat * Math.PI) / 180),
    position[0] * METRES_PER_DEGREE,
  ];
}

export function measureRoute(geometry: LatLng[]): RouteMeasure {
  const originLat = geometry[0]?.[0] ?? 0;
  const points = geometry.map((position) => toMetres(position, originLat));
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { points, cumulative, total: cumulative.at(-1) ?? 0, originLat };
}

/**
 * Metres along the route of the closest point to `position`, searching only forward from
 * `fromAlong` so loop routes (which end where they start) can't jump straight to 100%.
 * Returns null when the position is further than `maxOffset` metres from the searched stretch.
 */
export function projectAlong(
  measure: RouteMeasure,
  position: LatLng,
  fromAlong: number,
  lookahead = 500,
  maxOffset = 80,
): number | null {
  const [px, py] = toMetres(position, measure.originLat);
  let best: { along: number; offset: number } | null = null;
  for (let index = 1; index < measure.points.length; index += 1) {
    const segmentStart = measure.cumulative[index - 1];
    const segmentEnd = measure.cumulative[index];
    if (segmentEnd < fromAlong) continue;
    if (segmentStart > fromAlong + lookahead) break;
    const [ax, ay] = measure.points[index - 1];
    const [bx, by] = measure.points[index];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    const offset = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    const along = Math.max(fromAlong, segmentStart + t * (segmentEnd - segmentStart));
    if (!best || offset < best.offset) best = { along, offset };
  }
  return best && best.offset <= maxOffset ? best.along : null;
}

/** Metres along the route at which each stop sits, in visiting order. */
export function stopAlongs(measure: RouteMeasure, stops: LatLng[]): number[] {
  let cursor = 0;
  return stops.map((stop) => {
    cursor = projectAlong(measure, stop, cursor, Infinity, Infinity) ?? cursor;
    return cursor;
  });
}
