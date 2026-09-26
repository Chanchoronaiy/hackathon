import type { LatLng } from "@/lib/route-planner";

export type GeocodeSuggestion = {
  id: string;
  label: string;
  position: LatLng;
};
