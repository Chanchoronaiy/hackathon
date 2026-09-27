export type TrailReview = {
  id: string;
  trailId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const STORAGE_KEY = "wander:trail-reviews";
export const TRAIL_REVIEWS_EVENT = "wander-trail-reviews-updated";

export function readTrailReviews(): TrailReview[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((review): review is TrailReview => (
      Boolean(review)
      && typeof review.id === "string"
      && typeof review.trailId === "string"
      && typeof review.rating === "number"
      && review.rating >= 1
      && review.rating <= 5
      && typeof review.comment === "string"
      && typeof review.createdAt === "string"
    ));
  } catch {
    return [];
  }
}

export function getTrailReviewsSnapshot() {
  return JSON.stringify(readTrailReviews());
}

export function subscribeToTrailReviews(onChange: () => void) {
  window.addEventListener(TRAIL_REVIEWS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TRAIL_REVIEWS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function addTrailReview(review: Omit<TrailReview, "id" | "createdAt">) {
  const next: TrailReview[] = [
    {
      ...review,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
    ...readTrailReviews(),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(TRAIL_REVIEWS_EVENT));
}