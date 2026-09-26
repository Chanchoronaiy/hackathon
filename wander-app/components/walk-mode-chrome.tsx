"use client";

import { ArrowLeft, Camera, Check, CornerUpRight, Images, Share, Shuffle, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { HistoryImagePair } from "@/lib/history-sites";
import type { WanderRoute } from "@/lib/route-planner";

type WalkModeChromeProps = {
  route: WanderRoute;
  currentStopIndex: number;
  locationStatus: "locating" | "located" | "unavailable";
  historyMoment: {
    siteName: string;
    fact: string;
    facts?: string[];
    factIndex?: number;
    beforeAfter?: HistoryImagePair;
    sourceLabel?: string;
    sourceUrl?: string;
  } | null;
  explorationPercent: number;
  onBack: () => void;
  onShare: () => void;
  onCapture: () => void;
  onDismissHistoryMoment: () => void;
  onAnotherFact: () => void;
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
  locationStatus,
  historyMoment,
  explorationPercent,
  onBack,
  onShare,
  onCapture,
  onDismissHistoryMoment,
  onAnotherFact,
  onAdvance,
}: WalkModeChromeProps) {
  const [photoComparisonOpen, setPhotoComparisonOpen] = useState(false);
  const totalStops = route.stops.length;
  const done = totalStops === 0 || currentStopIndex >= totalStops;
  const nextStop = done ? null : route.stops[currentStopIndex];
  const nextNumber = currentStopIndex + 1;
  const minsLeft = remainingMinutes(route, currentStopIndex);
  const kmLeft = remainingKm(route, currentStopIndex);
  const progress = walkPercent(route, currentStopIndex);
  const exploredShown = Math.max(progress, Math.round(explorationPercent));

  return (
    <>
      <div className="walk-top">
        <button type="button" className="walk-round" aria-label="End walk" onClick={onBack}>
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <div className="walk-status" aria-live="polite">
          <strong>{done ? "Walk complete" : minsLeft > 0 ? `${minsLeft} min left` : "Almost there"}</strong>
          <span>
            {done
              ? `${route.distanceKm.toFixed(1)} km · ${exploredShown}% explored`
              : `${kmLeft.toFixed(1)} km · ${exploredShown}% explored`}
          </span>
        </div>
        <button type="button" className="walk-round" aria-label="Share wander" onClick={onShare}>
          <Share size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="walk-progress-row" aria-label={`${progress}% walked`}>
        <div className="walk-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong className="walk-progress-pct">{progress}%</strong>
      </div>
      <p className={`walk-location-status is-${locationStatus}`} aria-live="polite">
        <span aria-hidden="true" />
        {locationStatus === "located"
          ? "Live location on"
          : locationStatus === "locating"
            ? "Finding your location…"
            : "Live location unavailable. Check browser location permission; progress is estimated."}
      </p>

      {historyMoment ? (
        <aside className="walk-history-toast" aria-live="polite" aria-label={`${historyMoment.sourceUrl ? "Local history" : "Wander note"} at ${historyMoment.siteName}`}>
          <div className="walk-history-toast-head">
            <span>{historyMoment.sourceUrl ? "A little local history" : "A note for your wander"} · {historyMoment.siteName}</span>
            <button type="button" aria-label="Dismiss history fact" onClick={onDismissHistoryMoment}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p>{historyMoment.fact}</p>
          {historyMoment.beforeAfter ? (
            <button type="button" className="walk-history-compare-trigger" onClick={() => setPhotoComparisonOpen(true)}>
              <Images size={16} aria-hidden="true" /> View before &amp; after photos
            </button>
          ) : null}
          {historyMoment.sourceUrl && historyMoment.sourceLabel ? (
            <a href={historyMoment.sourceUrl} target="_blank" rel="noreferrer">Source: {historyMoment.sourceLabel}</a>
          ) : (
            <span className="walk-history-source">From the curated Adelaide place guide</span>
          )}
          {historyMoment.facts && historyMoment.facts.length > 1 ? (
            <button type="button" className="walk-history-another" onClick={onAnotherFact}>
              <Shuffle size={14} aria-hidden="true" /> Another fact
            </button>
          ) : null}
        </aside>
      ) : null}

      {photoComparisonOpen && historyMoment?.beforeAfter ? (
        <div className="walk-photo-comparison-backdrop">
          <button
            type="button"
            className="walk-photo-comparison-scrim"
            aria-label="Close photo comparison"
            onClick={() => setPhotoComparisonOpen(false)}
          />
          <dialog open className="walk-photo-comparison" aria-labelledby="walk-photo-comparison-title">
            <header>
              <div>
                <span>Before &amp; after</span>
                <h2 id="walk-photo-comparison-title">{historyMoment.siteName}</h2>
              </div>
              <button type="button" aria-label="Close photo comparison" onClick={() => setPhotoComparisonOpen(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="walk-history-comparison">
              {[historyMoment.beforeAfter.before, historyMoment.beforeAfter.after].map((photo, index) => (
                <figure key={photo.url} className="walk-history-photo">
                  <div className="walk-history-photo-image">
                    <Image src={photo.url} alt={photo.label} fill sizes="(max-width: 600px) 90vw, 45vw" unoptimized />
                    <span>{index === 0 ? "BEFORE" : "AFTER"}</span>
                  </div>
                  <figcaption>
                    <strong>{photo.label}</strong>
                    <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.credit}</a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </dialog>
        </div>
      ) : null}

      <button type="button" className="walk-capture" onClick={onCapture}>
        <Camera size={22} strokeWidth={2.2} aria-hidden="true" />
        <span>Capture</span>
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
              aria-label={`Next stop: ${nextStop.name}`}
              onClick={onAdvance}
            >
              <CornerUpRight size={22} strokeWidth={2.4} />
              <span>Next</span>
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
            <button type="button" className="walk-done-capture" onClick={onCapture}>
              <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
              Capture
            </button>
            <button type="button" className="walk-done-end" onClick={onBack}>
              <Check size={18} strokeWidth={2.4} aria-hidden="true" />
              End walk
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
