"use client";

import { Camera, X } from "lucide-react";

type WalkMemoryDialogProps = {
  step: "intro" | "preview";
  previewUrl: string | null;
  saving: boolean;
  error: string | null;
  onOpenCamera: () => void;
  onRetake: () => void;
  onKeep: () => void;
  onClose: () => void;
};

export default function WalkMemoryDialog({
  step,
  previewUrl,
  saving,
  error,
  onOpenCamera,
  onRetake,
  onKeep,
  onClose,
}: WalkMemoryDialogProps) {
  return (
    <div className="checkin-backdrop" role="presentation">
      <button type="button" className="checkin-scrim" aria-label="Close memory capture" onClick={onClose} />
      <dialog open className="checkin-card walk-memory-card" aria-modal="true" aria-labelledby="walk-memory-title">
        <button type="button" className="checkin-close" aria-label="Close memory capture" onClick={onClose}><X size={18} /></button>
        {step === "intro" ? (
          <>
            <span className="checkin-icon"><Camera size={23} /></span>
            <p className="checkin-kicker">Memories</p>
            <h2 id="walk-memory-title">One memory per walk, so make it count.</h2>
            <p>You can retake the photo as often as you like. Once you tap Keep, it’s saved as this walk’s memory.</p>
            <button type="button" className="checkin-verify" onClick={onOpenCamera}>Open camera</button>
          </>
        ) : (
          <>
            <p className="checkin-kicker">This walk’s memory</p>
            <h2 id="walk-memory-title">Keep this one?</h2>
            {/* Local blob preview, so next/image optimisation does not apply. */}
            {/* oxlint-disable-next-line next/no-img-element */}
            {previewUrl ? <img className="walk-memory-preview" src={previewUrl} alt="Your new walk memory, ready to keep or retake" /> : null}
            {error ? <p className="checkin-error" role="alert">{error}</p> : null}
            <div className="walk-memory-actions">
              <button type="button" className="walk-memory-retake" disabled={saving} onClick={onRetake}>Retake</button>
              <button type="button" className="checkin-verify" disabled={saving} onClick={onKeep}>
                {saving ? "Saving…" : "Keep"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
