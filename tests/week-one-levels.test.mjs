import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreFlightLevel,
  effectiveFlightLevel,
  levelReward,
} from "../lib/week-one-level-rules.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { validateDayContent } from "../lib/week-one-program-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

export const config = { ...fixtureConfig(), version: 1 };
export const start = new Date(config.officialStart);
export const later = (minutes) => new Date(start.getTime() + minutes * 60000);
export function evidenceFor(activity, variant) {
  if (activity.kind === "QUIZ")
    return Object.fromEntries(activity.questions.map((q) => [q.id, q.correct]));
  return Object.fromEntries(
    activity.fields.map((key) => [
      key,
      key === "sequence"
        ? variant.cards
        : key === "url"
          ? "https://chatgpt.com/share/new-evidence"
          : `${key} ${activity.id} We compared the supplied observations against another explanation and recorded a specific independent verification step before reaching this cautious conclusion.`,
    ]),
  );
}
export function pack(day) {
  return validateDayContent(day, starterFlightContent(day, config), config);
}
export function attemptsFor(day) {
  return pack(day).activities.map((activity) => ({
    activityId: activity.id,
    data: {
      activity,
      variant: activity.variants?.[0],
      originalUrl: "https://chatgpt.com/share/old-evidence",
      startedAt: start.toISOString(),
      deadline: later(activity.durationMinutes).toISOString(),
      submittedAt: later(10).toISOString(),
      submissions: [
        {
          id: activity.id,
          complete: true,
          answers: evidenceFor(activity, activity.variants?.[0]),
          at: later(10).toISOString(),
        },
      ],
    },
  }));
}
test("Levels 2–5 score real submission evidence, effort, deadlines and 5x rewards", () => {
  for (const day of [2, 3, 4, 5]) {
    const rows = attemptsFor(day);
    assert.equal(scoreFlightLevel(day, rows.slice(0, 1)).stars, 0);
    let result = scoreFlightLevel(day, rows);
    assert.equal(result.stars, 3, `Level ${day}`);
    assert.deepEqual(
      { trophies: result.trophies, xp: result.xp },
      { trophies: 30, xp: 150 },
    );
    rows[0].data.submissions[0].late = true;
    assert.equal(scoreFlightLevel(day, rows).stars, 2);
    const key = rows[0].data.activity.fields.find(
      (k) => !["sequence", "url"].includes(k),
    );
    rows[0].data.submissions[0].answers[key] = "brief";
    assert.equal(scoreFlightLevel(day, rows).stars, 1);
    assert.equal(scoreFlightLevel(day, rows).xp, 75);
  }
  for (const n of [0, 1, 2, 3])
    assert.equal(levelReward(n).xp, levelReward(n).trophies * 5);
});
test("copied notes, wrong component order, weak quiz and recycled chat cannot earn three stars", () => {
  let rows = attemptsFor(2);
  rows[0].data.submissions[0].answers.finding2 =
    rows[0].data.submissions[0].answers.finding1;
  assert.equal(scoreFlightLevel(2, rows).stars, 1);
  rows = attemptsFor(3);
  rows[1].data.submissions[0].answers.sequence = [
    ...rows[1].data.variant.cards,
  ].reverse();
  assert.equal(scoreFlightLevel(3, rows).stars, 1);
  rows = attemptsFor(5);
  rows[1].data.activity.questions.forEach((q) => {
    rows[1].data.submissions[0].answers[q.id] =
      (q.correct + 1) % q.options.length;
  });
  assert.equal(scoreFlightLevel(5, rows).stars, 1);
  delete rows[1].data.submissions[0].answers.q1;
  assert.equal(scoreFlightLevel(5, rows).stars, 0);
  rows = attemptsFor(5);
  rows[0].data.submissions[0].answers.url = rows[0].data.originalUrl;
  assert.equal(scoreFlightLevel(5, rows).stars, 1);
  const manual = { completed: false, stars: 0, source: "CENTRE_COMMAND" };
  assert.equal(
    effectiveFlightLevel({
      automatic: { completed: true, stars: 3 },
      override: manual,
    }),
    manual,
  );
  assert.equal(
    effectiveFlightLevel({
      practice: true,
      automatic: { completed: false, stars: 0 },
      history: [{ result: { completed: true, stars: 2 } }],
    }).stars,
    2,
  );
});
