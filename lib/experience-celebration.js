import { experienceProgress } from "./rewards.js";
export const RANK_CELEBRATION_MS = 1500;

export const experienceStorageKey = (id) => `codewild:rank-v2:${id}`;
// Keep an unseen event until its animation finishes, including across reloads.
export function trackExperience(previous, xp) {
  const { state, celebration } = advanceExperience(previous, xp);
  const held = previous?.pending;
  const pending = celebration
    ? { ...celebration, from: held?.from ?? celebration.from }
    : held && Number.isFinite(held.to) && Number.isFinite(held.total) && state.xp >= held.total ? held : null;
  return { ...state, pending };
}
export function advanceExperience(previous, xp) {
  const next = experienceProgress(xp);
  const valid = previous && Number.isFinite(previous.xp) && Number.isInteger(previous.highestLevel) && previous.highestLevel >= 1;
  const highestLevel = valid ? Math.max(previous.highestLevel, next.level) : next.level;
  return {
    state: { xp: next.total, highestLevel },
    celebration: valid && next.total > previous.xp && next.level > previous.highestLevel
      ? { from: previous.highestLevel, to: next.level, gained: next.total - previous.xp, ...next }
      : null,
  };
}
