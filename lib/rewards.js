export const XP_MULTIPLIER = 3;
export const TROPHY_MULTIPLIER = 2;
export const DAILY_XP_CAP = 150;
export const DAILY_TROPHY_CAP = 50;
export const XP_PER_LEVEL = 100;
// Each next rank costs 50 XP more: 100, 150, 200, 250, …
export const rankStartXp = (level) => {
  const n = Math.max(0, Math.floor(level) - 1);
  return 25 * n * (n + 3);
};
export function experienceProgress(xp = 0) {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const level = Math.floor((Math.sqrt(9 + total / 6.25) - 3) / 2) + 1;
  const start = rankStartXp(level), required = 100 + (level - 1) * 50;
  return { level, total, progress: total - start, required, remaining: start + required - total };
}
export const experienceLevel = (xp = 0) => experienceProgress(xp).level;
export const rewardAmounts = (base) => ({
  xp: base * XP_MULTIPLIER,
  trophies: base * TROPHY_MULTIPLIER,
});
export function trophyStandings(roster) {
  const ordered = roster
    .map(({ _id, name, teamId, trophies = 0 }) => ({
      _id,
      name,
      teamId,
      trophies,
    }))
    .sort((a, b) => b.trophies - a.trophies || a.name.localeCompare(b.name));
  return ordered.map((person, index) => ({
    ...person,
    rank: ordered.findIndex((p) => p.trophies === person.trophies) + 1,
  }));
}
