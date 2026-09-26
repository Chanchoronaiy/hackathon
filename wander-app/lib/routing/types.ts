import type { LatLng } from "@/lib/route-planner";

export type RouteGeometryAdapter = {
  id: "grid" | "openrouteservice";
  getLoopGeometry: (waypoints: LatLng[]) => Promise<{
    geometry: LatLng[];
    distanceKm?: number;
    walkingMinutes?: number;
  }>;
};
