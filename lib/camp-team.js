import { characterFor } from "./characters.js";
import { playerEnergy } from "./rules.js";

// Feet positions in the 1672 × 941 camp artwork, on the paths outside each door.
export const campTents = [
  { key: "blaze", x: 1168, y: 775 },
  { key: "glitch", x: 1084, y: 526 },
  { key: "shade", x: 485, y: 674 },
  { key: "pulse", x: 864, y: 425 },
  { key: "rune", x: 560, y: 408 },
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
      const tent =
        campTents.find(
          (t) => t.key === character?.key && !occupied.has(t.key),
        ) || campTents.find((t) => !occupied.has(t.key));
      occupied.add(tent.key);
      return { player, character, tent };
    });
}

export function campVitals(player, dayOne = false) {
  return {
    life: Math.max(0, Math.min(5, player.hp ?? 5)),
    energy: dayOne ? 5 : playerEnergy(player),
    energyMax: dayOne ? 5 : 3,
  };
}
