"use client";

import dynamic from "next/dynamic";
import { Bookmark, ChevronUp, Coffee, Compass, Eye, Leaf, MapPin, Palette, Sun, Trees, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MinuteRuler from "@/components/minute-ruler";
import StartSearch from "@/components/start-search";
import { ADELAIDE_PLACES, START } from "@/lib/adelaide-data";
import { markExplored, readExploredIds } from "@/lib/exploration";
import { planWanderRoute, type LatLng, type WanderRoute } from "@/lib/route-planner";
import { resolveLoopGeometry } from "@/lib/routing";
import { deleteSavedTrial, readSavedTrials, saveTrial, type SavedTrial } from "@/lib/saved-trials";
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
  const [heatEscapeOpen, setHeatEscapeOpen] = useState(false);
  const [heatEscape, setHeatEscape] = useState<{ shade: number; coolerMinutes: number } | null>(null);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTrials, setSavedTrials] = useState<SavedTrial[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);

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
    const preview = planWanderRoute({
      ...plan,
      exploredIds,
      weather,
    });
    const frame = requestAnimationFrame(() => {
      setActivePlan(plan);
      setCalmOpen(false);
      setFogActive(false);
      setAboutOpen(false);
      setGenerating(false);
      if (plan.mode === "heat" && preview.shadeEstimate != null) {
        setHeatEscape({
          shade: preview.shadeEstimate,
          coolerMinutes: Math.max(1, Math.round(preview.walkingMinutes * (preview.shadeEstimate / 100))),
        });
        setHeatEscapeOpen(true);
      } else {
        setHeatEscapeOpen(false);
      }
    });
    void frame;
  }, [exploredIds, mode, planMinutes, selected, start, startName, totalMinutes, weather]);

  const handleExploreStop = useCallback((id: string) => {
    setExploredIds(markExplored(id));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setExploredIds(readExploredIds());
      setSavedTrials(readSavedTrials());
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

  const openSavedTrials = useCallback(() => {
    setSavedOpen(true);
    setBrandMenuOpen(false);
    setCalmOpen(false);
    setHeatEscapeOpen(false);
    setSaveNote(null);
  }, []);

  const handleSaveTrial = useCallback(() => {
    if (!hasRoute || !activePlan) {
      setSaveNote("Generate a wander first, then save it.");
      openSavedTrials();
      return;
    }
    const next = saveTrial({
      mode: activePlan.mode,
      minutes: activePlan.minutes,
      interests: activePlan.interests,
      start: activePlan.start,
      startName: activePlan.startName,
      stopNames: route.stops.map((stop) => stop.name),
      walkingMinutes: route.walkingMinutes,
      distanceKm: route.distanceKm,
    });
    setSavedTrials(next);
    setSaveNote("Wander saved.");
    openSavedTrials();
  }, [activePlan, hasRoute, openSavedTrials, route.distanceKm, route.stops, route.walkingMinutes]);

  const restoreTrial = useCallback((trial: SavedTrial) => {
    const nextMinutes = Math.max(5, Math.min(180, Math.round(trial.minutes)));
    setMode(trial.mode);
    setWanderHours(Math.floor(nextMinutes / 60));
    setWanderMinutes(nextMinutes % 60);
    setSelected(trial.interests);
    if (trial.start) {
      applyStart({
        label: trial.startName ?? "Saved start",
        position: trial.start,
      }, { fromUser: true });
    } else {
      clearToVictoriaSquare(true);
    }
    applyPlan({
      mode: trial.mode,
      minutes: nextMinutes,
      interests: trial.interests,
      start: trial.start,
      startName: trial.startName,
    });
    setSavedOpen(false);
    setBrandMenuOpen(false);
    setSaveNote(null);
  }, [applyPlan, applyStart, clearToVictoriaSquare]);

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
        <div className={`brand-menu${brandMenuOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="brand-mark"
            aria-label="Open Wander menu"
            aria-expanded={brandMenuOpen}
            onClick={() => {
              setBrandMenuOpen((open) => !open);
              setSavedOpen(false);
            }}
          >
            <Compass size={19} strokeWidth={2.4} />
          </button>
          {brandMenuOpen && (
            <div className="brand-menu-actions">
              <button
                type="button"
                className="brand-action"
                aria-label="Saved trials"
                onClick={openSavedTrials}
              >
                <Bookmark size={18} />
                <span>Save</span>
              </button>
              <button
                type="button"
                className={`brand-action${fogActive ? " active" : ""}`}
                aria-pressed={fogActive}
                aria-label={fogActive ? "Exit exploration fog view" : "Explore unexplored areas on the map"}
                onClick={() => {
                  setFogActive((open) => !open);
                  setCalmOpen(false);
                  setBrandMenuOpen(false);
                  setSavedOpen(false);
                  setHeatEscapeOpen(false);
                }}
              >
                {fogActive ? <X size={18} /> : <Eye size={18} />}
                <span>{fogActive ? "Exit" : "Explore"}</span>
              </button>
            </div>
          )}
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

      {savedOpen && !fogActive && (
        <aside className="saved-panel" aria-live="polite">
          <div className="saved-panel-head">
            <strong>Saved trials</strong>
            <button type="button" aria-label="Close saved trials" onClick={() => setSavedOpen(false)}>
              <X size={17} />
            </button>
          </div>
          {saveNote ? <p className="saved-note">{saveNote}</p> : null}
          {hasRoute ? (
            <button type="button" className="saved-current" onClick={handleSaveTrial}>
              Save current wander
            </button>
          ) : null}
          {savedTrials.length === 0 ? (
            <p className="saved-empty">No saved wanders yet. Generate a loop, then save it here.</p>
          ) : (
            <ul className="saved-list">
              {savedTrials.map((trial) => (
                <li key={trial.id}>
                  <button type="button" className="saved-item" onClick={() => restoreTrial(trial)}>
                    <span className="saved-item-title">
                      {trial.mode === "heat" ? "Beat the heat" : "Discover"} · {trial.walkingMinutes} min
                    </span>
                    <span className="saved-item-meta">
                      {trial.distanceKm.toFixed(1)} km · {trial.stopNames.slice(0, 3).join(", ") || "No stops"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-delete"
                    aria-label="Delete saved trial"
                    onClick={() => setSavedTrials(deleteSavedTrial(trial.id))}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

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

          <div className="interest-block"><span className="field-label">Make it more you</span><div className="chips">
            {interests.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" aria-pressed={selected.includes(id)} className={selected.includes(id) ? "selected" : ""} onClick={() => toggleInterest(id)}><Icon size={15} /> {label}</button>
            ))}
          </div></div>

          <button className="generate" type="button" disabled={generating || totalMinutes < 1} onClick={() => applyPlan()}>
            <span>{generating ? "Drawing loop…" : "Find my wander"}</span>
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
        {!fogActive && (
          <button className="calm-button" type="button" aria-label="Find a curated calm spot" onClick={() => setCalmOpen(true)}>
            <span className="calm-pulse" /> Calm spot
          </button>
        )}
        {fogActive && (
          <button
            className="explore-button active"
            type="button"
            aria-pressed
            aria-label="Exit exploration fog view"
            onClick={() => setFogActive(false)}
          >
            <X size={18} />
            <span>Exit fog</span>
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
      {heatEscapeOpen && heatEscape && !fogActive && (
        <div className="heat-escape-backdrop">
          <button
            type="button"
            className="heat-escape-scrim"
            aria-label="Dismiss sunshine escape"
            onClick={() => setHeatEscapeOpen(false)}
          />
          <dialog
            className="heat-escape-card"
            open
            aria-labelledby="heat-escape-title"
          >
            <button type="button" aria-label="Close sunshine escape" onClick={() => setHeatEscapeOpen(false)}>
              <X size={17} />
            </button>
            <span className="heat-escape-kicker"><Sun size={14} /> Beat the heat</span>
            <strong id="heat-escape-title">You escaped about {heatEscape.shade}% of the harsh sunshine</strong>
            <p>
              That’s roughly {heatEscape.coolerMinutes} cooler minutes on this walk
              {weather ? ` · UV ${weather.uvIndex} · feels like ${weather.apparent}°` : ""}.
              Estimated from comfort attributes and modelled weather — not live street sensors.
            </p>
          </dialog>
        </div>
      )}
    </main>
  );
}
