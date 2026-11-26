import { playerRole } from './team-roles.js';
// Historical task-slot IDs remain readable; these are work assignments, never avatar identities.
export const assignmentSlots = [
  {
    key: "blaze", code: "TEAM_LEAD",
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
    key: "glitch", code: "FRONTEND",
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
    key: "shade", code: "BACKEND",
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
    key: "pulse", code: "DATABASE_QA",
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
    key: "rune", code: "DEVOPS",
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

export function assignmentSlotKey(player) {
  const roleIndex = assignmentSlots.findIndex(slot => slot.code === playerRole(player || {}));
  if (roleIndex >= 0) return assignmentSlots[roleIndex].key;
  return assignmentSlots.find(slot => slot.key === player?.characterKey)?.key || null;
}
export function assignmentSlotFor(player) {
  return assignmentSlots.find(slot => slot.key === assignmentSlotKey(player)) || null;
}
