"use client";

import { useEffect, useRef } from "react";
import { startRulerScrollSound, stopRulerScrollSound } from "@/lib/sound";

const MIN_MINUTES = 0;
const MAX_MINUTES = 59;
const TICK_STEP = 10;

type MinuteRulerProps = {
  value: number;
  onChange: (minutes: number) => void;
};

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(value)));
}

export default function MinuteRuler({ value, onChange }: MinuteRulerProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const ignoreScrollRef = useRef(false);
  const draggingRef = useRef(false);
  const dragOriginRef = useRef({ x: 0, scroll: 0 });
  const settleRef = useRef<number | null>(null);
  const soundStopRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = clampMinutes(value) * TICK_STEP;
    const frame = requestAnimationFrame(() => {
      if (Math.abs(scroller.scrollLeft - target) <= 1) return;
      ignoreScrollRef.current = true;
      scroller.scrollLeft = target;
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    function minutesFromScroll() {
      return clampMinutes(scroller!.scrollLeft / TICK_STEP);
    }

    function settle() {
      const next = minutesFromScroll();
      ignoreScrollRef.current = true;
      scroller!.scrollTo({ left: next * TICK_STEP, behavior: "smooth" });
      if (next !== valueRef.current) onChangeRef.current(next);
      window.setTimeout(() => {
        ignoreScrollRef.current = false;
      }, 160);
    }

    function handleScroll() {
      if (ignoreScrollRef.current) return;
      startRulerScrollSound();
      if (soundStopRef.current != null) window.clearTimeout(soundStopRef.current);
      soundStopRef.current = window.setTimeout(stopRulerScrollSound, 120);
      const next = minutesFromScroll();
      if (next !== valueRef.current) onChangeRef.current(next);
      if (settleRef.current != null) window.clearTimeout(settleRef.current);
      settleRef.current = window.setTimeout(settle, 80);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      draggingRef.current = true;
      dragOriginRef.current = { x: event.clientX, scroll: scroller!.scrollLeft };
      scroller!.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!draggingRef.current) return;
      const delta = event.clientX - dragOriginRef.current.x;
      scroller!.scrollLeft = dragOriginRef.current.scroll - delta;
    }

    function onPointerUp(event: PointerEvent) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (scroller!.hasPointerCapture(event.pointerId)) {
        scroller!.releasePointerCapture(event.pointerId);
      }
      settle();
    }

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", onPointerUp);
    scroller.addEventListener("pointercancel", onPointerUp);
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", onPointerUp);
      scroller.removeEventListener("pointercancel", onPointerUp);
      if (settleRef.current != null) window.clearTimeout(settleRef.current);
      if (soundStopRef.current != null) window.clearTimeout(soundStopRef.current);
      stopRulerScrollSound();
    };
  }, []);

  const minutes = clampMinutes(value);
  const ticks = Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, index) => MIN_MINUTES + index);

  return (
    <div className="minute-ruler">
      <div className="minute-ruler-frame">
        <span className="minute-ruler-pointer" aria-hidden="true" />
        <div ref={scrollerRef} className="minute-ruler-scroller" aria-hidden="true">
          <div className="minute-ruler-track">
            {ticks.map((minute) => {
              const major = minute % 10 === 0;
              const mid = minute % 5 === 0;
              return (
                <div
                  key={minute}
                  className={`minute-tick${major ? " is-major" : mid ? " is-mid" : ""}`}
                >
                  <span className="minute-tick-mark" />
                  {major ? <span className="minute-tick-label">{minute}m</span> : null}
                </div>
              );
            })}
          </div>
        </div>
        <input
          className="minute-ruler-input"
          type="range"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={1}
          value={minutes}
          aria-label="Minutes"
          onChange={(event) => onChange(clampMinutes(Number(event.target.value)))}
        />
      </div>
      <span>minutes</span>
    </div>
  );
}
