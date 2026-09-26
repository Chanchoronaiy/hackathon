"use client";

import { ExternalLink, X } from "lucide-react";
import type { LatLng } from "@/lib/route-planner";

export default function StreetViewDialog({
  name,
  position,
  onClose,
}: {
  name: string;
  position: LatLng;
  onClose: () => void;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const location = `${position[0]},${position[1]}`;
  const source = key
    ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(key)}&location=${encodeURIComponent(location)}&fov=80`
    : null;

  return (
    <div className="streetview-backdrop" role="presentation">
      <button type="button" className="streetview-scrim" aria-label="Close Street View" onClick={onClose} />
      <section className="streetview-card" role="dialog" aria-modal="true" aria-labelledby="streetview-title">
        <header>
          <div>
            <span>Preview the quest</span>
            <h2 id="streetview-title">{name}</h2>
          </div>
          <button type="button" aria-label="Close Street View" onClick={onClose}><X size={19} /></button>
        </header>
        {source ? (
          <iframe
            title={`Google Street View of ${name}`}
            src={source}
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="streetview-empty">
            <ExternalLink size={28} aria-hidden="true" />
            <strong>Street View is ready for your key</strong>
            <p>Enable Maps Embed API, then add NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY to .env.local.</p>
          </div>
        )}
      </section>
    </div>
  );
}
