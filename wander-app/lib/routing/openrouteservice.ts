import type { LatLng } from "@/lib/route-planner";
import type { RouteGeometryAdapter } from "@/lib/routing/types";

type DirectionsResponse = {
  geometry?: LatLng[];
  distanceKm?: number;
  walkingMinutes?: number;
  error?: string;
};

export const openRouteServiceAdapter: RouteGeometryAdapter = {
  id: "openrouteservice",
  async getLoopGeometry(waypoints) {
    const response = await fetch("/api/directions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ waypoints }),
    });
    if (!response.ok) throw new Error(`directions unavailable (${response.status})`);
    const data = (await response.json()) as DirectionsResponse;
    if (!data.geometry?.length) throw new Error(data.error ?? "empty geometry");
    return {
      geometry: data.geometry,
      distanceKm: data.distanceKm,
      walkingMinutes: data.walkingMinutes,
    };
  },
};
