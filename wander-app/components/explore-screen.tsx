"use client";

import { Camera, ChevronRight, Coffee, Eye, MapPin, Search, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import PhotoCheckinDialog from "@/components/photo-checkin-dialog";
import StreetViewDialog from "@/components/street-view-dialog";
import { dailyQuests, readGamificationProfile, type DailyQuest } from "@/lib/gamification";

export type ExploreSuggestion = {
  id: string;
  title: string;
  distanceKm: number;
  minutes: number;
  rating: number;
  reviews: number;
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
    rating: 4.9,
    reviews: 48,
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
    rating: 4.8,
    reviews: 36,
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
    rating: 4.7,
    reviews: 22,
    tags: ["Shady", "Green"],
    mode: "discover",
    interests: ["green"],
    accent: "discover",
  },
];

const FILTERS = ["For you", "Nearby", "Under 30 min", "Shady"] as const;

type ExploreScreenProps = {
  onOpenSuggestion: (suggestion: ExploreSuggestion) => void;
  onOpenCollection?: (id: string) => void;
};

export default function ExploreScreen({ onOpenSuggestion, onOpenCollection }: ExploreScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("For you");
  const [streetViewQuest, setStreetViewQuest] = useState<DailyQuest | null>(null);
  const [checkinQuest, setCheckinQuest] = useState<DailyQuest | null>(null);
  const [points, setPoints] = useState(() => readGamificationProfile().points);
  const quests = useMemo(() => dailyQuests(), []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUGGESTIONS.filter((item) => {
      if (filter === "Under 30 min" && item.minutes >= 30) return false;
      if (filter === "Shady" && !item.tags.includes("Shady") && item.mode !== "heat") return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q)
        || item.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [filter, query]);

  return (
    <section className="explore-screen" aria-labelledby="explore-screen-title">
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

      <div className="explore-section-head daily-quest-head">
        <div>
          <span><Sparkles size={14} /> Refreshes daily</span>
          <h2>Today’s five quests</h2>
        </div>
        <strong>{points.toLocaleString()} pts</strong>
      </div>

      <div className="daily-quest-scroller">
        {quests.map((quest, index) => (
          <article className="daily-quest-card" key={quest.id}>
            <span className="daily-quest-number">0{index + 1}</span>
            <span className="daily-quest-bonus">+{quest.points}</span>
            <h3>{quest.place.name}</h3>
            <p>{quest.place.reason}</p>
            <div>
              <button type="button" onClick={() => setStreetViewQuest(quest)}><Eye size={15} /> Street View</button>
              <button type="button" onClick={() => setCheckinQuest(quest)}><Camera size={15} /> Check in</button>
            </div>
          </article>
        ))}
      </div>

      <div className="explore-section-head">
        <h2>Suggested near you</h2>
        <button type="button" className="explore-see-all">See all</button>
      </div>

      <div className="explore-suggest-scroller">
        {suggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="explore-suggest-card"
            aria-label={`Open ${item.title}`}
            onClick={() => onOpenSuggestion(item)}
          >
            <span className={`explore-suggest-map is-${item.accent}`} aria-hidden="true" />
            <span className="explore-suggest-body">
              <span className="explore-suggest-rating">
                <Star size={13} fill="currentColor" aria-hidden="true" />
                {item.rating.toFixed(1)} ({item.reviews})
              </span>
              <strong>{item.title}</strong>
              <span className="explore-suggest-meta">
                {item.distanceKm.toFixed(1)} km · {item.minutes} min
              </span>
              <span className="explore-suggest-tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </span>
            </span>
          </button>
        ))}
        {suggestions.length === 0 ? (
          <p className="explore-empty">No routes match that search.</p>
        ) : null}
      </div>

      <div className="explore-section-head">
        <h2>Popular collections</h2>
        <span className="explore-place">Adelaide</span>
      </div>

      <div className="explore-collections">
        <button
          type="button"
          className="explore-collection is-coffee"
          onClick={() => onOpenCollection?.("coffee")}
        >
          <span className="explore-collection-icon" aria-hidden="true"><Coffee size={18} /></span>
          <span className="explore-collection-copy">
            <strong>Best laneway coffee</strong>
            <span>7 routes · Curated by locals</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="explore-collection is-heritage"
          onClick={() => onOpenCollection?.("heritage")}
        >
          <span className="explore-collection-icon" aria-hidden="true"><MapPin size={18} /></span>
          <span className="explore-collection-copy">
            <strong>North Adelaide heritage</strong>
            <span>5 routes · 112 saves</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {streetViewQuest ? (
        <StreetViewDialog
          name={streetViewQuest.place.name}
          position={streetViewQuest.place.position}
          onClose={() => setStreetViewQuest(null)}
        />
      ) : null}
      {checkinQuest ? (
        <PhotoCheckinDialog
          eventId={checkinQuest.id}
          placeName={checkinQuest.place.name}
          placePosition={checkinQuest.place.position}
          points={checkinQuest.points}
          onClose={() => setCheckinQuest(null)}
          onVerified={setPoints}
        />
      ) : null}
    </section>
  );
}
