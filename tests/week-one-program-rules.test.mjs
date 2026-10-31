import test from "node:test";
import assert from "node:assert/strict";
import {
  criteria,
  activities,
  weekOneNavigation,
} from "../lib/week-one-catalog.js";
import {
  validateDayContent,
  validateSettings,
  publicActivity,
  weightedRatings,
  needsHumanReview,
  answersFor,
  completeAnswers,
  professionalScore,
  readiness,
  balancedTeams,
  bookRescues,
  quizScore,
} from "../lib/week-one-program-rules.js";
import { releaseProjection } from "../lib/week-one-rules.js";
import { capabilityScores } from "../lib/week-one-outcomes.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import {
  programFixture,
  settingsFixture,
} from "./week-one-program-fixture.mjs";

test("Week 1 freezes 23 role views and 13 WILD6 criteria in the four 40/20/25/15 buckets", () => {
  assert.deepEqual(
    Object.values(weekOneNavigation).map((v) => v.length),
    [8, 8, 7],
  );
  assert.equal(criteria.length, 13);
  const buckets = Object.groupBy(criteria, (c) => c.area);
  assert.deepEqual(
    Object.values(buckets).map((v) => v.reduce((n, c) => n + c.weight, 0)),
    [40, 20, 25, 15],
  );
});
test("all approved day packs validate and Friday preserves original question versions", () => {
  for (const n of [2, 3, 4, 5])
    assert.equal(
      validateDayContent(n, programFixture(n), fixtureConfig()).activities
        .length,
      2,
    );
  const bad = programFixture(5);
  bad.activities[0].variants[0].brief += " changed";
  assert.throws(() => validateDayContent(5, bad, fixtureConfig()));
  const missing = programFixture(3);
  missing.activities[0].variants.pop();
  assert.throws(() => validateDayContent(3, missing));
  const keyed = programFixture(5);
  keyed.activities[1].questions[0].correct = 9;
  assert.throws(() => validateDayContent(5, keyed, fixtureConfig()));
});
test("public content projections never reveal reference answers, quiz keys or prepared drafts", () => {
  const content = validateDayContent(5, programFixture(5), fixtureConfig());
  for (const a of content.activities) {
    const projected = JSON.stringify(publicActivity(a));
    assert.ok(!projected.includes('"correct"'));
    assert.ok(!projected.includes('"reference"'));
  }
  const visible = releaseProjection(
    {
      days: [
        { day: 5, title: "Prove", state: "OPEN", content, draft: content },
      ],
    },
    "GAMER",
  );
  assert.equal(visible.days[0].draft, undefined);
  assert.ok(!JSON.stringify(visible).includes("Keyed answer"));
});
test("AI-first weighting and inclusive human review boundaries use unrounded percentages", () => {
  const keys = ["framing", "reasoning", "verification", "communication"],
    ratings = Object.fromEntries(keys.map((k) => [k, 3]));
  assert.equal(weightedRatings(keys, ratings).maximum, 28);
  assert.equal(weightedRatings(keys, ratings).percent, 75);
  assert.equal((75 / 100) * 5, 3.75);
  assert.equal((75 / 100) * 4, 3);
  for (const [value, expected] of [
    [50, true],
    [50.001, false],
    [84.999, false],
    [85, true],
  ])
    assert.equal(needsHumanReview(value), expected);
  assert.equal(needsHumanReview(75, true), true);
  assert.throws(() => weightedRatings(keys, { ...ratings, framing: 5 }));
  assert.throws(() => weightedRatings(keys, { framing: 3 }));
});
test("STORY, FIRE and component ordering preserve partial evidence without fabricated answers", () => {
  const a = validateDayContent(3, programFixture(3)).activities[1],
    v = a.variants[0];
  const partial = answersFor(a, v, {
    scene: "A partial explanation",
    sequence: ["Frontend", "API"],
  });
  assert.equal(completeAnswers(a, v, partial), false);
  assert.equal(partial.need, "");
  assert.throws(() => answersFor(a, v, { sequence: ["API", "API"] }));
  assert.equal(
    activities
      .find((a) => a.id === "D4-G02")
      .fields.filter((k) =>
        ["frame", "integrate", "reason", "experiment"].includes(k),
      ).length,
    4,
  );
});
test("quiz grades keyed answers without negative marking and retains blank items", () => {
  const q = validateDayContent(5, programFixture(5), fixtureConfig())
    .activities[1];
  assert.equal(quizScore(q, answersFor(q, null, {})), 0);
  const answers = Object.fromEntries(
    q.questions.map((q, i) => [q.id, i < 10 ? 0 : i < 14 ? 1 : null]),
  );
  assert.ok(Math.abs((quizScore(q, answers) / 100) * 3 - 2) < 1e-12);
});
test("professional penalties apply once per missing-agenda streak and do not duplicate Discovery inside the denominator", () => {
  const days = Array.from({ length: 5 }, (_, i) => ({
    day: i + 1,
    events: [
      { id: "clock", met: true },
      { id: "eod", met: true },
    ],
    agendaMissing: true,
    discoveryRequired: i > 0 && i < 4,
    discoveryAttempted: false,
  }));
  const score = professionalScore(days);
  assert.equal(score.total, 7.5);
  assert.equal(
    score.ledger.reduce((n, d) => n + (d.penalty || 0), 0),
    2.5,
  );
  days[2].discoveryAttempted = true;
  assert.equal(professionalScore(days).total, 8);
  for (const d of days) d.events.forEach((e) => (e.met = false));
  assert.equal(professionalScore(days).total, 0);
  days[2].excused = true;
  assert.equal(professionalScore(days).ledger[2].events.length, 0);
});
test("readiness preserves pending values and exact 70/92 boundaries", () => {
  const settings = settingsFixture(),
    all = (n) =>
      Object.fromEntries(Object.keys(settings.weights).map((k) => [k, n]));
  assert.equal(readiness(all(70), settings).status, "CLEARED");
  assert.equal(readiness(all(69.999), settings).status, "RESCUE_PENDING");
  assert.equal(readiness(all(92), settings).distinction, true);
  assert.equal(
    readiness({ ...all(100), fitness: null }, settings).status,
    "PENDING",
  );
  assert.throws(() =>
    validateSettings({
      ...settings,
      weights: { ...settings.weights, fitness: 51 },
    }),
  );
  assert.throws(() =>
    validateSettings({
      ...settings,
      awardDefinitions: settings.awardDefinitions.slice(0, 12),
    }),
  );
});
test("unobserved capability criteria remain Not Assessed and matching task suggestions require >92", () => {
  const source = [
    {
      activityId: "D2-G01",
      data: {
        result: {
          status: "ACCEPTED",
          criteria: [{ key: "framing", rating: 3.68 }],
        },
      },
    },
  ];
  const scores = capabilityScores(source);
  assert.equal(
    scores.find((c) => c.area === "Technical Application").percent,
    null,
  );
  assert.equal(
    scores.find((c) => c.area === "AI-Enabled Problem-Solving").percent,
    92,
  );
  assert.equal(
    scores.filter((c) => c.percent !== null && c.percent > 92).length,
    0,
  );
});
test("provisional teams contain only cleared learners in 1-high/3-middle/1-low groups where viable", () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({
    userId: `g${String(i).padStart(2, "0")}`,
    total: 100 - i,
    status: "CLEARED",
  }));
  const teams = balancedTeams([
    ...rows,
    { userId: "rescue", total: 60, status: "RESCUE_PENDING" },
  ]);
  assert.equal(teams.length, 5);
  assert.ok(
    teams.every((t) => t.members.length === 5 && t.status === "PROVISIONAL"),
  );
  assert.equal(new Set(teams.flatMap((t) => t.members)).size, 25);
  for (const team of teams) {
    assert.equal(
      team.members.filter((id) => rows.slice(0, 5).some((r) => r.userId === id))
        .length,
      1,
    );
    assert.equal(
      team.members.filter((id) => rows.slice(-5).some((r) => r.userId === id))
        .length,
      1,
    );
  }
  for (let size = 1; size <= 24; size++) {
    const groups = balancedTeams(rows.slice(0, size));
    assert.equal(new Set(groups.flatMap((g) => g.members)).size, size);
    assert.ok(groups.every((g) => g.members.length <= 5));
  }
});
test("rescue uses approved Saturday one-hour slots and explicitly flags insufficient capacity", () => {
  const s = settingsFixture(),
    rows = [
      { userId: "a", status: "RESCUE_PENDING" },
      { userId: "b", status: "RESCUE_PENDING" },
    ];
  const bookings = bookRescues(
    rows,
    [{ ...s.rescueSlots[0], capacity: 1 }],
    "Asia/Kolkata",
    "2026-11-06T11:30:00Z",
  );
  assert.equal(bookings[0].status, "BOOKED");
  assert.equal(bookings[1].status, "SCHEDULING_EXCEPTION");
  assert.deepEqual(
    bookRescues(rows, [], "Asia/Kolkata", "2026-11-06T11:30:00Z").map(
      (r) => r.status,
    ),
    ["SCHEDULING_EXCEPTION", "SCHEDULING_EXCEPTION"],
  );
});
