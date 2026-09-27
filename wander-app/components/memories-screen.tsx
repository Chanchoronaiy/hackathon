"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { Building2, CalendarDays, Camera, Circle, Coffee, Landmark, Trees, Trash2 } from "lucide-react";

type MomentTone = "sage" | "sand" | "blue" | "lavender" | "olive" | "clay";
type MomentIcon = "tree" | "coffee" | "building" | "bridge" | "bench" | "circles" | "lamp";

type Moment = {
  id: string;
  day: string;
  tone: MomentTone;
  icon: MomentIcon;
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

async function compressPhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.78);
}

const MONTHS: MonthGroup[] = [
  {
    id: "may-2025",
    title: "May 2025",
    count: 8,
    moments: [
      { id: "m1", day: "28", tone: "sage", icon: "tree", label: "Park canopy" },
      { id: "m2", day: "26", tone: "sand", icon: "coffee", mark: "O", label: "Laneway coffee" },
      { id: "m3", day: "24", tone: "blue", icon: "building", label: "Street facade" },
      { id: "m4", day: "22", tone: "lavender", icon: "bridge", mark: "P", label: "River bridge" },
      { id: "m5", day: "19", tone: "olive", icon: "bench", label: "Evening bench" },
      { id: "m6", day: "16", tone: "clay", icon: "circles", mark: "S", label: "Plaza pause" },
      { id: "m7", day: "12", tone: "sage", icon: "lamp", label: "Night walk" },
      { id: "m8", day: "09", tone: "blue", icon: "coffee", label: "Morning brew" },
    ],
  },
  {
    id: "apr-2025",
    title: "April 2025",
    count: 6,
    moments: [
      { id: "a1", day: "27", tone: "lavender", icon: "tree", mark: "S", label: "Autumn leaves" },
      { id: "a2", day: "21", tone: "sand", icon: "building", label: "Market corner" },
      { id: "a3", day: "18", tone: "sage", icon: "bridge", label: "Torrens edge" },
      { id: "a4", day: "14", tone: "olive", icon: "coffee", mark: "P", label: "Shared espresso" },
      { id: "a5", day: "08", tone: "blue", icon: "bench", label: "Quiet square" },
      { id: "a6", day: "03", tone: "clay", icon: "circles", label: "Art stop" },
    ],
  },
  {
    id: "mar-2025",
    title: "March 2025",
    count: 5,
    moments: [
      { id: "c1", day: "29", tone: "sage", icon: "lamp", label: "Late stroll" },
      { id: "c2", day: "22", tone: "lavender", icon: "coffee", mark: "O", label: "First wander" },
      { id: "c3", day: "17", tone: "sand", icon: "tree", label: "Botanic path" },
      { id: "c4", day: "11", tone: "blue", icon: "building", label: "North Terrace" },
      { id: "c5", day: "04", tone: "olive", icon: "bridge", mark: "S", label: "Footbridge" },
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoData = useSyncExternalStore(subscribeToPhotos, getPhotoSnapshot, () => "[]");
  const photos = useMemo(
    () => (JSON.parse(photoData) as PhotoMemory[]).map((photo) => ({ ...photo, monthId: photo.monthId ?? MONTHS[0].id })),
    [photoData],
  );
  const [targetMonthId, setTargetMonthId] = useState(MONTHS[0].id);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const targetMonth = MONTHS.find((month) => month.id === targetMonthId) ?? MONTHS[0];
      const usedSlots = photos.filter((photo) => photo.monthId === targetMonth.id).length;
      const availableSlots = targetMonth.moments.length - usedSlots;
      if (imageFiles.length === 0) {
        setPhotoError("Choose an image file to add a memory.");
        return;
      }
      if (availableSlots <= 0) {
        setPhotoError(`${targetMonth.title} has no empty photo slots. Choose another month.`);
        return;
      }
      const filesToAdd = imageFiles.slice(0, availableSlots);
      const addedPhotos = await Promise.all(filesToAdd.map(async (file) => ({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        monthId: targetMonthId,
        src: await compressPhoto(file),
      })));
      const nextPhotos = [...photos, ...addedPhotos];
      localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(nextPhotos));
      window.dispatchEvent(new Event(PHOTO_CHANGE_EVENT));
      setPhotoError(filesToAdd.length < imageFiles.length
        ? `Added ${filesToAdd.length} photo${filesToAdd.length === 1 ? "" : "s"}. ${targetMonth.title} has no more empty slots.`
        : null);
    } catch {
      setPhotoError("Could not save the photo. Try a smaller image or remove browser storage data.");
    }
  }

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
        <button type="button" className="memories-calendar" aria-label="Open calendar">
          <CalendarDays size={18} strokeWidth={2.2} />
        </button>
      </header>

      <p className="memories-stats">19 memories · 11 walks · 27 km</p>

      <input
        ref={photoInputRef}
        className="memories-photo-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelection}
        aria-label="Choose photos to add to Memories"
      />
      <div className="memories-add-row">
        <label className="memories-month-target">
          <span>Add to</span>
          <select aria-label="Choose a month for this memory" value={targetMonthId} onChange={(event) => setTargetMonthId(event.target.value)}>
            {MONTHS.map((month) => <option key={month.id} value={month.id}>{month.title}</option>)}
          </select>
        </label>
        <button type="button" className="memories-add" onClick={() => photoInputRef.current?.click()}>
          <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>Add a memory</span>
        </button>
      </div>
      {photoError ? <output className="memories-photo-error">{photoError}</output> : null}

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
                return photo ? (
                  <div key={moment.id} className="memories-tile memories-photo-tile">
                    <Image className="memories-photo-image" src={photo.src} alt={`${moment.label}, ${month.title}`} fill sizes="25vw" unoptimized />
                    <span className="memories-tile-day">{moment.day}</span>
                    <button
                      type="button"
                      className="memories-photo-delete"
                      aria-label={`Delete photo from ${month.title}`}
                      title="Delete photo"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                    </button>
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
