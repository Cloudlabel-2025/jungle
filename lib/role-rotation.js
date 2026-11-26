import { teamRoles } from "./team-roles.js";

// Published roster order is the stable seat order. Never derive a seat from a
// player's name, current role, avatar, or the order returned by a database query.
export function sprintRoleAssignments(members, sprintNumber = 1) {
  if (!Number.isInteger(sprintNumber) || sprintNumber < 1)
    throw new Error("A positive sprint number is required for role rotation.");
  if (!Array.isArray(members) || members.length > teamRoles.length || new Set(members).size !== members.length)
    throw new Error("Role rotation needs up to five distinct team members.");
  return members.map((userId, baseIndex) => ({
    userId, baseIndex, sprintNumber,
    ...teamRoles[(baseIndex + sprintNumber - 1) % teamRoles.length],
  }));
}

export function sprintTaskOwners(tasks, members, commanderId) {
  return Object.fromEntries(tasks.map(task => {
    const index = "ABCDE".indexOf(task.owner);
    if (index < 0 || task.owner.length !== 1) throw new Error("Unknown approved task seat.");
    return [task.id, members[index] || commanderId];
  }));
}
