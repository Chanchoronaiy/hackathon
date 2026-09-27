"use client";

import { ArrowLeft, Bookmark, Camera, Check, CornerUpRight, Images, Star, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { HistoryImagePair } from "@/lib/history-sites";
import type { WanderRoute } from "@/lib/route-planner";

type WalkModeChromeProps = {
  route: WanderRoute;
  reviewTrailId: string;
  currentStopIndex: number;
  /** 0–1 distance walked along the route line; falls back to stops reached when absent. */
  progress?: number | null;
  locationStatus: "locating" | "located" | "unavailable";
  historyMoment: {
    siteName: string;
    fact: string;
    beforeAfter?: HistoryImagePair;
    sourceLabel?: string;
    sourceUrl?: string;
  } | null;
  onBack: () => void;
  onFinish: () => void;
  onCapture: () => void;
  onDismissHistoryMoment: () => void;
  onSubmitReview: (trailId: string, rating: number, comment: string) => void;
  onAdvance?: () => void;
  /** This walk's one memory is already saved. */
  memorySaved?: boolean;
  /** This route is already in the saved list. */
  routeSaved?: boolean;
  onSaveRoute?: () => void;
};

function stopProgress(route: WanderRoute, currentStopIndex: number) {
  return Math.min(1, currentStopIndex / Math.max(1, route.stops.length));
}

function etaToNext(route: WanderRoute) {
  return Math.max(1, Math.round(route.walkingMinutes / Math.max(route.stops.length, 1)));
}

export default function WalkModeChrome({
  route,
  reviewTrailId,
  currentStopIndex,
  progress: progressFraction,
  locationStatus,
  historyMoment,
  onBack,
  onFinish,
  onCapture,
  onDismissHistoryMoment,
  onSubmitReview,
  onAdvance,
  memorySaved = false,
  routeSaved = false,
  onSaveRoute,
}: WalkModeChromeProps) {
  const [photoComparisonOpen, setPhotoComparisonOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSkipped, setReviewSkipped] = useState(false);
  const totalStops = route.stops.length;
  const done = totalStops === 0 || currentStopIndex >= totalStops;
  const nextStop = done ? null : route.stops[currentStopIndex];
  const nextNumber = currentStopIndex + 1;
  const fraction = progressFraction ?? stopProgress(route, currentStopIndex);
  const minsLeft = Math.max(0, Math.round(route.walkingMinutes * (1 - fraction)));
  const kmLeft = Math.max(0, route.distanceKm * (1 - fraction));
  const progress = Math.min(100, Math.round(fraction * 100));

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
          {historyMoment.sourceUrl && historyMoment.sourceLabel ? (
            <a href={historyMoment.sourceUrl} target="_blank" rel="noreferrer">Source: {historyMoment.sourceLabel}</a>
          ) : (
            <span className="walk-history-source">From the curated Adelaide place guide</span>
          )}
          {historyMoment.beforeAfter ? (
            <button type="button" className="walk-history-compare-trigger" onClick={() => setPhotoComparisonOpen(true)}>
              <Images size={16} aria-hidden="true" /> View before &amp; after photos
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

      {memorySaved ? (
        <button type="button" className="walk-capture is-saved" aria-label="Memory saved ✓" disabled>
          <Check size={20} strokeWidth={2.6} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className="walk-capture" aria-label="Capture moment for Memories" onClick={onCapture}>
          <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}

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
          <div className="walk-next-row is-done">
            <div className="walk-next-copy">
              <strong className="walk-done-title">Nice wander</strong>
              {memorySaved && <p>Your memory is saved. End the walk when you’re ready.</p>}
            </div>
          </div>
          {reviewSubmitted ? (
            <output className="walk-review-thanks">
              <strong>Thanks for helping other walkers.</strong>
              <button type="button" className="walk-done-end" onClick={onFinish}>
                <Check size={18} strokeWidth={2.4} aria-hidden="true" /> End walk
              </button>
            </output>
          ) : reviewSkipped ? (
            <div className="walk-done-actions">
              {memorySaved ? (
                <button type="button" className="walk-done-capture is-saved" disabled>
                  Memory saved ✓
                </button>
              ) : (
                <button type="button" className="walk-done-capture" aria-label="Capture moment for Memories" onClick={onCapture}>
                  <Camera size={18} strokeWidth={2.2} aria-hidden="true" /> Capture
                </button>
              )}
              <button type="button" className="walk-done-end" onClick={onFinish}>
                <Check size={18} strokeWidth={2.4} aria-hidden="true" /> End walk
              </button>
            </div>
          ) : (
            <form
              className="walk-review-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (reviewRating < 1) {
                  setReviewError("Choose a star rating first.");
                  return;
                }
                if (reviewComment.trim().length < 3) {
                  setReviewError("Add a short comment about your walk.");
                  return;
                }
                onSubmitReview(reviewTrailId, reviewRating, reviewComment.trim());
                setReviewSubmitted(true);
                setReviewError(null);
              }}
            >
              <strong>How was this walk?</strong>
              <div className="walk-review-row">
              <fieldset className="walk-review-stars">
                <legend>Rate this walk</legend>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                    aria-pressed={reviewRating === rating}
                    onClick={() => { setReviewRating(rating); setReviewError(null); }}
                  >
                    <Star size={22} fill={reviewRating >= rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </fieldset>
              <button
                type="button"
                className={`walk-review-save${routeSaved ? " is-saved" : ""}`}
                aria-label={routeSaved ? "Walk saved to your list, tap to unsave" : "Save this walk"}
                aria-pressed={routeSaved}
                onClick={onSaveRoute}
              >
                <Bookmark size={20} strokeWidth={2.2} fill={routeSaved ? "currentColor" : "none"} />
              </button>
              </div>
              <label className="walk-review-comment">
                <span>Leave a tip or comment</span>
                <textarea
                  value={reviewComment}
                  maxLength={300}
                  rows={2}
                  placeholder="What would you tell the next walker?"
                  onChange={(event) => { setReviewComment(event.target.value); setReviewError(null); }}
                />
              </label>
              {reviewError ? <p className="walk-review-error" role="alert">{reviewError}</p> : null}
              <div className="walk-done-actions">
                <button type="submit" className="walk-done-end">Post review</button>
                <button type="button" className="walk-review-skip" onClick={() => setReviewSkipped(true)}>Skip review</button>
              </div>
            </form>
          )}
        </aside>
      )}
    </>
  );
}
