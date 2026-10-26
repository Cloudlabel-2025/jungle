import test from "node:test";
import assert from "node:assert/strict";
import {
  rewardAmounts,
  experienceLevel,
  trophyStandings,
  DAILY_XP_CAP,
  DAILY_TROPHY_CAP,
} from "../lib/rewards.js";
import { boundedAward } from "../lib/rules.js";
test("normal rewards split into 3x experience and 2x trophies with separate caps", () => {
  assert.deepEqual(rewardAmounts(5), { xp: 15, trophies: 10 });
  assert.equal(boundedAward(15, 149, DAILY_XP_CAP), 1);
  assert.equal(boundedAward(10, 49, DAILY_TROPHY_CAP), 1);
  assert.equal(boundedAward(10, 50, DAILY_TROPHY_CAP), 0);
});
test("experience levels depend only on personal XP", () => {
  assert.equal(experienceLevel(0), 1);
  assert.equal(experienceLevel(99), 1);
  assert.equal(experienceLevel(100), 2);
  assert.equal(experienceLevel(350), 4);
});
test("leaderboard ranks trophies only, hides XP and treats trophy ties equally", () => {
  const standings = trophyStandings([
    { _id: "a", name: "A", xp: 9999, trophies: 2 },
    { _id: "b", name: "B", xp: 0, trophies: 10 },
    { _id: "c", name: "C", xp: 1, trophies: 10 },
  ]);
  assert.deepEqual(
    standings.map((p) => [p._id, p.rank]),
    [
      ["b", 1],
      ["c", 1],
      ["a", 3],
    ],
  );
  assert.ok(standings.every((p) => !("xp" in p)));
});
