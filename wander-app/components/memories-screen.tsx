"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Building2, Circle, Coffee, Landmark, Trees, Trash2, X } from "lucide-react";
import { listWalkMemories, MEMORIES_CHANGED_EVENT } from "@/lib/walk-memories";

type MomentTone = "sage" | "sand" | "blue" | "lavender" | "olive" | "clay";
type MomentIcon = "tree" | "coffee" | "building" | "bridge" | "bench" | "circles" | "lamp";

type Moment = {
  id: string;
  day: string;
  tone: MomentTone;
  icon: MomentIcon;
  photoSrc?: string;
  mark?: string;
  label: string;
};

type MonthGroup = {
  id: string;
  title: string;
  count: number;
  moments: Moment[];
};

type PhotoMemory = {
  id: string;
  createdAt: string;
  monthId: string;
  src: string;
};

const PHOTO_STORAGE_KEY = "wander-memories-photos";
const PHOTO_CHANGE_EVENT = "wander-memories-photos-change";

function subscribeToPhotos(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PHOTO_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PHOTO_CHANGE_EVENT, onChange);
  };
}

function getPhotoSnapshot() {
  return localStorage.getItem(PHOTO_STORAGE_KEY) ?? "[]";
}

type Highlight = { id: string; url: string; label: string; date: string };

