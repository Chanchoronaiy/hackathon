"use client";

import { useEffect, useRef, useState } from "react";
import type { PopularPlace } from "@/lib/popularity";
import type { WanderRoute } from "@/lib/route-planner";

declare global {
  interface Window {
    google?: any;
    __wanderGoogleMapsPromise?: Promise<any>;
  }
}

function loadGoogleMaps(key: string) {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__wanderGoogleMapsPromise) return window.__wanderGoogleMapsPromise;

  window.__wanderGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-wander-google-maps]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.dataset.wanderGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.__wanderGoogleMapsPromise;
}

export default function GoogleMapBackground({
  route,
  showRoute,
  popularPlaces,
}: {
  route: WanderRoute;
  showRoute: boolean;
  popularPlaces: PopularPlace[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
    ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

  useEffect(() => {
    if (!key || !hostRef.current) return;
    let cancelled = false;
    const overlays: any[] = [];

    void loadGoogleMaps(key).then((google) => {
      if (cancelled || !hostRef.current || !google?.maps) return;
      const map = new google.maps.Map(hostRef.current, {
        center: { lat: route.start.position[0], lng: route.start.position[1] },
        zoom: 15,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi.business", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ],
      });

      if (showRoute && route.geometry.length > 1) {
        const path = route.geometry.map(([lat, lng]) => ({ lat, lng }));
        const outline = new google.maps.Polyline({ path, map, strokeColor: "#101410", strokeOpacity: 0.88, strokeWeight: 11 });
        const line = new google.maps.Polyline({ path, map, strokeColor: "#d8ff64", strokeOpacity: 1, strokeWeight: 6 });
        overlays.push(outline, line);
        const bounds = new google.maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 72);

        [route.start, ...route.stops].forEach((stop) => {
          const marker = new google.maps.Marker({
            map,
            position: { lat: stop.position[0], lng: stop.position[1] },
            title: stop.name,
          });
          overlays.push(marker);
        });
      }

      popularPlaces.forEach((place) => {
        overlays.push(new google.maps.Circle({
          map,
          center: { lat: place.position[0], lng: place.position[1] },
          radius: 90 + (place.score ?? 0.5) * 150,
          strokeColor: "#e9592f",
          strokeOpacity: 0.65,
          strokeWeight: 1,
          fillColor: "#ffcf56",
          fillOpacity: 0.28,
        }));
      });
    }).catch(() => setError(true));

    return () => {
      cancelled = true;
      overlays.forEach((overlay) => overlay.setMap?.(null));
    };
  }, [key, popularPlaces, route, showRoute]);

  if (!key || error) {
    return (
      <div className="google-map-background google-map-error" role="status">
        Enable Maps JavaScript API on the browser key to use Google map.
      </div>
    );
  }

  return <div ref={hostRef} className="google-map-background" aria-label="Google map background" />;
}
