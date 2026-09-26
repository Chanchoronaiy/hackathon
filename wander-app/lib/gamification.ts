import { ADELAIDE_PLACES, type AdelaidePlace } from "@/lib/adelaide-data";

const PROFILE_KEY = "wander:gamification";

export type DailyQuest = {
  id: string;
  place: AdelaidePlace;
  points: number;
  date: string;
};

export type GamificationProfile = {
  points: number;
  completedEventIds: string[];
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  initials: string;
  points: number;
  scope: "friends" | "global";
};

const EMPTY_PROFILE: GamificationProfile = { points: 0, completedEventIds: [] };

const QUEST_BONUSES = [220, 250, 280, 300, 340];

export function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hashDate(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Five deterministic Adelaide quests: identical for all users on the same local date. */
export function dailyQuests(date = new Date()): DailyQuest[] {
  const dateKey = localDateKey(date);
  const pool = ADELAIDE_PLACES.filter((place) => !["water", "calm"].includes(place.category));
  const start = hashDate(dateKey) % pool.length;
  const step = 7;
  return Array.from({ length: Math.min(5, pool.length) }, (_, index) => {
    const place = pool[(start + index * step) % pool.length];
    return {
      id: `${dateKey}:${place.id}`,
      place,
      points: QUEST_BONUSES[index % QUEST_BONUSES.length],
      date: dateKey,
    };
  });
}

export function readGamificationProfile(): GamificationProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<GamificationProfile> | null;
    return {
      points: typeof parsed?.points === "number" ? parsed.points : 0,
      completedEventIds: Array.isArray(parsed?.completedEventIds)
        ? parsed.completedEventIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function isQuestCompleted(questId: string, profile = readGamificationProfile()) {
  return profile.completedEventIds.includes(questId);
}

export function awardPoints(eventId: string, points: number): GamificationProfile {
  const current = readGamificationProfile();
  if (current.completedEventIds.includes(eventId)) return current;
  const next = {
    points: current.points + Math.max(0, Math.round(points)),
    completedEventIds: [...current.completedEventIds, eventId],
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("wander:points", { detail: next }));
  }
  return next;
}

export function completeDailyQuest(quest: DailyQuest): GamificationProfile {
  return awardPoints(quest.id, quest.points);
}

export function demoFriendsLeaderboard(userPoints: number): LeaderboardEntry[] {
  return [
    { id: "sam", name: "Sam P.", initials: "SP", points: 2140, scope: "friends" as const },
    { id: "priya", name: "Priya K.", initials: "PK", points: 1680, scope: "friends" as const },
    { id: "you", name: "You", initials: "AS", points: userPoints, scope: "friends" as const },
    { id: "mia", name: "Mia L.", initials: "ML", points: 940, scope: "friends" as const },
    { id: "tom", name: "Tom R.", initials: "TR", points: 720, scope: "friends" as const },
  ].sort((a, b) => b.points - a.points);
}

/** @deprecated Prefer demoFriendsLeaderboard */
export function demoLeaderboard(userPoints: number) {
  return demoFriendsLeaderboard(userPoints);
}

export function demoGlobalLeaderboard(userPoints: number): LeaderboardEntry[] {
  return [
    { id: "nova", name: "Nova Chen", initials: "NC", points: 9820, scope: "global" as const },
    { id: "rio", name: "Rio Alvarez", initials: "RA", points: 8640, scope: "global" as const },
    { id: "hana", name: "Hana Park", initials: "HP", points: 7410, scope: "global" as const },
    { id: "eli", name: "Eli Santos", initials: "ES", points: 6120, scope: "global" as const },
    { id: "sam-g", name: "Sam P.", initials: "SP", points: 2140, scope: "global" as const },
    { id: "you", name: "You", initials: "AS", points: userPoints, scope: "global" as const },
    { id: "priya-g", name: "Priya K.", initials: "PK", points: 1680, scope: "global" as const },
    { id: "kai", name: "Kai Moreau", initials: "KM", points: 1320, scope: "global" as const },
    { id: "mia-g", name: "Mia L.", initials: "ML", points: 940, scope: "global" as const },
    { id: "zoe", name: "Zoe Quinn", initials: "ZQ", points: 610, scope: "global" as const },
  ].sort((a, b) => b.points - a.points);
}
