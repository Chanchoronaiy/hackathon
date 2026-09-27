"use client";

import { ExternalLink, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/route-planner";
import styles from "@/components/street-view-dialog.module.css";

const ADELAIDE_CENTRE: LatLng = [-34.9235, 138.6007];
const warmedLocations = new Set<string>();

function embedSource(position: LatLng) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  if (!key) return null;
  const location = `${position[0]},${position[1]}`;
  return `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(key)}&location=${encodeURIComponent(location)}&fov=80`;
}

// Loads the Street View viewer off-screen so its scripts are cached before the real dialog opens.
export function warmStreetView(position: LatLng = ADELAIDE_CENTRE) {
  const source = embedSource(position);
  if (!source || typeof document === "undefined" || warmedLocations.has(source)) return;
  warmedLocations.add(source);
  const frame = document.createElement("iframe");
  frame.src = source;
  frame.title = "";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:240px;border:0;opacity:0;pointer-events:none;";
  frame.addEventListener("load", () => window.setTimeout(() => frame.remove(), 20_000), { once: true });
  document.body.appendChild(frame);
}

export default function StreetViewDialog({
  name,
  position,
  onClose,
}: {
  name: string;
  position: LatLng;
  onClose: () => void;
}) {
  const source = embedSource(position);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [source]);

  return (
    <div className="streetview-backdrop" role="presentation">
      <button type="button" className="streetview-scrim" aria-label="Close Street View" onClick={onClose} />
      <section className="streetview-card" role="dialog" aria-modal="true" aria-label={`Street View of ${name}`}>
        <button className={styles.close} type="button" aria-label="Close Street View" onClick={onClose}><X size={20} /></button>
        {source ? (
          <div className={styles.frameWrap}>
            {!loaded && (
              <div className={styles.loading} aria-live="polite">
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
