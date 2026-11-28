// League membership is derived from the authoritative account balance. No
// stored rank can drift when rewards are corrected, revoked or migrated.
export const TROPHY_LEAGUES = Object.freeze([
  {
    id: "scout",
    name: "Scout",
    floor: 300,
    divisions: [300, 450, 600],
    motto: "Every expedition begins with a first step.",
    color: "#a9b99b",
  },
  {
    id: "trailblazer",
    name: "Trailblazer",
    floor: 750,
    divisions: [750, 1000, 1250],
    motto: "Find the trail. Make your mark.",
    color: "#dea769",
  },
  {
    id: "ranger",
    name: "Ranger",
    floor: 1500,
    divisions: [1500, 2000, 2500],
    motto: "Read the wild. Lead with evidence.",
    color: "#a9d57b",
  },
  {
    id: "pathfinder",
    name: "Pathfinder",
    floor: 3000,
    divisions: [3000, 3750, 4500],
    motto: "Turn difficult terrain into a way forward.",
    color: "#7ed0d8",
  },
  {
    id: "guardian",
    name: "Guardian",
    floor: 5000,
    divisions: [5000, 6000, 7000],
    motto: "Strengthen the crew. Protect the expedition.",
    color: "#c2a8f2",
  },
  {
    id: "legend",
    name: "Legend",
    floor: 8000,
    divisions: [8000, 10000, 12000],
    motto: "Leave a trail worth following.",
    color: "#f2ce78",
  },
]);
export const trophyBalance = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
export const UNRANKED = Object.freeze({
  id: "unranked",
  name: "Unranked",
  floor: 0,
  color: "#b8bca8",
  motto: "Your first league is earned at 300 trophies.",
});
export function trophyLeague(value = 0) {
  const total = trophyBalance(value);
  const index = TROPHY_LEAGUES.findLastIndex((league) => total >= league.floor);
  const current = TROPHY_LEAGUES[index] || UNRANKED,
    next = TROPHY_LEAGUES[index + 1] || null;
  const divisionIndex =
    index < 0 ? -1 : current.divisions.findLastIndex((floor) => total >= floor);
  const division =
    index < 0
      ? null
      : {
          number: divisionIndex + 1,
          label: ["I", "II", "III"][divisionIndex],
          floor: current.divisions[divisionIndex],
        };
  const nextRank =
    index < 0
      ? { name: "Scout I", floor: TROPHY_LEAGUES[0].floor }
      : divisionIndex < 2
        ? {
            name: `${current.name} ${["I", "II", "III"][divisionIndex + 1]}`,
            floor: current.divisions[divisionIndex + 1],
          }
        : next
          ? { name: `${next.name} I`, floor: next.floor }
          : null;
  const rankFloor = division?.floor || 0;
  return {
    ...current,
    division,
    displayName: division ? `${current.name} ${division.label}` : current.name,
    rankIndex: index < 0 ? -1 : index * 3 + divisionIndex,
    nextRank,
    rankFloor,
    rankRemaining: nextRank ? nextRank.floor - total : 0,
    rankPercent: nextRank
      ? ((total - rankFloor) / (nextRank.floor - rankFloor)) * 100
      : 100,
    ranked: index >= 0,
    index,
    total,
    next,
    previous: index < 0 ? null : TROPHY_LEAGUES[index - 1] || UNRANKED,
    progress: total - current.floor,
    span: next ? next.floor - current.floor : null,
    remaining: next ? next.floor - total : 0,
    percent: next
      ? ((total - current.floor) / (next.floor - current.floor)) * 100
      : 100,
    cushion: total - current.floor,
  };
}
// First observation establishes a baseline. Refreshes never invent a promotion.
export const LEAGUE_CELEBRATION_MS = 1500;
export function trackTrophyLeague(previous, value) {
  const { state, transition } = advanceTrophyLeague(previous, value);
  const held = previous?.pending;
  return { ...state, pending: transition || (held?.to === trophyLeague(value).displayName ? held : null) };
}
export function advanceTrophyLeague(previous, value) {
  const current = trophyLeague(value),
    state = {
      total: current.total,
      league: current.id,
      division: current.division?.number || null,
    };
  if (!previous || !Number.isFinite(previous.total))
    return { state, transition: null };
  const before = trophyLeague(previous.total);
  return {
    state,
    transition:
      before.rankIndex === current.rankIndex
        ? null
        : {
            direction:
              current.rankIndex > before.rankIndex ? "promotion" : "demotion",
            from: before.displayName,
            to: current.displayName,
            total: current.total,
            league: current,
          },
  };
}
