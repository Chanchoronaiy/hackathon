"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, Rectangle, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { POI_DATA_TIMESTAMP } from "@/lib/adelaide-data";
import {
  EXPLORATION_RADIUS_M,
  estimateViewportExplorationPercent,
  exploredPositionsFor,
  type MapBounds,
} from "@/lib/exploration";
import type { LatLng, WanderRoute } from "@/lib/route-planner";

type Clearing = { id: string; x: number; y: number; r: number };

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

function Recenter({ position }: { position: LatLng }) {
  const map = useMap();
  const key = position.join(",");
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true });
  }, [map, key, position]);
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
  fogActive,
  onClearings,
  onPercent,
}: {
  positions: Array<{ id: string; position: LatLng }>;
  fogActive: boolean;
  onClearings: (clearings: Clearing[]) => void;
  onPercent: (percent: number) => void;
}) {
  const map = useMap();
  const positionKey = positions.map((item) => `${item.id}:${item.position.join(",")}`).join("|");

  useMapEvents({
    moveend() {
      onClearings(projectClearings(map, positions));
      if (fogActive) onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    },
    zoomend() {
      onClearings(projectClearings(map, positions));
      if (fogActive) onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    },
    resize() {
      onClearings(projectClearings(map, positions));
      if (fogActive) onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    },
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      onClearings(projectClearings(map, positions));
      if (fogActive) onPercent(estimateViewportExplorationPercent(boundsFromMap(map), positions));
    });
    return () => cancelAnimationFrame(frame);
  }, [map, fogActive, onClearings, onPercent, positionKey, positions]);

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
  fogActive,
  showRoute,
  onExploreStop,
  onExplorationPercent,
}: {
  mode: "discover" | "heat";
  route: WanderRoute;
  exploredIds: string[];
  fogActive: boolean;
  showRoute: boolean;
  onExploreStop: (id: string) => void;
  onExplorationPercent: (percent: number) => void;
}) {
  const colour = mode === "discover" ? "#d8ff64" : "#ffb75e";
  const start = route.start;
  const explored = useMemo(() => new Set(exploredIds), [exploredIds]);
  const [clearings, setClearings] = useState<Clearing[]>([]);
  const exploredPositions = useMemo(() => exploredPositionsFor(exploredIds), [exploredIds]);

  return (
    <div className={`map-stage${fogActive ? " fog-active" : ""}`} aria-label="Interactive map of central Adelaide">
      <MapContainer center={start.position} zoom={15} zoomControl={false} className="leaflet-map">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <CreamWash />
        <Recenter position={start.position} />
        <FitRoute geometry={route.geometry} enabled={showRoute && !fogActive} />
        <FogSync
          positions={exploredPositions}
          fogActive={fogActive}
          onClearings={setClearings}
          onPercent={onExplorationPercent}
        />
        {showRoute && (
          <>
            <Polyline positions={route.geometry} pathOptions={{ color: "#0b0e0c", weight: 12, opacity: fogActive ? .4 : .88, lineCap: "round", lineJoin: "round" }} />
            <Polyline positions={route.geometry} pathOptions={{ color: colour, weight: 7, opacity: fogActive ? .6 : 1, lineCap: "round", lineJoin: "round" }} />
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
      </MapContainer>
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
          <rect width="100%" height="100%" fill="rgba(48, 68, 40, 0.58)" mask="url(#wander-fog-mask)" />
          <rect width="100%" height="100%" fill="rgba(155, 184, 122, 0.28)" mask="url(#wander-fog-mask)" />
        </svg>
      )}
      <div className="map-caption">
        Adelaide CBD · POIs cached {POI_DATA_TIMESTAMP}
        {showRoute
          ? (route.geometrySource === "openrouteservice" ? " · walking geometry" : " · grid geometry (temporary)")
          : " · choose a loop to draw a route"}
      </div>
    </div>
  );
}
