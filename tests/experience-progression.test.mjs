import test from "node:test";
import assert from "node:assert/strict";
import { experienceProgress, experienceLevel, rankStartXp } from "../lib/rewards.js";
import { levelReward } from "../lib/week-one-level-rules.js";
import { advanceExperience, experienceStorageKey } from "../lib/experience-celebration.js";

test("rank thresholds and progress increase at every level and match exact boundaries", () => {
  for (let level = 1; level <= 1000; level++) {
    const start = rankStartXp(level), cost = 100 + (level - 1) * 50;
    assert.deepEqual(experienceProgress(start), { level, total: start, progress: 0, required: cost, remaining: cost });
    assert.equal(experienceLevel(start + cost - 1), level);
    assert.equal(experienceLevel(start + cost), level + 1);
    if (level > 1) assert.equal(experienceLevel(start - 1), level - 1);
  }
  for (const bad of [NaN, Infinity, undefined, -50]) assert.equal(experienceLevel(bad), 1);
});

test("later flight levels award more XP at each star rating, trophies stay 15–30", () => {
  for (const stars of [1, 2, 3]) {
    const base = levelReward(stars, 1);
    for (let day = 1; day <= 5; day++) {
      const reward = levelReward(stars, day);
      assert.equal(reward.trophies, base.trophies);
      assert.equal(reward.xp, base.xp * day);
    }
  }
  assert.throws(() => levelReward(3, 6));
  assert.throws(() => levelReward(3, 2.5));
});

test("celebrations follow saved increases, handle multiple ranks and do not repeat on reload or correction", () => {
  let next = advanceExperience(null, 75);
  assert.equal(next.celebration, null, "initial load sets a baseline");
  next = advanceExperience(next.state, 125);
  assert.equal(next.celebration.to, 2);
  assert.equal(next.celebration.gained, 50);
  const saved = JSON.parse(JSON.stringify(next.state));
  assert.equal(advanceExperience(saved, 125).celebration, null);
  next = advanceExperience(saved, 650);
  assert.equal(next.celebration.from, 2);
  assert.equal(next.celebration.to, 4);
  assert.equal(next.celebration.progress, 200);
  const correction = advanceExperience(next.state, 75);
  assert.equal(correction.celebration, null);
  assert.equal(advanceExperience(correction.state, 650).celebration, null, "re-earning a revoked rank does not replay a promotion");
  assert.notEqual(experienceStorageKey("aarav"), experienceStorageKey("other"));
  assert.equal(advanceExperience({ xp: "invalid" }, 150).celebration, null);
});
