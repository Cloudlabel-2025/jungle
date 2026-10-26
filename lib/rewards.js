export const XP_MULTIPLIER = 3;
export const TROPHY_MULTIPLIER = 2;
export const DAILY_XP_CAP = 150;
export const DAILY_TROPHY_CAP = 100;
export const XP_PER_LEVEL = 100;
export const experienceLevel = (xp = 0) =>
  1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
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
