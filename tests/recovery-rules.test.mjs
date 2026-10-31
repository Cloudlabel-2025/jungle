import test from "node:test";
import assert from "node:assert/strict";
import {
  recoveryScore,
  recoveryTeamSizes,
  generateRecoveryTeams,
  validateRecoveryTeams,
  validateRecoveryConfig,
  humanRequired,
} from "../lib/recovery-rules.js";
import { defaultSettings } from "../lib/week-one-program-rules.js";
import { recoveryFixture } from "./recovery-fixture.mjs";
test("Pack 3A exact 60 threshold, both exams and human boundaries", () => {
  assert.equal(defaultSettings().clearance, 60);
  assert.equal(recoveryScore(74, 58).total, 66);
  assert.equal(recoveryScore(60, 60).status, "CLEARED");
  assert.equal(recoveryScore(59.99, 60).status, "INSTITUTION_PENDING");
  assert.equal(recoveryScore(90, null).status, "INCOMPLETE");
  assert.equal(recoveryScore(90, 90, false).status, "INCOMPLETE");
  assert.ok(humanRequired(50));
  assert.ok(humanRequired(85));
  assert.ok(!humanRequired(74));
});
test("approved Saturday configuration requires two complete four-variant packs and explicit policies", () => {
  assert.equal(validateRecoveryConfig(recoveryFixture()).exams.length, 2);
  for (const change of [
    (c) => c.exams[0].variants.pop(),
    (c) => (c.exams[0].variants[0].reference = ""),
    (c) => (c.meetingUrl = "http://example.invalid"),
    (c) => (c.start = "2026-11-06T03:30:00Z"),
    (c) => (c.teamScoreBasis = ""),
    (c) => (c.choiceDeadline = c.examClose),
  ]) {
    const c = recoveryFixture();
    change(c);
    assert.throws(() => validateRecoveryConfig(c));
  }
});
test("all eligible counts produce unique balanced 3–5 crews and fixed support entitlements", () => {
  assert.deepEqual(recoveryTeamSizes(25), [5, 5, 5, 5, 5]);
  assert.deepEqual(recoveryTeamSizes(24), [5, 5, 5, 5, 4]);
  assert.deepEqual(recoveryTeamSizes(23), [5, 5, 5, 5, 3]);
  assert.deepEqual(recoveryTeamSizes(22), [5, 5, 5, 4, 3]);
  assert.deepEqual(recoveryTeamSizes(21), [5, 5, 5, 3, 3]);
  assert.deepEqual(recoveryTeamSizes(7), [4, 3]);
  for (let n = 3; n <= 60; n++) {
    const rows = Array.from({ length: n }, (_, i) => ({
      userId: `g${i}`,
      score: 100 - i,
    }));
    const teams = generateRecoveryTeams(rows, "fixed-seed");
    assert.deepEqual(teams, generateRecoveryTeams(rows, "fixed-seed"));
    assert.equal(
      validateRecoveryTeams(teams, rows).flatMap((t) => t.members).length,
      n,
    );
    for (const t of teams) assert.equal(t.credits, 5 - t.size);
  }
  assert.throws(() =>
    generateRecoveryTeams([{ userId: "only", score: 60 }], "seed"),
  );
  assert.throws(() =>
    validateRecoveryTeams(
      [{ members: ["a", "b"] }],
      [{ userId: "a" }, { userId: "b" }],
    ),
  );
});
