"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import SavedScreen from "@/components/saved-screen";
import { deleteSavedTrial, readSavedTrials, type SavedTrial } from "@/lib/saved-trials";

const SAVED_EVENT = "wander-saved-updated";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(SAVED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SAVED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot() {
  return readSavedTrials();
}

function getServerSnapshot(): SavedTrial[] {
  return [];
}

export default function SavedTrialsPage() {
  const trials = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const removeTrial = useCallback((id: string) => {
    deleteSavedTrial(id);
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
