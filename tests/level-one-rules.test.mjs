import test from "node:test";
import assert from "node:assert/strict";
import { scoreLevelOne, levelOneReward } from "../lib/level-one-rules.js";

export const conversation = (strong = true) => {
  const answer =
    "Automobiles research needs careful reasoning and sources. Compare the alternatives using the same travel distance and total running costs. Check equipment, safety, maintenance and environmental assumptions. Explain which choice fits the budget and why another choice might be better in a different situation. A published source can help us check an estimate, but its date and method also matter. Avoid treating a claim as true simply because it sounds confident. State uncertainties and describe how to test them.";
  return `User: Help me investigate Automobiles research and compare options.\nAssistant: ${answer}\n${strong ? `User: Compare the alternatives in more detail.\nAssistant: ${answer}\nUser: How can I check those sources and reasoning?\nAssistant: Use https://example.org/research and verify the original data. ${answer}` : ""}`;
};
const data = {
  config: {
    genres: [
      {
        id: "g",
        question:
          "Investigate research about Automobiles and show sources and reasoning.",
      },
    ],
  },
  genreId: "g",
  acknowledgedAt: "2026-11-14T03:30:00Z",
  startedAt: "2026-11-14T03:30:00Z",
  deadline: "2026-11-14T05:00:00Z",
};
test("Level 1 gives 1/2/3 stars for completion, meaningful effort and deadline respectively", () => {
  assert.equal(
    scoreLevelOne(data, {
      id: "one",
      transcript: conversation(false),
      at: "2026-11-14T03:40:00Z",
    }).stars,
    1,
  );
  const onTime = scoreLevelOne(data, {
    id: "two",
    transcript: conversation(),
    at: data.deadline,
  });
  assert.equal(onTime.stars, 3);
  assert.equal(onTime.trophies, 30);
  assert.equal(onTime.xp, 150);
  assert.equal(
    scoreLevelOne(data, {
      id: "three",
      transcript: conversation(),
      at: "2026-11-14T05:00:01Z",
    }).stars,
    2,
  );
  const extended = { ...data, deadline: "2026-11-14T06:00:00Z" };
  assert.equal(
    scoreLevelOne(extended, {
      transcript: conversation(),
      at: "2026-11-14T05:30:00Z",
    }).stars,
    3,
  );
});
test("time alone, missing evidence and unrelated chat cannot clear a level", () => {
  assert.equal(scoreLevelOne(data, { at: data.deadline }).completed, false);
  assert.equal(
    scoreLevelOne(data, {
      at: data.deadline,
      transcript: "User: done\nAssistant: okay",
    }).completed,
    false,
  );
  const unrelated = conversation().replaceAll(
    /Automobiles|research|reasoning|sources/gi,
    "flowers",
  );
  assert.equal(
    scoreLevelOne(data, { at: data.deadline, transcript: unrelated }).completed,
    false,
  );
  assert.equal(
    scoreLevelOne(
      { ...data, acknowledgedAt: null },
      { at: data.deadline, transcript: conversation() },
    ).completed,
    false,
  );
});
test("all new level rewards maintain exactly five XP per trophy", () => {
  assert.deepEqual([1, 2, 3].map(levelOneReward), [
    { trophies: 15, xp: 75 },
    { trophies: 25, xp: 125 },
    { trophies: 30, xp: 150 },
  ]);
  for (const stars of [0, 1, 2, 3]) {
    const reward = levelOneReward(stars);
    assert.equal(reward.xp, reward.trophies * 5);
  }
});
test("a future research start cannot qualify as completed effort", () => {
  assert.equal(
    scoreLevelOne(data, {
      transcript: conversation(),
      at: "2026-11-14T03:29:59Z",
    }).completed,
    false,
  );
});
