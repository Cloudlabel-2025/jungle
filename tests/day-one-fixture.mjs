import { defaultSetup } from "../lib/day-one-rules.js";
export function fixtureConfig() {
  const c = defaultSetup();
  return {
    ...c,
    day: "2026-11-02",
    officialStart: "2026-11-02T03:30:00Z",
    availableAt: "2026-11-02T03:30:00Z",
    clockCutoff: "2026-11-02T03:30:00Z",
    closingCutoff: "2026-11-02T11:30:00Z",
    revealAfter: "2026-11-08T11:30:00Z",
    genres: c.genres.map((g) => ({
      ...g,
      question: `Investigate a real open research question in ${g.name}. Show sources and verify your reasoning.`,
    })),
    markingInstructions:
      "Rate all five observable criteria from zero to four using the shared evidence.",
    championPrompt:
      "PRIVATE_PRIZE: verify your findings against independent primary sources and explain discrepancies.",
  };
}
