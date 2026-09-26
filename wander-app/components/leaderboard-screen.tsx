"use client";

import { Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  demoFriendsLeaderboard,
  demoGlobalLeaderboard,
  leaderboardBand,
  readGamificationProfile,
} from "@/lib/gamification";
import { loadCloudLeaderboard } from "@/lib/cloud-data";

type LeaderboardScreenProps = {
  onClose?: () => void;
};

export default function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const [tab, setTab] = useState<"friends" | "global">("friends");
  const [points, setPoints] = useState(() => readGamificationProfile().points);
  const [cloudEntries, setCloudEntries] = useState<Awaited<ReturnType<typeof loadCloudLeaderboard>>>(null);

  useEffect(() => {
    const update = () => setPoints(readGamificationProfile().points);
    window.addEventListener("wander:points", update);
    return () => window.removeEventListener("wander:points", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCloudLeaderboard().then((entries) => {
      if (!cancelled && entries?.length) setCloudEntries(entries);
    });
    return () => { cancelled = true; };
  }, [points]);

  const entries = useMemo(() => {
    const cloudYou = cloudEntries?.find((entry) => entry.id === "you");
    const score = typeof cloudYou?.points === "number" ? cloudYou.points : points;
    if (tab === "friends") return demoFriendsLeaderboard(score);
    // Keep demo global so friends/global ranks stay consistent; use cloud score for You.
    if (cloudEntries && cloudEntries.length >= 15) {
      return cloudEntries;
    }
    return demoGlobalLeaderboard(score);
  }, [cloudEntries, points, tab]);
  const yourIndex = entries.findIndex((entry) => entry.id === "you");
  const yourRank = yourIndex + 1;
  const you = yourIndex >= 0 ? entries[yourIndex] : null;

  const visible = useMemo(() => {
    if (tab === "friends") {
      return {
        rows: entries.map((person, index) => ({ person, rank: index + 1 })),
        youBelow: null as { person: NonNullable<typeof you>; rank: number } | null,
      };
    }
    const topFifteen = entries.slice(0, 15);
    const inTop = yourRank > 0 && yourRank <= 15;
    return {
      rows: topFifteen.map((person, index) => ({ person, rank: index + 1 })),
      youBelow: !inTop && you ? { person: you, rank: yourRank } : null,
    };
  }, [entries, tab, you, yourRank]);

  return (
    <section className="leaderboard-screen" aria-labelledby="leaderboard-screen-title">
      <header className="leaderboard-screen-header">
        <div>
          <h1 id="leaderboard-screen-title">
            <Trophy size={28} aria-hidden="true" />
            Leaderboard
          </h1>
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
        {visible.rows.map(({ person, rank }) => (
          <li
            key={person.id}
            className={[
              person.id === "you" ? "is-you" : "",
              tab === "global" ? leaderboardBand(rank) : "",
            ].filter(Boolean).join(" ")}
          >
            <span className="leaderboard-rank">{rank}</span>
            <span className="friends-avatar is-mint" aria-hidden="true">{person.initials}</span>
            <strong>{person.name}</strong>
            <span>{person.points.toLocaleString()} pts</span>
          </li>
        ))}
      </ol>
      {visible.youBelow ? (
        <ol className="leaderboard-screen-list leaderboard-list-you" start={visible.youBelow.rank}>
          <li
            className={[
              "is-you",
              tab === "global" ? leaderboardBand(visible.youBelow.rank) : "",
            ].filter(Boolean).join(" ")}
          >
            <span className="leaderboard-rank">{visible.youBelow.rank}</span>
            <span className="friends-avatar is-mint" aria-hidden="true">{visible.youBelow.person.initials}</span>
            <strong>{visible.youBelow.person.name}</strong>
            <span>{visible.youBelow.person.points.toLocaleString()} pts</span>
          </li>
        </ol>
      ) : null}
    </section>
  );
}
