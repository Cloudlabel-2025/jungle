export function beginRetryRewards(level, result, xp) {
  const bestStars = Math.max(level.retryRewards?.bestStars || 0, result?.completed ? result.stars : 0, ...(level.history || []).map(row => row.result?.completed ? row.result.stars : 0));
  level.retryRewards = { bestStars, baselineStars: bestStars, baseTrophies: level.creditedTrophies || 0, baseXp: xp, awardedTrophies: 0, awardedXp: 0 };
}

// Reconciliation can run repeatedly while submitting, polling or validating.
// Only the delta from this attempt's highest reward is ever credited.
export function retryRewardTotals(level, result, normal) {
  const retry = level.retryRewards;
  if (result?.completed) {
    const trophies = retry.baselineStars === 0 ? normal.trophies : result.stars > retry.baselineStars ? 3 : 0;
    retry.awardedTrophies = Math.max(retry.awardedTrophies, trophies);
    retry.awardedXp = Math.max(retry.awardedXp, Math.floor(normal.xp / 4));
    retry.bestStars = Math.max(retry.bestStars, result.stars);
  }
  return { trophies: retry.baseTrophies + retry.awardedTrophies, xp: retry.baseXp + retry.awardedXp };
}
