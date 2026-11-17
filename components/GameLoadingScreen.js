"use client";
import { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { VowEmblem } from "./VowBrand";
import { brand } from "@/lib/brand.js";

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
      className={`game-entry-loader ${flight ? "is-flight-loading" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${brand.name}`}
      tabIndex={-1}
      ref={screen}
    >
      <div className="game-entry-scene" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="game-entry-content">
        <div className="vow-loading-crest">
          <div className="vow-loading-orbit" aria-hidden="true" />
          <VowEmblem decorative eager />
          <span className="vow-loading-glint" aria-hidden="true" />
        </div>
        <div className="vow-loading-copy">
          <span className="game-entry-kicker">YOUR NEXT DISCOVERY AWAITS</span>
          <h1>{brand.name}</h1>
          <span className="vow-loading-initials">V O W</span>
          <p>
            <Compass size={15} aria-hidden="true" />
            {flight ? "Preparing your flight…" : "Preparing your voyage…"}
          </p>
          <div className="game-entry-track" aria-hidden="true">
            <i />
          </div>
          <small className="vow-loading-caption">
            Explore. Question. Discover.
          </small>
          {slow && (
            <p className="game-entry-slow">
              Your voyage is still loading. It will open as soon as it’s ready.
            </p>
          )}
          {onCancel && (
            <button className="game-entry-cancel" onClick={onCancel}>
              Back to sign-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
