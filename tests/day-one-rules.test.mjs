import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSetup,
  frozenRubric,
  validateSetup,
  baselineScore,
  workingMinutes,
  desiredRewards,
  projectRecord,
  championCandidates,
  threadUrl,
} from "../lib/day-one-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
test("Day 1 frozen weighted 50/50 assessment is out of 33 and rejects missing/unbounded ratings", () => {
  assert.equal(
    baselineScore([4, 4, 4, 4, 4], [4, 4, 4, 4, 4], frozenRubric).total,
    33,
  );
  const score = baselineScore([4, 2, 3, 4, 0], [2, 4, 1, 0, 4], frozenRubric);
  assert.equal(score.total, 4.5 + 5.25 + 3.5 + 4 + 2.5);
  assert.equal(score.unassessed, 8);
  for (const bad of [
    [4, 4],
    Array(5).fill(null),
    [5, 1, 1, 1, 1],
    [NaN, 1, 1, 1, 1],
  ])
    assert.throws(() => baselineScore(bad, [4, 4, 4, 4, 4], frozenRubric));
});
test("Day 1 30/60 acknowledgement windows include exact boundaries, skip weekends, holidays and nights", () => {
  const c = fixtureConfig();
  for (const [end, expected] of [
    ["04:00:00", 30],
    ["04:00:01", 30 + 1 / 60],
    ["04:30:00", 60],
    ["04:30:01", 60 + 1 / 60],
  ])
    assert.ok(
      Math.abs(
        workingMinutes(c.availableAt, `2026-11-02T${end}Z`, c) - expected,
      ) < 1e-8,
    );
  assert.equal(
    workingMinutes("2026-10-30T11:20:00Z", "2026-11-02T03:50:00Z", c),
    30,
  );
  assert.equal(
    workingMinutes("2026-10-30T11:20:00Z", "2026-11-03T03:50:00Z", {
      ...c,
      holidays: ["2026-11-02"],
    }),
    30,
  );
});
test("Day 1 rewards: 20 maximum, pending and late verification, and no contribution to baseline", () => {
  const c = fixtureConfig(),
    data = {
      config: c,
      availableAt: c.availableAt,
      clockAt: c.clockCutoff,
      sod: { at: "2026-11-02T03:31:00Z" },
      agendaViewedAt: "2026-11-02T03:31:00Z",
      agendaAcknowledgedAt: "2026-11-02T03:32:00Z",
      acknowledgedAt: "2026-11-02T04:00:00Z",
      startedAt: "2026-11-02T04:01:00Z",
      submissions: [{ id: "one", at: "2026-11-02T05:31:00Z" }],
      eod: { at: c.closingCutoff },
    };
  assert.equal(
    Object.values(desiredRewards({ data })).reduce((a, b) => a + b),
    14,
  );
  data.verification = {
    status: "VERIFIED",
    revision: "one",
    at: "2026-11-04T05:31:00Z",
  };
  assert.equal(
    Object.values(desiredRewards({ data })).reduce((a, b) => a + b),
    20,
  );
  data.submissions[0].at = "2026-11-02T05:31:01Z";
  assert.equal(desiredRewards({ data }).submission, 0);
  data.acknowledgedAt = "2026-11-02T04:30:00Z";
  assert.equal(desiredRewards({ data }).acknowledge, 2);
  data.acknowledgedAt = "2026-11-02T04:30:01Z";
  assert.equal(desiredRewards({ data }).acknowledge, 0);
});
test("Day 1 projections never send scores, ranking, marking instructions or private prize to Gamer/MC", () => {
  const c = fixtureConfig(),
    record = {
      _id: "r",
      userId: "u",
      energy: 5,
      data: {
        config: c,
        submissions: [],
        ledger: [],
        assessment: {
          total: 34,
          ai: [4, 4, 4, 4, 4],
          human: [4, 4, 4, 4, 4],
          approvedAt: "now",
        },
      },
    };
  for (const role of ["GAMER", "MISSION_COMMANDER"]) {
    const p = projectRecord(record, role, {
      userId: "u",
      prompt: c.championPrompt,
    });
    assert.equal(p.assessment, undefined);
    assert.equal(p.champion, undefined);
    assert.equal(p.config.markingInstructions, undefined);
    assert.ok(!JSON.stringify(p).includes("PRIVATE_PRIZE"));
  }
  assert.equal(projectRecord(record, "CENTRE_COMMAND").assessment.total, 34);
  assert.equal(
    projectRecord(record, "GAMER", {
      userId: "u",
      prompt: "earned",
      releasedAt: "now",
    }).champion.prompt,
    "earned",
  );
  assert.equal(
    projectRecord(record, "MISSION_COMMANDER", {
      userId: "u",
      prompt: "earned",
      releasedAt: "now",
    }).champion,
    undefined,
  );
  assert.deepEqual(championCandidates([record, { ...record, userId: "v" }]), [
    "u",
    "v",
  ]);
});
test("Day 1 preparation requires final questions, protected rubric and explicit official start", () => {
  assert.equal(validateSetup(fixtureConfig()).durationMinutes, 90);
  assert.throws(() => validateSetup(defaultSetup()));
  assert.throws(() =>
    validateSetup({ ...fixtureConfig(), revealAfter: "2026-11-02T10:30:00Z" }),
  );
  assert.throws(() =>
    validateSetup({
      ...fixtureConfig(),
      rubric: frozenRubric.map((r, i) => (i === 3 ? { ...r, max: 9 } : r)),
    }),
  );
  for (const url of [
    "http://chat.example/share/x",
    "https://chat.example/",
    "https://user:pass@chat.example/share/x",
    "javascript:alert(1)",
    "https://chat.example/share/x https://chat.example/share/y",
  ])
    assert.throws(() => threadUrl(url));
  assert.equal(
    threadUrl("https://chat.example/share/one"),
    "https://chat.example/share/one",
  );
});
test("agenda trophies use the official 30-minute window independently of SOD", () => {
  const data = { config: fixtureConfig(), sod: { at: "2026-11-02T03:31:00Z" } };
  assert.equal(desiredRewards({ data }).agenda, 0);
  data.agendaViewedAt = "2026-11-02T03:31:00Z";
  for (const [ack, points] of [
    ["03:29:59", 0],
    ["04:00:00", 4],
    ["04:00:01", 0],
  ]) {
    data.agendaAcknowledgedAt = `2026-11-02T${ack}Z`;
    assert.equal(desiredRewards({ data }).agenda, points);
  }
  assert.throws(() => validateSetup({ ...fixtureConfig(), officialStart: "" }));
});
test("historical 34-mark assessments and old reward versions retain their rules", () => {
  const config = {
    ...fixtureConfig(),
    rewardVersion: "day1-v1.1",
    rubric: frozenRubric.map((r) =>
      r.key === "communication" ? { ...r, max: 9 } : r,
    ),
  };
  assert.equal(
    baselineScore(Array(5).fill(4), Array(5).fill(4), config.rubric).total,
    34,
  );
  const data = { config, sod: { at: "2026-11-02T03:31:00Z" } };
  assert.equal(desiredRewards({ data }).sod, 4);
  assert.equal(desiredRewards({ data }).agenda, undefined);
});