function useWalkHighlights() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  useEffect(() => {
    let active = true;
    let urls: string[] = [];
    const load = async () => {
      const memories = await listWalkMemories();
      if (!active) return;
      urls.forEach((url) => URL.revokeObjectURL(url));
      const next = memories.map((memory) => ({
        id: memory.id,
        url: URL.createObjectURL(memory.photo),
        label: memory.stopName || memory.routeTitle || "Wander",
        date: new Date(memory.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),
      }));
      urls = next.map((item) => item.url);
      setHighlights(next);
    };
    void load();
    window.addEventListener(MEMORIES_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(MEMORIES_CHANGED_EVENT, load);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  return highlights;
}

const MONTHS: MonthGroup[] = [
  {
    id: "may-2025",
    title: "May 2025",
    count: 8,
    moments: [
      { id: "m1", day: "28", tone: "sage", icon: "tree", photoSrc: "/pic%201.jpg", label: "Park canopy" },
      { id: "m2", day: "26", tone: "sand", icon: "coffee", photoSrc: "/pic%203.jpg", mark: "O", label: "Laneway coffee" },
      { id: "m3", day: "24", tone: "blue", icon: "building", photoSrc: "/pic%204.jpg", label: "Street facade" },
      { id: "m4", day: "22", tone: "lavender", icon: "bridge", photoSrc: "/pic%205.jpg", mark: "P", label: "River bridge" },
      { id: "m5", day: "19", tone: "olive", icon: "bench", photoSrc: "/pic%206.png", label: "Evening bench" },
      { id: "m6", day: "16", tone: "clay", icon: "circles", photoSrc: "/pic%207.jpg", mark: "S", label: "Plaza pause" },
      { id: "m7", day: "12", tone: "sage", icon: "lamp", photoSrc: "/pic%208.jpg", label: "Night walk" },
      { id: "m8", day: "09", tone: "blue", icon: "coffee", photoSrc: "/pic%209.jpg", label: "Morning brew" },
    ],
  },
  {
    id: "apr-2025",
    title: "April 2025",
    count: 6,
    moments: [
      { id: "a1", day: "27", tone: "lavender", icon: "tree", photoSrc: "/pic%2010.jpg", mark: "S", label: "Autumn leaves" },
      { id: "a2", day: "21", tone: "sand", icon: "building", photoSrc: "/pic%2011.jpg", label: "Market corner" },
      { id: "a3", day: "18", tone: "sage", icon: "bridge", photoSrc: "/pic%2012.jpg", label: "Torrens edge" },
      { id: "a4", day: "14", tone: "olive", icon: "coffee", photoSrc: "/pic%2013.jpg", mark: "P", label: "Shared espresso" },
      { id: "a5", day: "08", tone: "blue", icon: "bench", photoSrc: "/pic%2014.jpg", label: "Quiet square" },
      { id: "a6", day: "03", tone: "clay", icon: "circles", photoSrc: "/pic%2015.jpg", label: "Art stop" },
    ],
  },
  {
    id: "mar-2025",
    title: "March 2025",
    count: 8,
    moments: [
      { id: "c1", day: "29", tone: "sage", icon: "lamp", photoSrc: "/pic%2016.jpg", label: "Late stroll" },
      { id: "c2", day: "22", tone: "lavender", icon: "coffee", photoSrc: "/pic%2017.jpg", mark: "O", label: "First wander" },
      { id: "c3", day: "17", tone: "sand", icon: "tree", photoSrc: "/pic%2018.jpg", label: "Botanic path" },
      { id: "c4", day: "11", tone: "blue", icon: "building", photoSrc: "/pic%2019.jpg", label: "North Terrace" },
      { id: "c5", day: "04", tone: "olive", icon: "bridge", photoSrc: "/pic%2020.jpg", mark: "S", label: "Footbridge" },
      { id: "c6", day: "03", tone: "clay", icon: "tree", photoSrc: "/pic%2021.jpg", label: "Garden walk" },
      { id: "c7", day: "02", tone: "sage", icon: "building", photoSrc: "/pic%2022.jpg", label: "City detail" },
      { id: "c8", day: "01", tone: "sand", icon: "lamp", photoSrc: "/Summer%20sunset.jpg", label: "Summer sunset" },
    ],
  },
];

function MomentGlyph({ icon }: { icon: MomentIcon }) {
  const props = { size: 22, strokeWidth: 1.7, "aria-hidden": true as const };
  switch (icon) {
    case "tree":
      return <Trees {...props} />;
    case "coffee":
      return <Coffee {...props} />;
    case "building":
      return <Building2 {...props} />;
    case "bridge":
      return <Landmark {...props} />;
    case "bench":
      return <Landmark {...props} />;
    case "lamp":
      return <Landmark {...props} />;
    case "circles":
      return <Circle {...props} />;
    default:
      return <Circle {...props} />;
  }
}

export default function MemoriesScreen() {
  const photoData = useSyncExternalStore(subscribeToPhotos, getPhotoSnapshot, () => "[]");
  const photos = useMemo(
    () => (JSON.parse(photoData) as PhotoMemory[]).map((photo) => ({ ...photo, monthId: photo.monthId ?? MONTHS[0].id })),
    [photoData],
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const highlights = useWalkHighlights();
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const viewing = viewingIndex != null ? highlights[viewingIndex] : null;

  function handleDeletePhoto(photoId: string) {
    try {
      const nextPhotos = photos.filter((photo) => photo.id !== photoId);
      localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(nextPhotos));
      window.dispatchEvent(new Event(PHOTO_CHANGE_EVENT));
      setPhotoError(null);
    } catch {
      setPhotoError("Could not delete the photo. Please try again.");
    }
  }

  return (
    <section className="memories-screen" aria-labelledby="memories-screen-title">
      <header className="memories-screen-header">
        <div className="memories-screen-heading">
          <h1 id="memories-screen-title">Memories</h1>
          <p>The moments between destinations.</p>
        </div>
      </header>

      <p className="memories-stats">22 memories · 11 walks · 27 km</p>

      {highlights.length > 0 ? (
      <div className="memories-highlights" role="list" aria-label="Walk memories">
        {highlights.map((highlight, index) => (
          <button
            key={highlight.id}
            type="button"
            role="listitem"
            className="memories-highlight"
            aria-label={`Open memory from ${highlight.label}, ${highlight.date}`}
            onClick={() => setViewingIndex(index)}
          >
            <span className="memories-highlight-ring">
              <img src={highlight.url} alt="" />
            </span>
            <span className="memories-highlight-label">{highlight.label}</span>
          </button>
        ))}
      </div>
      ) : null}
      {photoError ? <output className="memories-photo-error">{photoError}</output> : null}

      {viewing ? (
        <div className="memory-viewer" role="dialog" aria-modal="true" aria-label={`Memory from ${viewing.label}`}>
          <div className="memory-viewer-bars" aria-hidden="true">
            {highlights.map((highlight, index) => (
              <span key={highlight.id} className={index <= (viewingIndex ?? 0) ? "is-seen" : ""} />
            ))}
          </div>
          <div className="memory-viewer-stage">
            <img src={viewing.url} alt={`Memory from ${viewing.label}`} />
            <button
              type="button"
              className="memory-viewer-tap is-prev"
              aria-label="Previous memory"
              onClick={() => setViewingIndex((current) => Math.max(0, (current ?? 0) - 1))}
            />
            <button
              type="button"
              className="memory-viewer-tap is-next"
              aria-label="Next memory"
              onClick={() => setViewingIndex((current) => {
                const next = (current ?? 0) + 1;
                return next >= highlights.length ? null : next;
              })}
            />
          </div>
          <div className="memory-viewer-caption">
            <div>
              <strong>{viewing.label}</strong>
              <span>{viewing.date}</span>
            </div>
            <button type="button" className="memory-viewer-close" aria-label="Close memory" onClick={() => setViewingIndex(null)}>
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : null}

      {MONTHS.map((month) => {
        const monthPhotos = photos.filter((photo) => photo.monthId === month.id);
        return (
          <section key={month.id} className="memories-month" aria-labelledby={`${month.id}-title`}>
            <div className="memories-section-head">
              <h2 id={`${month.id}-title`}>{month.title}</h2>
              <span>{month.count} moments</span>
            </div>
            <div className="memories-grid">
              {month.moments.map((moment, index) => {
                const photo = monthPhotos[index];
                const photoSrc = photo?.src ?? moment.photoSrc;
                return photoSrc ? (
                  <div key={moment.id} className="memories-tile memories-photo-tile">
                    <Image className="memories-photo-image" src={photoSrc} alt={`${moment.label}, ${month.title}`} fill sizes="25vw" unoptimized />
                    <span className="memories-tile-day">{moment.day}</span>
                    {photo ? (
                      <button
                        type="button"
                        className="memories-photo-delete"
                        aria-label={`Delete photo from ${month.title}`}
                        title="Delete photo"
                        onClick={() => handleDeletePhoto(photo.id)}
                      >
                        <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    key={moment.id}
                    type="button"
                    className={`memories-tile is-${moment.tone}`}
                    aria-label={`${moment.label}, ${moment.day} ${month.title}`}
                  >
                    {moment.mark ? <span className="memories-tile-mark">{moment.mark}</span> : null}
                    <span className="memories-tile-glyph" aria-hidden="true">
                      <MomentGlyph icon={moment.icon} />
                    </span>
                    <span className="memories-tile-day">{moment.day}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
