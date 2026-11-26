import { characterFor } from "./characters.js";
import { playerEnergy, playerLives, MAX_ENERGY } from "./rules.js";

// Feet positions in the 1672 × 941 camp artwork, on the paths outside each door.
export const campTents = [
  { key: "tent-1", x: 1168, y: 775 },
  { key: "tent-2", x: 1084, y: 526 },
  { key: "tent-3", x: 485, y: 674 },
  { key: "tent-4", x: 864, y: 425 },
  { key: "tent-5", x: 560, y: 408 },
];

export function campTeamMembers(roster, user) {
  if (!user?.teamId) return [];
  const occupied = new Set();
  return roster
    .filter(
      (p) =>
        p.teamId === user.teamId && p.role === "GAMER" && p.active !== false,
    )
    .map((p) => (p._id === user._id ? { ...p, ...user } : { ...p }))
    .sort((a, b) => String(a._id).localeCompare(String(b._id)))
    .slice(0, 5)
    .map((player) => {
      const character = characterFor(player);
      const tent = campTents.find((t) => !occupied.has(t.key));
      occupied.add(tent.key);
      return { player, character, tent };
    });
}

export function campVitals(player) {
  return {
    life: playerLives(player),
    energy: playerEnergy(player),
    energyMax: MAX_ENERGY,
  };
}
