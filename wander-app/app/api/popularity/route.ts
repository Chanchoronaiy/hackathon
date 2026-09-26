import type { PopularPlace } from "@/lib/popularity";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
};

export async function GET() {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return Response.json({ error: "GOOGLE_PLACES_API_KEY is not configured" }, { status: 503 });

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

  if (!response.ok) return Response.json({ error: `Google Places returned ${response.status}` }, { status: 502 });
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

  return Response.json({ places }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
