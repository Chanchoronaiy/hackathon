"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Bookmark, CalendarDays, Camera, Cloud, Coffee, Compass, Leaf, Map, Palette, Sun, Trees, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExploreScreen, { type ExploreSuggestion } from "@/components/explore-screen";
import FriendsScreen from "@/components/friends-screen";
import MemoriesScreen from "@/components/memories-screen";
import SavedScreen from "@/components/saved-screen";
import WalkModeChrome from "@/components/walk-mode-chrome";
import MinuteRuler from "@/components/minute-ruler";
import StartSearch from "@/components/start-search";
import { START, type PlaceCategory } from "@/lib/adelaide-data";
import { distanceMetres, markExplored, readExploredIds, readExploredTrail, recordExploredPosition } from "@/lib/exploration";
import { planWanderRoute, type LatLng, type WanderRoute } from "@/lib/route-planner";
import { resolveLoopGeometry } from "@/lib/routing";
import { deleteSavedTrial, readSavedTrials, saveTrial, type SavedTrial } from "@/lib/saved-trials";
import { recordWalkHistory, type WalkCapture } from "@/lib/walk-history";
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
type WalkLocationStatus = "locating" | "located" | "unavailable";
type Plan = {
  mode: Mode;
  minutes: number;
  interests: string[];
  start?: LatLng;
  startName?: string;
  preferUnexplored?: boolean;
};
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
  { id: "photo", label: "Photo spots", icon: Camera },
];

function categoryLabel(category: PlaceCategory) {
  switch (category) {
    case "art": return "Street art";
    case "coffee": return "Cafe";
    case "green": return "Green space";
    case "photo": return "Photo";
    case "history": return "Heritage";
    case "water": return "Water";
    case "calm": return "Quiet";
    default: return "Stop";
  }
}

