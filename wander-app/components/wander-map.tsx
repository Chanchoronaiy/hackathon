"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Pane, Polyline, Popup, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { POI_DATA_TIMESTAMP } from "@/lib/adelaide-data";
import { HISTORY_SITES } from "@/lib/history-sites";
import {
  EXPLORATION_RADIUS_M,
  estimateViewportExplorationPercent,
  exploredPositionsFor,
  type MapBounds,
} from "@/lib/exploration";
import type { LatLng, WanderRoute } from "@/lib/route-planner";
import { popularityScore, type PopularPlace } from "@/lib/popularity";

type Clearing = { id: string; x: number; y: number; r: number };

// Coolest (deep shade) → hottest (full sun).
const HEAT_COLOURS = ["#b8b3d9", "#dcd9ee", "#fffceb", "#ffe08a", "#f6b48f", "#d97c7c"];
const HEAT_NEUTRAL = 2;

function heatGradient(score: number) {
  const level = Math.min(HEAT_COLOURS.length - 1, Math.max(0, Math.round(score * (HEAT_COLOURS.length - 1))));
  const step = level >= HEAT_NEUTRAL ? -1 : 1;
  const ramp: string[] = [];
  for (let index = level; index !== HEAT_NEUTRAL + step; index += step) ramp.push(HEAT_COLOURS[index]);
  if (ramp.length === 1) ramp.push(HEAT_COLOURS[HEAT_NEUTRAL]);
  const alphas = ["f2", "c4", "8c", "5c"];
  const stops = ramp.map((colour, index) => {
    const at = Math.round((index / ramp.length) * 58);
    return `${colour}${alphas[Math.min(index, alphas.length - 1)]} ${at}%`;
  });
  return `radial-gradient(circle, ${stops.join(", ")}, ${ramp[ramp.length - 1]}00 70%)`;
}

