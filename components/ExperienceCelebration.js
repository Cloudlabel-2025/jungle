"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUp, Sparkles } from "lucide-react";
import { advanceExperience, experienceStorageKey, RANK_CELEBRATION_MS } from "@/lib/experience-celebration.js";

export function RankCelebration({ result, close }) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), RANK_CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [result.to]);
  const emblem = (
    <div className="rank-level-up" role="status" aria-live="polite" aria-label={`Level up! You reached Level ${result.to}`} style={{ "--rank-duration": `${RANK_CELEBRATION_MS}ms` }}>
      <div className="rank-celebration" aria-hidden="true">
        <div className="rank-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--ray": i }} />)}
        </div>
        <div className="rank-halo" />
        <div className="rank-medallion"><Sparkles /><small>LEVEL</small><span>{result.to}</span><ChevronsUp /></div>
        <strong className="rank-up-title">LEVEL UP!</strong>
      </div>
    </div>
  );
  return typeof document === "undefined" ? emblem : createPortal(emblem, document.body);
}

export default function ExperienceCelebration({ player, ready = true }) {
  const previous = useRef(undefined), [current, setCurrent] = useState(null);
  useEffect(() => {
    if (player.role !== "GAMER" || !Number.isFinite(player.xp)) return;
    const key = experienceStorageKey(player._id);
    if (previous.current === undefined) {
      try { previous.current = JSON.parse(sessionStorage.getItem(key)); }
      catch { previous.current = null; }
    }
    const { state, celebration } = advanceExperience(previous.current, player.xp);
    previous.current = state;
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* In-memory tracking still works without storage. */ }
    setCurrent((old) => {
      if (celebration) return old ? { ...celebration, from: old.from, gained: celebration.total - (old.total - old.gained) } : celebration;
      if (old && player.xp < old.total) return null;
      return old;
    });
  }, [player._id, player.role, player.xp]);
  return ready && current ? <RankCelebration key={current.to} result={current} close={() => setCurrent(null)} /> : null;
}
