import type { LatLng } from "@/lib/route-planner";
import type { RouteGeometryAdapter } from "@/lib/routing/types";

export function gridLoopGeometry(waypoints: LatLng[]): LatLng[] {
  if (waypoints.length === 0) return [];
  const geometry: LatLng[] = [waypoints[0]];
  waypoints.slice(1).forEach((next, index) => {
    const previous = waypoints[index];
    geometry.push(index % 2 === 0 ? [previous[0], next[1]] : [next[0], previous[1]], next);
  });
  return geometry;
}

export const gridRoutingAdapter: RouteGeometryAdapter = {
  id: "grid",
  async getLoopGeometry(waypoints) {
    return gridLoopGeometry(waypoints);
  },
};
