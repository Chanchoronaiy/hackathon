"use client";

import dynamic from "next/dynamic";
import { ChevronUp, Coffee, Compass, Eye, Leaf, MapPin, Palette, Sun, Trees, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MinuteRuler from "@/components/minute-ruler";
import StartSearch from "@/components/start-search";
import { ADELAIDE_PLACES, START } from "@/lib/adelaide-data";
import { markExplored, readExploredIds } from "@/lib/exploration";
import { planWanderRoute, type LatLng, type WanderRoute } from "@/lib/route-planner";
import { resolveLoopGeometry } from "@/lib/routing";
import { fetchAdelaideWeather, type WeatherSnapshot } from "@/lib/weather";

const WanderMap = dynamic(() => import("@/components/wander-map"), {
  ssr: false,
  loading: () => (
    <output className="map-loading">
      Drawing Adelaide…
    </output>
  ),
});

type Mode = "discover" | "heat";
type Plan = { mode: Mode; minutes: number; interests: string[]; start?: LatLng; startName?: string };
type LocationStatus = "locating" | "located" | "idle";

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const interests = [
  { id: "art", label: "Art", icon: Palette },
  { id: "coffee", label: "Coffee", icon: Coffee },
  { id: "green", label: "Green space", icon: Trees },
];

const calmSpot = ADELAIDE_PLACES.find((place) => place.id === "city-library") ?? ADELAIDE_PLACES[0];

function walkMinutesBetween(a: LatLng, b: LatLng) {
  const latitudeKm = (a[0] - b[0]) * 111;
  const longitudeKm = (a[1] - b[1]) * 91;
  return Math.max(1, Math.round((Math.hypot(latitudeKm, longitudeKm) / 4.8) * 60));
}

function AboutRoute({
  route,
  routeCopy,
  empty,
  open,
  onToggle,
}: {
  route: WanderRoute;
  routeCopy: string;
  empty: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  if (empty) {
    return (
      <aside className="about-panel is-empty" aria-live="polite">
        <p className="about-panel-empty">no route yet</p>
      </aside>
    );
  }

  const itinerary = [route.start, ...route.stops];

  return (
    <aside className={`about-panel${open ? " is-open" : ""}`} aria-live="polite">
      <button
        type="button"
        className="about-panel-toggle"
        aria-expanded={open}
        aria-controls="about-route-details"
        onClick={onToggle}
      >
        <ChevronUp size={14} strokeWidth={2.8} className="about-panel-chevron" aria-hidden="true" />
        <span className="about-panel-rule" aria-hidden="true" />
        <span className="about-panel-title">About this route</span>
      </button>
      {open && (
        <div id="about-route-details" className="about-panel-body">
          <p className="about-panel-meta">{routeCopy}</p>
          <span className="about-panel-rule" aria-hidden="true" />
          <ol className="about-stops">
            {itinerary.map((place, index) => {
              const next = itinerary[index + 1];
              return (
                <li key={`${place.id}-${index}`}>
                  <div className="about-stop">
                    <span>{place.name}</span>
                  </div>
                  {next ? (
                    <div className="about-leg" aria-label={`${walkMinutesBetween(place.position, next.position)} minutes to next stop`}>
                      <span className="about-leg-line" aria-hidden="true" />
                      <span className="about-leg-mins">{walkMinutesBetween(place.position, next.position)}m</span>
                      <span className="about-leg-line" aria-hidden="true" />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {route.shadeEstimate != null && (
            <p className="about-shade">Estimated shade {route.shadeEstimate}% · comfort attributes + modelled weather · not live sensing</p>
          )}
        </div>
      )}
    </aside>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("discover");
  const [wanderHours, setWanderHours] = useState(0);
  const [wanderMinutes, setWanderMinutes] = useState(0);
  const [selected, setSelected] = useState(["art", "green"]);
  const [start, setStart] = useState<LatLng | undefined>(undefined);
  const [startName, setStartName] = useState<string | undefined>(undefined);
  const [startQuery, setStartQuery] = useState("");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locating");
  const startTouchedRef = useRef(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [calmOpen, setCalmOpen] = useState(false);
  const [exploredIds, setExploredIds] = useState<string[]>([]);
  const [orsOverride, setOrsOverride] = useState<{ key: string; geometry: LatLng[] } | null>(null);
  const [fogActive, setFogActive] = useState(false);
  const [explorationPercent, setExplorationPercent] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const totalMinutes = wanderHours * 60 + wanderMinutes;
  const planMinutes = Math.max(5, Math.min(180, totalMinutes || 0));

  const draftPlan = useMemo(
    () => ({ mode, minutes: planMinutes, interests: selected, start, startName }),
    [mode, planMinutes, selected, start, startName],
  );

  const planned = useMemo(
    () => planWanderRoute({
      ...(activePlan ?? draftPlan),
      start: start ?? (activePlan ?? draftPlan).start,
      startName: startName ?? (activePlan ?? draftPlan).startName,
      exploredIds,
      weather,
    }),
    [activePlan, draftPlan, start, startName, exploredIds, weather],
  );

  const loopKey = useMemo(
    () => `${planned.start.position.join(",")}|${planned.stops.map((stop) => `${stop.id}:${stop.position.join(",")}`).join(";")}`,
    [planned.start.position, planned.stops],
  );

  const route = useMemo(
    () => orsOverride?.key === loopKey
      ? { ...planned, geometry: orsOverride.geometry, geometrySource: "openrouteservice" as const }
      : planned,
    [planned, orsOverride, loopKey],
  );

  const hasRoute = activePlan != null;
  const displayMode = activePlan?.mode ?? mode;

  const routeCopy = useMemo(
    () => `${route.walkingMinutes} min · ${route.distanceKm.toFixed(1)} km`,
    [route.distanceKm, route.walkingMinutes],
  );

  const applyStart = useCallback((next: { label: string; position: LatLng }, options?: { fromUser?: boolean }) => {
    if (options?.fromUser) startTouchedRef.current = true;
    setStart(next.position);
    setStartName(next.label);
    setStartQuery(next.label);
    setActivePlan((current) => (
      current ? { ...current, start: next.position, startName: next.label } : current
    ));
  }, []);

  const clearToVictoriaSquare = useCallback((fromUser = false) => {
    if (fromUser) startTouchedRef.current = true;
    setStart(undefined);
    setStartName(undefined);
    setStartQuery("");
    setActivePlan((current) => (
      current ? { ...current, start: undefined, startName: undefined } : current
    ));
  }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("idle");
      clearToVictoriaSquare(true);
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: LatLng = [position.coords.latitude, position.coords.longitude];
        setLocationStatus("located");
        applyStart({ label: "Your location", position: next }, { fromUser: true });
      },
      () => {
        // Demo-friendly: keep Victoria Square quietly if the browser blocks us.
        setLocationStatus("idle");
        clearToVictoriaSquare(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }, [applyStart, clearToVictoriaSquare]);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) {
      const frame = requestAnimationFrame(() => {
        if (!cancelled) setLocationStatus("idle");
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled || startTouchedRef.current) return;
        const next: LatLng = [position.coords.latitude, position.coords.longitude];
        setLocationStatus("located");
        applyStart({ label: "Your location", position: next });
      },
      () => {
        if (!cancelled) setLocationStatus("idle");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
    return () => { cancelled = true; };
  }, [applyStart]);
  const weatherDetail = weather
    ? `Feels ${weather.apparent}° · UV ${weather.uvIndex} · ${weather.time}`
    : "Modelled · Adelaide";

  const applyPlan = useCallback((nextPlan?: Plan) => {
    if (!nextPlan && totalMinutes < 1) return;
    setGenerating(true);
    const plan = nextPlan ?? { mode, minutes: planMinutes, interests: selected, start, startName };
    const frame = requestAnimationFrame(() => {
      setActivePlan(plan);
      setCalmOpen(false);
      setFogActive(false);
      setAboutOpen(false);
      setGenerating(false);
    });
    void frame;
  }, [mode, planMinutes, selected, start, startName, totalMinutes]);

  const handleExploreStop = useCallback((id: string) => {
    setExploredIds(markExplored(id));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setExploredIds(readExploredIds());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const [latitude, longitude] = start ?? START.position;
    fetchAdelaideWeather(latitude, longitude, controller.signal)
      .then(setWeather)
      .catch(() => undefined);
    return () => controller.abort();
  }, [start]);

  useEffect(() => {
    if (!hasRoute) return;
    const waypoints: LatLng[] = [
      planned.start.position,
      ...planned.stops.map((stop) => stop.position),
      planned.start.position,
    ];
    let cancelled = false;
    void resolveLoopGeometry(waypoints).then(({ geometry, source }) => {
      if (cancelled || source === "grid") return;
      setOrsOverride({ key: loopKey, geometry });
    });
    return () => { cancelled = true; };
  }, [hasRoute, loopKey, planned.start.position, planned.stops]);

  useEffect(() => {
    if (!document.modelContext) return;
    const lifecycle = new AbortController();
    void Promise.resolve(document.modelContext.registerTool({
      name: "configure_wander",
      title: "Configure a Wander route",
      description: "Configure and display an Adelaide walking loop in Wander.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["discover", "heat"] },
          minutes: { type: "number", minimum: 5, maximum: 180 },
          interests: { type: "array", items: { type: "string", enum: ["art", "coffee", "green"] } },
        },
        required: ["mode", "minutes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: { mode: Mode; minutes: number; interests?: string[] }) => {
        const nextMinutes = Math.max(5, Math.min(180, Math.round(input.minutes)));
        const nextPlan = { mode: input.mode, minutes: nextMinutes, interests: input.interests ?? [], start, startName };
        setMode(nextPlan.mode);
        setWanderHours(Math.floor(nextMinutes / 60));
        setWanderMinutes(nextMinutes % 60);
        setSelected(nextPlan.interests);
        applyPlan(nextPlan);
        return { content: [{ type: "text", text: `Showing a ${nextPlan.minutes}-minute ${nextPlan.mode} loop in Adelaide.` }] };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [applyPlan, start, startName]);

  function toggleInterest(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  const shellClass = [
    "app-shell",
    fogActive ? "mode-fog fog-mode" : displayMode === "heat" ? "mode-heat" : "mode-discover",
  ].join(" ");

  return (
    <main className={shellClass}>
      <WanderMap
        mode={displayMode}
        route={route}
        exploredIds={exploredIds}
        fogActive={fogActive}
        showRoute={hasRoute}
        onExploreStop={handleExploreStop}
        onExplorationPercent={setExplorationPercent}
      />
      <header className="topbar">
        <div className="brand" aria-label="Wander home">
          <span className="brand-mark"><Compass size={19} strokeWidth={2.4} /></span><span>Wander</span>
        </div>
        {fogActive ? (
          <div className="explore-pill" aria-live="polite" aria-label="Exploration of the current map view">
            <span className="explore-you">You</span>
            <strong>{explorationPercent.toFixed(1)}%</strong>
            <span className="explore-meta">{exploredIds.length} places cleared</span>
          </div>
        ) : (
          <div className="weather-pill" aria-label="Current modelled Adelaide weather">
            <Sun size={16} />
            <span>{weather ? `${weather.temperature}°` : "—°"}</span>
            <span className="weather-detail">{weatherDetail}</span>
          </div>
        )}
      </header>

      <div className="left-stack" hidden={fogActive}>
        <section className="planner" aria-label="Wander planner">
          <StartSearch
            value={startQuery}
            onQueryChange={(query) => {
              setStartQuery(query);
              if (!query.trim()) {
                clearToVictoriaSquare(true);
                setLocationStatus("idle");
              }
            }}
            onSelect={(suggestion) => applyStart(suggestion, { fromUser: true })}
            onUseMyLocation={useMyLocation}
            locating={locationStatus === "locating"}
            statusNote={null}
          />
          <fieldset className="mode-switch" aria-label="Route mode">
            <button className={mode === "discover" ? "active" : ""} onClick={() => setMode("discover")} type="button"><Leaf size={18} /> Discover</button>
            <button className={mode === "heat" ? "active heat" : ""} onClick={() => setMode("heat")} type="button"><Sun size={18} /> Beat the heat</button>
          </fieldset>

          <div className="time-block">
            <span className="field-label">Time to wander</span>
            <fieldset className="time-boxes">
              <legend className="sr-only">Hours and minutes to wander</legend>
              <label className="time-box">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={3}
                  value={wanderHours}
                  aria-label="Hours"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === "") {
                      setWanderHours(0);
                      return;
                    }
                    const next = Number(raw);
                    setWanderHours(Number.isFinite(next) ? Math.max(0, Math.min(3, Math.trunc(next))) : 0);
                  }}
                />
                <span>hours</span>
              </label>
              <MinuteRuler value={wanderMinutes} onChange={setWanderMinutes} />
            </fieldset>
          </div>

          {mode === "discover" ? (
            <div className="interest-block"><span className="field-label">Make it more you</span><div className="chips">
              {interests.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-pressed={selected.includes(id)} className={selected.includes(id) ? "selected" : ""} onClick={() => toggleInterest(id)}><Icon size={15} /> {label}</button>
              ))}
            </div></div>
          ) : (
            <p className="heat-note">
              Favours comfort using modelled weather and estimated shade from cached place attributes — not live street sensors
              {weather ? ` · updated ${weather.time} · UV ${weather.uvIndex} · wind ${weather.windSpeed} km/h` : " · updating weather…"}
              {weather ? ` · ${weather.precipitationProbability}% rain chance this hour.` : ""}
            </p>
          )}

          <button className="generate" type="button" disabled={generating || totalMinutes < 1} onClick={() => applyPlan()}>
            <span>{generating ? "Drawing loop…" : mode === "discover" ? "Find my wander" : "Find a cooler walk"}</span>
            <span aria-hidden="true">{generating ? "…" : "→"}</span>
          </button>
        </section>

        <AboutRoute
          route={route}
          routeCopy={routeCopy}
          empty={!hasRoute}
          open={aboutOpen}
          onToggle={() => setAboutOpen((current) => !current)}
        />
      </div>
      <div className="map-actions">
        <button
          className={`explore-button${fogActive ? " active" : ""}`}
          type="button"
          aria-pressed={fogActive}
          aria-label={fogActive ? "Exit exploration fog view" : "Show explored areas on the map"}
          onClick={() => { setFogActive((open) => !open); setCalmOpen(false); }}
        >
          {fogActive ? <X size={18} /> : <Eye size={18} />}
          <span>{fogActive ? "Exit fog" : "Explore map"}</span>
        </button>
        {!fogActive && (
          <button className="calm-button" type="button" aria-label="Find a curated calm spot" onClick={() => setCalmOpen(true)}>
            <span className="calm-pulse" /> Calm spot
          </button>
        )}
      </div>
      {calmOpen && !fogActive && (
        <aside className="calm-card" aria-live="polite">
          <button type="button" aria-label="Close calm spot" onClick={() => setCalmOpen(false)}><X size={17} /></button>
          <span className="calm-kicker"><MapPin size={14} /> Curated calm spot · not from your loop</span>
          <strong>{calmSpot.name}</strong>
          <p>
            {calmSpot.reason}. Quiet/calm attributes are curated, not measured live.
            {calmSpot.openingHours ? ` ${calmSpot.openingHours}.` : " Opening hours unverified."}
          </p>
        </aside>
      )}
    </main>
  );
}
