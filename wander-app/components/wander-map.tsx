"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { POI_DATA_TIMESTAMP } from "@/lib/adelaide-data";
import {
  EXPLORATION_RADIUS_M,
  estimateViewportExplorationPercent,
  exploredPositionsFor,
  type MapBounds,
} from "@/lib/exploration";
import type { LatLng, WanderRoute } from "@/lib/route-planner";
import { popularityScore, type PopularPlace } from "@/lib/popularity";
import GoogleMapBackground from "@/components/google-map-background";

type Clearing = { id: string; x: number; y: number; r: number };

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

function streetViewBuddyIcon() {
  return L.divIcon({
    className: "streetview-buddy-marker",
    html: `<span aria-hidden="true">👋</span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 42],
  });
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
        fillColor: "#f4efe6",
        fillOpacity: 0.28,
        interactive: false,
        pane: "wander-cream",
      }}
    />
  );
}

function Recenter({ position, zoom }: { position: LatLng; zoom?: number }) {
  const map = useMap();
  const key = position.join(",");
  useEffect(() => {
    map.setView(position, zoom ?? map.getZoom(), { animate: true });
  }, [map, key, position, zoom]);
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
        fillColor: explored ? "#f7f3ea" : colour,
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
  showRoute,
  walkMode = false,
  walkStopIndex = 0,
  walkPosition,
  questPins = [],
  selectedQuestId = null,
  optionalRouteActive = false,
  onSelectQuest,
  onStreetViewPosition,
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
  showRoute: boolean;
  walkMode?: boolean;
  walkStopIndex?: number;
  walkPosition?: LatLng | null;
  questPins?: Array<{ id: string; position: LatLng; number: number; done?: boolean }>;
  selectedQuestId?: string | null;
  optionalRouteActive?: boolean;
  onSelectQuest?: (id: string) => void;
  onStreetViewPosition?: (position: LatLng) => void;
  popularPlaces?: PopularPlace[];
  onExploreStop: (id: string) => void;
  onSelectOptionalStop?: (id: string) => void;
  onExplorationPercent: (percent: number) => void;
}) {
  const colour = walkMode ? "#e07045" : mode === "discover" ? "#d8ff64" : "#ffe08a";
  const start = route.start;
  const explored = useMemo(() => new Set(exploredIds), [exploredIds]);
  const [clearings, setClearings] = useState<Clearing[]>([]);
  const [baseMapStyle, setBaseMapStyle] = useState<"calm" | "detailed" | "google">("calm");
  const [streetViewBuddyPosition, setStreetViewBuddyPosition] = useState<LatLng | null>(null);
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
          {baseMapStyle === "calm" ? (
            <TileLayer
              key="calm-map"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              attribution="© OpenStreetMap contributors · © CARTO"
            />
          ) : (
            <TileLayer
              key="detailed-map"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
          )}
          <CreamWash />
          {!questPins.length ? (
            <Recenter position={walkMode ? youAreHere : start.position} zoom={walkMode ? 16 : undefined} />
          ) : null}
          <FitRoute
            geometry={[
              ...route.geometry,
              ...(route.optionalGeometry ?? []),
            ]}
            enabled={showRoute && !fogActive && !walkMode && questPins.length === 0}
          />
          <FitPositions positions={questPositions} enabled={questPins.length > 0 && !walkMode} />
          <FogSync
            positions={exploredPositions}
            onClearings={setClearings}
            onPercent={onExplorationPercent}
          />
          {popularPlaces.map((place) => {
            const score = popularityScore(place);
            return (
              <CircleMarker
                key={place.id}
                center={place.position}
                radius={14 + score * 30}
                pathOptions={{ color: "#e9592f", fillColor: "#ffcf56", fillOpacity: 0.16 + score * 0.34, weight: 1.5, opacity: 0.7 }}
                interactive={false}
              />
            );
          })}
          {showRoute && !walkMode && (
            <Marker
              position={streetViewBuddyPosition ?? start.position}
              icon={streetViewBuddyIcon()}
              draggable
              zIndexOffset={700}
              eventHandlers={{
                dragend: (event) => {
                  const point = event.target.getLatLng();
                  const next: LatLng = [point.lat, point.lng];
                  setStreetViewBuddyPosition(next);
                  onStreetViewPosition?.(next);
                },
              }}
            />
          )}
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
                    color: optionalRouteActive ? "#5f7a45" : "#4a504a",
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
        </MapContainer>
        {baseMapStyle === "google" && (
          <GoogleMapBackground route={route} showRoute={showRoute} popularPlaces={popularPlaces} />
        )}
        {!walkMode && (
          <button
            type="button"
            className="map-style-toggle"
            onClick={() => setBaseMapStyle((current) => current === "calm" ? "detailed" : current === "detailed" ? "google" : "calm")}
            aria-label={`Current map background: ${baseMapStyle}. Switch map background`}
          >
            <span aria-hidden="true">{baseMapStyle === "calm" ? "◫" : baseMapStyle === "detailed" ? "◎" : "G"}</span>
            {baseMapStyle === "calm" ? "Calm map" : baseMapStyle === "detailed" ? "Detailed map" : "Google map"}
          </button>
        )}
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
              <rect width="100%" height="100%" fill="rgba(72, 64, 92, 0.42)" mask="url(#wander-fog-mask)" />
              <rect width="100%" height="100%" fill="rgba(120, 118, 140, 0.22)" mask="url(#wander-fog-mask)" />
            </>
          ) : (
            <>
              <rect width="100%" height="100%" fill="rgba(48, 68, 40, 0.58)" mask="url(#wander-fog-mask)" />
              <rect width="100%" height="100%" fill="rgba(155, 184, 122, 0.28)" mask="url(#wander-fog-mask)" />
            </>
          )}
        </svg>
      )}
    </>
  );
}
