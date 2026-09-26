"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SavedScreen from "@/components/saved-screen";
import { deleteSavedTrial, readSavedTrials, type SavedTrial } from "@/lib/saved-trials";
import { loadCloudTrials, removeCloudTrial } from "@/lib/cloud-data";

const SAVED_EVENT = "wander-saved-updated";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(SAVED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SAVED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export default function SavedTrialsPage() {
  const [trials, setTrials] = useState<SavedTrial[]>([]);

  useEffect(() => {
    const update = () => setTrials(readSavedTrials());
    update();
    const unsubscribe = subscribe(update);
    void loadCloudTrials().then((cloudTrials) => {
      if (cloudTrials?.length) setTrials(cloudTrials);
    });
    return unsubscribe;
  }, []);

  const removeTrial = useCallback((id: string) => {
    deleteSavedTrial(id);
    setTrials((current) => current.filter((trial) => trial.id !== id));
    void removeCloudTrial(id);
    window.dispatchEvent(new Event(SAVED_EVENT));
  }, []);

  return (
    <main className="saved-page-shell">
      <SavedScreen
        trials={trials}
        onRemoveTrial={removeTrial}
        onOpenTrial={() => {
          window.location.assign("/");
        }}
      />
      <nav className="home-nav saved-page-nav" aria-label="Primary">
        <Link href="/">Map</Link>
        <Link href="/">Explore</Link>
        <span className="is-disabled">Memories</span>
        <Link href="/saved" className="is-active" aria-current="page">Saved</Link>
        <span className="is-disabled">Friends</span>
      </nav>
    </main>
  );
}
