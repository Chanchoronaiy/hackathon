'use client';

import { useEffect, useState } from 'react';
import { loadFriends, type FriendsSnapshot } from '@/lib/friends';

/** Both friends leaderboards use the same database query and refresh signals. */
export function useFriends() {
  const [snapshot, setSnapshot] = useState<FriendsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
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
  return { snapshot, error };
}
