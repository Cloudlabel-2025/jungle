import { fixtureConfig } from "./day-one-fixture.mjs";
import {
  emptyDayContent,
  defaultSettings,
} from "../lib/week-one-program-rules.js";
export function programFixture(day) {
  const original = fixtureConfig();
  const start = new Date(
    Date.parse(original.officialStart) + (day - 1) * 86400000,
  );
  const content = emptyDayContent(day);
  content.officialStart = start.toISOString();
  content.closingCutoff = new Date(start.getTime() + 8 * 3600000).toISOString();
  if (day < 5) {
    content.nudgeAt = new Date(start.getTime() + 4 * 3600000).toISOString();
    content.discovery = {
      title: `Fixture Discovery ${day}`,
      brief:
        "Test-only adventure: investigate a claim and retain evidence of your checks.",
    };
  }
  for (const activity of content.activities) {
    if (activity.id === "D5-F01")
      activity.variants = original.genres.map((g) => ({
        id: g.id,
        name: g.name,
        brief: g.question,
        reference:
          "Fixture-only reference: consider independent sources and defensible alternative explanations.",
      }));
    else if (activity.questions)
      activity.questions = activity.questions.map((q) => ({
        ...q,
        question: `Fixture-only Full Stack concept question ${q.id}?`,
        options: [
          "Keyed answer",
          "Alternative B",
          "Alternative C",
          "Alternative D",
        ],
        correct: 0,
      }));
    else
      activity.variants = activity.variants.map((v) => ({
        ...v,
        brief: `Fixture-only ${v.name} scenario: compare these conflicting source clues and explain an evidence-backed conclusion.`,
        reference:
          "Fixture-only official observations and allowed alternatives. Reasoning and verification must be supported by evidence.",
        ...(activity.id === "D3-G02"
          ? { cards: ["Frontend", "API", "Backend", "Database"] }
          : {}),
      }));
  }
  return content;
}
export function settingsFixture() {
  return {
    ...defaultSettings(),
    clearance: 70, // Historical Week 1 baseline; Pack 3A migration is tested separately.
    compassQuestions: [
      "Fixture prompt about progress",
      "Fixture prompt about evidence",
      "Fixture prompt about next steps",
    ],
    awardDefinitions: Array.from({ length: 13 }, (_, i) => ({
      id: `award-${i}`,
      name: `Fixture award ${i + 1}`,
      category: i < 5 ? "SKILL" : "GROWTH",
      rule: "Test-only selection requires documented assessment evidence and human approval.",
    })),
    rescueSlots: [
      {
        id: "saturday",
        start: "2026-11-07T03:30:00Z",
        end: "2026-11-07T04:30:00Z",
        capacity: 25,
        meetingUrl: "https://meet.example/rescue",
        approval: "Test college approved this one-hour Saturday online slot.",
      },
    ],
  };
}
