'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadFriends, type FriendEntry, type FriendsSnapshot } from '@/lib/friends';
import { demoFriendsLeaderboard, readGamificationProfile } from '@/lib/gamification';

/** Demo friends fill the board around real ones so it never looks empty. */
function withDemoFriends(real: FriendEntry[], points: number): FriendEntry[] {
  const realIds = new Set(real.map((entry) => entry.id));
  const demo = demoFriendsLeaderboard(points)
    .filter((entry) => !realIds.has(entry.id))
    .map((entry) => ({ ...entry, completedWalks: Math.max(1, Math.round(entry.points / 140)) }));
  const synced = real.map((entry) => (
    entry.id === 'you' ? { ...entry, points: Math.max(entry.points, points) } : entry
  ));
  return [...synced, ...demo].sort(
    (a, b) => b.points - a.points || (a.id === 'you' ? -1 : b.id === 'you' ? 1 : 0),
  );
}

/** Both friends leaderboards use the same database query and refresh signals. */
export function useFriends() {
  const [snapshot, setSnapshot] = useState<FriendsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState(() => readGamificationProfile().points);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      setPoints(readGamificationProfile().points);
      try {
        const next = await loadFriends();
        if (active && request === generation) { setSnapshot(next); setError(null); }
      } catch (reason) {
        if (active && request === generation) setError(reason instanceof Error ? reason.message : 'Could not load friends.');
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('wander:friends', refresh);
    window.addEventListener('wander:points', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('wander:friends', refresh);
      window.removeEventListener('wander:points', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const entries = useMemo(() => withDemoFriends(snapshot?.entries ?? [], points), [snapshot, points]);
  return { snapshot, entries, error };
}
