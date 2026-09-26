"use client";

import { ExternalLink, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/route-planner";
import styles from "@/components/street-view-dialog.module.css";

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [source]);

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
          <div className={styles.frameWrap}>
            {!loaded && (
              <div className={styles.loading} aria-live="polite">
                <span className={styles.buddy} aria-hidden="true">👋</span>
                <LoaderCircle size={22} className={styles.spinner} aria-hidden="true" />
                <strong>Looking around…</strong>
                <p>Loading the view from this point.</p>
              </div>
            )}
            <iframe
              title={`Google Street View of ${name}`}
              src={source}
              loading="eager"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className={loaded ? styles.loaded : ""}
              onLoad={() => setLoaded(true)}
            />
          </div>
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
