"use client";

import { Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  demoGlobalLeaderboard,
  leaderboardBand,
  readGamificationProfile,
} from "@/lib/gamification";
import { useFriends } from "@/hooks/use-friends";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadCloudLeaderboard } from "@/lib/cloud-data";

type LeaderboardScreenProps = {
  onClose?: () => void;
};

export default function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const { entries: friendEntries } = useFriends();
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
    const refresh = () => {
      void loadCloudLeaderboard().then((entries) => {
        if (!cancelled && entries) setCloudEntries(entries);
      }).catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("wander:friends", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("wander:friends", refresh);
    };
  }, [points]);

  const entries = useMemo(() => {
    if (tab === "friends") return friendEntries;
    const cloudYou = cloudEntries?.find((entry) => entry.id === "you");
    // Local points land instantly; the cloud total can lag or miss events, so trust the higher one.
    const score = Math.max(cloudYou?.points ?? 0, points);
    const demo = demoGlobalLeaderboard(score);
    if (!cloudEntries) return isSupabaseConfigured() ? [] : demo;
    const real = cloudEntries.map((entry) => (entry.id === "you" ? { ...entry, points: score } : entry));
    if (!cloudYou) real.push(demo.find((entry) => entry.id === "you")!);
    const realIds = new Set(real.map((entry) => entry.id));
    const filler = real.length >= 15 ? [] : demo.filter((entry) => !realIds.has(entry.id));
    return [...real, ...filler].sort(
      (a, b) => b.points - a.points || (a.id === "you" ? -1 : b.id === "you" ? 1 : 0),
    );
  }, [cloudEntries, friendEntries, points, tab]);
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
        <strong>{(you?.points ?? points).toLocaleString()} pts</strong>
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
