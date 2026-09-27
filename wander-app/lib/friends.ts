import { ensureSupabaseUser, getSupabase } from '@/lib/supabase';
import type { LeaderboardEntry } from '@/lib/gamification';

export type FriendRequest = { id: string; name: string };
export type FriendEntry = LeaderboardEntry & { completedWalks: number };
export type FriendsSnapshot = { pending: FriendRequest[]; entries: FriendEntry[] };

async function connection() {
  const client = getSupabase();
  if (!client) throw new Error('Connect Supabase to use friend requests and shared leaderboards.');
  if (!await ensureSupabaseUser()) throw new Error('Sign in to load your friends.');
  return client;
}

function checkError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === 'PGRST202') throw new Error('Friend requests need the latest database update.');
  throw new Error(error.message);
}

export async function loadFriends(): Promise<FriendsSnapshot> {
  const client = await connection();
  const { data, error } = await client.rpc('get_wander_friends');
  checkError(error);
  return {
    pending: data.pending,
    entries: data.entries.map((entry: Omit<FriendEntry, 'initials' | 'scope'>) => ({
      ...entry,
      initials: entry.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      scope: 'friends' as const,
    })),
  };
}

export async function respondToFriend(requesterId: string, accept: boolean) {
  const client = await connection();
  const { error } = await client.rpc('respond_wander_friend', { p_requester: requesterId, p_accept: accept });
  checkError(error);
  window.dispatchEvent(new Event('wander:friends'));
}

export async function sendFriendRequest(username: string) {
  const client = await connection();
  const { error } = await client.rpc('send_wander_friend', { p_username: username.trim() });
  checkError(error);
  window.dispatchEvent(new Event('wander:friends'));
}
