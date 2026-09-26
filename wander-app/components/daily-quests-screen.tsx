"use client";

import { Camera, Check, Eye, MapPinned, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PhotoCheckinDialog from "@/components/photo-checkin-dialog";
import StreetViewDialog from "@/components/street-view-dialog";
import {
  dailyQuests,
  isQuestCompleted,
  readGamificationProfile,
  type DailyQuest,
} from "@/lib/gamification";

type DailyQuestsScreenProps = {
  onGoToQuest: (quest: DailyQuest) => void;
  onOpenLeaderboard: () => void;
  onClose?: () => void;
};

export default function DailyQuestsScreen({
  onGoToQuest,
  onOpenLeaderboard,
  onClose,
}: DailyQuestsScreenProps) {
  const quests = useMemo(() => dailyQuests(), []);
  const [profile, setProfile] = useState(() => readGamificationProfile());
  const [streetViewQuest, setStreetViewQuest] = useState<DailyQuest | null>(null);
  const [checkinQuest, setCheckinQuest] = useState<DailyQuest | null>(null);

  useEffect(() => {
    const update = () => setProfile(readGamificationProfile());
    window.addEventListener("wander:points", update);
    return () => window.removeEventListener("wander:points", update);
  }, []);

  const doneCount = quests.filter((quest) => isQuestCompleted(quest.id, profile)).length;

  return (
    <section className="quests-screen" aria-labelledby="quests-screen-title">
      <header className="quests-screen-header">
        <div>
          <p className="quests-kicker">Daily · Adelaide</p>
          <h1 id="quests-screen-title">Daily quests</h1>
          <p>Hit 5 spots for extra points. They feed friends & global boards.</p>
        </div>
        {onClose ? (
          <button type="button" className="quests-close" aria-label="Close daily quests" onClick={onClose}>
            ×
          </button>
        ) : null}
      </header>

      <div className="quests-summary">
        <span>
          <Sparkles size={16} aria-hidden="true" />
          {doneCount}/{quests.length} claimed today
        </span>
        <strong>{profile.points.toLocaleString()} pts</strong>
      </div>

      <ul className="quests-list">
        {quests.map((quest, index) => {
          const done = isQuestCompleted(quest.id, profile);
          return (
            <li key={quest.id} className={done ? "is-done" : ""}>
              <span className="quests-index" aria-hidden="true">{index + 1}</span>
              <div className="quests-copy">
                <strong>{quest.place.name}</strong>
                <p>{quest.place.reason}</p>
                <span className="quests-bonus">+{quest.points} extra pts</span>
              </div>
              <div className="quests-actions">
                {done ? (
                  <span className="quests-claimed">
                    <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                    Done
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="quests-go"
                      onClick={() => onGoToQuest(quest)}
                    >
                      <MapPinned size={16} strokeWidth={2.2} aria-hidden="true" />
                      Go
                    </button>
                    <button type="button" className="quests-preview" onClick={() => setStreetViewQuest(quest)} aria-label={`Preview ${quest.place.name} in Street View`}>
                      <Eye size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="quests-claim" onClick={() => setCheckinQuest(quest)}>
                      <Camera size={15} aria-hidden="true" /> Check in
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <button type="button" className="quests-leaderboard-link" onClick={onOpenLeaderboard}>
        <Trophy size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>See friends & global leaderboard</span>
      </button>
      {streetViewQuest ? (
        <StreetViewDialog name={streetViewQuest.place.name} position={streetViewQuest.place.position} onClose={() => setStreetViewQuest(null)} />
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
    </section>
  );
}