function YourWanderSheet({
  route,
  exploredIds,
  onStartWalk,
  onSave,
  onClose,
}: {
  route: WanderRoute;
  exploredIds: string[];
  onStartWalk: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const stops = route.stops;
  const newCount = stops.filter((stop) => !exploredIds.includes(stop.id)).length;
  const newPercent = stops.length === 0 ? 0 : Math.round((newCount / stops.length) * 100);

  return (
    <aside className="wander-sheet" aria-label="Your wander">
      <span className="wander-sheet-handle" aria-hidden="true" />
      <div className="wander-sheet-top">
        <p className="wander-sheet-kicker">Your wander</p>
        <button type="button" className="wander-sheet-close" aria-label="Close your wander" onClick={onClose}>
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>
      <h2 className="wander-sheet-title">{route.title}</h2>
      <div className="wander-sheet-stats" aria-label="Route summary">
        <span>{route.distanceKm.toFixed(1)} km</span>
        <span>{route.walkingMinutes} min</span>
        <span>{stops.length} stop{stops.length === 1 ? "" : "s"}</span>
        <span>{newPercent}% new</span>
      </div>
      <ol className="wander-sheet-stops">
        {stops.map((stop, index) => (
          <li key={stop.id}>
            <span className="wander-sheet-index" aria-hidden="true">{index + 1}</span>
            <div className="wander-sheet-stop">
              <strong>{stop.name}</strong>
              <p>{categoryLabel(stop.category)} · {stop.why}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="wander-sheet-actions">
        <button type="button" className="wander-sheet-start" onClick={onStartWalk}>
          Start walk
        </button>
        <button type="button" className="wander-sheet-save" aria-label="Save this wander" onClick={onSave}>
          <Bookmark size={20} strokeWidth={2.2} />
        </button>
      </div>
    </aside>
  );
}

export default function Home() {
  const walkStartedAtRef = useRef<string | null>(null);
  const walkCapturesRef = useRef<WalkCapture[]>([]);
  const [mode, setMode] = useState<Mode>("discover");
  const [wanderHours, setWanderHours] = useState(0);
  const [wanderMinutes, setWanderMinutes] = useState(15);
  const [selected, setSelected] = useState(["art", "green"]);
  const [preferUnexplored, setPreferUnexplored] = useState(true);
  const [start, setStart] = useState<LatLng | undefined>(undefined);
  const [startName, setStartName] = useState<string | undefined>(undefined);
  const [startQuery, setStartQuery] = useState("");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const startTouchedRef = useRef(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [exploredIds, setExploredIds] = useState<string[]>([]);
  const [exploredTrail, setExploredTrail] = useState<LatLng[]>([]);
  const [orsOverride, setOrsOverride] = useState<{
    key: string;
    geometry: LatLng[];
    distanceKm?: number;
    walkingMinutes?: number;
  } | null>(null);
  const [fogActive, setFogActive] = useState(false);
  const [explorationPercent, setExplorationPercent] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [wanderSheetOpen, setWanderSheetOpen] = useState(false);
  const [walkingActive, setWalkingActive] = useState(false);
  const [walkLocationStatus, setWalkLocationStatus] = useState<WalkLocationStatus>("locating");
  const [walkStopIndex, setWalkStopIndex] = useState(0);
  const [walkPosition, setWalkPosition] = useState<LatLng | null>(null);
  const [heatEscapeOpen, setHeatEscapeOpen] = useState(false);
  const [heatEscape, setHeatEscape] = useState<{ shade: number; coolerMinutes: number } | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [savedTrials, setSavedTrials] = useState<SavedTrial[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [homeTab, setHomeTab] = useState<"map" | "explore" | "memories" | "saved" | "friends">("map");

  const totalMinutes = wanderHours * 60 + wanderMinutes;
  const planMinutes = Math.max(5, Math.min(180, totalMinutes || 0));

  const draftPlan = useMemo(
    () => ({ mode, minutes: planMinutes, interests: selected, start, startName, preferUnexplored }),
    [mode, planMinutes, selected, start, startName, preferUnexplored],
  );

  const planned = useMemo(
    () => planWanderRoute({
      ...(activePlan ?? draftPlan),
      start: start ?? (activePlan ?? draftPlan).start,
      startName: startName ?? (activePlan ?? draftPlan).startName,
      preferUnexplored: activePlan?.preferUnexplored ?? preferUnexplored,
      exploredIds,
      weather,
    }),
    [activePlan, draftPlan, start, startName, preferUnexplored, exploredIds, weather],
  );

  const loopKey = useMemo(
    () => `${planned.start.position.join(",")}|${planned.stops.map((stop) => `${stop.id}:${stop.position.join(",")}`).join(";")}`,
    [planned.start.position, planned.stops],
  );

  const route = useMemo(
    () => orsOverride?.key === loopKey
      ? {
          ...planned,
          geometry: orsOverride.geometry,
          distanceKm: orsOverride.distanceKm ?? planned.distanceKm,
          walkingMinutes: orsOverride.walkingMinutes ?? planned.walkingMinutes,
          geometrySource: "openrouteservice" as const,
        }
      : planned,
    [planned, orsOverride, loopKey],
  );

  const hasRoute = activePlan != null;
  const displayMode = activePlan?.mode ?? mode;

  const applyStart = useCallback((next: { label: string; position: LatLng }, options?: { fromUser?: boolean }) => {
    if (options?.fromUser) startTouchedRef.current = true;
    setLocationMessage(null);
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
      setLocationMessage("Location is not available in this browser.");
      clearToVictoriaSquare(true);
      return;
    }
    setLocationStatus("locating");
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: LatLng = [position.coords.latitude, position.coords.longitude];
        setLocationStatus("located");
        setLocationMessage(null);
        applyStart({ label: "Your location", position: next }, { fromUser: true });
      },
      (error) => {
        setLocationStatus("idle");
        setLocationMessage(error.code === error.PERMISSION_DENIED
          ? "Allow location access in your browser, then try again."
          : "Could not get your location. Check GPS and try again.");
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

  const applyPlan = useCallback((nextPlan?: Plan) => {
    if (!nextPlan && totalMinutes < 1) return;
    setGenerating(true);
    const plan = nextPlan ?? { mode, minutes: planMinutes, interests: selected, start, startName, preferUnexplored };
    const preview = planWanderRoute({
      ...plan,
      exploredIds,
      preferUnexplored: plan.preferUnexplored ?? preferUnexplored,
      weather,
    });
    const frame = requestAnimationFrame(() => {
      setActivePlan(plan);
      setFogActive(false);
      setPlannerOpen(false);
      setWanderSheetOpen(true);
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
  }, [exploredIds, mode, planMinutes, preferUnexplored, selected, start, startName, totalMinutes, weather]);

  const handleExploreStop = useCallback((id: string) => {
    setExploredIds(markExplored(id));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setExploredIds(readExploredIds());
      setExploredTrail(readExploredTrail());
      setSavedTrials(readSavedTrials());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!walkingActive || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next: LatLng = [position.coords.latitude, position.coords.longitude];
        setWalkLocationStatus("located");
        setWalkPosition(next);
        setExploredTrail(recordExploredPosition(next));

        const nextStop = route.stops[walkStopIndex];
        if (nextStop && distanceMetres(next, nextStop.position) <= 45) {
          setExploredIds(markExplored(nextStop.id));
          setWalkStopIndex((current) => Math.min(route.stops.length, current + 1));
        }
      },
      () => setWalkLocationStatus("unavailable"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [walkingActive, route.stops, walkStopIndex]);

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
    void resolveLoopGeometry(waypoints).then(({ geometry, distanceKm, walkingMinutes, source }) => {
      if (cancelled || source === "grid") return;
      setOrsOverride({ key: loopKey, geometry, distanceKm, walkingMinutes });
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
          interests: { type: "array", items: { type: "string", enum: ["art", "coffee", "green", "photo"] } },
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

  const closeOverlayScreens = useCallback(() => {
    setSavedOpen(false);
    setExploreOpen(false);
    setMemoriesOpen(false);
    setFriendsOpen(false);
  }, []);

  const openSavedScreen = useCallback((note?: string | null) => {
    setSaveNote(note ?? null);
    closeOverlayScreens();
    setSavedOpen(true);
    setHomeTab("saved");
    setWanderSheetOpen(false);
    setPlannerOpen(false);
    setFogActive(false);
    setHeatEscapeOpen(false);
  }, [closeOverlayScreens]);

  const openExploreScreen = useCallback(() => {
    closeOverlayScreens();
    setExploreOpen(true);
    setHomeTab("explore");
    setWanderSheetOpen(false);
    setPlannerOpen(false);
    setFogActive(false);
    setHeatEscapeOpen(false);
  }, [closeOverlayScreens]);

  const openMemoriesScreen = useCallback(() => {
    closeOverlayScreens();
    setMemoriesOpen(true);
    setHomeTab("memories");
    setWanderSheetOpen(false);
    setPlannerOpen(false);
    setFogActive(false);
    setHeatEscapeOpen(false);
  }, [closeOverlayScreens]);

  const openFriendsScreen = useCallback(() => {
    closeOverlayScreens();
    setFriendsOpen(true);
    setHomeTab("friends");
    setWanderSheetOpen(false);
    setPlannerOpen(false);
    setFogActive(false);
    setHeatEscapeOpen(false);
  }, [closeOverlayScreens]);

  const openExploreSuggestion = useCallback((suggestion: ExploreSuggestion) => {
    const nextMinutes = Math.max(5, Math.min(180, suggestion.minutes));
    setMode(suggestion.mode);
    setWanderHours(Math.floor(nextMinutes / 60));
    setWanderMinutes(nextMinutes % 60);
    setSelected(suggestion.interests);
    closeOverlayScreens();
    applyPlan({
      mode: suggestion.mode,
      minutes: nextMinutes,
      interests: suggestion.interests,
      start,
      startName,
      preferUnexplored,
    });
  }, [applyPlan, closeOverlayScreens, preferUnexplored, start, startName]);

  const handleSaveTrial = useCallback(() => {
    if (!hasRoute || !activePlan) {
      openSavedScreen("Generate a wander first, then save it.");
      return;
    }
    const next = saveTrial({
      mode: activePlan.mode,
      minutes: activePlan.minutes,
      interests: activePlan.interests,
      start: activePlan.start,
      geometry: route.geometry.filter((_, index) => index % Math.max(1, Math.ceil(route.geometry.length / 64)) === 0),
      startName: activePlan.startName,
      stopNames: route.stops.map((stop) => stop.name),
      walkingMinutes: route.walkingMinutes,
      distanceKm: route.distanceKm,
      title: route.title,
    });
    setSavedTrials(next);
    openSavedScreen(null);
  }, [activePlan, hasRoute, openSavedScreen, route.distanceKm, route.geometry, route.stops, route.title, route.walkingMinutes]);

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
    setSaveNote(null);
    setHomeTab("map");
    setPlannerOpen(false);
    setWanderSheetOpen(true);
    setExploreOpen(false);
    setMemoriesOpen(false);
    setFriendsOpen(false);
  }, [applyPlan, applyStart, clearToVictoriaSquare]);

  function toggleInterest(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  const shellClass = [
    "app-shell",
    fogActive ? "mode-fog fog-mode" : displayMode === "heat" ? "mode-heat" : "mode-discover",
    plannerOpen ? "planner-open" : "home-view",
  ].join(" ");

  const showMapChrome = !plannerOpen && !wanderSheetOpen && !walkingActive && !savedOpen && !exploreOpen && !memoriesOpen && !friendsOpen;
  const showHomeDock = !plannerOpen && !wanderSheetOpen && !walkingActive;
  const tabScreenOpen = savedOpen || exploreOpen || memoriesOpen || friendsOpen;

  function toggleFog() {
    if (fogActive) {
      setFogActive(false);
      setHomeTab("map");
      return;
    }
    setFogActive(true);
    setWalkingActive(false);
    setHomeTab("map");
    closeOverlayScreens();
    setPlannerOpen(false);
    setWanderSheetOpen(false);
    setHeatEscapeOpen(false);
  }

  function openPlanner() {
    setPlannerOpen(true);
    setWanderSheetOpen(false);
    setWalkingActive(false);
    closeOverlayScreens();
    setHeatEscapeOpen(false);
    setHomeTab("map");
  }

  function closePlanner() {
    setPlannerOpen(false);
  }

  function closeWanderSheet() {
    setWanderSheetOpen(false);
  }

  function startWalk() {
    walkStartedAtRef.current = new Date().toISOString();
    walkCapturesRef.current = [];
    setWalkLocationStatus(navigator.geolocation ? "locating" : "unavailable");
    setWanderSheetOpen(false);
    setWalkingActive(true);
    setWalkStopIndex(0);
    setWalkPosition(null);
    setFogActive(false);
    closeOverlayScreens();
    setPlannerOpen(false);
    setHomeTab("map");
  }

  function endWalk() {
    if (walkStartedAtRef.current) {
      recordWalkHistory({
        startedAt: walkStartedAtRef.current,
        mode: activePlan?.mode ?? mode,
        title: route.title,
        startName: activePlan?.startName ?? startName,
        start: activePlan?.start ?? start,
        stopNames: route.stops.map((stop) => stop.name),
        walkingMinutes: route.walkingMinutes,
        distanceKm: route.distanceKm,
        captures: walkCapturesRef.current,
      });
      walkStartedAtRef.current = null;
      walkCapturesRef.current = [];
    }
    setWalkingActive(false);
    setWalkStopIndex(0);
    setWalkPosition(null);
  }

  function shareWalk() {
    const text = `Walking ${route.title} · ${route.distanceKm.toFixed(1)} km · ${route.walkingMinutes} min in Adelaide`;
    if (navigator.share) {
      void navigator.share({ title: "Wander", text }).catch(() => undefined);
      return;
    }
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  function captureWalkMoment() {
    const stop = route.stops[Math.min(walkStopIndex, Math.max(route.stops.length - 1, 0))];
    if (stop) {
      handleExploreStop(stop.id);
      walkCapturesRef.current = [...walkCapturesRef.current, {
        stopName: stop.name,
        capturedAt: new Date().toISOString(),
      }];
    }
    if (walkStopIndex >= route.stops.length) {
      openMemoriesScreen();
      endWalk();
      return;
    }
  }

  function goHomeTab(tab: typeof homeTab) {
    setHomeTab(tab);
    if (tab === "map") {
      setFogActive(false);
      closeOverlayScreens();
      setPlannerOpen(false);
      setWanderSheetOpen(false);
      setWalkingActive(false);
      return;
    }
    if (tab === "explore") {
      openExploreScreen();
      return;
    }
    if (tab === "memories") {
      openMemoriesScreen();
      return;
    }
    if (tab === "saved") {
      setFogActive(false);
      closeOverlayScreens();
      setSavedOpen(true);
      setPlannerOpen(false);
      setWanderSheetOpen(false);
      setSaveNote(null);
      return;
    }
    if (tab === "friends") {
      openFriendsScreen();
      return;
    }
    setFogActive(false);
    closeOverlayScreens();
  }

  return (
    <main className={shellClass}>
      <WanderMap
        mode={displayMode}
        route={route}
        exploredIds={exploredIds}
        exploredTrail={exploredTrail}
        fogActive={fogActive}
        showRoute={hasRoute}
        walkMode={walkingActive}
        walkStopIndex={walkStopIndex}
        walkPosition={walkPosition}
        onExploreStop={handleExploreStop}
        onExplorationPercent={setExplorationPercent}
      />

      {showMapChrome && (
        <>
          <header className="home-top">
            <button type="button" className="home-profile" aria-label="Open profile">
              <span aria-hidden="true">AS</span>
            </button>
            <div className="home-search">
              <StartSearch
                variant="home"
                placeholder="Search Adelaide"
                ariaLabel="Search Adelaide"
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
            </div>
          </header>

          <aside className="home-rail" aria-label="Map controls">
            <button
              type="button"
              className={`home-rail-chip${fogActive ? " is-on" : ""}`}
              aria-pressed={fogActive}
              aria-label={fogActive ? "Turn fog exploration off" : "Turn fog exploration on"}
              onClick={toggleFog}
            >
              <Cloud size={18} strokeWidth={2.2} />
              <span>{fogActive ? "On" : "Off"}</span>
            </button>
          </aside>

          <div className="home-explore-pill" aria-live="polite">
            <span className="home-explore-dot" aria-hidden="true" />
            <span>{explorationPercent.toFixed(0)}% explored</span>
          </div>
        </>
      )}

      {showHomeDock && (
        <div className={`home-dock${tabScreenOpen ? " is-saved" : ""}`}>
          {!tabScreenOpen && (
            <button className="start-wander" type="button" onClick={openPlanner}>
              <span>Start wandering</span>
            </button>
          )}
          <nav className="home-nav" aria-label="Primary">
            <button
              type="button"
              className={homeTab === "map" && !tabScreenOpen ? "is-active" : ""}
              onClick={() => goHomeTab("map")}
            >
              <Map size={20} strokeWidth={2.2} />
              <span>Map</span>
            </button>
            <button
              type="button"
              className={homeTab === "explore" || exploreOpen ? "is-active" : ""}
              onClick={() => goHomeTab("explore")}
            >
              <Compass size={20} strokeWidth={2.2} />
              <span>Explore</span>
            </button>
            <button
              type="button"
              className={homeTab === "memories" || memoriesOpen ? "is-active" : ""}
              onClick={() => goHomeTab("memories")}
            >
              <CalendarDays size={20} strokeWidth={2.2} />
              <span>Memories</span>
            </button>
            <button
              type="button"
              className={homeTab === "saved" || savedOpen ? "is-active" : ""}
              onClick={() => goHomeTab("saved")}
            >
              <Bookmark size={20} strokeWidth={2.2} />
              <span>Saved</span>
            </button>
            <button
              type="button"
              className={homeTab === "friends" || friendsOpen ? "is-active" : ""}
              onClick={() => goHomeTab("friends")}
            >
              <Users size={20} strokeWidth={2.2} />
              <span>Friends</span>
            </button>
          </nav>
        </div>
      )}

      {exploreOpen && !fogActive && (
        <ExploreScreen
          onOpenSuggestion={openExploreSuggestion}
          onOpenCollection={(id) => {
            if (id === "coffee") {
              setSelected(["coffee"]);
              setMode("discover");
            } else {
              setSelected(["art", "photo"]);
              setMode("discover");
            }
            setExploreOpen(false);
            openPlanner();
          }}
        />
      )}

      {memoriesOpen && !fogActive && (
        <MemoriesScreen />
      )}

      {friendsOpen && !fogActive && (
        <FriendsScreen />
      )}

      {savedOpen && !fogActive && (
        <SavedScreen
          trials={savedTrials}
          note={saveNote}
          onOpenTrial={restoreTrial}
          onRemoveTrial={(id) => setSavedTrials(deleteSavedTrial(id))}
        />
      )}

      {plannerOpen && !fogActive && (
        <div className="planner-popup-backdrop">
          <button
            type="button"
            className="planner-popup-scrim"
            aria-label="Close planner"
            onClick={closePlanner}
          />
          <dialog
            className="planner-popup"
            open
            aria-label="Wander planner"
          >
            <div className="planner-popup-stack">
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
                  statusNote={locationMessage}
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

                <div className="interest-block">
                  <span className="interest-heading">A little more of...</span>
                  <div className="chips">
                    {interests.map(({ id, label, icon: Icon }) => (
                      <button key={id} type="button" aria-pressed={selected.includes(id)} className={selected.includes(id) ? "selected" : ""} onClick={() => toggleInterest(id)}><Icon size={15} /> {label}</button>
                    ))}
                  </div>
                </div>

                <div className="prefer-unexplored">
                  <div className="prefer-unexplored-copy">
                    <span className="interest-heading">Prefer unexplored areas</span>
                  </div>
                  <button
                    type="button"
                    className={`prefer-toggle${preferUnexplored ? " is-on" : ""}`}
                    role="switch"
                    aria-checked={preferUnexplored}
                    aria-label="Prefer unexplored areas"
                    onClick={() => setPreferUnexplored((current) => !current)}
                  >
                    <span className="prefer-toggle-thumb" aria-hidden="true" />
                  </button>
                </div>

                <button className="generate" type="button" disabled={generating || totalMinutes < 1} onClick={() => applyPlan()}>
                  <span>{generating ? "Drawing loop…" : "Generate my Wander"}</span>
                  <span aria-hidden="true">{generating ? "…" : "→"}</span>
                </button>
              </section>
            </div>
          </dialog>
        </div>
      )}

      {wanderSheetOpen && hasRoute && !fogActive && (
        <>
          <button type="button" className="wander-back" aria-label="Back to map" onClick={closeWanderSheet}>
            <ArrowLeft size={20} strokeWidth={2.4} />
          </button>
          <YourWanderSheet
            route={route}
            exploredIds={exploredIds}
            onStartWalk={startWalk}
            onSave={handleSaveTrial}
            onClose={closeWanderSheet}
          />
        </>
      )}

      {walkingActive && hasRoute && (
        <WalkModeChrome
          route={route}
          currentStopIndex={walkStopIndex}
                    locationStatus={walkLocationStatus}
          explorationPercent={explorationPercent}
          onBack={endWalk}
          onShare={shareWalk}
          onCapture={captureWalkMoment}
          onAdvance={() => {
            const stop = route.stops[walkStopIndex];
            if (stop) handleExploreStop(stop.id);
            setWalkStopIndex((current) => Math.min(route.stops.length, current + 1));
          }}
        />
      )}

      {heatEscapeOpen && heatEscape && !fogActive && !walkingActive && (
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
