"use client";

const REMIX_KEY = "wander:remix-tries";
const FREE_TRIES_PER_WEEK = 3;
const PAID_PACK_TRIES = 2;

export type RemixTriesState = {
  weekKey: string;
  used: number;
  bonus: number;
};

function localWeekKey(date = new Date()) {
  // Monday-start week in Australia/Adelaide local calendar.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekday = local.getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  local.setUTCDate(local.getUTCDate() + mondayOffset);
  return local.toISOString().slice(0, 10);
}

function emptyState(weekKey = localWeekKey()): RemixTriesState {
  return { weekKey, used: 0, bonus: 0 };
}

export function readRemixTries(): RemixTriesState {
  if (typeof window === "undefined") return emptyState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REMIX_KEY) ?? "null") as Partial<RemixTriesState> | null;
    const weekKey = localWeekKey();
    if (!parsed || parsed.weekKey !== weekKey) return emptyState(weekKey);
    return {
      weekKey,
      used: typeof parsed.used === "number" ? Math.max(0, parsed.used) : 0,
      bonus: typeof parsed.bonus === "number" ? Math.max(0, parsed.bonus) : 0,
    };
  } catch {
    return emptyState();
  }
}

function writeRemixTries(state: RemixTriesState) {
  if (typeof window === "undefined") return state;
  window.localStorage.setItem(REMIX_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("wander:remix-tries", { detail: state }));
  return state;
}

export function remixTriesRemaining(state = readRemixTries()) {
  return Math.max(0, FREE_TRIES_PER_WEEK + state.bonus - state.used);
}

export function canRemix(state = readRemixTries()) {
  return remixTriesRemaining(state) > 0;
}

export function consumeRemixTry(): RemixTriesState {
  const current = readRemixTries();
  if (remixTriesRemaining(current) <= 0) return current;
  return writeRemixTries({ ...current, used: current.used + 1 });
}

/** Demo checkout: unlock +2 remixes for $5. */
export function purchaseRemixPack(): RemixTriesState {
  const current = readRemixTries();
  return writeRemixTries({ ...current, bonus: current.bonus + PAID_PACK_TRIES });
}

export const REMIX_FREE_TRIES = FREE_TRIES_PER_WEEK;
export const REMIX_PACK_PRICE = 5;
export const REMIX_PACK_TRIES = PAID_PACK_TRIES;
