"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CameraCaptureProps = {
  title?: string;
  onCapture: (file: File) => void;
  onClose: () => void;
};

export default function CameraCapture({ title = "Take a photo", onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can’t open the camera here. Choose a photo instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Camera access was blocked. Allow the camera in your browser settings or choose a photo.");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `wander-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.88,
    );
  }

  return (
    <div className="camera-capture" role="dialog" aria-modal="true" aria-label={title}>
      <header className="camera-capture-top">
        <strong>{title}</strong>
        <button type="button" className="camera-capture-close" aria-label="Close camera" onClick={onClose}>
          <X size={20} strokeWidth={2.4} />
        </button>
      </header>

      <div className="camera-capture-view">
        {error ? (
          <p className="camera-capture-error">{error}</p>
        ) : (
          <video
            ref={videoRef}
            className={ready ? "is-ready" : ""}
            playsInline
            muted
            autoPlay
            onLoadedData={() => setReady(true)}
          />
        )}
      </div>

      <footer className="camera-capture-controls">
        <button type="button" className="camera-capture-library" aria-label="Choose from photos" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={20} strokeWidth={2.2} />
        </button>
        <button type="button" className="camera-capture-shutter" aria-label="Take photo" disabled={!ready || Boolean(error)} onClick={snap}>
          <Camera size={24} strokeWidth={2.2} />
        </button>
        <span className="camera-capture-spacer" aria-hidden="true" />
      </footer>

      <input
        ref={fileRef}
        className="camera-capture-file"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onCapture(file);
        }}
      />
    </div>
  );
}
