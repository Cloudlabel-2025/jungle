import test from "node:test";
import assert from "node:assert/strict";
import {
  ist,
  attendanceRule,
  boundedAward,
  healthDrop,
  deadlineInfraction,
  league,
} from "../lib/rules.js";
test("IST attendance boundaries are evaluated from server UTC timestamps", () => {
  assert.equal(ist(new Date("2026-10-24T03:30:00.000Z")).minutes, 540);
  assert.equal(attendanceRule(new Date("2026-10-24T03:30:00Z")).onTime, true);
  assert.equal(
    attendanceRule(new Date("2026-10-24T03:30:00.001Z")).onTime,
    false,
  );
  assert.throws(
    () => attendanceRule(new Date("2026-10-24T03:45:00.001Z")),
    /lateness reason/,
  );
  assert.equal(attendanceRule(new Date("2026-10-24T03:31:00Z")).onTime, false);
  assert.throws(
    () => attendanceRule(new Date("2026-10-24T03:46:00Z")),
    /lateness reason/,
  );
  assert.equal(
    attendanceRule(
      new Date("2026-10-24T03:46:00Z"),
      "Rail service was delayed.",
    ).onTime,
    false,
  );
  assert.equal(ist(new Date("2026-10-24T20:00:00Z")).day, "2026-10-25");
});
test("daily trophy cap cannot be exceeded or become negative", () => {
  assert.equal(boundedAward(10, 48), 2);
  assert.equal(boundedAward(5, 50), 0);
  assert.equal(boundedAward(5, 55), 0);
  assert.equal(boundedAward(1, 0), 1);
});
test("every third energy penalty costs one life and resets energy", () => {
  assert.deepEqual(healthDrop(3, 2, 1), {
    hp: 2,
    energy: 3,
    lifeChange: -1,
    drops: 3,
    warning: true,
    rescue: false,
  });
  assert.equal(healthDrop(1, 4, 1).rescue, true);
  assert.equal(healthDrop(0, 5).hp, 0);
  let state = { hp: 5, drops: 0, energy: 3 };
  for (let i = 1; i <= 15; i++) {
    state = healthDrop(state.hp, state.drops, state.energy);
    assert.equal(state.hp, 5 - Math.floor(i / 3));
    assert.equal(state.energy, i === 15 ? 0 : 3 - (i % 3));
    assert.equal(state.rescue, i === 15);
  }
  assert.equal(healthDrop(0, 15, 0).energy, 0);
});
test("finishing on time does not substitute for a pre-deadline report", () => {
  const dueAt = "2026-10-25T10:00:00Z";
  assert.equal(deadlineInfraction({ dueAt, status: "Done" }), true);
  assert.equal(
    deadlineInfraction({ dueAt, reportedAt: "2026-10-25T09:59:59Z" }),
    false,
  );
  assert.equal(deadlineInfraction({ dueAt, reportedAt: dueAt }), true);
});
test("league thresholds match the brief", () => {
  assert.equal(league(299), "BRONZE");
  assert.equal(league(300), "SILVER");
  assert.equal(league(699), "SILVER");
  assert.equal(league(700), "GOLD");
});
