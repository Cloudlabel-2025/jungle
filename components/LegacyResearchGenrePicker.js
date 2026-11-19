"use client";
import fetch from "@/lib/college-fetch.js";

import { useEffect, useRef, useState } from "react";

export default function ResearchGenrePicker({ act, recordId }) {
  const [genres, setGenres] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selecting = useRef(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      if (selecting.current) return;
      try {
        const response = await fetch("/api/day1/genre-offer", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load genres.");
        if (!disposed && !selecting.current && result.assignment) {
          selecting.current = true;
          try {
            await act("day1/genre", { genreId: result.assignment.genreId }, "");
          } finally {
            selecting.current = false;
          }
          return;
        }
        if (!disposed && !selecting.current) {
          setGenres(result.genres);
          setError("");
        }
      } catch (e) {
        if (!disposed) setError(e.message);
      }
    }
    load();
    const timer = setInterval(load, 8000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [recordId, retry]);
  return (
    <section aria-label="Research genre choices">
      <p>
        Choose one genre. Your question is assigned randomly after selection.
        Your choice is permanent for this research round; each genre can be used
        once in your five-person research group.
      </p>
      {error && <p role="alert">{error}</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {genres.map((g) => (
          <button
            key={g.id}
            className="btn"
            disabled={busy}
            onClick={async () => {
              if (selecting.current) return;
              selecting.current = true;
              setBusy(true);
              try {
                await act(
                  "day1/genre",
                  { genreId: g.id },
                  "Research question assigned.",
                );
              } finally {
                selecting.current = false;
                setBusy(false);
                setRetry((n) => n + 1);
              }
            }}
          >
            {g.name}
          </button>
        ))}
      </div>
      <p aria-live="polite">
        {busy
          ? "Assigning your question…"
          : !genres.length && !error
            ? "Loading available genres…"
            : "Availability refreshes every eight seconds."}
      </p>
      {error && (
        <button
          className="btn"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          Try again
        </button>
      )}
    </section>
  );
}
