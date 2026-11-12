import { terrainStops } from "./map-terrain.js";

const milestones = [
  ["Open the Gates", "Login & Directory", "Build secure login, administrator and alumnus permissions, an alumni directory and profile screens backed by 20 fictional records.", 0, "thorns"],
  ["Build the Registry", "Create & Edit", "Add administrator-only creation and editing, validate alumni details, reject duplicates and prove changes persist.", 2, "vines"],
  ["Repair the Trail", "Investigate & Fix", "Reproduce a client-reported fault, identify its root cause, repair it and verify that earlier journeys still work.", 5, "bridge"],
  ["Prove the Portal", "Testing & UAT", "Test complete journeys, security, performance, reliability, accessibility and usability. Complete individual Client’s Chair UAT and retest defects.", 7, "rockfall"],
  ["Deliver Alumni Connect", "Release & Defence", "Deploy the final tested release, prepare handover and recovery instructions, and complete five persona demonstrations and individual defences.", 9, "animal"],
];
export const alumniLevels = milestones.map(([name, subtitle, goal, anchor, hazardKey], i) => ({
  _id: `alumni-sprint-${i + 1}`, number: i + 1, name, subtitle, goal,
  mapAnchor: terrainStops[anchor], hazardKey,
}));

export function hasSprintKey(sprints, teamId, number) {
  return sprints.some(s => s.data.number === number && s.data.acceptances?.some(a =>
    a.teamId === teamId && a.decision === "ACCEPTED" && a.key === `Key ${number}`));
}
export function missingSprintKeys(sprints, teamId, number) {
  return Array.from({ length: number - 1 }, (_, i) => i + 1)
    .filter(n => !hasSprintKey(sprints, teamId, n));
}

// Input is already scoped to the authenticated player's cohort and sprint team.
// Keep this projection small: no assessment marks, resources or evidence files.
export function buildAlumniMap(user, sprints, tasks, manifests) {
  const currentTeamId = [...sprints].sort((a, b) => b.data.number - a.data.number)
    .flatMap(s => s.data.teams || []).find(t => t.members?.includes(user._id))?.teamId || user.teamId;
  return alumniLevels.map(level => {
    const matching = sprints.filter(s => s.data.number === level.number && s.state !== "DRAFT")
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const sprint = matching[0];
    const team = sprint?.data.teams?.find(t => t.members?.includes(user._id));
    const teamId = team?.teamId || currentTeamId;
    const acceptance = sprint?.data.acceptances?.find(a => a.teamId === teamId);
    const cleared = acceptance?.decision === "ACCEPTED" && acceptance.key === `Key ${level.number}`;
    const missing = missingSprintKeys(sprints.filter(s => s.state !== "DRAFT"), teamId, level.number);
    const cards = tasks.filter(t => t.sprintId === sprint?._id && t.teamId === teamId && !t.data.extensionId);
    const rework = acceptance?.decision === "NOT_ACCEPTED" || acceptance?.decision === "REVIEW_REQUIRED" || cards.some(t => t.state === "Rework");
    const state = cleared ? "CLEARED" : missing.length ? "LOCKED" : !team || sprint.state === "CLOSED" ? "WAITING_RELEASE"
      : rework ? "REWORK" : sprint.state === "CLIENT_REVIEW" || cards.length > 0 && cards.every(t => t.state === "Accepted") ? "REVIEW"
      : team.kickoff ? "ACTIVE" : "KICKOFF";
    const labels = { CLEARED: `Key ${level.number} earned`, LOCKED: `Earn ${missing.map(n => `Key ${n}`).join(", ")} first`, WAITING_RELEASE: "Waiting for Commander release", REWORK: "Rework needed", REVIEW: "Awaiting client acceptance", ACTIVE: "Sprint in progress", KICKOFF: "Waiting for kickoff" };
    const gates = sprint?.data.gates || [];
    const checks = sprint?.data.template?.acceptance || manifests.find(m => m.number === level.number)?.acceptance || [];
    return {
      ...level, state, statusLabel: labels[state], teamId, sprintId: sprint?._id || null,
      canOpen: Boolean(team && !missing.length),
      dueAt: sprint?.data.dueAt || null,
      acceptance: checks.map((a, i) => ({ id: a.id, text: a.text,
        decision: gates.find(g => g.teamId === teamId && g.code === `AC-${i + 1}`)?.decision || "PENDING" })),
      tasks: cards.map(t => ({ _id: t._id, code: t.data.code, title: t.data.title, userId: t.userId, ownerName: t.ownerName,
        mine: t.userId === user._id || t.data.coGamerId === user._id, state: t.state,
        depends: t.data.depends || [] })),
      acceptedTasks: cards.filter(t => t.state === "Accepted").length,
    };
  });
}
