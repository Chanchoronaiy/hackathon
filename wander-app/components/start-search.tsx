"use client";

import { LocateFixed, MapPin, Search, X } from "lucide-react";
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
  placeholder?: string;
  ariaLabel?: string;
  variant?: "planner" | "home";
  fromValue?: string;
  onFromQueryChange?: (query: string) => void;
  onFromSelect?: (suggestion: { label: string; position: LatLng }) => void;
  fromExpanded?: boolean;
  onFromExpandedChange?: (expanded: boolean) => void;
  onClearDestination?: () => void;
};

function useGeocodeResults(value: string) {
  const [results, setResults] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      const frame = requestAnimationFrame(() => {
        setResults([]);
        setLoading(false);
        setError(null);
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

  return { results, loading, error, setResults };
}

export default function StartSearch({
  value,
  onQueryChange,
  onSelect,
  onUseMyLocation,
  locating,
  statusNote,
  placeholder = "Start a Wander",
  ariaLabel = "Start a Wander",
  variant = "planner",
  fromValue = "",
  onFromQueryChange,
  onFromSelect,
  fromExpanded = false,
  onFromExpandedChange,
  onClearDestination,
}: StartSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<"to" | "from" | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const toSearch = useGeocodeResults(value);
  const fromSearch = useGeocodeResults(fromValue);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
        onFromExpandedChange?.(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onFromExpandedChange]);

  function chooseTo(suggestion: GeocodeSuggestion) {
    onQueryChange(suggestion.label);
    onSelect({ label: suggestion.label, position: suggestion.position });
    setOpen(null);
    toSearch.setResults([]);
    setActiveIndex(-1);
  }

  function chooseFrom(suggestion: GeocodeSuggestion) {
    onFromSelect?.({ label: suggestion.label, position: suggestion.position });
    setOpen(null);
    fromSearch.setResults([]);
    setActiveIndex(-1);
  }

  const activeResults = open === "from" ? fromSearch.results : toSearch.results;
  const activeLoading = open === "from" ? fromSearch.loading : toSearch.loading;
  const activeError = open === "from" ? fromSearch.error : toSearch.error;
  const activeQuery = open === "from" ? fromValue : value;
  const Icon = variant === "home" ? Search : MapPin;
  const showFrom = variant === "home" && fromExpanded;

  return (
    <div className={`start-block${variant === "home" ? " is-home" : ""}${showFrom ? " has-from" : ""}`} ref={rootRef}>
      <div className="start-field">
        <Icon size={16} aria-hidden="true" />
        <input
          type="search"
          name="destination"
          autoComplete="off"
          spellCheck={false}
          placeholder={variant === "home" ? "Search a place to wander to" : placeholder}
          value={value}
          aria-label={variant === "home" ? "Search destination" : ariaLabel}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen("to");
            setActiveIndex(-1);
            if (variant === "home") onFromExpandedChange?.(true);
          }}
          onFocus={() => {
            if (variant === "home") onFromExpandedChange?.(true);
            if (toSearch.results.length > 0) setOpen("to");
          }}
          onKeyDown={(event) => {
            if (open !== "to" || toSearch.results.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % toSearch.results.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current <= 0 ? toSearch.results.length - 1 : current - 1));
            }
            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              chooseTo(toSearch.results[activeIndex]);
            }
            if (event.key === "Escape") setOpen(null);
          }}
        />
        {variant === "home" && value.trim() ? (
          <button
            type="button"
            className="start-clear"
            aria-label="Clear destination"
            title="Clear"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onQueryChange("");
              onClearDestination?.();
              setOpen(null);
            }}
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : variant === "home" ? (
          <span className="start-locate-spacer" aria-hidden="true" />
        ) : null}
        {variant === "planner" ? (
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
        ) : null}
      </div>

      {showFrom ? (
        <div className="start-field is-from">
          <MapPin size={16} aria-hidden="true" />
          <input
            type="search"
            name="from"
            autoComplete="off"
            spellCheck={false}
            placeholder="From"
            value={fromValue}
            aria-label="From — search start location"
            onChange={(event) => {
              onFromQueryChange?.(event.target.value);
              setOpen("from");
              setActiveIndex(-1);
            }}
            onFocus={() => {
              if (fromSearch.results.length > 0) setOpen("from");
            }}
            onKeyDown={(event) => {
              if (open !== "from" || fromSearch.results.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % fromSearch.results.length);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => (current <= 0 ? fromSearch.results.length - 1 : current - 1));
              }
              if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                chooseFrom(fromSearch.results[activeIndex]);
              }
              if (event.key === "Escape") setOpen(null);
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
      ) : null}

      {open && activeQuery.trim().length >= 2 && (
        <ul className={`start-suggestions${open === "from" ? " is-from" : ""}`} id={`${listId}-list`}>
          {activeLoading ? <li className="start-suggestion-meta">Searching Adelaide…</li> : null}
          {!activeLoading && activeError ? <li className="start-suggestion-meta">{activeError}</li> : null}
          {!activeLoading && !activeError && activeResults.length === 0 ? (
            <li className="start-suggestion-meta">No Adelaide places found</li>
          ) : null}
          {activeResults.map((suggestion, index) => (
            <li key={suggestion.id}>
              <button
                type="button"
                className={index === activeIndex ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => (open === "from" ? chooseFrom(suggestion) : chooseTo(suggestion))}
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
