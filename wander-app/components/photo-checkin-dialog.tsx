"use client";

import { Camera, CheckCircle2, MapPin, X } from "lucide-react";
import { useState } from "react";
import { distanceMetres } from "@/lib/exploration";
import { awardPoints } from "@/lib/gamification";
import type { LatLng } from "@/lib/route-planner";

export default function PhotoCheckinDialog({
  eventId,
  placeName,
  placePosition,
  points,
  onClose,
  onVerified,
}: {
  eventId: string;
  placeName: string;
  placePosition: LatLng;
  points: number;
  onClose: () => void;
  onVerified: (totalPoints: number) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "verified" | "too-far" | "location-error">("idle");

  function verify() {
    if (!photo || !navigator.geolocation) {
      setStatus("location-error");
      return;
    }
    setStatus("checking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: LatLng = [position.coords.latitude, position.coords.longitude];
        if (distanceMetres(current, placePosition) > 100) {
          setStatus("too-far");
          return;
        }
        const profile = awardPoints(eventId, points);
        setStatus("verified");
        onVerified(profile.points);
      },
      () => setStatus("location-error"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 15_000 },
    );
  }

  return (
    <div className="checkin-backdrop" role="presentation">
      <button type="button" className="checkin-scrim" aria-label="Close photo check-in" onClick={onClose} />
      <section className="checkin-card" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
        <button type="button" className="checkin-close" aria-label="Close photo check-in" onClick={onClose}><X size={18} /></button>
        <span className="checkin-icon"><Camera size={23} /></span>
        <p className="checkin-kicker">Photo check-in · +{points} points</p>
        <h2 id="checkin-title">Prove you reached {placeName}</h2>
        <p>Take a photo and allow location access. Wander checks that you are within 100 metres.</p>
        <label className="checkin-photo">
          <Camera size={18} aria-hidden="true" />
          <span>{photo ? photo.name : "Take or choose a photo"}</span>
          <input type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
        </label>
        {status === "too-far" ? <p className="checkin-error"><MapPin size={15} /> Move closer to the destination and try again.</p> : null}
        {status === "location-error" ? <p className="checkin-error"><MapPin size={15} /> A photo and location permission are required.</p> : null}
        {status === "verified" ? <p className="checkin-success"><CheckCircle2 size={17} /> Verified — points added!</p> : null}
        <button type="button" className="checkin-verify" disabled={!photo || status === "checking" || status === "verified"} onClick={verify}>
          {status === "checking" ? "Checking location…" : status === "verified" ? "Verified" : "Verify check-in"}
        </button>
      </section>
    </div>
  );
}
