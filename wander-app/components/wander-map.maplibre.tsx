"use client";

/**
 * Optional MapLibre + OpenFreeMap Liberty branch.
 * Not imported by the live app. Leaflet + OSM tiles in wander-map.tsx are the release basemap
 * until this renders reliably under vinext/Vite (worker/tiles).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSONSource,
  Map as MapLibreMap,
  Popup,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import { POI_DATA_TIMESTAMP } from "@/lib/adelaide-data";
import {
  estimateViewportExplorationPercent,
  exploredPositionsFor,
  type MapBounds,
} from "@/lib/exploration";
import type { LatLng, WanderRoute } from "@/lib/route-planner";

const LIBERTY_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ADELAIDE_FALLBACK: LatLng = [-34.92852, 138.60075];

type Clearing = { id: string; x: number; y: number; r: number };

function toLngLat(position: LatLng): [number, number] {
  return [position[1], position[0]];
}

function lineFeature(geometry: LatLng[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: geometry.map(toLngLat),
    },
  };
}

function stopsCollection(
  start: WanderRoute["start"],
  stops: WanderRoute["stops"],
  explored: Set<string>,
  colour: string,
) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {
          id: start.id,
          name: start.name,
          body: start.reason,
          explored: explored.has(start.id),
          kind: "start",
          colour,
        },
        geometry: { type: "Point" as const, coordinates: toLngLat(start.position) },
      },
      ...stops.map((stop) => ({
        type: "Feature" as const,
        properties: {
          id: stop.id,
          name: stop.name,
          body: `${stop.why}\n${explored.has(stop.id) ? "Explored — fog cleared here." : "Tap to mark explored."}`,
          explored: explored.has(stop.id),
          kind: "stop",
          colour,
        },
        geometry: { type: "Point" as const, coordinates: toLngLat(stop.position) },
      })),
    ],
  };
}

function projectClearings(
  map: MapLibreMap,
  positions: Array<{ id: string; position: LatLng }>,
): Clearing[] {
  const canvas = map.getCanvas();
  const radius = Math.max(42, Math.min(canvas.clientWidth, canvas.clientHeight) * 0.11);
  return positions.map(({ id, position }) => {
    const point = map.project(toLngLat(position));
    return { id, x: point.x, y: point.y, r: radius };
  });
}

function boundsFromMap(map: MapLibreMap): MapBounds {
  const b = map.getBounds();
  return {
    south: b.getSouth(),
    west: b.getWest(),
    north: b.getNorth(),
    east: b.getEast(),
  };
}

function ensureRouteLayers(map: MapLibreMap, colour: string, fogActive: boolean) {
  if (!map.getSource("wander-route")) {
    map.addSource("wander-route", { type: "geojson", data: lineFeature([]) });
    map.addLayer({
      id: "wander-route-outline",
      type: "line",
      source: "wander-route",
      paint: {
        "line-color": "#101412",
        "line-width": 10,
        "line-opacity": fogActive ? 0.45 : 0.78,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    map.addLayer({
      id: "wander-route-line",
      type: "line",
      source: "wander-route",
      paint: {
        "line-color": colour,
        "line-width": 6,
        "line-opacity": fogActive ? 0.55 : 1,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }
  if (!map.getSource("wander-stops")) {
    map.addSource("wander-stops", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "wander-stops-halo",
      type: "circle",
      source: "wander-stops",
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "start"], 11, 9],
        "circle-color": "#151816",
      },
    });
    map.addLayer({
      id: "wander-stops-fill",
      type: "circle",
      source: "wander-stops",
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "kind"], "start"],
          8,
          ["case", ["get", "explored"], 7.5, 6.5],
        ],
        "circle-color": [
          "case",
          ["get", "explored"],
          "#f7f3ea",
          ["get", "colour"],
        ],
      },
    });
  }

  map.setPaintProperty("wander-route-outline", "line-opacity", fogActive ? 0.45 : 0.78);
  map.setPaintProperty("wander-route-line", "line-color", colour);
  map.setPaintProperty("wander-route-line", "line-opacity", fogActive ? 0.55 : 1);
}

export default function WanderMap({
  mode,
  route,
  exploredIds,
  fogActive,
  onExploreStop,
  onExplorationPercent,
}: {
  mode: "discover" | "heat";
  route: WanderRoute;
  exploredIds: string[];
  fogActive: boolean;
  onExploreStop: (id: string) => void;
  onExplorationPercent: (percent: number) => void;
}) {
  const colour = mode === "discover" ? "#d8ff64" : "#ffb75e";
  const start = route.start;
  const explored = useMemo(() => new Set(exploredIds), [exploredIds]);
  const exploredPositions = useMemo(() => exploredPositionsFor(exploredIds), [exploredIds]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const onExploreStopRef = useRef(onExploreStop);
  const onExplorationPercentRef = useRef(onExplorationPercent);
  const fogActiveRef = useRef(fogActive);
  const exploredPositionsRef = useRef(exploredPositions);
  const colourRef = useRef(colour);
  const [clearings, setClearings] = useState<Clearing[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onExploreStopRef.current = onExploreStop;
    onExplorationPercentRef.current = onExplorationPercent;
    fogActiveRef.current = fogActive;
    exploredPositionsRef.current = exploredPositions;
    colourRef.current = colour;
  }, [onExploreStop, onExplorationPercent, fogActive, exploredPositions, colour]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: LIBERTY_STYLE,
      center: toLngLat(ADELAIDE_FALLBACK),
      zoom: 15,
      attributionControl: {
        compact: true,
        customAttribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
      },
    });
    mapRef.current = map;
    popupRef.current = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "260px",
      offset: 14,
    });

    const syncFog = () => {
      const positions = exploredPositionsRef.current;
      setClearings(projectClearings(map, positions));
      if (fogActiveRef.current) {
        onExplorationPercentRef.current(estimateViewportExplorationPercent(boundsFromMap(map), positions));
      }
    };

    const onLoad = () => {
      ensureRouteLayers(map, colourRef.current, fogActiveRef.current);
      setMapReady(true);
      requestAnimationFrame(syncFog);
    };

    const onStopClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const id = String(feature.properties?.id ?? "");
      const name = String(feature.properties?.name ?? "");
      const body = String(feature.properties?.body ?? "");
      if (id) onExploreStopRef.current(id);
      popupRef.current
        ?.setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(`<strong>${name}</strong><br/>${body.replaceAll("\n", "<br/>")}`)
        .addTo(map);
    };

    map.on("load", onLoad);
    map.on("move", syncFog);
    map.on("zoom", syncFog);
    map.on("resize", syncFog);
    map.on("click", "wander-stops-fill", onStopClick);
    map.on("mouseenter", "wander-stops-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "wander-stops-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.off("load", onLoad);
      map.off("move", syncFog);
      map.off("zoom", syncFog);
      map.off("resize", syncFog);
      map.off("click", "wander-stops-fill", onStopClick);
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    ensureRouteLayers(map, colour, fogActive);
    const routeSource = map.getSource("wander-route") as GeoJSONSource | undefined;
    const stopsSource = map.getSource("wander-stops") as GeoJSONSource | undefined;
    void routeSource?.setData(lineFeature(route.geometry));
    void stopsSource?.setData(stopsCollection(start, route.stops, explored, colour));
  }, [mapReady, colour, fogActive, route.geometry, route.stops, start, explored]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ center: toLngLat(start.position), duration: 650 });
  }, [mapReady, start.position]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const frame = requestAnimationFrame(() => {
      setClearings(projectClearings(map, exploredPositions));
      if (fogActive) {
        onExplorationPercent(estimateViewportExplorationPercent(boundsFromMap(map), exploredPositions));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mapReady, fogActive, exploredPositions, onExplorationPercent]);

  return (
    <div className={`map-stage${fogActive ? " fog-active" : ""}`} aria-label="Interactive map of central Adelaide">
      <div ref={containerRef} className="wander-map" />
      {fogActive && (
        <svg className="fog-layer" aria-hidden="true">
          <defs>
            <filter id="wander-fog-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
            </filter>
            <mask id="wander-fog-mask">
              <rect width="100%" height="100%" fill="white" />
              <g filter="url(#wander-fog-soft)">
                {clearings.map((clearing) => (
                  <g key={clearing.id}>
                    <circle cx={clearing.x} cy={clearing.y} r={clearing.r * 1.15} fill="black" opacity="0.85" />
                    <circle cx={clearing.x} cy={clearing.y} r={clearing.r * 0.72} fill="black" />
                  </g>
                ))}
              </g>
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(58, 92, 48, 0.62)" mask="url(#wander-fog-mask)" />
          <rect width="100%" height="100%" fill="rgba(216, 255, 100, 0.22)" mask="url(#wander-fog-mask)" />
        </svg>
      )}
      <div className="map-caption">
        Adelaide CBD · POIs cached {POI_DATA_TIMESTAMP}
        {route.geometrySource === "openrouteservice" ? " · walking geometry" : " · grid geometry"}
      </div>
    </div>
  );
}
