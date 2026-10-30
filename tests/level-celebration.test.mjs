import test from "node:test";
import assert from "node:assert/strict";
import { completionKey, pendingCompletions } from "../lib/level-celebration.js";

const cleared = {
  _id: "a:l1",
  teamId: "a",
  status: "CLEARED",
  stars: 3,
  clearedAt: "2026-10-30T10:00:00Z",
  rewards: [{ userId: "p", xp: 120, trophies: 60 }],
};
const data = {
  user: { _id: "p", role: "GAMER", teamId: "a" },
  projectAttempts: [cleared],
};
test("celebrations require committed clearance, valid stars and recorded rewards for the player team", () => {
  assert.deepEqual(
    pendingCompletions(data, () => false),
    [cleared],
  );
  for (const patch of [
    { status: "REVIEW" },
    { stars: 0 },
    { stars: 4 },
    { rewards: [] },
    { teamId: "b" },
  ])
    assert.equal(
      pendingCompletions(
        { ...data, projectAttempts: [{ ...cleared, ...patch }] },
        () => false,
      ).length,
      0,
    );
  assert.equal(
    pendingCompletions(
      { ...data, user: { ...data.user, role: "CENTRE_COMMAND" } },
      () => false,
    ).length,
    0,
  );
});
test("acknowledgements are isolated per player and completion and prevent repeated celebrations", () => {
  const key = completionKey("p", cleared);
  assert.equal(pendingCompletions(data, (value) => value === key).length, 0);
  assert.notEqual(key, completionKey("other-player", cleared));
  assert.notEqual(key, completionKey("p", { ...cleared, _id: "a:l2" }));
  const later = { ...cleared, _id: "a:l2", clearedAt: "2026-10-31T10:00:00Z" };
  assert.deepEqual(
    pendingCompletions(
      { ...data, projectAttempts: [later, cleared] },
      () => false,
    ).map((a) => a._id),
    ["a:l1", "a:l2"],
  );
});
