import type { LeaderboardEntry } from '@/lib/gamification';
import type { LatLng } from '@/lib/route-planner';
import type { SavedTrial } from '@/lib/saved-trials';
import {
  ensureSupabaseUser,
  getSupabase,
  isSupabaseConfigured,
} from '@/lib/supabase';

type CloudRouteRow = {
  id: string;
  title: string;
  route_data: Omit<SavedTrial, 'id' | 'savedAt'>;
  created_at: string;
};

export async function loadCloudTrials(): Promise<SavedTrial[] | null> {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return null;
  const { data, error } = await supabase
    .from('routes')
    .select('id,title,route_data,created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return null;
  return ((data ?? []) as CloudRouteRow[]).map((row) => ({
    ...row.route_data,
    id: row.id,
    title: row.title,
    savedAt: row.created_at,
  }));
}

export async function syncSavedTrial(
  trial: SavedTrial,
): Promise<SavedTrial | null> {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return null;
  const { id: _localId, savedAt: _savedAt, ...routeData } = trial;
  const { data, error } = await supabase
    .from('routes')
    .insert({
      user_id: user.id,
      title: trial.title?.trim() || 'Adelaide wander',
      route_data: routeData,
    })
    .select('id,title,route_data,created_at')
    .single();
  if (error || !data) return null;
  const row = data as CloudRouteRow;
  return {
    ...row.route_data,
    id: row.id,
    title: row.title,
    savedAt: row.created_at,
  };
}

export async function removeCloudTrial(id: string) {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user || id.startsWith('trial-')) return false;
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  return !error;
}

export async function syncPointsEvent(
  eventKey: string,
  points: number,
  reason: string,
) {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return null;
  const { data, error } = await supabase.rpc('award_wander_points', {
    p_event_key: eventKey,
    p_points: Math.max(0, Math.round(points)),
    p_reason: reason,
  });
  return error || typeof data !== 'number' ? null : data;
}

export async function submitCloudCheckin({
  eventKey,
  placeId,
  placeName,
  placePosition,
  currentPosition,
  points,
  photo,
}: {
  eventKey: string;
  placeId: string;
  placeName: string;
  placePosition: LatLng;
  currentPosition: LatLng;
  points: number;
  photo: File;
}) {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return null;
  const extension =
    photo.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';
  const photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('checkin-photos')
    .upload(photoPath, photo, {
      contentType: photo.type || 'image/jpeg',
      upsert: false,
    });
  if (uploadError) return null;
  const { data, error } = await supabase.rpc('complete_wander_checkin', {
    p_event_key: eventKey,
    p_place_id: placeId,
    p_place_name: placeName,
    p_place_latitude: placePosition[0],
    p_place_longitude: placePosition[1],
    p_checkin_latitude: currentPosition[0],
    p_checkin_longitude: currentPosition[1],
    p_photo_path: photoPath,
    p_points: Math.max(0, Math.round(points)),
  });
  return error || typeof data !== 'number' ? null : data;
}

/**
 * Stores a walk's one memory in Supabase. The `walk_memories` table has a
 * unique (user_id, walk_id) constraint, so the database rejects a second
 * memory for the same walk (Postgres error 23505) — reported as 'duplicate'.
 */
export async function syncWalkMemory({
  walkId,
  routeTitle,
  stopId,
  stopName,
  photo,
}: {
  walkId: string;
  routeTitle: string;
  stopId?: string;
  stopName?: string;
  photo: Blob;
}): Promise<'saved' | 'duplicate' | 'skipped' | 'error'> {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return 'skipped';
  const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  // One fixed path per walk: storage also refuses a second upload (upsert: false).
  const photoPath = `${user.id}/memories/${walkId}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('checkin-photos')
    .upload(photoPath, photo, {
      contentType: photo.type || 'image/jpeg',
      upsert: false,
    });
  if (uploadError && !/exists|duplicate/i.test(uploadError.message)) return 'error';
  const { error } = await supabase.from('walk_memories').insert({
    user_id: user.id,
    walk_id: walkId,
    route_title: routeTitle,
    stop_id: stopId ?? null,
    stop_name: stopName ?? null,
    photo_path: photoPath,
  });
  if (!error) return 'saved';
  return error.code === '23505' ? 'duplicate' : 'error';
}

export async function loadCloudLeaderboard(): Promise<
  LeaderboardEntry[] | null
> {
  const supabase = getSupabase();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return null;
  const { data, error } = await supabase
    .from('global_leaderboard')
    .select('id,username,total_points')
    .limit(50);
  if (error) return null;
  return (data ?? []).map(
    (row: { id: string; username: string; total_points: number }) => ({
      id: row.id === user.id ? 'you' : row.id,
      name: row.id === user.id ? 'You' : row.username,
      initials: initialsFor(row.username),
      points: row.total_points,
      scope: 'global' as const,
    }),
  );
}

export { isSupabaseConfigured };

function initialsFor(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'W'
  );
}
