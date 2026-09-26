"use client";

import { ChevronRight, Plus, Trophy, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { demoFriendsLeaderboard, readGamificationProfile } from "@/lib/gamification";

const CIRCLE = [
  { id: "sam", initials: "SP", name: "Sam P.", detail: "2 shared memories", percent: "31%", tone: "peach" },
  { id: "priya", initials: "PK", name: "Priya K.", detail: "Adelaide explored", percent: "18%", tone: "mint" },
  { id: "mia", initials: "ML", name: "Mia L.", detail: "1 shared memory", percent: "9%", tone: "lavender" },
];

const ACTIVITY = [
  { id: "a1", tone: "orange", text: "Sam added 3 photos to Laneway Coffee Crawl", when: "2h" },
  { id: "a2", tone: "green", text: "Priya explored 5% more of North Adelaide", when: "Yesterday" },
];

type FriendsScreenProps = {
  onAddFriend?: () => void;
};

export default function FriendsScreen({ onAddFriend }: FriendsScreenProps) {
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

      <h2 className="friends-section-title">Your circle</h2>
      <ul className="friends-circle">
        {CIRCLE.map((friend) => (
          <li key={friend.id}>
            <button type="button" className="friends-row" aria-label={`${friend.name}, ${friend.percent} explored`}>
              <span className={`friends-avatar is-${friend.tone}`} aria-hidden="true">{friend.initials}</span>
              <span className="friends-row-copy">
                <strong>{friend.name}</strong>
                <span>{friend.detail}</span>
              </span>
              <span className="friends-percent">{friend.percent}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="friends-fog-card" aria-label="Friends fog, 46 percent uncovered">
        <span className="friends-fog-thumb" aria-hidden="true" />
        <span className="friends-fog-copy">
          <strong>Friends’ fog</strong>
          <span>Together, you’ve uncovered 46% of Adelaide.</span>
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

      <h2 className="friends-section-title">Recent activity</h2>
      <ul className="friends-activity">
        {ACTIVITY.map((item) => (
          <li key={item.id}>
            <span className={`friends-activity-dot is-${item.tone}`} aria-hidden="true" />
            <span className="friends-activity-text">{item.text}</span>
            <span className="friends-activity-when">{item.when}</span>
          </li>
        ))}
      </ul>

      <p className="friends-hint">
        <UserPlus size={14} aria-hidden="true" />
        Demo circle — invite friends when accounts ship.
      </p>
    </section>
  );
}
