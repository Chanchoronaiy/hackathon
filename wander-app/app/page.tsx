"use client";

import dynamic from "next/dynamic";
import { Angry, ArrowLeft, BookOpen, Bookmark, CalendarDays, Camera, Cloud, Coffee, Compass, Leaf, Map, MapPinned, Palette, Shuffle, Sun, Trees, Trophy, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DailyQuestsScreen from "@/components/daily-quests-screen";
import ExploreScreen, { type ExploreSuggestion } from "@/components/explore-screen";
import FriendsScreen from "@/components/friends-screen";
import LeaderboardScreen from "@/components/leaderboard-screen";
import MemoriesScreen from "@/components/memories-screen";
import SavedScreen from "@/components/saved-screen";
import WalkMemoryDialog from "@/components/walk-memory-dialog";
import WalkModeChrome from "@/components/walk-mode-chrome";
import MinuteRuler from "@/components/minute-ruler";
import StartSearch from "@/components/start-search";
import StreetViewBuddy from "@/components/street-view-buddy";
import StreetViewDialog from "@/components/street-view-dialog";
import type { Map as LeafletMap } from "leaflet";
import { START, type PlaceCategory } from "@/lib/adelaide-data";
import { distanceMetres, markExplored, readExploredIds, readExploredTrail, recordExploredPosition } from "@/lib/exploration";
import { completeWalk, dailyQuests, isQuestCompleted, localDateKey, readGamificationProfile, type DailyQuest } from "@/lib/gamification";
import {
  canRemix,
  consumeRemixTry,
  purchaseRemixPack,
  readRemixTries,
  remixTriesRemaining,
  REMIX_FREE_TRIES,
  REMIX_PACK_PRICE,
  REMIX_PACK_TRIES,
} from "@/lib/remix-tries";
import { HISTORY_SITES, type HistoryImagePair } from "@/lib/history-sites";
import { planWanderRoute, type LatLng, type WanderRoute } from "@/lib/route-planner";
import { resolveLoopGeometry } from "@/lib/routing";
import { deleteSavedTrial, readSavedTrials, saveTrial, type SavedTrial } from "@/lib/saved-trials";
import { addTrailReview } from "@/lib/trail-reviews";
import { recordWalkHistory, type WalkCapture } from "@/lib/walk-history";
import { loadCloudTrials, removeCloudTrial, syncSavedTrial, syncWalkMemory } from "@/lib/cloud-data";
import { ALREADY_SAVED_MESSAGE, createId, getMemoryForWalk, hasSeenMemoryRule, markMemoryRuleSeen, saveWalkMemory } from "@/lib/walk-memories";
import { fetchAdelaideWeather, type WeatherSnapshot } from "@/lib/weather";
import type { PopularPlace } from "@/lib/popularity";

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
type WalkHistoryMoment = {
  siteName: string;
  fact: string;
  facts?: string[];
  factIndex?: number;
  beforeAfter?: HistoryImagePair;
  sourceLabel?: string;
  sourceUrl?: string;
};
type Plan = {
  mode: Mode;
  minutes: number;
  interests: string[];
  suggestionId?: string;
  start?: LatLng;
  startName?: string;
  preferUnexplored?: boolean;
  focusPlaceId?: string;
  focusDestination?: { name: string; position: LatLng };
  remixSeed?: number;
  excludePlaceIds?: string[];
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
  remixLeft,
  onRemix,
  onStartWalk,
  onSave,
  onClose,
  onDropBuddy,
}: {
  route: WanderRoute;
  remixLeft: number;
  onRemix: () => void;
  onStartWalk: () => void;
  onSave: () => void;
  onClose: () => void;
  onDropBuddy: (clientX: number, clientY: number) => void;
}) {
  const stops = route.stops;

  return (
    <aside className="wander-sheet" aria-label="Your wander">
      <StreetViewBuddy onDrop={onDropBuddy} />
      <span className="wander-sheet-handle" aria-hidden="true" />
      <div className="wander-sheet-top">
        <p className="wander-sheet-kicker">Your wander</p>
        <div className="wander-sheet-top-actions">
          <button
            type="button"
            className="wander-sheet-remix"
            aria-label={remixLeft > 0 ? `Remix optional scenery, ${remixLeft} left this week` : "Remix optional scenery"}
            title={remixLeft > 0 ? `Remix scenery · ${remixLeft} left` : "Remix scenery"}
            onClick={onRemix}
          >
            <Shuffle size={17} strokeWidth={2.4} />
          </button>
          <button type="button" className="wander-sheet-close" aria-label="Close your wander" onClick={onClose}>
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <div className="wander-sheet-stats" aria-label="Route summary">
        <span>{route.distanceKm.toFixed(1)} km</span>
        <span>{route.walkingMinutes} min</span>
        <span>{stops.length} stop{stops.length === 1 ? "" : "s"}</span>
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
  const seenWalkHistorySitesRef = useRef(new Set<string>());
  const seenWalkStopsRef = useRef(new Set<string>());
  const [mode, setMode] = useState<Mode>("discover");
  const [wanderHours, setWanderHours] = useState(0);
  const [wanderMinutes, setWanderMinutes] = useState(15);
  const [selected, setSelected] = useState(["art", "green"]);
  const [preferUnexplored, setPreferUnexplored] = useState(true);
  const [start, setStart] = useState<LatLng | undefined>(undefined);
  const [startName, setStartName] = useState<string | undefined>(undefined);
  const [startQuery, setStartQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [fromQuery, setFromQuery] = useState("");
  const [pendingDestination, setPendingDestination] = useState<{ label: string; position: LatLng } | null>(null);
  const [searchFromOpen, setSearchFromOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locating");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const startTouchedRef = useRef(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [exploredIds, setExploredIds] = useState<string[]>([]);
  const [exploredTrail, setExploredTrail] = useState<LatLng[]>([]);
  const [orsOverride, setOrsOverride] = useState<{
    key: string;
    geometry: LatLng[];
    optionalGeometry?: LatLng[];
    optionalDistanceKm?: number;
    optionalWalkingMinutes?: number;
    distanceKm?: number;
    walkingMinutes?: number;
  } | null>(null);
  const [readyRouteKey, setReadyRouteKey] = useState<string | null>(null);
  const [fogActive, setFogActive] = useState(false);
  const [friendsFogView, setFriendsFogView] = useState(false);
  const [historyLayer, setHistoryLayer] = useState(false);
  const [explorationPercent, setExplorationPercent] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [plannerNotice, setPlannerNotice] = useState<string | null>(null);
  const [celebratingFinish, setCelebratingFinish] = useState(false);
  const [wanderSheetOpen, setWanderSheetOpen] = useState(false);
  const [walkingActive, setWalkingActive] = useState(false);
  const [walkLocationStatus, setWalkLocationStatus] = useState<WalkLocationStatus>("locating");
  const [walkHistoryMoment, setWalkHistoryMoment] = useState<WalkHistoryMoment | null>(null);
  const [walkStopIndex, setWalkStopIndex] = useState(0);
  const [walkPosition, setWalkPosition] = useState<LatLng | null>(null);
  // Each walk gets a unique id; its one memory (photo) records that id. Restarting the
  // same generated plan before finishing it resumes the same walk. (Not loopKey: that
  // changes as stops are explored, even though it's the same route.)
  const [walkId, setWalkId] = useState<string | null>(null);
  const [walkPlan, setWalkPlan] = useState<Plan | null>(null);
  const [walkMemorySaved, setWalkMemorySaved] = useState(false);
  const [memoryStep, setMemoryStep] = useState<"intro" | "preview" | null>(null);
  const [memoryPhoto, setMemoryPhoto] = useState<{ file: File; url: string } | null>(null);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const memoryInputRef = useRef<HTMLInputElement>(null);
  const [heatEscapeOpen, setHeatEscapeOpen] = useState(false);
  const [heatEscape, setHeatEscape] = useState<{ shade: number } | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [_questPointsTick, setQuestPointsTick] = useState(0);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [savedTrials, setSavedTrials] = useState<SavedTrial[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [streetViewPosition, setStreetViewPosition] = useState<LatLng | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);
  const dropStreetViewBuddy = useCallback((clientX: number, clientY: number) => {
    const map = mapRef.current;
    if (!map) return;
    const rect = map.getContainer().getBoundingClientRect();
    const point = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
    setStreetViewPosition([point.lat, point.lng]);
  }, []);
  const [popularPlaces, setPopularPlaces] = useState<PopularPlace[]>([]);
  const [homeTab, setHomeTab] = useState<"map" | "explore" | "memories" | "saved" | "friends">("map");
  const [remixTries, setRemixTries] = useState(() => readRemixTries());
  const [remixPaywallOpen, setRemixPaywallOpen] = useState(false);
  const [remixFeedback, setRemixFeedback] = useState<"thanks" | "angry" | null>(null);
  const [optionalRouteActive, setOptionalRouteActive] = useState(false);
  const remixFeedbackTimer = useRef<number | null>(null);
  const remixLeft = remixTriesRemaining(remixTries);

  const showRemixFeedback = useCallback((kind: "thanks" | "angry") => {
    if (remixFeedbackTimer.current != null) window.clearTimeout(remixFeedbackTimer.current);
    setRemixFeedback(kind);
    remixFeedbackTimer.current = window.setTimeout(() => {
      setRemixFeedback(null);
      remixFeedbackTimer.current = null;
    }, kind === "angry" ? 2200 : 2400);
  }, []);

  useEffect(() => () => {
    if (remixFeedbackTimer.current != null) window.clearTimeout(remixFeedbackTimer.current);
  }, []);

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
    () => `${planned.start.position.join(",")}|${planned.stops.map((stop) => `${stop.id}:${stop.position.join(",")}`).join(";")}|opt:${(planned.optionalStops ?? []).map((stop) => stop.id).join(",")}`,
    [planned.start.position, planned.stops, planned.optionalStops],
  );

  const route = useMemo(
    () => orsOverride?.key === loopKey
      ? {
          ...planned,
          geometry: orsOverride.geometry,
          optionalGeometry: orsOverride.optionalGeometry ?? planned.optionalGeometry,
          optionalDistanceKm: orsOverride.optionalDistanceKm ?? planned.optionalDistanceKm,
          optionalWalkingMinutes: orsOverride.optionalWalkingMinutes ?? planned.optionalWalkingMinutes,
          distanceKm: orsOverride.distanceKm ?? planned.distanceKm,
          walkingMinutes: orsOverride.walkingMinutes ?? planned.walkingMinutes,
          geometrySource: "openrouteservice" as const,
        }
      : planned,
    [planned, orsOverride, loopKey],
  );

  const displayRoute = useMemo(() => {
    if (!optionalRouteActive || !route.optionalStops?.length) return route;
    return {
      ...route,
      stops: [...route.optionalStops, ...route.stops],
      distanceKm: route.optionalDistanceKm ?? route.distanceKm,
      walkingMinutes: route.optionalWalkingMinutes ?? route.walkingMinutes,
      geometry: route.optionalGeometry?.length ? route.optionalGeometry : route.geometry,
    };
  }, [optionalRouteActive, route]);

  useEffect(() => {
    setOptionalRouteActive(false);
  }, [loopKey]);

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
      setFromQuery("Victoria Square");
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
        setFromQuery("Your location");
      },
      (error) => {
        setLocationStatus("idle");
        setLocationMessage(error.code === error.PERMISSION_DENIED
          ? "Allow location access in your browser, then try again."
          : "Could not get your location. Check GPS and try again.");
        clearToVictoriaSquare(true);
        setFromQuery("Victoria Square");
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
        setFromQuery("Your location");
      },
      () => {
        if (!cancelled) setLocationStatus("idle");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
    return () => { cancelled = true; };
  }, [applyStart]);

  const applyPlan = useCallback((nextPlan?: Plan) => {
    if (!nextPlan && totalMinutes < 1) {
      setPlannerNotice("Choose some time first, then we’ll find a loop that fits.");
      return;
    }
    setGenerating(true);
    const plan = nextPlan ?? { mode, minutes: planMinutes, interests: selected, start, startName, preferUnexplored };
    const preview = planWanderRoute({
      ...plan,
      exploredIds,
      preferUnexplored: plan.preferUnexplored ?? preferUnexplored,
      weather,
    });
    if (preview.unavailableReason) {
      setPlannerNotice(preview.unavailableReason);
      setGenerating(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setPlannerNotice(null);
      setActivePlan(plan);
      setOrsOverride(null);
      setFogActive(false);
      setPlannerOpen(false);
      setWanderSheetOpen(true);
      setGenerating(false);
      if (plan.mode === "heat" && preview.shadeEstimate != null) {
        setHeatEscape({
          shade: preview.shadeEstimate,
        });
        setHeatEscapeOpen(true);
      } else {
        setHeatEscapeOpen(false);
      }
    });
    void frame;
  }, [exploredIds, mode, planMinutes, preferUnexplored, selected, start, startName, totalMinutes, weather]);

  const remixWander = useCallback(() => {
    if (!activePlan) return;
    if (!canRemix()) {
      setRemixPaywallOpen(true);
      return;
    }
    const nextTries = consumeRemixTry();
    setRemixTries(nextTries);
    // Only remix optional scenery — keep the primary quest/destination fixed.
    const excludePlaceIds = [
      ...(route.optionalStops ?? []),
      ...route.stops,
    ]
      .map((stop) => stop.id)
      .filter((id) => id !== activePlan.focusPlaceId && !id.startsWith("search:"));
    applyPlan({
      ...activePlan,
      remixSeed: (activePlan.remixSeed ?? 0) + 1,
      excludePlaceIds,
    });
  }, [activePlan, applyPlan, route.optionalStops, route.stops]);

  useEffect(() => {
    const sync = () => setRemixTries(readRemixTries());
    window.addEventListener("wander:remix-tries", sync);
    return () => window.removeEventListener("wander:remix-tries", sync);
  }, []);

  const handleExploreStop = useCallback((id: string) => {
    setExploredIds(markExplored(id));
  }, []);

  const dismissWalkHistoryMoment = useCallback(() => {
    setWalkHistoryMoment(null);
  }, []);

  const showAnotherWalkFact = useCallback(() => {
    setWalkHistoryMoment((current) => {
      if (!current?.facts || current.facts.length < 2) return current;
      const options = current.facts.map((_, index) => index).filter((index) => index !== current.factIndex);
      const factIndex = options[Math.floor(Math.random() * options.length)];
      return { ...current, factIndex, fact: current.facts[factIndex] };
    });
  }, []);

  useEffect(() => {
    if (!plannerNotice) return;
    const timer = window.setTimeout(() => setPlannerNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [plannerNotice]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setExploredIds(readExploredIds());
      setExploredTrail(readExploredTrail());
      setSavedTrials(readSavedTrials());
      void loadCloudTrials().then((cloudTrials) => {
        if (cloudTrials?.length) setSavedTrials(cloudTrials);
      });
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

        const nearbyHistorySite = HISTORY_SITES.find((site) => (
          !seenWalkHistorySitesRef.current.has(site.id)
          && distanceMetres(next, site.position) <= 350
        ));
        if (nearbyHistorySite) {
          seenWalkHistorySitesRef.current.add(nearbyHistorySite.id);
          const fact = nearbyHistorySite.facts[Math.floor(Math.random() * nearbyHistorySite.facts.length)];
          setWalkHistoryMoment({
            siteName: nearbyHistorySite.name,
            fact,
            facts: nearbyHistorySite.facts,
            factIndex: nearbyHistorySite.facts.indexOf(fact),
            beforeAfter: nearbyHistorySite.beforeAfter,
            sourceLabel: nearbyHistorySite.sourceLabel,
            sourceUrl: nearbyHistorySite.sourceUrl,
          });
        }

        const nextStop = displayRoute.stops[walkStopIndex];
        if (nextStop && distanceMetres(next, nextStop.position) <= 45) {
          if (!seenWalkStopsRef.current.has(nextStop.id)) {
            seenWalkStopsRef.current.add(nextStop.id);
            const stopHasHistory = HISTORY_SITES.some((site) => (
              distanceMetres(site.position, nextStop.position) <= 150
            ));
            if (!nearbyHistorySite && !stopHasHistory) {
              setWalkHistoryMoment({
                siteName: nextStop.name,
                fact: nextStop.reason,
              });
            }
          }
          setExploredIds(markExplored(nextStop.id));
          setWalkStopIndex((current) => Math.min(displayRoute.stops.length, current + 1));
        }
      },
      () => setWalkLocationStatus("unavailable"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [walkingActive, displayRoute.stops, walkStopIndex]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/popularity", { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ places?: PopularPlace[] }> : { places: [] })
      .then((data) => setPopularPlaces(data.places ?? []))
      .catch(() => undefined);
    return () => controller.abort();
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
    const primaryWaypoints: LatLng[] = [
      planned.start.position,
      ...planned.stops.map((stop) => stop.position),
    ];
    // Direct quest/destination paths are start → destination (not a closed loop).
    const isDirect = Boolean(activePlan?.focusPlaceId || activePlan?.focusDestination);
    if (!isDirect) {
      primaryWaypoints.push(planned.start.position);
    }

    const optionalStops = planned.optionalStops ?? [];
    const optionalWaypoints: LatLng[] | null = optionalStops.length > 0
      ? [
          planned.start.position,
          ...optionalStops.map((stop) => stop.position),
          ...(planned.stops[0] ? [planned.stops[0].position] : []),
          planned.start.position,
        ]
      : null;

    let cancelled = false;
    setReadyRouteKey(null);
    void Promise.all([
      resolveLoopGeometry(primaryWaypoints),
      optionalWaypoints ? resolveLoopGeometry(optionalWaypoints) : Promise.resolve(null),
    ]).then(([primary, optional]) => {
      if (cancelled) return;
      if (primary.source === "openrouteservice" || optional?.source === "openrouteservice") {
        setOrsOverride({
          key: loopKey,
          geometry: primary.source === "openrouteservice" ? primary.geometry : planned.geometry,
          optionalGeometry: optional?.source === "openrouteservice"
            ? optional.geometry
            : planned.optionalGeometry,
          optionalDistanceKm: optional?.distanceKm ?? planned.optionalDistanceKm,
          optionalWalkingMinutes: optional?.walkingMinutes ?? planned.optionalWalkingMinutes,
          distanceKm: primary.distanceKm,
          walkingMinutes: primary.walkingMinutes,
        });
      }
      setReadyRouteKey(loopKey);
    });
    return () => { cancelled = true; };
  }, [hasRoute, loopKey, planned.start.position, planned.stops, planned.optionalStops, planned.geometry, planned.optionalGeometry, activePlan?.focusPlaceId, activePlan?.focusDestination]);

  useEffect(() => {
    if (!plannerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlannerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [plannerOpen]);

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
    setQuestsOpen(false);
    setSelectedQuestId(null);
    setLeaderboardOpen(false);
  }, []);

  /** Drop a planned route that was never started as a walk. */
  const clearUnusedRoute = useCallback(() => {
    setWanderSheetOpen(false);
    setActivePlan(null);
    setOrsOverride(null);
    setHeatEscapeOpen(false);
  }, []);

  const openSavedScreen = useCallback((note?: string | null) => {
    setSaveNote(note ?? null);
    closeOverlayScreens();
    clearUnusedRoute();
    setSavedOpen(true);
    setHomeTab("saved");
    setPlannerOpen(false);
    setFogActive(false);
  }, [clearUnusedRoute, closeOverlayScreens]);

  const openExploreScreen = useCallback(() => {
    closeOverlayScreens();
    clearUnusedRoute();
    setExploreOpen(true);
    setHomeTab("explore");
    setPlannerOpen(false);
    setFogActive(false);
  }, [clearUnusedRoute, closeOverlayScreens]);

  const openMemoriesScreen = useCallback(() => {
    closeOverlayScreens();
    clearUnusedRoute();
    setMemoriesOpen(true);
    setHomeTab("memories");
    setPlannerOpen(false);
    setFogActive(false);
  }, [clearUnusedRoute, closeOverlayScreens]);

  const openFriendsScreen = useCallback(() => {
    closeOverlayScreens();
    clearUnusedRoute();
    setFriendsFogView(false);
    setFriendsOpen(true);
    setHomeTab("friends");
    setPlannerOpen(false);
    setFogActive(false);
  }, [clearUnusedRoute, closeOverlayScreens]);

  const openFriendsFog = useCallback(() => {
    closeOverlayScreens();
    clearUnusedRoute();
    setFriendsFogView(true);
    setFogActive(true);
    setWalkingActive(false);
    setPlannerOpen(false);
    setHomeTab("friends");
  }, [clearUnusedRoute, closeOverlayScreens]);

  const closeFriendsFog = useCallback(() => {
    setFriendsFogView(false);
    setFogActive(false);
    setFriendsOpen(true);
    setHomeTab("friends");
  }, []);

  const openQuestsScreen = useCallback(() => {
    if (questsOpen) {
      setQuestsOpen(false);
      setSelectedQuestId(null);
      return;
    }
    closeOverlayScreens();
    clearUnusedRoute();
    setQuestsOpen(true);
    setSelectedQuestId(null);
    setPlannerOpen(false);
    setFogActive(false);
    setWalkingActive(false);
    setHomeTab("map");
  }, [clearUnusedRoute, closeOverlayScreens, questsOpen]);

  const openLeaderboardScreen = useCallback(() => {
    closeOverlayScreens();
    clearUnusedRoute();
    setLeaderboardOpen(true);
    setPlannerOpen(false);
    setFogActive(false);
    setWalkingActive(false);
  }, [clearUnusedRoute, closeOverlayScreens]);

  const planScenicToDestination = useCallback((
    destination: { label: string; position: LatLng },
    origin: { label: string; position: LatLng },
  ) => {
    const metres = distanceMetres(origin.position, destination.position);
    const minutes = Math.max(20, Math.min(90, Math.ceil((metres / 1000 / 4.8) * 60) * 2 + 18));
    applyStart(origin, { fromUser: true });
    setFromQuery(origin.label);
    setDestinationQuery(destination.label);
    setPendingDestination(null);
    setSearchFromOpen(false);
    applyPlan({
      mode: "discover",
      minutes,
      interests: selected.length ? selected : ["art", "photo", "green"],
      start: origin.position,
      startName: origin.label,
      preferUnexplored,
      focusDestination: { name: destination.label, position: destination.position },
    });
  }, [applyPlan, applyStart, preferUnexplored, selected]);

  const selectSearchDestination = useCallback((destination: { label: string; position: LatLng }) => {
    setDestinationQuery(destination.label);
    setPendingDestination(destination);
    setSearchFromOpen(true);
    setQuestsOpen(false);
    setSelectedQuestId(null);
    clearUnusedRoute();
  }, [clearUnusedRoute]);

  const selectSearchFrom = useCallback((origin: { label: string; position: LatLng }) => {
    applyStart(origin, { fromUser: true });
    setFromQuery(origin.label);
    if (pendingDestination) {
      planScenicToDestination(pendingDestination, origin);
    }
  }, [applyStart, pendingDestination, planScenicToDestination]);

  const useMyLocationForSearch = useCallback(() => {
    setSearchFromOpen(true);
    if (!navigator.geolocation) {
      setLocationStatus("idle");
      const origin = { label: "Victoria Square", position: START.position };
      clearToVictoriaSquare(true);
      setFromQuery(origin.label);
      if (pendingDestination) planScenicToDestination(pendingDestination, origin);
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: LatLng = [position.coords.latitude, position.coords.longitude];
        setLocationStatus("located");
        const origin = { label: "Your location", position: next };
        if (pendingDestination) {
          planScenicToDestination(pendingDestination, origin);
        } else {
          applyStart(origin, { fromUser: true });
          setFromQuery(origin.label);
        }
      },
      () => {
        setLocationStatus("idle");
        const origin = { label: "Victoria Square", position: START.position };
        clearToVictoriaSquare(true);
        setFromQuery(origin.label);
        if (pendingDestination) planScenicToDestination(pendingDestination, origin);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }, [applyStart, clearToVictoriaSquare, pendingDestination, planScenicToDestination]);

  const goToDailyQuest = useCallback((quest: DailyQuest) => {
    setQuestsOpen(false);
    setSelectedQuestId(null);
    setFriendsFogView(false);
    setFogActive(false);
    setHomeTab("map");
    setGenerating(true);

    const launch = (position: LatLng, label: string) => {
      applyStart({ label, position }, { fromUser: true });
      const metres = distanceMetres(position, quest.place.position);
      const minutes = Math.max(15, Math.min(90, Math.ceil((metres / 1000 / 4.8) * 60) * 2 + 10));
      applyPlan({
        mode: "discover",
        minutes,
        interests: [quest.place.category],
        start: position,
        startName: label,
        preferUnexplored,
        focusPlaceId: quest.place.id,
      });
    };

    if (start) {
      launch(start, startName?.trim() || "Your location");
      return;
    }

    if (!navigator.geolocation) {
      launch(START.position, "Victoria Square");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: LatLng = [position.coords.latitude, position.coords.longitude];
        setLocationStatus("located");
        launch(next, "Your location");
      },
      () => {
        setLocationStatus("idle");
        launch(START.position, "Victoria Square");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }, [applyPlan, applyStart, preferUnexplored, start, startName]);

  const heatMapHidden = questsOpen
    || plannerOpen
    || searchFromOpen
    || destinationQuery.trim().length > 0
    || hasRoute
    || walkingActive;

  const [questDateKey, setQuestDateKey] = useState(() => localDateKey());
  useEffect(() => {
    const refreshDate = () => setQuestDateKey((current) => {
      const next = localDateKey();
      return current === next ? current : next;
    });
    const timer = window.setInterval(refreshDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const todaysQuests = useMemo(() => dailyQuests(), [questDateKey]);
  const [hasUnfinishedQuests, setHasUnfinishedQuests] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const profile = readGamificationProfile();
      setHasUnfinishedQuests(todaysQuests.some((quest) => !isQuestCompleted(quest.id, profile)));
    });
    return () => cancelAnimationFrame(frame);
  }, [todaysQuests, questsOpen, _questPointsTick]);
  const questPins = !questsOpen ? [] : (() => {
    const profile = readGamificationProfile();
    return todaysQuests.map((quest, index) => ({
      id: quest.id,
      position: quest.place.position,
      number: index + 1,
      done: isQuestCompleted(quest.id, profile),
    }));
  })();

  useEffect(() => {
    if (!questsOpen) return;
    const update = () => setQuestPointsTick((tick) => tick + 1);
    window.addEventListener("wander:points", update);
    return () => window.removeEventListener("wander:points", update);
  }, [questsOpen]);

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
      suggestionId: suggestion.id,
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
      geometry: displayRoute.geometry.filter((_, index) => index % Math.max(1, Math.ceil(displayRoute.geometry.length / 64)) === 0),
      startName: activePlan.startName,
      stopNames: displayRoute.stops.map((stop) => stop.name),
      walkingMinutes: displayRoute.walkingMinutes,
      distanceKm: displayRoute.distanceKm,
      title: displayRoute.title,
    });
    setSavedTrials(next);
    const localTrial = next[0];
    if (localTrial) {
      void syncSavedTrial(localTrial).then((cloudTrial) => {
        if (!cloudTrial) return;
        setSavedTrials((current) => [cloudTrial, ...current.filter((trial) => trial.id !== localTrial.id)]);
      });
    }
    openSavedScreen(null);
  }, [activePlan, displayRoute.distanceKm, displayRoute.geometry, displayRoute.stops, displayRoute.title, displayRoute.walkingMinutes, hasRoute, openSavedScreen]);

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
    questsOpen ? "quests-open" : "",
  ].filter(Boolean).join(" ");

  const friendsFogPercent = Math.min(
    100,
    Math.round(Math.max(explorationPercent, 0) + 18 + 9 + Math.min(explorationPercent, 12)),
  );
  const fogPercentLabel = friendsFogView ? friendsFogPercent : explorationPercent;

  const showMapChrome = !plannerOpen && !wanderSheetOpen && !walkingActive && !savedOpen && !exploreOpen && !memoriesOpen && !friendsOpen && !leaderboardOpen && !friendsFogView;
  const showHomeDock = !plannerOpen && !wanderSheetOpen && !walkingActive && !leaderboardOpen && !friendsFogView;
  const tabScreenOpen = savedOpen || exploreOpen || memoriesOpen || friendsOpen || leaderboardOpen;

  function toggleFog() {
    if (fogActive) {
      setFogActive(false);
      setFriendsFogView(false);
      setHomeTab("map");
      return;
    }
    setFriendsFogView(false);
    setFogActive(true);
    setWalkingActive(false);
    setHomeTab("map");
    closeOverlayScreens();
    clearUnusedRoute();
    setPlannerOpen(false);
  }

  function openPlanner() {
    setPlannerOpen(true);
    setWalkingActive(false);
    closeOverlayScreens();
    clearUnusedRoute();
    setHomeTab("map");
  }

  function closePlanner() {
    setPlannerOpen(false);
  }

  function closeWanderSheet() {
    clearUnusedRoute();
  }

  function startWalk() {
    setWalkHistoryMoment(null);
    setHistoryLayer(true);
    setWalkLocationStatus(navigator.geolocation ? "locating" : "unavailable");
    setWanderSheetOpen(false);
    setWalkingActive(true);
    if (!walkId || !activePlan || walkPlan !== activePlan) {
      setWalkId(createId("walk"));
      setWalkPlan(activePlan);
      setWalkMemorySaved(false);
      walkStartedAtRef.current = new Date().toISOString();
      walkCapturesRef.current = [];
      seenWalkHistorySitesRef.current = new Set();
      seenWalkStopsRef.current = new Set();
    }
    setWalkStopIndex(0);
    setWalkPosition(null);
    setFogActive(false);
    closeOverlayScreens();
    setPlannerOpen(false);
    setHomeTab("map");
  }

  function exitWalk() {
    setWalkingActive(false);
    setWalkHistoryMoment(null);
    setWalkStopIndex(0);
    setWalkPosition(null);
    setWanderSheetOpen(true);
  }

  function finishWalk() {
    // One award per walk: the walk id is the points event key, so repeats are ignored.
    if (walkId) completeWalk(`walk:${walkId}`, displayRoute.walkingMinutes, walkMemorySaved);
    if (walkStartedAtRef.current) {
      recordWalkHistory({
        startedAt: walkStartedAtRef.current,
        mode: activePlan?.mode ?? mode,
        title: displayRoute.title,
        startName: activePlan?.startName ?? startName,
        start: activePlan?.start ?? start,
        stopNames: displayRoute.stops.map((stop) => stop.name),
        walkingMinutes: displayRoute.walkingMinutes,
        distanceKm: displayRoute.distanceKm,
        captures: walkCapturesRef.current,
      });
      walkStartedAtRef.current = null;
      walkCapturesRef.current = [];
    }
    setWalkingActive(false);
    setWalkHistoryMoment(null);
    setWalkId(null);
    setWalkPlan(null);
    setWalkStopIndex(0);
    setWalkPosition(null);
    clearUnusedRoute();
    setCelebratingFinish(true);
    window.setTimeout(() => setCelebratingFinish(false), 1800);
  }

  // Must run inside the button's click so mobile browsers allow the camera to open.
  function openMemoryCamera() {
    const input = memoryInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  function captureWalkMoment() {
    if (walkMemorySaved || !walkId) return;
    if (!hasSeenMemoryRule()) {
      setMemoryStep("intro");
      return;
    }
    openMemoryCamera();
  }

  function closeMemoryDialog() {
    if (memorySaving) return;
    if (memoryPhoto) URL.revokeObjectURL(memoryPhoto.url);
    setMemoryPhoto(null);
    setMemoryError(null);
    setMemoryStep(null);
  }

  function handleMemoryPhoto(file: File | undefined) {
    if (!file) return;
    if (memoryPhoto) URL.revokeObjectURL(memoryPhoto.url);
    setMemoryPhoto({ file, url: URL.createObjectURL(file) });
    setMemoryError(null);
    setMemoryStep("preview");
  }

  async function keepWalkMemory() {
    if (!walkId || !memoryPhoto || memorySaving) return;
    setMemorySaving(true);
    setMemoryError(null);
    const stop = displayRoute.stops[Math.min(walkStopIndex, Math.max(displayRoute.stops.length - 1, 0))];
    const details = { walkId, routeTitle: displayRoute.title, stopId: stop?.id, stopName: stop?.name, photo: memoryPhoto.file };
    // Check local storage first so a walk that already has a memory never uploads another.
    if (await getMemoryForWalk(walkId)) {
      setMemorySaving(false);
      setWalkMemorySaved(true);
      setMemoryError(ALREADY_SAVED_MESSAGE);
      return;
    }
    // When Supabase is configured, its unique (user_id, walk_id) constraint is the final word.
    const cloud = await syncWalkMemory(details).catch(() => "error" as const);
    if (cloud === "duplicate") {
      setMemorySaving(false);
      setWalkMemorySaved(true);
      setMemoryError("This walk already has a memory saved to your account. One memory per walk, so make it count.");
      return;
    }
    const result = await saveWalkMemory(details);
    setMemorySaving(false);
    if (!result.ok) {
      if (result.reason === "already-saved") setWalkMemorySaved(true);
      setMemoryError(result.message);
      return;
    }
    if (stop) {
      handleExploreStop(stop.id);
      walkCapturesRef.current = [...walkCapturesRef.current, { stopName: stop.name, capturedAt: new Date().toISOString() }];
    }
    setWalkMemorySaved(true);
    URL.revokeObjectURL(memoryPhoto.url);
    setMemoryPhoto(null);
    setMemoryStep(null);
  }

  function goHomeTab(tab: typeof homeTab) {
    setHomeTab(tab);
    if (tab === "map") {
      setFogActive(false);
      setFriendsFogView(false);
      closeOverlayScreens();
      setPlannerOpen(false);
      setWalkingActive(false);
      clearUnusedRoute();
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
      clearUnusedRoute();
      setSavedOpen(true);
      setPlannerOpen(false);
      setSaveNote(null);
      return;
    }
    if (tab === "friends") {
      openFriendsScreen();
      return;
    }
    setFogActive(false);
    closeOverlayScreens();
    clearUnusedRoute();
  }

  return (
    <main className={shellClass}>
      {celebratingFinish && (
        <div className="finish-confetti" aria-hidden="true">
          {Array.from({ length: 48 }, (_, index) => (
            <i
              key={index}
              className={index % 3 === 0 ? "is-round" : index % 3 === 1 ? "is-strip" : "is-square"}
              style={{ "--confetti-index": index } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      <WanderMap
        mode={displayMode}
        route={route}
        exploredIds={exploredIds}
        exploredTrail={exploredTrail}
        fogActive={fogActive}
        historyLayer={historyLayer}
        showRoute={hasRoute && readyRouteKey === loopKey}
        walkMode={walkingActive}
        walkStopIndex={walkStopIndex}
        walkPosition={walkPosition}
        questPins={questPins}
        selectedQuestId={selectedQuestId}
        optionalRouteActive={optionalRouteActive}
        onSelectQuest={setSelectedQuestId}
        onExploreStop={handleExploreStop}
        onSelectOptionalStop={() => setOptionalRouteActive((current) => !current)}
        onExplorationPercent={setExplorationPercent}
        onMapReady={handleMapReady}
        popularPlaces={heatMapHidden ? [] : popularPlaces}
      />
      {streetViewPosition && (
        <StreetViewDialog
          name="Street View preview"
          position={streetViewPosition}
          onClose={() => setStreetViewPosition(null)}
        />
      )}

      {showMapChrome && (
        <>
          <header className="home-top">
            <button
              type="button"
              className="home-profile"
              aria-label="Open profile"
              onClick={() => {
                setQuestsOpen(false);
                setSelectedQuestId(null);
              }}
            >
              <span aria-hidden="true">AS</span>
            </button>
            <div className="home-search">
              <StartSearch
                variant="home"
                placeholder="Search a place to wander to"
                ariaLabel="Search destination"
                value={destinationQuery}
                onQueryChange={(query) => {
                  setDestinationQuery(query);
                  setQuestsOpen(false);
                  setSelectedQuestId(null);
                  if (!query.trim()) setSearchFromOpen(false);
                }}
                onSelect={selectSearchDestination}
                onUseMyLocation={useMyLocationForSearch}
                locating={locationStatus === "locating"}
                statusNote={null}
                fromValue={fromQuery}
                onFromQueryChange={(query) => {
                  setFromQuery(query);
                  setQuestsOpen(false);
                  setSelectedQuestId(null);
                }}
                onFromSelect={selectSearchFrom}
                fromExpanded={searchFromOpen}
                onFromExpandedChange={(expanded) => {
                  setSearchFromOpen(expanded);
                  if (expanded) {
                    setQuestsOpen(false);
                    setSelectedQuestId(null);
                  }
                }}
                onClearDestination={() => {
                  setDestinationQuery("");
                  setPendingDestination(null);
                  clearUnusedRoute();
                  setSearchFromOpen(false);
                  setQuestsOpen(false);
                  setSelectedQuestId(null);
                }}
              />
            </div>
          </header>

          <aside className="home-rail" aria-label="Map controls">
            <button
              type="button"
              className={`home-rail-chip${historyLayer ? " is-on" : ""}`}
              aria-pressed={historyLayer}
              aria-label={historyLayer ? "Turn history layer off" : "Turn history layer on"}
              onClick={() => setHistoryLayer((current) => !current)}
            >
              <BookOpen size={18} strokeWidth={2.2} />
              <span>History</span>
            </button>
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
            <div className={`home-rail-quests${questsOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className={`home-rail-chip${questsOpen ? " is-on" : ""}`}
                aria-pressed={questsOpen}
                aria-label={questsOpen
                  ? "Close daily quests"
                  : hasUnfinishedQuests ? "Open daily quests, some unfinished" : "Open daily quests"}
                onClick={openQuestsScreen}
              >
                {hasUnfinishedQuests && <span className="quests-alert" aria-hidden="true">!</span>}
                <MapPinned size={18} strokeWidth={2.2} />
                <span>Quests</span>
              </button>
            </div>
            <button
              type="button"
              className={`home-rail-chip${leaderboardOpen ? " is-on" : ""}`}
              aria-pressed={leaderboardOpen}
              aria-label="Open points leaderboard"
              onClick={openLeaderboardScreen}
            >
              <Trophy size={18} strokeWidth={2.2} />
              <span>Board</span>
            </button>
          </aside>

          <div className="home-explore-pill">
            <StreetViewBuddy onDrop={dropStreetViewBuddy} />
            <span className="home-explore-dot" aria-hidden="true" />
            <span aria-live="polite">{explorationPercent.toFixed(0)}% explored</span>
          </div>
        </>
      )}

      {friendsFogView && (
        <>
          <button
            type="button"
            className="friends-fog-close"
            aria-label="Close friends fog"
            onClick={closeFriendsFog}
          >
            <X size={18} strokeWidth={2.4} />
          </button>
          <div className="home-explore-pill friends-fog-pill" aria-live="polite">
            <span className="home-explore-dot" aria-hidden="true" />
            <span>{fogPercentLabel.toFixed(0)}% friends fog</span>
          </div>
        </>
      )}

      {showHomeDock && (
        <div className={`home-dock${tabScreenOpen ? " is-saved" : ""}`}>
          {!tabScreenOpen && !questsOpen && (
            <button className={`start-wander${displayMode === "heat" ? " is-heat" : ""}`} type="button" onClick={openPlanner}>
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
        <FriendsScreen
          friendsFogPercent={friendsFogPercent}
          onOpenFriendsFog={openFriendsFog}
        />
      )}

      {questsOpen && !fogActive && (
        <DailyQuestsScreen
          selectedQuestId={selectedQuestId}
          onSelectQuest={setSelectedQuestId}
          onGoToQuest={goToDailyQuest}
          onClose={() => {
            setQuestsOpen(false);
            setSelectedQuestId(null);
          }}
        />
      )}

      {leaderboardOpen && !fogActive && (
        <LeaderboardScreen onClose={() => setLeaderboardOpen(false)} />
      )}

      {savedOpen && !fogActive && (
        <SavedScreen
          trials={savedTrials}
          note={saveNote}
          onOpenTrial={restoreTrial}
          onRemoveTrial={(id) => {
            deleteSavedTrial(id);
            setSavedTrials((current) => current.filter((trial) => trial.id !== id));
            void removeCloudTrial(id);
          }}
        />
      )}

      {plannerOpen && (
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
            <button type="button" className="planner-popup-close" aria-label="Close planner" onClick={closePlanner}>
              <X size={24} strokeWidth={2.4} />
            </button>
            <div className="planner-popup-stack">
              <section className={`planner${mode === "heat" ? " is-heat" : ""}`} aria-label="Wander planner">
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

                {plannerNotice && <p className="planner-notice" role="alert">{plannerNotice}</p>}
                <button className={`generate${mode === "heat" ? " is-heat" : ""}`} type="button" disabled={generating || totalMinutes < 1} onClick={() => applyPlan()}>
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
            route={displayRoute}
            remixLeft={remixLeft}
            onRemix={remixWander}
            onStartWalk={startWalk}
            onSave={handleSaveTrial}
            onClose={closeWanderSheet}
            onDropBuddy={dropStreetViewBuddy}
          />
        </>
      )}

      {remixPaywallOpen && (
        <div className="remix-paywall-backdrop" role="dialog" aria-modal="true" aria-labelledby="remix-paywall-title">
          <button
            type="button"
            className="remix-paywall-scrim"
            aria-label="Dismiss"
            onClick={() => {
              setRemixPaywallOpen(false);
              showRemixFeedback("angry");
            }}
          />
          <div className="remix-paywall-card">
            <h2 id="remix-paywall-title">Out of remixes!!</h2>
            <p>
              You’ve used your {REMIX_FREE_TRIES} free remixes this week.
              Unlock {REMIX_PACK_TRIES} more for ${REMIX_PACK_PRICE}.
            </p>
            <div className="remix-paywall-actions">
              <button
                type="button"
                className="remix-paywall-cancel"
                onClick={() => {
                  setRemixPaywallOpen(false);
                  showRemixFeedback("angry");
                }}
              >
                Not now
              </button>
              <button
                type="button"
                className="remix-paywall-buy"
                onClick={() => {
                  setRemixTries(purchaseRemixPack());
                  setRemixPaywallOpen(false);
                  showRemixFeedback("thanks");
                }}
              >
                Pay ${REMIX_PACK_PRICE}
                <span className="remix-paywall-pls" aria-hidden="true">(pls)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {remixFeedback === "thanks" && (
        <div className="remix-thanks" role="status" aria-live="polite">
          <span className="remix-thanks-face" aria-hidden="true">
            <span className="remix-thanks-heart remix-thanks-heart-a" />
            <span className="remix-thanks-heart remix-thanks-heart-b" />
            <span className="remix-thanks-kiss" />
          </span>
          <span>Thank you for paying</span>
        </div>
      )}

      {remixFeedback === "angry" && (
        <div className="remix-angry" role="status" aria-live="polite">
          <span className="remix-angry-face" aria-hidden="true">
            <span className="remix-angry-steam remix-angry-steam-l" />
            <span className="remix-angry-steam remix-angry-steam-r" />
            <Angry size={26} strokeWidth={2.6} />
          </span>
          <span>Fine. No remix for you.</span>
        </div>
      )}

      {walkingActive && hasRoute && (
        <WalkModeChrome
          route={displayRoute}
          reviewTrailId={activePlan?.suggestionId ?? `route:${displayRoute.title}:${displayRoute.stops.map((stop) => stop.id).join("-")}`}
          currentStopIndex={walkStopIndex}
          locationStatus={walkLocationStatus}
          historyMoment={walkHistoryMoment}
          onBack={exitWalk}
          onFinish={finishWalk}
          onCapture={captureWalkMoment}
          memorySaved={walkMemorySaved}
          onDismissHistoryMoment={dismissWalkHistoryMoment}
          onAnotherFact={showAnotherWalkFact}
          onSubmitReview={(trailId, rating, comment) => addTrailReview({
            trailId,
            rating,
            comment,
          })}
          onAdvance={() => {
            const stop = displayRoute.stops[walkStopIndex];
            if (stop) handleExploreStop(stop.id);
            setWalkStopIndex((current) => Math.min(displayRoute.stops.length, current + 1));
          }}
        />
      )}

      {walkingActive && hasRoute && (
        <input
          ref={memoryInputRef}
          className="walk-memory-input"
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => handleMemoryPhoto(event.target.files?.[0])}
        />
      )}

      {memoryStep && (
        <WalkMemoryDialog
          step={memoryStep}
          previewUrl={memoryPhoto?.url ?? null}
          saving={memorySaving}
          error={memoryError}
          onOpenCamera={() => {
            markMemoryRuleSeen();
            setMemoryStep(null);
            openMemoryCamera();
          }}
          onRetake={openMemoryCamera}
          onKeep={() => void keepWalkMemory()}
          onClose={closeMemoryDialog}
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
          </dialog>
        </div>
      )}
    </main>
  );
}
