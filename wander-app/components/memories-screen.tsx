"use client";

import { Building2, CalendarDays, Camera, Circle, Coffee, Landmark, Trees } from "lucide-react";

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

type MemoriesScreenProps = {
  onAddMemory?: () => void;
};

export default function MemoriesScreen({ onAddMemory }: MemoriesScreenProps) {
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

      <button type="button" className="memories-add" onClick={onAddMemory}>
        <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>Add a memory</span>
      </button>

      {MONTHS.map((month) => (
        <section key={month.id} className="memories-month" aria-labelledby={`${month.id}-title`}>
          <div className="memories-section-head">
            <h2 id={`${month.id}-title`}>{month.title}</h2>
            <span>{month.count} moments</span>
          </div>
          <div className="memories-grid">
            {month.moments.map((moment) => (
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
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
