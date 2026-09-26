export type WeatherSnapshot = {
  temperature: number;
  apparent: number;
  weatherCode: number;
  windSpeed: number;
  uvIndex: number;
  precipitationProbability: number;
  time: string;
};

type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    time: string;
  };
  hourly: {
    time: string[];
    apparent_temperature: number[];
    uv_index: number[];
    precipitation_probability: number[];
  };
};

function hourlyIndexForCurrent(times: string[], currentTime: string) {
  const exact = times.indexOf(currentTime.slice(0, 13) + ":00");
  if (exact >= 0) return exact;
  const hourPrefix = currentTime.slice(0, 13);
  const prefixMatch = times.findIndex((time) => time.startsWith(hourPrefix));
  return prefixMatch >= 0 ? prefixMatch : 0;
}

export async function fetchAdelaideWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    hourly: "apparent_temperature,uv_index,precipitation_probability",
    timezone: "Australia/Adelaide",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error("weather unavailable");
  const data = (await response.json()) as OpenMeteoResponse;
  const hourIndex = hourlyIndexForCurrent(data.hourly.time, data.current.time);
  return {
    temperature: Math.round(data.current.temperature_2m),
    apparent: Math.round(data.current.apparent_temperature),
    weatherCode: data.current.weather_code,
    windSpeed: Math.round(data.current.wind_speed_10m),
    uvIndex: Math.round(data.hourly.uv_index[hourIndex] ?? 0),
    precipitationProbability: Math.round(data.hourly.precipitation_probability[hourIndex] ?? 0),
    time: data.current.time.slice(11),
  };
}
