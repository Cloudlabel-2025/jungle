export const levelTwoMissions = {
  "D2-G01": {
    type: "GENERAL EXPLORATION",
    headline: "Untangle the signals.",
    description:
      "Conflicting messages. Missing context. Find the facts before the team takes the wrong route.",
    art: "signals",
    objective:
      "Separate facts from assumptions, ask two useful questions and send a clear team update.",
  },
  "D2-G02": {
    type: "FLIGHT INVESTIGATION",
    headline: "Recover the signal.",
    description:
      "A missing beacon. A strange echo. Follow the flight clues and radio what you discover.",
    art: "radar",
    objective:
      "Help Pip investigate a flight-information mystery. Compare the clues, plan two checks and radio the crew. No coding or aircraft controls required.",
  },
};
export const evidencePrompts = {
  finding1: [
    "Discover your first fact",
    "What is one confirmed fact in the scenario? Separate it from an assumption.",
  ],
  finding2: [
    "Spot the conflicting clue",
    "Which detail conflicts with another instruction? Record what the evidence actually says.",
  ],
  finding3: [
    "Connect the clues",
    "What else is known, missing or uncertain? Record your third finding.",
  ],
  question1: [
    "Ask the first useful question",
    "What precise question would resolve the most important uncertainty?",
  ],
  question2: [
    "Ask one level deeper",
    "What second clarification would help the team choose the right action?",
  ],
  message: [
    "Radio the team",
    "Write a clear team message: what is confirmed, what needs checking and what happens next.",
  ],
  cause: [
    "Track the anomaly",
    "Which component or behaviour is the likely cause, and why? Keep hypotheses distinct from facts.",
  ],
  evidence: [
    "Gather your evidence",
    "Which observations support your explanation? What evidence would you still collect?",
  ],
  check1: [
    "Plan your first check",
    "Describe a specific diagnostic check and what its result would tell you.",
  ],
  check2: [
    "Test an alternative",
    "Describe a second check that could challenge your first explanation.",
  ],
  update: [
    "Send your field report",
    "Radio the crew and MC: what do the clues confirm, what do you suspect and what still needs checking?",
  ],
};
export function missionEvidenceState(record, now) {
  if (!record)
    return {
      completed: false,
      answered: 0,
      total: 0,
      firstMissing: 0,
      expired: false,
    };
  const d = record.data;
  const fields = d.activity.fields;
  const firstMissing = fields.findIndex((key) => !d.draft?.[key]?.trim());
  return {
    completed: d.submissions.at(-1)?.complete === true,
    answered: fields.filter((key) => d.draft?.[key]?.trim()).length,
    total: fields.length,
    firstMissing:
      firstMissing < 0 ? Math.max(0, fields.length - 1) : firstMissing,
    expired: new Date(now) > new Date(d.deadline),
  };
}
