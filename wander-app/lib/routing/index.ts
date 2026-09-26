import { gridLoopGeometry, gridRoutingAdapter } from "@/lib/routing/grid";
import { openRouteServiceAdapter } from "@/lib/routing/openrouteservice";
import type { LatLng } from "@/lib/route-planner";
import type { RouteGeometryAdapter } from "@/lib/routing/types";

export type { RouteGeometryAdapter } from "@/lib/routing/types";
export { gridLoopGeometry, gridRoutingAdapter, openRouteServiceAdapter };

/** Prefer OpenRouteService when the server has a key; always fall back to the local grid. */
export async function resolveLoopGeometry(waypoints: LatLng[]): Promise<{
  geometry: LatLng[];
  distanceKm?: number;
  walkingMinutes?: number;
  source: RouteGeometryAdapter["id"];
}> {
  try {
    const route = await openRouteServiceAdapter.getLoopGeometry(waypoints);
    return { ...route, source: "openrouteservice" };
  } catch {
    const route = await gridRoutingAdapter.getLoopGeometry(waypoints);
    return { ...route, source: "grid" };
  }
}
