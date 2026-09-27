"use client";

import { useRef, useState } from "react";
import { warmStreetView } from "@/components/street-view-dialog";

const DRAG_THRESHOLD_PX = 8;

export default function StreetViewBuddy({
  className = "",
  onDrop,
}: {
  className?: string;
  onDrop: (clientX: number, clientY: number) => void;
}) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [held, setHeld] = useState(false);

  function reset() {
    origin.current = null;
    setOffset(null);
    setHeld(false);
  }

  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label="Drag onto the map to look around in Street View"
      className={`buddy-mascot${held ? " is-held" : ""}${offset ? " is-dragging" : ""} ${className}`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        origin.current = { x: event.clientX, y: event.clientY };
        setHeld(true);
        warmStreetView();
      }}
      onPointerMove={(event) => {
        if (!origin.current) return;
        setOffset({ x: event.clientX - origin.current.x, y: event.clientY - origin.current.y });
      }}
      onPointerUp={(event) => {
        const start = origin.current;
        reset();
        if (!start) return;
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (moved < DRAG_THRESHOLD_PX) return;
        const target = document
          .elementsFromPoint(event.clientX, event.clientY)
          .find((element) => !element.closest(".buddy-mascot"));
        if (target?.closest(".leaflet-container")) onDrop(event.clientX, event.clientY);
      }}
      onPointerCancel={reset}
    >
      <span className="buddy-bubble" aria-hidden="true">Drag me</span>
      <img className="buddy-idle" src="/mascot/street-view-buddy-idle.png" alt="" draggable={false} />
      <img className="buddy-held" src="/mascot/street-view-buddy-held.png" alt="" draggable={false} />
    </span>
  );
}
