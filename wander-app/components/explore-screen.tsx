"use client";

import { ChevronRight, Search, Star, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { addTrailReview, getTrailReviewsSnapshot, subscribeToTrailReviews, type TrailReview } from "@/lib/trail-reviews";

export type ExploreSuggestion = {
  id: string;
  title: string;
  distanceKm: number;
  minutes: number;
  tags: string[];
  mode: "discover" | "heat";
  interests: string[];
  accent: "discover" | "heat";
};

const SUGGESTIONS: ExploreSuggestion[] = [
  {
    id: "coffee-crawl",
    title: "Laneway coffee crawl",
    distanceKm: 2.8,
    minutes: 38,
    tags: ["Great coffee", "Shady"],
    mode: "discover",
    interests: ["coffee", "art"],
    accent: "discover",
  },
  {
    id: "north-terrace",
    title: "North Terrace at dusk",
    distanceKm: 3.1,
    minutes: 42,
    tags: ["Heritage", "Photos"],
    mode: "heat",
    interests: ["green", "photo"],
    accent: "heat",
  },
  {
    id: "parkland-loop",
    title: "Parkland quiet loop",
    distanceKm: 2.2,
    minutes: 28,
    tags: ["Shady", "Green"],
    mode: "discover",
    interests: ["green"],
    accent: "discover",
  },
];

const FILTERS = ["For you", "Nearby", "Under 30 min", "Shady"] as const;

const SUGGESTED_ROUTE_PATHS: Record<string, string> = {
  "coffee-crawl": "M32 74 L62 74 L62 55 L94 55 L94 31 L132 31 L132 47 L168 47",
  "north-terrace": "M28 30 L68 30 L68 51 L104 51 L104 72 L142 72 L142 49 L174 49",
  "parkland-loop": "M34 63 L34 40 L70 40 L70 25 L122 25 L122 45 L164 45 L164 68 L114 68 L114 57 L76 57 L76 72",
};

function SuggestionRouteMap({ suggestion }: { suggestion: ExploreSuggestion }) {
  const routePath = SUGGESTED_ROUTE_PATHS[suggestion.id] ?? SUGGESTED_ROUTE_PATHS["coffee-crawl"];
  const points = [...routePath.matchAll(/([\d.]+) ([\d.]+)/g)];
  const firstPoint = points[0];
  const lastPoint = points.at(-1);

  return (
    <svg className={`explore-suggest-map is-${suggestion.accent}`} viewBox="0 0 200 100" aria-hidden="true">
      <path className="explore-map-streets" d="M-10 18H210 M-10 39H210 M-10 60H210 M-10 81H210 M40-5V105 M84-5V105 M128-5V105 M172-5V105" />
      <path className="explore-map-route-outline" d={routePath} />
      <path className="explore-map-route" d={routePath} />
      {firstPoint ? <circle className="explore-map-start" cx={firstPoint[1]} cy={firstPoint[2]} r="4.2" /> : null}
      {lastPoint ? <circle className="explore-map-end" cx={lastPoint[1]} cy={lastPoint[2]} r="3.2" /> : null}
    </svg>
  );
}

type ExploreScreenProps = {
  onOpenSuggestion: (suggestion: ExploreSuggestion) => void;
  onOpenCollection?: (id: string) => void;
};

export default function ExploreScreen({ onOpenSuggestion, onOpenCollection }: ExploreScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("For you");
  const [reviewingTrail, setReviewingTrail] = useState<ExploreSuggestion | null>(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const reviewsData = useSyncExternalStore(subscribeToTrailReviews, getTrailReviewsSnapshot, () => "[]");
  const reviews = useMemo(() => JSON.parse(reviewsData) as TrailReview[], [reviewsData]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = SUGGESTIONS.filter((item) => {
      if (filter === "Under 30 min" && item.minutes >= 30) return false;
      if (filter === "Shady" && !item.tags.includes("Shady") && item.mode !== "heat") return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q)
        || item.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
    return filtered.sort((first, second) => {
      const firstReviews = reviews.filter((review) => review.trailId === first.id);
      const secondReviews = reviews.filter((review) => review.trailId === second.id);
      const popularity = secondReviews.length - firstReviews.length;
      if (popularity !== 0) return popularity;
      const firstAverage = firstReviews.reduce((sum, review) => sum + review.rating, 0) / (firstReviews.length || 1);
      const secondAverage = secondReviews.reduce((sum, review) => sum + review.rating, 0) / (secondReviews.length || 1);
      return secondAverage - firstAverage;
    });
  }, [filter, query, reviews]);

  function openReview(trail: ExploreSuggestion) {
    setReviewingTrail(trail);
    setDraftRating(0);
    setDraftComment("");
    setReviewError(null);
  }

  function submitReview() {
    if (!reviewingTrail || draftRating < 1) {
      setReviewError("Choose a star rating to continue.");
      return;
    }
    const comment = draftComment.trim();
    if (comment.length < 3) {
      setReviewError("Add a short comment about this trail.");
      return;
    }
    try {
      addTrailReview({ trailId: reviewingTrail.id, rating: draftRating, comment });
      setReviewingTrail(null);
    } catch {
      setReviewError("Could not save your review in this browser.");
    }
  }

  return (
    <section className={`explore-screen${reviewingTrail ? " is-reviewing" : ""}`} aria-labelledby="explore-screen-title">
      <header className="explore-screen-header">
        <h1 id="explore-screen-title">Explore</h1>
        <p>Walks worth wandering.</p>
      </header>

      <label className="explore-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search routes and collections"
          aria-label="Search routes and collections"
        />
      </label>

      <div className="explore-filters" role="tablist" aria-label="Explore filters">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            className={filter === item ? "is-active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="explore-section-head">
        <h2>Popular near you</h2>
        <button type="button" className="explore-see-all">See all</button>
      </div>

      <div className="explore-suggest-scroller">
        {suggestions.map((item) => {
          const itemReviews = reviews.filter((review) => review.trailId === item.id);
          const average = itemReviews.reduce((sum, review) => sum + review.rating, 0) / (itemReviews.length || 1);
          return (
            <article key={item.id} className="explore-suggest-card">
              <button
                type="button"
                className="explore-suggest-open"
                aria-label={`Open ${item.title}`}
                onClick={() => onOpenSuggestion(item)}
              >
                <SuggestionRouteMap suggestion={item} />
                <span className="explore-suggest-body">
                  <span className={`explore-suggest-rating${itemReviews.length ? " has-ratings" : ""}`}>
                    {itemReviews.length ? (
                      <><Star size={13} fill="currentColor" aria-hidden="true" /> {average.toFixed(1)} · {itemReviews.length} {itemReviews.length === 1 ? "review" : "reviews"}</>
                    ) : "Be the first to review"}
                  </span>
                  <strong>{item.title}</strong>
                  <span className="explore-suggest-meta">{item.distanceKm.toFixed(1)} km · {item.minutes} min</span>
                  <span className="explore-suggest-tags">
                    {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </span>
                </span>
              </button>
              <button type="button" className="explore-review-trigger" onClick={() => openReview(item)}>
                <Star size={15} aria-hidden="true" /> Rate &amp; comment
              </button>
              {itemReviews.length ? (
                <p className="explore-latest-comment">“{itemReviews[0].comment}”</p>
              ) : null}
            </article>
          );
        })}
        {suggestions.length === 0 ? (
          <p className="explore-empty">No routes match that search.</p>
        ) : null}
      </div>

      <div className="explore-section-head">
        <h2>Popular collections</h2>
        <span className="explore-place">Adelaide</span>
      </div>

      <div className="explore-collections">
        <div className="explore-collection-shell is-coffee">
          <button
            type="button"
            className="explore-collection is-coffee"
            onClick={() => onOpenCollection?.("coffee")}
          >
            <span className="explore-collection-image is-coffee-photo">
              <Image
                src="/images/adelaide-flat-white.jpg"
                alt="Flat white served at an Adelaide cafe"
                fill
                sizes="56px"
                unoptimized
              />
            </span>
            <span className="explore-collection-copy">
              <strong>Best laneway coffee</strong>
              <span>7 routes · Curated by locals</span>
              <span className="explore-collection-credit">Photo: Ashton 29 · CC BY-SA 4.0</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <a className="explore-collection-source" href="https://commons.wikimedia.org/wiki/File:Flat_white_at_an_Adelaide_cafe.jpg" target="_blank" rel="noreferrer" aria-label="Image source and license for Adelaide cafe photo">Image source</a>
        </div>
        <div className="explore-collection-shell is-heritage">
          <button
            type="button"
            className="explore-collection is-heritage"
            onClick={() => onOpenCollection?.("heritage")}
          >
            <span className="explore-collection-image">
              <Image src="/images/north-adelaide-heritage.jpg" alt="Heritage-listed terrace building in North Adelaide" fill sizes="56px" unoptimized />
            </span>
            <span className="explore-collection-copy">
              <strong>North Adelaide heritage</strong>
              <span>5 routes · 112 saves</span>
              <span className="explore-collection-credit">Photo: Yu Chu Chin · CC BY-SA 4.0</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <a className="explore-collection-source" href="https://commons.wikimedia.org/wiki/File:Heritage-listed_building_on_Pennington_Terrace,_North_Adelaide_(028A8523).jpg" target="_blank" rel="noreferrer" aria-label="Image source and license for heritage building photo">Image source</a>
        </div>
      </div>

      {reviewingTrail ? (
        <div className="explore-review-backdrop">
          <button type="button" className="explore-review-scrim" aria-label="Close review form" onClick={() => setReviewingTrail(null)} />
          <dialog open className="explore-review-dialog" aria-labelledby="explore-review-title">
            <header>
              <div><span>Your trail review</span><h2 id="explore-review-title">{reviewingTrail.title}</h2></div>
              <button type="button" aria-label="Close review form" onClick={() => setReviewingTrail(null)}><X size={19} /></button>
            </header>
            <fieldset className="explore-review-stars">
              <legend>Rate this walk</legend>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" aria-label={`${rating} star${rating === 1 ? "" : "s"}`} aria-pressed={draftRating === rating} onClick={() => setDraftRating(rating)}>
                  <Star size={30} fill={draftRating >= rating ? "currentColor" : "none"} />
                </button>
              ))}
            </fieldset>
            <label className="explore-review-comment">
              <span>What should other walkers know?</span>
              <textarea value={draftComment} maxLength={500} rows={4} placeholder="Share a highlight, tip, or what you loved…" onChange={(event) => setDraftComment(event.target.value)} />
              <small>{draftComment.length}/500</small>
            </label>
            {reviewError ? <p className="explore-review-error" role="alert">{reviewError}</p> : null}
            <button type="button" className="explore-review-submit" onClick={submitReview}>Post review</button>
          </dialog>
        </div>
      ) : null}
    </section>
  );
}
