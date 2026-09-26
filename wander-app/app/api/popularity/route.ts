import type { PopularPlace } from "@/lib/popularity";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
};

const ADELAIDE_POPULARITY_FALLBACK: PopularPlace[] = [
  { id: "fallback-central-market", name: "Adelaide Central Market", position: [-34.9297, 138.5981], rating: 0, reviewCount: 0, score: 1 },
  { id: "fallback-rundle-mall", name: "Rundle Mall", position: [-34.9227, 138.6036], rating: 0, reviewCount: 0, score: 0.95 },
  { id: "fallback-art-gallery", name: "Art Gallery of South Australia", position: [-34.9206, 138.6043], rating: 0, reviewCount: 0, score: 0.82 },
  { id: "fallback-botanic-garden", name: "Adelaide Botanic Garden", position: [-34.9173, 138.6118], rating: 0, reviewCount: 0, score: 0.9 },
  { id: "fallback-victoria-square", name: "Victoria Square / Tarntanyangga", position: [-34.9285, 138.6007], rating: 0, reviewCount: 0, score: 0.74 },
  { id: "fallback-riverbank", name: "Adelaide Riverbank", position: [-34.9191, 138.5986], rating: 0, reviewCount: 0, score: 0.78 },
  { id: "fallback-himeji", name: "Himeji Garden", position: [-34.9352, 138.6076], rating: 0, reviewCount: 0, score: 0.64 },
];

function fallback(reason: string) {
  return Response.json(
    { places: ADELAIDE_POPULARITY_FALLBACK, source: "curated-fallback", warning: reason },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}

export async function GET() {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return fallback("Google Places is not configured");

  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      includedTypes: ["tourist_attraction", "museum", "art_gallery", "cafe", "park"],
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: { center: { latitude: -34.9285, longitude: 138.6007 }, radius: 2500 },
      },
    }),
    next: { revalidate: 3600 },
  });

  if (!response.ok) return fallback(`Google Places returned ${response.status}`);
  const payload = await response.json() as { places?: GooglePlace[] };
  const places: PopularPlace[] = (payload.places ?? []).flatMap((place) => {
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    if (!place.id || !place.displayName?.text || typeof latitude !== "number" || typeof longitude !== "number") return [];
    return [{
      id: place.id,
      name: place.displayName.text,
      position: [latitude, longitude],
      rating: place.rating ?? 0,
      reviewCount: place.userRatingCount ?? 0,
    }];
  });

  if (!places.length) return fallback("Google Places returned no locations");

  return Response.json({ places, source: "google-places" }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
