import { START } from "@/lib/adelaide-data";
import type { GeocodeSuggestion } from "@/lib/geocode";
import type { LatLng } from "@/lib/route-planner";

type PeliasFeature = {
  type?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    id?: string;
    gid?: string;
    label?: string;
    name?: string;
    locality?: string;
    county?: string;
    region?: string;
    country_a?: string;
    country?: string;
  };
};

type PeliasResponse = {
  features?: PeliasFeature[];
};

/** Rough Adelaide metro bounds used to keep results local. */
const ADELAIDE_BOUNDS = {
  minLat: -35.2,
  maxLat: -34.7,
  minLng: 138.4,
  maxLng: 138.8,
};

function inAdelaide([lat, lng]: LatLng) {
  return (
    lat >= ADELAIDE_BOUNDS.minLat
    && lat <= ADELAIDE_BOUNDS.maxLat
    && lng >= ADELAIDE_BOUNDS.minLng
    && lng <= ADELAIDE_BOUNDS.maxLng
  );
}

function looksAdelaide(feature: PeliasFeature) {
  const props = feature.properties ?? {};
  const haystack = [
    props.label,
    props.name,
    props.locality,
    props.county,
    props.region,
    props.country,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes("adelaide") || haystack.includes("tarntanya");
}

function toSuggestion(feature: PeliasFeature, index: number): GeocodeSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  const position: LatLng = [lat, lng];
  if (!inAdelaide(position) && !looksAdelaide(feature)) return null;
  if (!inAdelaide(position)) return null;
  const label = feature.properties?.label?.trim() || feature.properties?.name?.trim();
  if (!label) return null;
  return {
    id: feature.properties?.gid || feature.properties?.id || `geocode-${index}`,
    label,
    position,
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTESERVICE_API_KEY is not configured", results: [] },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json({ results: [] });
  }

  const endpoint = new URL("https://api.heigit.org/pelias/v1/autocomplete");
  endpoint.searchParams.set("text", query);
  endpoint.searchParams.set("size", "8");
  endpoint.searchParams.set("lang", "en");
  endpoint.searchParams.set("focus.point.lat", String(START.position[0]));
  endpoint.searchParams.set("focus.point.lon", String(START.position[1]));
  endpoint.searchParams.set("boundary.rect.min_lat", String(ADELAIDE_BOUNDS.minLat));
  endpoint.searchParams.set("boundary.rect.max_lat", String(ADELAIDE_BOUNDS.maxLat));
  endpoint.searchParams.set("boundary.rect.min_lon", String(ADELAIDE_BOUNDS.minLng));
  endpoint.searchParams.set("boundary.rect.max_lon", String(ADELAIDE_BOUNDS.maxLng));
  endpoint.searchParams.set("boundary.country", "AUS");

  const response = await fetch(endpoint, {
    headers: {
      authorization: apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { error: `geocoder returned ${response.status}`, results: [] },
      { status: 502 },
    );
  }

  const data = (await response.json()) as PeliasResponse;
  const seen = new Set<string>();
  const results: GeocodeSuggestion[] = [];
  for (const [index, feature] of (data.features ?? []).entries()) {
    const suggestion = toSuggestion(feature, index);
    if (!suggestion || seen.has(suggestion.label.toLowerCase())) continue;
    seen.add(suggestion.label.toLowerCase());
    results.push(suggestion);
  }

  return Response.json({ results });
}
