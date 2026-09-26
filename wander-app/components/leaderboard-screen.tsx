"use client";

import { Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  demoFriendsLeaderboard,
  demoGlobalLeaderboard,
  readGamificationProfile,
} from "@/lib/gamification";

type LeaderboardScreenProps = {
  onClose?: () => void;
};

export default function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const [tab, setTab] = useState<"friends" | "global">("friends");
  const [points, setPoints] = useState(() => readGamificationProfile().points);

  useEffect(() => {
    const update = () => setPoints(readGamificationProfile().points);
    window.addEventListener("wander:points", update);
    return () => window.removeEventListener("wander:points", update);
  }, []);

  const entries = useMemo(
    () => (tab === "friends" ? demoFriendsLeaderboard(points) : demoGlobalLeaderboard(points)),
    [points, tab],
  );
  const yourRank = entries.findIndex((entry) => entry.id === "you") + 1;

  return (
    <section className="leaderboard-screen" aria-labelledby="leaderboard-screen-title">
      <header className="leaderboard-screen-header">
        <div>
          <p className="leaderboard-kicker">
            <Trophy size={14} aria-hidden="true" />
            Points
          </p>
          <h1 id="leaderboard-screen-title">Leaderboard</h1>
          <p>Daily quests and walks add points here.</p>
        </div>
        {onClose ? (
          <button type="button" className="leaderboard-close" aria-label="Close leaderboard" onClick={onClose}>
            ×
          </button>
        ) : null}
      </header>

      <div className="leaderboard-you">
        <strong>{points.toLocaleString()} pts</strong>
        <span>
          You’re #{yourRank || "—"} on {tab === "friends" ? "friends" : "global"}
        </span>
      </div>

      <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard scope">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "friends"}
          className={tab === "friends" ? "is-active" : ""}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "global"}
          className={tab === "global" ? "is-active" : ""}
          onClick={() => setTab("global")}
        >
          Global
        </button>
      </div>

      <ol className="leaderboard-screen-list">
        {entries.map((person, index) => (
          <li key={person.id} className={person.id === "you" ? "is-you" : ""}>
            <span className="leaderboard-rank">{index + 1}</span>
            <span className="friends-avatar is-mint" aria-hidden="true">{person.initials}</span>
            <strong>{person.name}</strong>
            <span>{person.points.toLocaleString()} pts</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
