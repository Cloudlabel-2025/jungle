import { experienceProgress } from "./rewards.js";
export const RANK_CELEBRATION_MS = 3000;

export const experienceStorageKey = (id) => `codewild:rank-v2:${id}`;
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
