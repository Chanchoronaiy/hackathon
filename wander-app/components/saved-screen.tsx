"use client";

import { Bookmark, Camera, Footprints } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type { SavedTrial } from "@/lib/saved-trials";
import type { LatLng } from "@/lib/route-planner";
import { readWalkHistory, WALK_HISTORY_EVENT, type WalkHistoryEntry } from "@/lib/walk-history";

function subscribeToWalkHistory(onChange: () => void) {
  window.addEventListener(WALK_HISTORY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(WALK_HISTORY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getWalkHistorySnapshot() {
  return JSON.stringify(readWalkHistory());
}

function routePath(points: LatLng[]) {
  if (points.length < 2) return "";
  const meanLatitude = points.reduce((sum, [latitude]) => sum + latitude, 0) / points.length;
  const longitudeScale = Math.cos((meanLatitude * Math.PI) / 180);
  const projected = points.map(([latitude, longitude]) => [longitude * longitudeScale, latitude] as const);
  const longitudes = projected.map(([longitude]) => longitude);
  const latitudes = projected.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const width = Math.max(maxLongitude - minLongitude, 0.00001);
  const height = Math.max(maxLatitude - minLatitude, 0.00001);
  const scale = 78 / Math.max(width, height);
  const offsetX = (100 - width * scale) / 2;
  const offsetY = (100 - height * scale) / 2;
  return projected.map(([longitude, latitude], index) => {
    const x = (longitude - minLongitude) * scale + offsetX;
    const y = (maxLatitude - latitude) * scale + offsetY;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function SavedRouteMap({ trial }: { trial: SavedTrial }) {
  const path = routePath(trial.geometry ?? []);
  const fallbackPath = "M13 72 L27 72 L27 47 L47 47 L47 27 L68 27 L68 52 L87 52";
  const drawnPath = path || fallbackPath;
  const startPoint = path ? drawnPath.match(/^M([\d.]+) ([\d.]+)/) : null;
  const endPoint = path ? [...drawnPath.matchAll(/([\d.]+) ([\d.]+)/g)].at(-1) : null;
  const startX = startPoint ? Number(startPoint[1]) : 13;
  const startY = startPoint ? Number(startPoint[2]) : 72;
  const endX = endPoint ? Number(endPoint[1]) : 87;
  const endY = endPoint ? Number(endPoint[2]) : 52;

  return (
    <svg className="saved-route-map" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" fill={trial.mode === "heat" ? "#f3edda" : "#e7eee3"} />
      <path className="saved-map-streets" d="M-10 20H110 M-10 42H110 M-10 64H110 M-10 86H110 M20-10V110 M43-10V110 M66-10V110 M89-10V110" />
      <path className="saved-map-route-outline" d={drawnPath} />
      <path className={`saved-map-route${trial.mode === "heat" ? " is-heat" : ""}`} d={drawnPath} />
      <circle className="saved-map-start" cx={startX} cy={startY} r="4.4" />
      <circle className="saved-map-end" cx={endX} cy={endY} r="3.4" />
    </svg>
  );
}

export function savedTrialTitle(trial: SavedTrial) {
  if (trial.title?.trim()) return trial.title.trim();
  if (trial.mode === "heat") return "North Terrace at dusk";
  if (trial.interests.includes("coffee")) return "Laneway coffee crawl";
  if (trial.interests.includes("photo")) return "Photo spots loop";
  if (trial.interests.includes("green")) return "Parkland wander";
  if (trial.interests.includes("art")) return "Laneways & little surprises";
  return "Adelaide wander";
}

export function savedTrialTags(trial: SavedTrial) {
  const tags: string[] = [];
  if (trial.interests.includes("coffee")) tags.push("Great coffee");
  if (trial.mode === "heat" || trial.interests.includes("green")) tags.push("Shady");
  if (trial.interests.includes("art")) tags.push("Heritage");
  if (trial.interests.includes("photo")) tags.push("Photos");
  if (tags.length === 0) tags.push(trial.mode === "heat" ? "Shady" : "Discover");
  return tags.slice(0, 2);
}

type SavedScreenProps = {
  trials: SavedTrial[];
  onOpenTrial?: (trial: SavedTrial) => void;
  onRemoveTrial?: (id: string) => void;
  note?: string | null;
};

export default function SavedScreen({
  trials,
  onOpenTrial,
  onRemoveTrial,
  note,
}: SavedScreenProps) {
  const historyData = useSyncExternalStore(subscribeToWalkHistory, getWalkHistorySnapshot, () => "[]");
  const walkHistory = useMemo(() => JSON.parse(historyData) as WalkHistoryEntry[], [historyData]);

  return (
    <section className="saved-screen" aria-labelledby="saved-screen-title">
      <header className="saved-screen-header">
        <h1 id="saved-screen-title">Saved</h1>
      </header>

      {note ? <p className="saved-screen-note">{note}</p> : null}

      <section className="saved-history" aria-labelledby="saved-history-title">
        <div className="saved-section-heading">
          <h2 id="saved-history-title">Walk history</h2>
          <span>{walkHistory.length} {walkHistory.length === 1 ? "walk" : "walks"}</span>
        </div>
        {walkHistory.length === 0 ? (
          <div className="saved-history-empty">
            <Footprints size={20} aria-hidden="true" />
            <span>Your walks and captured stops will appear here when you end a walk.</span>
          </div>
        ) : (
          <ul className="saved-history-list">
            {walkHistory.map((walk) => (
              <li key={walk.id} className="saved-history-item">
                <div className="saved-history-icon" aria-hidden="true"><Footprints size={18} /></div>
                <div className="saved-history-copy">
                  <strong>{walk.title}</strong>
                  <span>{new Date(walk.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {walk.distanceKm.toFixed(1)} km · {walk.walkingMinutes} min</span>
                  <span>{walk.stopNames.length} stops · {walk.mode === "heat" ? "Beat the Heat" : "Discover"}</span>
                  {walk.captures.length > 0 ? (
                    <span className="saved-history-captures">
                      <Camera size={14} aria-hidden="true" />
                      Captured: {walk.captures.map((capture) => capture.stopName).join(", ")}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="saved-section-heading saved-routes-heading">
        <h2>Saved routes</h2>
        <span>{trials.length} {trials.length === 1 ? "route" : "routes"}</span>
      </div>
      {trials.length === 0 ? (
        <div className="saved-screen-empty">
          <Bookmark size={26} />
          <strong>No saved routes yet</strong>
          <span>Generate a wander, then tap the bookmark to keep it.</span>
        </div>
      ) : (
        <ul className="saved-route-list">
          {trials.map((trial) => {
            const tags = savedTrialTags(trial);
            return (
              <li key={trial.id}>
                <button
                  type="button"
                  className="saved-route-card"
                  aria-label={`Open ${savedTrialTitle(trial)}`}
                  onClick={() => onOpenTrial?.(trial)}
                >
                  <span className="saved-route-thumb" aria-hidden="true">
                    <SavedRouteMap trial={trial} />
                  </span>
                  <span className="saved-route-body">
                    <strong>{savedTrialTitle(trial)}</strong>
                    <span className="saved-route-meta">
                      {trial.distanceKm.toFixed(1)} km · {trial.walkingMinutes} min
                    </span>
                    <span className="saved-route-tags">
                      {tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="saved-route-bookmark"
                  aria-label={`Remove ${savedTrialTitle(trial)}`}
                  onClick={() => onRemoveTrial?.(trial.id)}
                >
                  <Bookmark size={18} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
