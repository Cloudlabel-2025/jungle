import { playerRole, teamRoles } from "./team-roles.js";
import { avatarFor } from "./avatar.js";
import { stickerImage } from "./avatar-stickers.js";
const legacySlots = [
  "TEAM_LEAD",
  "FRONTEND",
  "BACKEND",
  "DATABASE_QA",
  "DEVOPS",
];
export const characters = [
  {
    key: "blaze",
    label: "Team Lead / Full Stack",
    color: "#e6a365",
    ability: {
      name: "Trail Planner",
      summary:
        "A guided plan for building your feature in small, testable steps.",
      steps: [
        "State the feature goal and its acceptance checks.",
        "Sketch the UI, API contract and stored fields before coding.",
        "Build one working path through all layers, then cover error states.",
        "Finish with evidence and a shared-app smoke check.",
      ],
    },
  },
  {
    key: "glitch",
    label: "Frontend Specialist",
    color: "#59d8e8",
    ability: {
      name: "Debug Lens",
      summary:
        "A structured trace from a broken screen to the request, server and stored data.",
      steps: [
        "Reproduce one failure and record its exact input.",
        "Inspect the request URL, payload, response status and body.",
        "Follow the request through validation and database persistence.",
        "Retest the original failure and one successful path.",
      ],
    },
  },
  {
    key: "shade",
    label: "Backend Architect",
    color: "#b4a0e5",
    ability: {
      name: "Edge Radar",
      summary: "A checklist for spotting boundary cases before review.",
      steps: [
        "Try empty, malformed and oversized input relevant to your feature.",
        "Check missing identifiers and duplicate or repeated requests.",
        "Verify refresh, retry, empty and failed-request states.",
        "Check concurrency or ownership boundaries when the level requires them.",
      ],
    },
  },
  {
    key: "pulse",
    label: "Database / QA",
    color: "#e69cac",
    ability: {
      name: "Team Signal",
      summary:
        "A concise coordination brief for sharing progress, evidence and blockers.",
      steps: [
        "Name the feature and the behaviour you are delivering.",
        "Report which layers are ready and link their evidence.",
        "State one blocker and the specific help needed.",
        "Agree the next integration check with a teammate.",
      ],
    },
  },
  {
    key: "rune",
    label: "DevOps / Reliability",
    color: "#bed98a",
    ability: {
      name: "Contract Map",
      summary:
        "A guide to connecting UI fields, API contracts, database records and verification.",
      steps: [
        "Map each UI field to a validated request field.",
        "Map endpoints and response shapes to loading, success and error states.",
        "Match stored fields to types, constraints and stable identifiers.",
        "Connect these behaviours to tests and the running shared-app route.",
      ],
    },
  },
];
export function characterKey(player) {
  if (player?.characterHidden) return null;
  return characters.some((c) => c.key === player?.characterKey)
    ? player.characterKey
    : characters[legacySlots.indexOf(playerRole(player || {}))]?.key || null;
}
export function characterFor(player) {
  if (!player || player.characterHidden) return null;
  const character = characters.find((c) => c.key === characterKey(player));
  if (!character && !player.avatar) return null;
  const avatar = avatarFor(player);
  return {
    ...(character || characters[0]),
    label:
      teamRoles[characters.indexOf(character)]?.label || "Full-stack explorer",
    variant: avatar.style,
    name: player.name || "Explorer",
    avatar,
    color: avatar.topColor,
    image: stickerImage(avatar, { portrait: true }),
    bodyImage: stickerImage(avatar),
    signature: JSON.stringify(avatar),
  };
}
export function fullStackTeamReady(players, teamId) {
  const active = players.filter(
    (player) =>
      player.teamId === teamId &&
      player.active !== false &&
      player.role === "GAMER",
  );
  return (
    active.length === 5 &&
    characters.every(
      (character) =>
        active.filter((player) => characterKey(player) === character.key)
          .length === 1,
    )
  );
}
export const disciplines = [
  { code: "FRONTEND", label: "Frontend" },
  { code: "BACKEND", label: "Backend" },
  { code: "DATABASE", label: "Database" },
  { code: "TESTING", label: "Testing" },
  { code: "DEPLOYMENT", label: "Deployment & integration" },
];
export function projectTaskLabel(task) {
  return task?.discipline
    ? `${task.featureName} · ${disciplines.find((d) => d.code === task.discipline)?.label || task.discipline}`
    : null;
}
