import test from "node:test";
import assert from "node:assert/strict";
import {
  TROPHY_LEAGUES,
  trophyLeague,
  advanceTrophyLeague,
} from "../lib/trophy-leagues.js";

test("every league boundary promotes at its floor and demotes one trophy below", () => {
  for (let index = 0; index < TROPHY_LEAGUES.length; index++) {
    const tier = TROPHY_LEAGUES[index],
      previous = TROPHY_LEAGUES[index - 1] || { id: "unranked" };
    assert.equal(trophyLeague(tier.floor - 1).id, previous.id);
    assert.equal(trophyLeague(tier.floor).id, tier.id);
    assert.equal(
      advanceTrophyLeague({ total: tier.floor - 1 }, tier.floor).transition
        .direction,
      "promotion",
    );
    assert.equal(
      advanceTrophyLeague({ total: tier.floor }, tier.floor - 1).transition
        .direction,
      "demotion",
    );
  }
});
test("progress and retention use current balance, with a safe starting and top league", () => {
  assert.equal(trophyLeague(0).remaining, 300);
  assert.equal(trophyLeague(299).remaining, 1);
  assert.equal(trophyLeague(300).floor, 300);
  assert.equal(trophyLeague(525).percent, 50);
  assert.equal(trophyLeague(300).cushion, 0);
  assert.equal(trophyLeague(299).ranked, false);
  assert.equal(trophyLeague(300).ranked, true);
  assert.equal(trophyLeague(100000).next, null);
  assert.equal(trophyLeague(100000).percent, 100);
  for (const value of [-1, NaN, Infinity, undefined, "150", null])
    assert.equal(trophyLeague(value).id, "unranked");
});
test("baseline, refresh, same-league gains and reset never invent a change", () => {
  assert.equal(advanceTrophyLeague(null, 600).transition, null);
  assert.equal(advanceTrophyLeague({ total: 600 }, 600).transition, null);
  assert.equal(advanceTrophyLeague({ total: 151 }, 299).transition, null);
  assert.equal(advanceTrophyLeague({ total: NaN }, 600).transition, null);
});
test("staff correction and restoration move down and up without a historical high-water rank", () => {
  const initial = advanceTrophyLeague(null, 300);
  const corrected = advanceTrophyLeague(initial.state, 295);
  assert.equal(corrected.transition.direction, "demotion");
  assert.equal(corrected.transition.to, "Unranked");
  const restored = advanceTrophyLeague(corrected.state, 300);
  assert.equal(restored.transition.direction, "promotion");
  assert.equal(restored.transition.to, "Scout I");
  assert.equal(advanceTrophyLeague(restored.state, 300).transition, null);
});
test("large balance changes skip directly to the correct league", () => {
  assert.equal(
    advanceTrophyLeague({ total: 0 }, 9000).transition.to,
    "Legend I",
  );
  assert.equal(
    advanceTrophyLeague({ total: 9000 }, 20).transition.to,
    "Unranked",
  );
});
test("all eighteen divisions promote and demote at exact boundaries", () => {
  for (const tier of TROPHY_LEAGUES)
    for (const [index, floor] of tier.divisions.entries()) {
      const current = trophyLeague(floor),
        before = trophyLeague(floor - 1);
      assert.equal(current.name, tier.name);
      assert.equal(current.division.number, index + 1);
      assert.equal(
        current.displayName,
        `${tier.name} ${["I", "II", "III"][index]}`,
      );
      assert.equal(current.rankIndex, before.rankIndex + 1);
      assert.equal(
        advanceTrophyLeague({ total: floor - 1 }, floor).transition.to,
        current.displayName,
      );
      assert.equal(
        advanceTrophyLeague({ total: floor }, floor - 1).transition.direction,
        "demotion",
      );
    }
});
test("division progress points to the next division, then the next league", () => {
  assert.equal(trophyLeague(299).nextRank.name, "Scout I");
  assert.equal(trophyLeague(449).nextRank.name, "Scout II");
  assert.equal(trophyLeague(449).rankRemaining, 1);
  assert.equal(trophyLeague(525).rankPercent, 50);
  assert.equal(trophyLeague(749).nextRank.name, "Trailblazer I");
  assert.equal(trophyLeague(12000).displayName, "Legend III");
  assert.equal(trophyLeague(12000).nextRank, null);
  assert.equal(trophyLeague(50000).rankPercent, 100);
  assert.equal(advanceTrophyLeague({ total: 450 }, 599).transition, null);
});
