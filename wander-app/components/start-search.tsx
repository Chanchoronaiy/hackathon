"use client";

import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { GeocodeSuggestion } from "@/lib/geocode";
import type { LatLng } from "@/lib/route-planner";

type StartSearchProps = {
  value: string;
  onQueryChange: (query: string) => void;
  onSelect: (suggestion: { label: string; position: LatLng }) => void;
  onUseMyLocation: () => void;
  locating: boolean;
  statusNote: string | null;
};

export default function StartSearch({
  value,
  onQueryChange,
  onSelect,
  onUseMyLocation,
  locating,
  statusNote,
}: StartSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [results, setResults] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      const frame = requestAnimationFrame(() => {
        setResults([]);
        setLoading(false);
        setError(null);
        setActiveIndex(-1);
      });
      return () => cancelAnimationFrame(frame);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = (await response.json()) as { results?: GeocodeSuggestion[]; error?: string };
          if (!response.ok) {
            setResults([]);
            setError(data.error ?? "Search unavailable right now.");
            return;
          }
          setResults(data.results ?? []);
          setOpen(true);
          setActiveIndex(-1);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setError("Search unavailable right now.");
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function choose(suggestion: GeocodeSuggestion) {
    onSelect({ label: suggestion.label, position: suggestion.position });
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
  }

  return (
    <div className="start-block" ref={rootRef}>
      <div className="start-field">
        <MapPin size={16} aria-hidden="true" />
        <input
          type="search"
          name="start"
          autoComplete="off"
          spellCheck={false}
          placeholder="Start a Wander"
          value={value}
          aria-label="Start a Wander"
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!open || results.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % results.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
            }
            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              choose(results[activeIndex]);
            }
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="start-locate"
          onClick={onUseMyLocation}
          disabled={locating}
          aria-label={locating ? "Finding your location" : "Use my location"}
          title="Use my location"
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      </div>
      {open && value.trim().length >= 2 && (
        <ul className="start-suggestions" id={`${listId}-list`}>
          {loading ? <li className="start-suggestion-meta">Searching Adelaide…</li> : null}
          {!loading && error ? <li className="start-suggestion-meta">{error}</li> : null}
          {!loading && !error && results.length === 0 ? (
            <li className="start-suggestion-meta">No Adelaide places found</li>
          ) : null}
          {results.map((suggestion, index) => (
            <li key={suggestion.id}>
              <button
                type="button"
                className={index === activeIndex ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {statusNote ? <p className="start-status" aria-live="polite">{statusNote}</p> : null}
    </div>
  );
}
