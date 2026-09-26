"use client";

import { Bookmark } from "lucide-react";
import type { SavedTrial } from "@/lib/saved-trials";

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
  return (
    <section className="saved-screen" aria-labelledby="saved-screen-title">
      <header className="saved-screen-header">
        <h1 id="saved-screen-title">Saved</h1>
        <p>Your Adelaide, collected</p>
      </header>

      {note ? <p className="saved-screen-note">{note}</p> : null}

      {trials.length === 0 ? (
        <div className="saved-screen-empty">
          <Bookmark size={26} />
          <strong>No saved routes yet</strong>
          <span>Generate a wander, then tap the bookmark to keep it.</span>
        </div>
      ) : (
        <ul className="saved-route-list">
          {trials.map((trial, index) => {
            const tags = savedTrialTags(trial);
            return (
              <li key={trial.id}>
                <button
                  type="button"
                  className="saved-route-card"
                  aria-label={`Open ${savedTrialTitle(trial)}`}
                  onClick={() => onOpenTrial?.(trial)}
                >
                  <span
                    className={`saved-route-thumb${trial.mode === "heat" ? " is-heat" : " is-discover"}${index % 2 === 1 ? " is-alt" : ""}`}
                    aria-hidden="true"
                  />
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
