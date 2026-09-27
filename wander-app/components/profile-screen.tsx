"use client";

import { ArrowLeft, ChevronRight, Cloud, Eye, Leaf, MapPin, Settings, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { profileInitials, readProfile, readProfileStats } from "@/lib/profile";

/** OpenStreetMap tiles (zoom 15) covering Adelaide's CBD, Victoria Square near the centre. */
const CBD_TILES = [19779, 19780, 19781].flatMap((y) => (
  [28998, 28999, 29000, 29001].map((x) => `https://tile.openstreetmap.org/15/${x}/${y}.png`)
));

type SettingRow = {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Wire up when each setting gets its own screen. */
  onSelect?: () => void;
};

const WANDER_SETTINGS: SettingRow[] = [
  { id: "scenic", icon: Leaf, title: "Scenic preferences", detail: "Parks, cafes, architecture" },
  { id: "visibility", icon: Eye, title: "Default route visibility", detail: "Friends" },
  { id: "privacy", icon: MapPin, title: "Privacy zone", detail: "Start & end hidden near home" },
  { id: "notifications", icon: Cloud, title: "Notifications", detail: "Walk reminders on" },
];

export default function ProfileScreen({ onClose }: { onClose: () => void }) {
  // Read once when the screen opens; it is remounted each time it is shown.
  const [profile] = useState(readProfile);
  const [stats] = useState(() => readProfileStats());
  const settingsRef = useRef<HTMLElement>(null);

  return (
    <section className="profile-screen" aria-labelledby="profile-screen-title">
      <div className="profile-screen-inner">
        <div className="profile-top">
          <button type="button" className="profile-back" aria-label="Back to map" onClick={onClose}>
            <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <h1 id="profile-screen-title" className="profile-title">Profile</h1>
        </div>

        <div className="profile-main">
          <header className="profile-identity">
            <span className="profile-avatar" aria-hidden="true">{profileInitials(profile.name)}</span>
            <div className="profile-names">
              <strong>{profile.name}</strong>
              <span>@{profile.handle}</span>
            </div>
            <button
              type="button"
              className="profile-settings"
              aria-label="Settings"
              onClick={() => settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Settings size={22} strokeWidth={2.1} aria-hidden="true" />
            </button>
          </header>

          <div className="profile-explored">
            <div className="profile-explored-map" aria-hidden="true">
              {CBD_TILES.map((url) => (
                <span key={url} style={{ backgroundImage: `url(${url})` }} />
              ))}
            </div>
            <div className="profile-explored-copy">
              <span className="profile-explored-kicker">Adelaide explored</span>
              <strong>{Math.round(stats.adelaideExploredPercent)}%</strong>
              {stats.walksThisMonth > 0 ? (
                <span className="profile-explored-chip">
                  +{stats.walksThisMonth} {stats.walksThisMonth === 1 ? "walk" : "walks"} this month
                </span>
              ) : null}
            </div>
            <span className="profile-explored-credit">© OpenStreetMap</span>
          </div>

          <dl className="profile-stats">
            <div>
              <dt>Walks</dt>
              <dd>{stats.walks}</dd>
            </div>
            <div>
              <dt>km walked</dt>
              <dd>{stats.kmWalked.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Discoveries</dt>
              <dd>{stats.discoveries}</dd>
            </div>
          </dl>
        </div>

        <section ref={settingsRef} className="profile-settings-list" aria-labelledby="profile-wander-title">
          <h2 id="profile-wander-title">Your Wander</h2>
          <ul>
            {WANDER_SETTINGS.map(({ id, icon: Icon, title, detail, onSelect }) => (
              <li key={id}>
                <button type="button" className="profile-setting" onClick={onSelect}>
                  <span className="profile-setting-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span className="profile-setting-copy">
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </span>
                  <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
