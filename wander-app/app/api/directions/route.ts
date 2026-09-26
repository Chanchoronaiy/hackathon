import type { LatLng } from "@/lib/route-planner";

type DirectionsBody = {
  waypoints?: LatLng[];
};

type OrsFeatureCollection = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTESERVICE_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: DirectionsBody;
  try {
    body = (await request.json()) as DirectionsBody;
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  const waypoints = body.waypoints;
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return Response.json({ error: "waypoints must include at least two points" }, { status: 400 });
  }

  const coordinates = waypoints.map(([lat, lng]) => [lng, lat]);
  const response = await fetch("https://api.heigit.org/v2/directions/foot-walking/geojson", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ coordinates }),
  });

  if (!response.ok) {
    return Response.json(
      { error: `openrouteservice returned ${response.status}` },
      { status: 502 },
    );
  }

  const data = (await response.json()) as OrsFeatureCollection;
  const line = data.features?.[0]?.geometry?.coordinates;
  if (!line?.length) {
    return Response.json({ error: "empty openrouteservice geometry" }, { status: 502 });
  }

  const geometry: LatLng[] = line.map(([lng, lat]) => [lat, lng]);
  return Response.json({ geometry, provider: "openrouteservice" });
}
