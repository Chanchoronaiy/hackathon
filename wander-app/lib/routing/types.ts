import type { LatLng } from "@/lib/route-planner";

export type RouteGeometryAdapter = {
  id: "grid" | "openrouteservice";
  getLoopGeometry: (waypoints: LatLng[]) => Promise<LatLng[]>;
};
