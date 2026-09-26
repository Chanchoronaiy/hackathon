import type { LatLng } from "@/lib/route-planner";

export type PopularPlace = {
  id: string;
  name: string;
  position: LatLng;
  rating: number;
  reviewCount: number;
  score?: number;
};

export function popularityScore(place: PopularPlace) {
  if (typeof place.score === "number") return Math.max(0, Math.min(1, place.score));
  return Math.max(0, Math.min(1, (place.rating / 5) * Math.log10(place.reviewCount + 10) / 4));
}
