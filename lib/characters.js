import { playerRole } from "./team-roles.js";
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
    label: "Blaze",
    male: "Zayn",
    female: "Zara",
    color: "#e6a365",
    style: "Amber expedition bomber, flame embroidery, bold undercut",
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
    label: "Glitch",
    male: "Jett",
    female: "Juno",
    color: "#59d8e8",
    style: "Cyan techwear, utility straps, angular visor",
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
    label: "Shade",
    male: "Nyx",
    female: "Nia",
    color: "#b4a0e5",
    style: "Violet hooded streetwear, silver details, quiet confidence",
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
    label: "Pulse",
    male: "Kai",
    female: "Kira",
    color: "#e69cac",
    style: "Coral trail jacket, headphones, playful layered styling",
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
    label: "Rune",
    male: "Riven",
    female: "Rhea",
    color: "#bed98a",
    style: "Sage utility vest, botanical patches, braided details",
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
  return characters.some((c) => c.key === player?.characterKey)
    ? player.characterKey
    : characters[legacySlots.indexOf(playerRole(player || {}))]?.key || null;
}
export function characterFor(player) {
  const character = characters.find((c) => c.key === characterKey(player));
  if (!character) return null;
  const variant = player.characterVariant === "female" ? "female" : "male";
  return {
    ...character,
    variant,
    name: character[variant],
    image: `/images/characters/${character.key}-${variant}.webp`,
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
