"use client";
import { collegeStorageKey } from "@/lib/college-fetch.js";
import { useEffect, useRef, useState } from "react";
import AvatarReaction from "./AvatarReaction";
import RewardOverlay from "./RewardOverlay";
import { ChevronsUp, Sparkles } from "lucide-react";
import { trackExperience, experienceStorageKey, RANK_CELEBRATION_MS } from "@/lib/experience-celebration.js";

export function RankCelebration({ result, close, player }) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), RANK_CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [result.to]);
  return <RewardOverlay title={`Level up! You reached Level ${result.to}`} duration={RANK_CELEBRATION_MS}>
    <div className="rank-level-up" style={{ "--rank-duration": `${RANK_CELEBRATION_MS}ms` }}>
      <div className="rank-celebration" aria-hidden="true">
        <div className="rank-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--ray": i }} />)}
        </div>
        <div className="rank-halo" />
        <div className="rank-medallion"><Sparkles /><small>LEVEL</small><span>{result.to}</span><ChevronsUp /></div>
        <strong className="rank-up-title">LEVEL UP!</strong><AvatarReaction player={player} mood="celebrate" compact caption="Congratulations, explorer!"/>
      </div>
    </div>
  </RewardOverlay>;
}

export default function ExperienceCelebration({ player, ready = true, onActiveChange }) {
  const previous = useRef(undefined), [current, setCurrent] = useState(null);
  useEffect(() => {
    if (player.role !== "GAMER" || !Number.isFinite(player.xp)) return;
    const key = collegeStorageKey(experienceStorageKey(player._id));
    if (previous.current === undefined) {
      try { previous.current = JSON.parse(sessionStorage.getItem(key)); }
      catch { previous.current = null; }
    }
    const state = trackExperience(previous.current, player.xp);
    previous.current = state;
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* In-memory tracking still works without storage. */ }
    setCurrent(state.pending);
  }, [player._id, player.role, player.xp]);
  useEffect(() => { onActiveChange?.(Boolean(current)); }, [current, onActiveChange]);
  const close = () => {
    previous.current = { ...previous.current, pending: null };
    try { sessionStorage.setItem(collegeStorageKey(experienceStorageKey(player._id)), JSON.stringify(previous.current)); } catch {}
    setCurrent(null);
  };
  return ready && current ? <RankCelebration player={player} key={current.to} result={current} close={close} /> : null;
}