function heatBlobIcon(score: number, index: number) {
  const size = Math.round(2 * (24 + score * 50));
  const gradient = heatGradient(score);
  return L.divIcon({
    className: `heat-blob heat-delay-${index % 6}`,
    html: `<span class="heat-blob-halo" style="background:${gradient}"></span><span class="heat-blob-core" style="background:${gradient}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function walkStopIcon(number: number, faded: boolean) {
  return L.divIcon({
    className: `walk-stop-marker${faded ? " is-faded" : ""}`,
    html: `<span>${number}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function questPinIcon(number: number, done: boolean, selected: boolean) {
  return L.divIcon({
    className: `quest-pin-marker${done ? " is-done" : ""}${selected ? " is-selected" : ""}`,
    html: `<span><b>${number}</b></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

function MapReady({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function CreamWash() {
  const map = useMap();
  useEffect(() => {
    const paneName = "wander-cream";
    if (!map.getPane(paneName)) {
      const pane = map.createPane(paneName);
      pane.style.zIndex = "250";
      pane.style.pointerEvents = "none";
    }
  }, [map]);

  return (
    <Rectangle
      bounds={[[-85, -180], [85, 180]]}
      pathOptions={{
        stroke: false,
        fillColor: "#fffdf2",
        fillOpacity: 0.22,
        interactive: false,
        pane: "wander-cream",
      }}
    />
  );
}

function Recenter({ position, zoom, animate = true }: { position: LatLng; zoom?: number; animate?: boolean }) {
  const map = useMap();
  const key = position.join(",");
  useEffect(() => {
    map.setView(position, zoom ?? map.getZoom(), { animate });
  }, [map, key, position, zoom, animate]);
  return null;
}

function FitRoute({ geometry, enabled }: { geometry: LatLng[]; enabled: boolean }) {
  const map = useMap();
  const key = geometry.map((point) => point.join(",")).join("|");
  useEffect(() => {
    if (!enabled || geometry.length < 2) return;
    map.fitBounds(geometry, { padding: [72, 72], maxZoom: 16, animate: true });
  }, [map, key, enabled, geometry]);
  return null;
}

function FitPositions({ positions, enabled }: { positions: LatLng[]; enabled: boolean }) {
  const map = useMap();
  const key = positions.map((point) => point.join(",")).join("|");
  useEffect(() => {
    if (!enabled || positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15, { animate: true });
      return;
    }
    map.fitBounds(positions, { padding: [80, 100], maxZoom: 15, animate: true });
  }, [map, key, enabled, positions]);
  return null;
}

function FitHistorySites({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    map.fitBounds(HISTORY_SITES.map((site) => site.position), {
      padding: [64, 64],
      maxZoom: 14,
      animate: true,
    });
  }, [enabled, map]);
  return null;
}

function projectClearings(
  map: ReturnType<typeof useMap>,
  positions: Array<{ id: string; position: LatLng }>,
): Clearing[] {
  return positions.map(({ id, position }) => {
    const point = map.latLngToContainerPoint(position);
    const radiusEdge = map.latLngToContainerPoint([
      position[0] + EXPLORATION_RADIUS_M / 111_000,
      position[1],
    ]);
    const radius = Math.max(2, Math.abs(point.y - radiusEdge.y));
    return { id, x: point.x, y: point.y, r: radius };
  });
}

function boundsFromMap(map: ReturnType<typeof useMap>): MapBounds {
  const b = map.getBounds();
  return {
    south: b.getSouth(),
    west: b.getWest(),
    north: b.getNorth(),
    east: b.getEast(),
  };
}

function FogSync({
  positions,
  onClearings,
  onPercent,
}: {
  positions: Array<{ id: string; position: LatLng }>;
  onClearings: (clearings: Clearing[]) => void;
  onPercent: (percent: number) => void;
}) {
  const map = useMap();
  const positionKey = positions.map((item) => `${item.id}:${item.position.join(",")}`).join("|");

  useMapEvents({
    moveend() {
      onClearings(projectClearings(map, positions));
      onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    },
    zoomend() {
      onClearings(projectClearings(map, positions));
      onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    },
    resize() {
      onClearings(projectClearings(map, positions));
      onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    },
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      onClearings(projectClearings(map, positions));
      onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    });
    return () => cancelAnimationFrame(frame);
  }, [map, onClearings, onPercent, positionKey, positions]);

  return null;
}

function StopMarker({
  stop,
  colour,
  explored,
  onExplore,
}: {
  stop: WanderRoute["stops"][number];
  colour: string;
  explored: boolean;
  onExplore: (id: string) => void;
}) {
  return (
    <CircleMarker
      center={stop.position}
      radius={explored ? 9 : 8}
      pathOptions={{
        color: "#0f1210",
        fillColor: explored ? "#fffdf2" : colour,
        fillOpacity: 1,
        weight: 3,
        opacity: 0.95,
      }}
      eventHandlers={{ click: () => onExplore(stop.id) }}
    >
      <Popup>
        <strong>{stop.name}</strong>
        <br />
        {stop.why}
        <br />
        <em>{explored ? "Explored — fog cleared here." : "Tap to mark explored."}</em>
      </Popup>
    </CircleMarker>
  );
}

export default function WanderMap({
  mode,
  route,
  exploredIds,
  exploredTrail,
  fogActive,
  historyLayer = false,
  showRoute,
  walkMode = false,
  walkStopIndex = 0,
  walkPosition,
  questPins = [],
  selectedQuestId = null,
  optionalRouteActive = false,
  onSelectQuest,
  onMapReady,
  popularPlaces = [],
  onExploreStop,
  onSelectOptionalStop,
  onExplorationPercent,
}: {
  mode: "discover" | "heat";
  route: WanderRoute;
  exploredIds: string[];
  exploredTrail: LatLng[];
  fogActive: boolean;
  historyLayer?: boolean;
  showRoute: boolean;
  walkMode?: boolean;
  walkStopIndex?: number;
  walkPosition?: LatLng | null;
  questPins?: Array<{ id: string; position: LatLng; number: number; done?: boolean }>;
  selectedQuestId?: string | null;
  optionalRouteActive?: boolean;
  onSelectQuest?: (id: string) => void;
  onMapReady?: (map: L.Map) => void;
  popularPlaces?: PopularPlace[];
  onExploreStop: (id: string) => void;
  onSelectOptionalStop?: (id: string) => void;
  onExplorationPercent: (percent: number) => void;
}) {
  const colour = walkMode ? "#d8a2a2" : mode === "discover" ? "#8ea66b" : "#ffe08a";
  const start = route.start;
  const explored = useMemo(() => new Set(exploredIds), [exploredIds]);
  const [clearings, setClearings] = useState<Clearing[]>([]);
  const exploredPositions = useMemo(() => [
    ...exploredPositionsFor(exploredIds),
    ...exploredTrail.map((position, index) => ({ id: `trail-${index}`, position })),
  ], [exploredIds, exploredTrail]);
  const questPositions = useMemo(() => questPins.map((pin) => pin.position), [questPins]);
  const walkStops = useMemo(
    () => (optionalRouteActive && route.optionalStops?.length
      ? [...route.optionalStops, ...route.stops]
      : route.stops),
    [optionalRouteActive, route.optionalStops, route.stops],
  );
  const walkGeometry = useMemo(
    () => (optionalRouteActive && route.optionalGeometry?.length
      ? route.optionalGeometry
      : route.geometry),
    [optionalRouteActive, route.optionalGeometry, route.geometry],
  );
  const youAreHere = useMemo(() => {
    if (walkMode && walkPosition) return walkPosition;
    if (!walkMode || walkGeometry.length === 0) return start.position;
    const idx = Math.min(
      walkGeometry.length - 1,
      Math.max(0, Math.floor((walkStopIndex / Math.max(walkStops.length, 1)) * (walkGeometry.length - 1))),
    );
    return walkGeometry[idx] ?? start.position;
  }, [walkMode, walkPosition, walkStopIndex, walkGeometry, walkStops.length, start.position]);

  return (
    <>
      <div className={`map-stage${fogActive ? " fog-active" : ""}${walkMode ? " walk-mode" : ""}${questPins.length ? " quest-mode" : ""}`} aria-label="Interactive map of central Adelaide">
        <MapContainer center={start.position} zoom={15} zoomControl={false} className="leaflet-map">
          <TileLayer
            key="detailed-map"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          <CreamWash />
          {!questPins.length ? (
            <Recenter position={walkMode ? youAreHere : start.position} zoom={walkMode ? 16 : undefined} animate={!walkMode} />
          ) : null}
          <FitRoute
            geometry={[
              ...route.geometry,
              ...(route.optionalGeometry ?? []),
            ]}
            enabled={showRoute && !fogActive && !walkMode && questPins.length === 0}
          />
          <FitPositions positions={questPositions} enabled={questPins.length > 0 && !walkMode} />
          <FitHistorySites enabled={historyLayer} />
          <FogSync
            positions={exploredPositions}
            onClearings={setClearings}
            onPercent={onExplorationPercent}
          />
          <Pane name="wander-heat" style={{ zIndex: 350, pointerEvents: "none" }}>
            {popularPlaces.map((place, index) => (
              <Marker
                key={place.id}
                position={place.position}
                icon={heatBlobIcon(popularityScore(place), index)}
                interactive={false}
                keyboard={false}
              />
            ))}
          </Pane>
          {onMapReady && <MapReady onReady={onMapReady} />}
          {questPins.map((pin) => (
            <Marker
              key={pin.id}
              position={pin.position}
              icon={questPinIcon(pin.number, Boolean(pin.done), pin.id === selectedQuestId)}
              eventHandlers={{ click: () => onSelectQuest?.(pin.id) }}
              zIndexOffset={pin.id === selectedQuestId ? 600 : 400}
            />
          ))}
          {showRoute && (
            <>
              {route.optionalGeometry && route.optionalGeometry.length >= 2 && (
                <Polyline
                  positions={route.optionalGeometry}
                  pathOptions={{
                    color: optionalRouteActive ? "#8ea66b" : "#4a504a",
                    weight: optionalRouteActive ? 6 : 5,
                    opacity: fogActive ? 0.4 : optionalRouteActive ? 0.95 : 0.88,
                    dashArray: "10 12",
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}
              <Polyline positions={route.geometry} pathOptions={{ color: walkMode ? "#c45a30" : "#0b0e0c", weight: walkMode ? 10 : 12, opacity: fogActive ? .4 : .88, lineCap: "round", lineJoin: "round" }} />
              <Polyline positions={route.geometry} pathOptions={{ color: colour, weight: walkMode ? 6 : 7, opacity: fogActive ? .6 : 1, lineCap: "round", lineJoin: "round" }} />
              {walkMode ? (
                <>
                  {walkStops.length >= 3 && (
                    <Polyline
                      positions={[...walkStops.map((stop) => stop.position), walkStops[0].position]}
                      pathOptions={{ color: "#8a8f88", weight: 2, opacity: 0.55, dashArray: "6 8", lineCap: "round", lineJoin: "round" }}
                    />
                  )}
                  <CircleMarker
                    center={youAreHere}
                    radius={11}
                    pathOptions={{ color: "rgba(142,166,107,.35)", fillColor: "#3f4a2e", fillOpacity: 1, weight: 10 }}
                  />
                  {walkStops.map((stop, index) => {
                    const faded = index >= walkStopIndex;
                    return (
                      <Marker
                        key={stop.id}
                        position={stop.position}
                        icon={walkStopIcon(index + 1, faded && index !== walkStopIndex)}
                        eventHandlers={{ click: () => onExploreStop(stop.id) }}
                      >
                        <Popup>
                          <strong>{index + 1}. {stop.name}</strong>
                          <br />
                          {stop.why}
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              ) : (
                <>
                  <CircleMarker
                    center={start.position}
                    radius={10}
                    pathOptions={{ color: "#0f1210", fillColor: colour, fillOpacity: 1, weight: 3 }}
                    eventHandlers={{ click: () => onExploreStop(start.id) }}
                  >
                    <Popup>
                      <strong>{start.name}</strong>
                      <br />
                      {start.reason}
                    </Popup>
                  </CircleMarker>
                  {(route.optionalStops ?? []).map((stop) => (
                    <CircleMarker
                      key={`optional-${stop.id}`}
                      center={stop.position}
                      radius={8}
                      pathOptions={{
                        color: optionalRouteActive ? "#3f4a2e" : "#4a504a",
                        fillColor: optionalRouteActive ? "#8ea66b" : "#c5cac3",
                        fillOpacity: 1,
                        weight: 3,
                        opacity: 0.95,
                      }}
                      eventHandlers={{
                        click: () => {
                          onSelectOptionalStop?.(stop.id);
                          onExploreStop(stop.id);
                        },
                      }}
                    >
                      <Tooltip direction="right" offset={[10, 0]} opacity={1} permanent className="optional-stop-label">
                        {stop.name}
                      </Tooltip>
                      <Popup>
                        <strong>{stop.name}</strong>
                        <br />
                        {stop.why}
                      </Popup>
                    </CircleMarker>
                  ))}
                  {route.stops.map((stop) => (
                    <StopMarker
                      key={stop.id}
                      stop={stop}
                      colour={colour}
                      explored={explored.has(stop.id)}
                      onExplore={onExploreStop}
                    />
                  ))}
                </>
              )}
            </>
          )}
          {historyLayer && HISTORY_SITES.map((site) => (
            <CircleMarker
              key={site.id}
              center={site.position}
              radius={11}
              pathOptions={{ color: "#fffdf8", fillColor: "#875b2b", fillOpacity: 1, weight: 3 }}
            >
              <Popup>
                <div className="history-popup">
                  <span className="history-popup-kicker">Local history</span>
                  <strong>{site.name}</strong>
                  <p>{site.facts[0]}</p>
                  <a href={site.sourceUrl} target="_blank" rel="noreferrer">
                    Source: {site.sourceLabel}
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        {!walkMode && (
          <div className="map-caption">
            Adelaide CBD · POIs cached {POI_DATA_TIMESTAMP}
            {showRoute
              ? (route.geometrySource === "openrouteservice" ? " · walking geometry" : " · grid geometry (temporary)")
              : " · choose a loop to draw a route"}
          </div>
        )}
      </div>
      {(fogActive || walkMode) && (
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
          {walkMode ? (
            <>
              <rect width="100%" height="100%" fill="rgba(72, 64, 92, 0.16)" mask="url(#wander-fog-mask)" />
              <rect width="100%" height="100%" fill="rgba(120, 118, 140, 0.08)" mask="url(#wander-fog-mask)" />
            </>
          ) : (
            <rect width="100%" height="100%" fill="#a6a5ad" fillOpacity={0.72} mask="url(#wander-fog-mask)" />
          )}
        </svg>
      )}
    </>
  );
}
