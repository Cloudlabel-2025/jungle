"use client";
import { useEffect, useRef, useState } from "react";
import { Footprints, Compass } from "lucide-react";

// The persistent workspace owns this gate. Ready data closes it immediately;
// navigation and background refreshes never reset the completed entry.
export function useGameEntryLoading(userId, ready, error) {
  const completed = useRef(null);
  const [visibleFor, setVisibleFor] = useState(null);
  useEffect(() => {
    if (!userId) {
      completed.current = null;
      setVisibleFor(null);
      return;
    }
    if (ready) {
      completed.current = userId;
      setVisibleFor(null);
      return;
    }
    if (error || completed.current === userId) {
      setVisibleFor(null);
      return;
    }
    const timer = setTimeout(() => setVisibleFor(userId), 800);
    return () => clearTimeout(timer);
  }, [userId, ready, error]);
  return Boolean(
    userId &&
    !ready &&
    !error &&
    completed.current !== userId &&
    visibleFor === userId,
  );
}

export default function GameLoadingScreen({ onCancel, flight = false }) {
  const screen = useRef(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    screen.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => {
      clearTimeout(timer);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className="game-entry-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading CODEWILD"
      tabIndex={-1}
      ref={screen}
    >
      <div className="game-entry-scene" aria-hidden="true" />
      <div className="game-entry-content">
        <span className="game-entry-brand">
          CODE<span>WILD</span>
        </span>
        <span className="game-entry-kicker">{flight ? "WELCOME ABOARD" : "BACK ON THE TRAIL"}</span>
        <h1>{flight ? "Preparing your flight" : "Opening your expedition"}</h1>
        <p>{flight ? "Getting your learning journey ready…" : "Finding your place in the jungle…"}</p>
        <div className="game-entry-trail" aria-hidden="true">
          {[0, 1, 2].map((step) => (
            flight ? <Compass key={step} size={23} /> : <Footprints key={step} size={23} />
          ))}
        </div>
        <div className="game-entry-track" aria-hidden="true">
          <i />
        </div>
        {slow && (
          <p className="game-entry-slow">
            This is taking a little longer. Your game will open as soon as it’s
            ready.
          </p>
        )}
        <button className="game-entry-cancel" onClick={onCancel}>
          Back to sign-in
        </button>
      </div>
    </div>
  );
}
