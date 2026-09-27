"use client";

import { Camera, Check, Eye, MapPinned, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PhotoCheckinDialog from "@/components/photo-checkin-dialog";
import StreetViewDialog from "@/components/street-view-dialog";
import {
  dailyQuests,
  isQuestCompleted,
  localDateKey,
  readGamificationProfile,
  type DailyQuest,
} from "@/lib/gamification";

type DailyQuestsScreenProps = {
  selectedQuestId: string | null;
  onSelectQuest: (id: string | null) => void;
  onGoToQuest: (quest: DailyQuest) => void;
  onClose?: () => void;
};

export default function DailyQuestsScreen({
  selectedQuestId,
  onSelectQuest,
  onGoToQuest,
  onClose,
}: DailyQuestsScreenProps) {
  const [questDateKey, setQuestDateKey] = useState(() => localDateKey());
  const quests = useMemo(() => dailyQuests(), [questDateKey]);
  const [profile, setProfile] = useState(() => readGamificationProfile());
  const [streetViewQuest, setStreetViewQuest] = useState<DailyQuest | null>(null);
  const [checkinQuest, setCheckinQuest] = useState<DailyQuest | null>(null);
  const [railHost, setRailHost] = useState<Element | null>(null);

  useEffect(() => {
    const update = () => setProfile(readGamificationProfile());
    window.addEventListener("wander:points", update);
    return () => window.removeEventListener("wander:points", update);
  }, []);

  useEffect(() => {
    const refreshDate = () => setQuestDateKey((current) => {
      const next = localDateKey();
      return current === next ? current : next;
    });
    const timer = window.setInterval(refreshDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setRailHost(document.querySelector(".home-rail-quests"));
  }, []);

  const doneCount = quests.filter((quest) => isQuestCompleted(quest.id, profile)).length;
  const selectedQuest = quests.find((quest) => quest.id === selectedQuestId) ?? null;
  const selectedDone = selectedQuest ? isQuestCompleted(selectedQuest.id, profile) : false;

  const slideSummary = (
    <div className="quests-slide-summary" aria-live="polite">
      <span>
        <Sparkles size={14} aria-hidden="true" />
        {doneCount}/{quests.length} claimed today
      </span>
      <strong>{profile.points.toLocaleString()} pts</strong>
      {onClose ? (
        <button type="button" className="quests-slide-close" aria-label="Close daily quests" onClick={onClose}>
          <X size={15} strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {railHost ? createPortal(slideSummary, railHost) : null}

      {selectedQuest ? (
        <aside className="quest-detail-card" aria-label={`${selectedQuest.place.name} quest details`}>
          <div className="quest-detail-top">
            <span className="quest-detail-index" aria-hidden="true">
              {quests.findIndex((quest) => quest.id === selectedQuest.id) + 1}
            </span>
            <div className="quest-detail-copy">
              <strong>{selectedQuest.place.name}</strong>
              <p>{selectedQuest.place.reason}</p>
              <span className="quest-detail-bonus">+{selectedQuest.points} extra pts</span>
            </div>
            <button
              type="button"
              className="quest-detail-dismiss"
              aria-label="Dismiss quest details"
              onClick={() => onSelectQuest(null)}
            >
              <X size={16} />
            </button>
          </div>
          {selectedDone ? (
            <div className="quest-detail-done">
              <Check size={16} strokeWidth={2.4} aria-hidden="true" />
              Claimed today
            </div>
          ) : (
            <div className="quest-detail-actions">
              <button type="button" className="quests-go" onClick={() => onGoToQuest(selectedQuest)}>
                <MapPinned size={16} strokeWidth={2.2} aria-hidden="true" />
                Go
              </button>
              <button
                type="button"
                className="quests-preview"
                onClick={() => setStreetViewQuest(selectedQuest)}
                aria-label={`Preview ${selectedQuest.place.name} in Street View`}
              >
                <Eye size={16} aria-hidden="true" />
                Street view
              </button>
              <button type="button" className="quests-claim" onClick={() => setCheckinQuest(selectedQuest)}>
                <Camera size={15} aria-hidden="true" /> Check in
              </button>
            </div>
          )}
        </aside>
      ) : null}

      {streetViewQuest ? (
        <StreetViewDialog
          name={streetViewQuest.place.name}
          position={streetViewQuest.place.position}
          onClose={() => setStreetViewQuest(null)}
        />
      ) : null}
      {checkinQuest ? (
        <PhotoCheckinDialog
          eventId={checkinQuest.id}
          placeName={checkinQuest.place.name}
          placePosition={checkinQuest.place.position}
          points={checkinQuest.points}
          onClose={() => setCheckinQuest(null)}
          onVerified={() => setProfile(readGamificationProfile())}
        />
      ) : null}
    </>
  );
}
