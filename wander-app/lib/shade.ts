import type { AdelaidePlace } from "@/lib/adelaide-data";
import type { WeatherSnapshot } from "@/lib/weather";

/** Estimated shade from cached comfort attributes plus modelled weather — not live sensing. */
export function estimateShade({
  mode,
  stops,
  weather,
}: {
  mode: "discover" | "heat";
  stops: AdelaidePlace[];
  weather?: Pick<WeatherSnapshot, "apparent" | "uvIndex"> | null;
}): number | undefined {
  if (mode !== "heat") return undefined;
  const comfortSum = stops.reduce((sum, place) => sum + place.comfort, 0);
  const comfortBase = 48 + comfortSum * 3.2;
  const heatPenalty = weather
    ? Math.max(0, (weather.apparent - 24) * 1.4) + weather.uvIndex * 2.2
    : 0;
  return Math.round(Math.min(82, Math.max(28, comfortBase - heatPenalty)));
}
