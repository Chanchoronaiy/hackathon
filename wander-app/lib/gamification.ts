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
export const WALK_POINTS_PER_MINUTE = 10;

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

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleForDate<T>(items: T[], dateKey: string) {
  const shuffled = [...items];
  const random = seededRandom(hashDate(dateKey));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** Five deterministic Adelaide quests: identical for all users on the same local date. */
export function dailyQuests(date = new Date()): DailyQuest[] {
  const dateKey = localDateKey(date);
  const pool = ADELAIDE_PLACES.filter((place) => !["water", "calm"].includes(place.category));
  const selectedPlaces = shuffleForDate(pool, dateKey).slice(0, Math.min(5, pool.length));
  return selectedPlaces.map((place, index) => {
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
  return profile.completedEventIds.includes(questId)
    || profile.completedEventIds.includes(`daily:${questId}`);
}

export function awardPoints(eventId: string, points: number, syncCloud = true): GamificationProfile {
  const current = readGamificationProfile();
  if (current.completedEventIds.includes(eventId)) return current;
  const next = {
    points: current.points + Math.max(0, Math.round(points)),
    completedEventIds: [...current.completedEventIds, eventId],
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("wander:points", { detail: next }));
    if (syncCloud) {
      void import("@/lib/cloud-data")
        .then(({ syncPointsEvent }) => syncPointsEvent(eventId, points, "Wander activity"))
        .then((cloudPoints) => {
          if (typeof cloudPoints !== "number") return;
          const synced = { ...readGamificationProfile(), points: cloudPoints };
          window.localStorage.setItem(PROFILE_KEY, JSON.stringify(synced));
          window.dispatchEvent(new CustomEvent("wander:points", { detail: synced }));
        })
        .catch(() => undefined);
    }
  }
  return next;
}

export function completeDailyQuest(quest: DailyQuest): GamificationProfile {
  return awardPoints(quest.id, quest.points);
}

export function walkPointsForMinutes(minutes: number) {
  const completedMinutes = Math.max(1, Math.min(180, Math.round(minutes)));
  return completedMinutes * WALK_POINTS_PER_MINUTE;
}

/** Awards a completed walk once locally, then reconciles the total with Supabase. */
export function completeWalk(eventId: string, minutes: number): GamificationProfile {
  const completedMinutes = Math.max(1, Math.min(180, Math.round(minutes)));
  const next = awardPoints(eventId, walkPointsForMinutes(completedMinutes), false);

  if (typeof window !== "undefined") {
    void import("@/lib/cloud-data")
      .then(({ syncCompletedWalk }) => syncCompletedWalk(eventId, completedMinutes))
      .then((cloudPoints) => {
        if (typeof cloudPoints !== "number") return;
        const synced = { ...readGamificationProfile(), points: cloudPoints };
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(synced));
        window.dispatchEvent(new CustomEvent("wander:points", { detail: synced }));
      })
      .catch(() => undefined);
  }

  return next;
}

type DemoPerson = {
  id: string;
  name: string;
  initials: string;
  points: number;
  friend?: boolean;
};

function demoRoster(userPoints: number): DemoPerson[] {
  return [
    { id: "nova", name: "Nova Chen", initials: "NC", points: 9820 },
    { id: "rio", name: "Rio Alvarez", initials: "RA", points: 8640 },
    { id: "hana", name: "Hana Park", initials: "HP", points: 7410 },
    { id: "eli", name: "Eli Santos", initials: "ES", points: 6120 },
    { id: "mira", name: "Mira Okonkwo", initials: "MO", points: 5280 },
    { id: "finn", name: "Finn Blake", initials: "FB", points: 4610 },
    { id: "yuki", name: "Yuki Sato", initials: "YS", points: 4020 },
    { id: "lara", name: "Lara Mendes", initials: "LM", points: 3580 },
    { id: "owen", name: "Owen Hart", initials: "OH", points: 3110 },
    { id: "ivy", name: "Ivy Cho", initials: "IC", points: 2740 },
    { id: "sam", name: "Sam P.", initials: "SP", points: 2140, friend: true },
    { id: "nate", name: "Nate Cole", initials: "Na", points: 1980 },
    { id: "priya", name: "Priya K.", initials: "PK", points: 1680, friend: true },
    { id: "jordan", name: "Jordan W.", initials: "JW", points: 1420, friend: true },
    { id: "kai", name: "Kai Moreau", initials: "KM", points: 1320, friend: true },
    { id: "beau", name: "Beau Tran", initials: "BT", points: 1100 },
    { id: "mia", name: "Mia L.", initials: "ML", points: 940, friend: true },
    { id: "reed", name: "Reed Patel", initials: "RP", points: 780 },
    { id: "tom", name: "Tom R.", initials: "TR", points: 720, friend: true },
    { id: "zoe", name: "Zoe Quinn", initials: "ZQ", points: 610 },
    { id: "aria", name: "Aria West", initials: "AW", points: 430 },
    { id: "jun", name: "Jun Park", initials: "JP", points: 290 },
    { id: "you", name: "You", initials: "AS", points: userPoints, friend: true },
    { id: "leo", name: "Leo Frost", initials: "LF", points: Math.max(0, userPoints - 35) },
  ];
}

function sortLeaderboard(entries: LeaderboardEntry[]) {
  return [...entries].sort(
    (a, b) => b.points - a.points || (a.id === "you" ? -1 : b.id === "you" ? 1 : 0),
  );
}

export function demoFriendsLeaderboard(userPoints: number): LeaderboardEntry[] {
  return sortLeaderboard(
    demoRoster(userPoints)
      .filter((person) => person.friend)
      .map((person) => ({
        id: person.id,
        name: person.name,
        initials: person.initials,
        points: person.points,
        scope: "friends" as const,
      })),
  );
}

/** @deprecated Prefer demoFriendsLeaderboard */
export function demoLeaderboard(userPoints: number) {
  return demoFriendsLeaderboard(userPoints);
}

export function demoGlobalLeaderboard(userPoints: number): LeaderboardEntry[] {
  return sortLeaderboard(
    demoRoster(userPoints).map((person) => ({
      id: person.id,
      name: person.name,
      initials: person.initials,
      points: person.points,
      scope: "global" as const,
    })),
  );
}

export function leaderboardBand(rank: number) {
  if (rank <= 0) return "band-rest";
  if (rank <= 5) return "band-1";
  if (rank <= 10) return "band-2";
  if (rank <= 15) return "band-3";
  return "band-rest";
}
