"use client";

import { ArrowLeft, Bookmark, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteSavedTrial, readSavedTrials, type SavedTrial } from "@/lib/saved-trials";

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

export default function SavedTrialsPage() {
  const [trials, setTrials] = useState<SavedTrial[]>([]);

  useEffect(() => {
    setTrials(readSavedTrials());
  }, []);

  return (
    <main className="saved-page">
      <header className="saved-page-header">
        <a className="saved-back" href="/"><ArrowLeft size={18} /> Back to Wander</a>
        <div className="saved-page-brand"><Bookmark size={18} /> Wander</div>
      </header>
      <section className="saved-page-content" aria-labelledby="saved-trials-title">
        <p className="saved-page-kicker">YOUR COLLECTION</p>
        <h1 id="saved-trials-title">Saved trials</h1>
        <p className="saved-page-intro">Keep the wanders worth repeating. Saved on this device.</p>
        {trials.length === 0 ? (
          <div className="saved-page-empty">
            <Bookmark size={26} />
            <strong>No saved trials yet</strong>
            <span>Generate a wander, then choose Save from the menu.</span>
          </div>
        ) : (
          <ul className="saved-page-list">
            {trials.map((trial) => (
              <li key={trial.id} className="saved-page-card">
                <div>
                  <span className="saved-page-mode">{trial.mode === "heat" ? "Beat the heat" : "Discover"}</span>
                  <h2>{durationLabel(trial.minutes)} wander</h2>
                  <p>{trial.distanceKm.toFixed(1)} km · {trial.walkingMinutes} min walking</p>
                  <small>{trial.stopNames.slice(0, 3).join(" · ") || "Adelaide loop"}</small>
                </div>
                <button type="button" className="saved-page-delete" aria-label={`Delete ${durationLabel(trial.minutes)} saved trial`} onClick={() => setTrials(deleteSavedTrial(trial.id))}>
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
