"use client";

import { ChevronRight, Plus, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { demoFriendsLeaderboard, readGamificationProfile } from "@/lib/gamification";

type FriendsScreenProps = {
  friendsFogPercent: number;
  onOpenFriendsFog: () => void;
  onAddFriend?: () => void;
};

export default function FriendsScreen({
  friendsFogPercent,
  onOpenFriendsFog,
  onAddFriend,
}: FriendsScreenProps) {
  const [points, setPoints] = useState(() => readGamificationProfile().points);
  const [pending, setPending] = useState({
    id: "tom",
    initials: "TR",
    name: "Tom R.",
    detail: "3 mutual friends",
    visible: true,
  });
  useEffect(() => {
    const update = () => setPoints(readGamificationProfile().points);
    window.addEventListener("wander:points", update);
    return () => window.removeEventListener("wander:points", update);
  }, []);

  const leaderboard = useMemo(() => demoFriendsLeaderboard(points), [points]);

  return (
    <section className="friends-screen" aria-labelledby="friends-screen-title">
      <header className="friends-screen-header">
        <h1 id="friends-screen-title">Friends</h1>
        <p>Explore together, your own way.</p>
      </header>

      <button type="button" className="friends-add" onClick={onAddFriend}>
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        <span>Add a friend</span>
      </button>

      <button
        type="button"
        className="friends-fog-card"
        aria-label={`Friends fog, ${friendsFogPercent} percent uncovered. Open fog map.`}
        onClick={onOpenFriendsFog}
      >
        <span className="friends-fog-thumb" aria-hidden="true" />
        <span className="friends-fog-copy">
          <strong>Friends’ fog</strong>
          <span>Together, you’ve uncovered {friendsFogPercent}% of Adelaide.</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <div className="friends-section-title leaderboard-title">
        <span>Weekly leaderboard</span>
        <Trophy size={17} aria-hidden="true" />
      </div>
      <ol className="leaderboard-list">
        {leaderboard.map((person, index) => (
          <li key={person.id} className={person.id === "you" ? "is-you" : ""}>
            <span className="leaderboard-rank">{index + 1}</span>
            <span className="friends-avatar is-mint" aria-hidden="true">{person.initials}</span>
            <strong>{person.name}</strong>
            <span>{person.points.toLocaleString()} pts</span>
          </li>
        ))}
      </ol>

      {pending.visible ? (
        <>
          <h2 className="friends-section-title">Pending requests</h2>
          <div className="friends-pending">
            <span className="friends-avatar is-amber" aria-hidden="true">{pending.initials}</span>
            <span className="friends-row-copy">
              <strong>{pending.name}</strong>
              <span>{pending.detail}</span>
            </span>
            <button
              type="button"
              className="friends-accept"
              onClick={() => setPending((current) => ({ ...current, visible: false }))}
            >
              Accept
            </button>
            <button
              type="button"
              className="friends-decline"
              onClick={() => setPending((current) => ({ ...current, visible: false }))}
            >
              Decline
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
