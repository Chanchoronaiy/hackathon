"use client";

import { ArrowLeft, Camera, Check, CornerUpRight } from "lucide-react";
import type { WanderRoute } from "@/lib/route-planner";

type WalkModeChromeProps = {
  route: WanderRoute;
  currentStopIndex: number;
  onBack: () => void;
  onFinish: () => void;
  onCapture: () => void;
  onAdvance?: () => void;
};

function remainingMinutes(route: WanderRoute, currentStopIndex: number) {
  const total = Math.max(1, route.stops.length);
  const progress = Math.min(1, currentStopIndex / total);
  return Math.max(0, Math.round(route.walkingMinutes * (1 - progress)));
}

function remainingKm(route: WanderRoute, currentStopIndex: number) {
  const total = Math.max(1, route.stops.length);
  const progress = Math.min(1, currentStopIndex / total);
  return Math.max(0, route.distanceKm * (1 - progress));
}

function etaToNext(route: WanderRoute) {
  return Math.max(1, Math.round(route.walkingMinutes / Math.max(route.stops.length, 1)));
}

function walkPercent(route: WanderRoute, currentStopIndex: number) {
  const total = Math.max(1, route.stops.length);
  return Math.min(100, Math.round((currentStopIndex / total) * 100));
}

export default function WalkModeChrome({
  route,
  currentStopIndex,
  onBack,
  onFinish,
  onCapture,
  onAdvance,
}: WalkModeChromeProps) {
  const totalStops = route.stops.length;
  const done = totalStops === 0 || currentStopIndex >= totalStops;
  const nextStop = done ? null : route.stops[currentStopIndex];
  const nextNumber = currentStopIndex + 1;
  const minsLeft = remainingMinutes(route, currentStopIndex);
  const kmLeft = remainingKm(route, currentStopIndex);
  const progress = walkPercent(route, currentStopIndex);

  return (
    <>
      <div className="walk-top">
        <button type="button" className="walk-round" aria-label="End walk" onClick={onBack}>
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <div className="walk-status" aria-live="polite">
          <strong>{done ? "Nice wander" : minsLeft > 0 ? `${minsLeft} min left` : "Almost there"}</strong>
          <span>{done ? `${route.distanceKm.toFixed(1)} km` : `${kmLeft.toFixed(1)} km left`}</span>
        </div>
        <span className="walk-top-spacer" aria-hidden="true" />
      </div>

      <div className="walk-progress-row" aria-label={`${progress}% walked`}>
        <div className="walk-progress" aria-hidden="true">
          <span style={{ width: `${Math.max(progress, progress > 0 ? 2 : 0)}%` }} />
        </div>
        <strong className="walk-progress-pct">{progress}%</strong>
      </div>

      <button type="button" className="walk-capture" aria-label="Capture moment for Memories" onClick={onCapture}>
        <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {nextStop ? (
        <aside className="walk-next-card">
          <p className="walk-next-kicker">Up next · {etaToNext(route)} min</p>
          <div className="walk-next-row">
            <span className="walk-next-index" aria-hidden="true">{nextNumber}</span>
            <div className="walk-next-copy">
              <strong>{nextStop.name}</strong>
              <p>{nextStop.why}</p>
            </div>
            <button
              type="button"
              className="walk-next-turn"
              aria-label={`Reached checkpoint ${nextNumber}`}
              onClick={onAdvance}
            >
              <CornerUpRight size={22} strokeWidth={2.4} />
            </button>
          </div>
        </aside>
      ) : (
        <aside className="walk-next-card walk-next-done">
          <p className="walk-next-kicker">Nice wander</p>
          <div className="walk-next-row is-done">
            <div className="walk-next-copy">
              <strong>You’re back near the start</strong>
              <p>Capture a last moment, or end the walk.</p>
            </div>
          </div>
          <div className="walk-done-actions">
            <button type="button" className="walk-done-capture" aria-label="Capture moment for Memories" onClick={onCapture}>
              <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
              Capture
            </button>
            <button type="button" className="walk-done-end" onClick={onFinish}>
              <Check size={18} strokeWidth={2.4} aria-hidden="true" />
              End walk
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
