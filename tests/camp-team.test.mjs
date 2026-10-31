import test from "node:test";
import assert from "node:assert/strict";
import { campTeamMembers, campVitals } from "../lib/camp-team.js";

const player = (id, key, variant = "male", teamId = "camp-a") => ({
  _id: id,
  name: `Explorer ${id}`,
  role: "GAMER",
  teamId,
  characterKey: key,
  characterVariant: variant,
  hp: 5,
  energy: 3,
  active: true,
});

test("camp residents use only the active current team and each selected variant", () => {
  const roster = [
    player("b", "glitch", "female"),
    player("a", "blaze"),
    player("other", "shade", "male", "camp-b"),
    { ...player("inactive", "pulse"), active: false },
    { ...player("staff", "rune"), role: "COMMANDER" },
  ];
  const members = campTeamMembers(roster, roster[1]);
  assert.deepEqual(
    members.map(({ player }) => player._id),
    ["a", "b"],
  );
  assert.equal(members[1].character.name, "Juno");
  assert.equal(members[1].character.variant, "female");
  assert.equal(members[1].tent.key, "glitch");
  assert.equal(campTeamMembers(roster, { teamId: null }).length, 0);
});

test("tent placement stays stable across roster order and variant changes", () => {
  const roster = [
    player("a", "blaze"),
    player("b", "glitch"),
    player("c", "shade"),
    player("d", "pulse"),
    player("e", "rune"),
  ];
  const before = campTeamMembers(roster, roster[0]);
  const after = campTeamMembers([...roster].reverse(), {
    ...roster[0],
    characterVariant: "female",
    hp: 2,
    energy: 1,
  });
  assert.deepEqual(
    before.map(({ tent }) => tent),
    after.map(({ tent }) => tent),
  );
  assert.equal(after[0].character.name, "Zara");
  assert.equal(after[0].player.hp, 2);
  assert.equal(new Set(after.map(({ tent }) => tent.key)).size, 5);
});

test("legacy duplicate character choices still receive separate tents", () => {
  const roster = [player("a", "blaze"), player("b", "blaze")];
  const members = campTeamMembers(roster, roster[0]);
  assert.notEqual(members[0].tent.key, members[1].tent.key);
});

test("camp vitals follow live life/energy rules and the Day 1 energy override", () => {
  assert.deepEqual(campVitals({ hp: 4, energy: 1 }), {
    life: 4,
    energy: 1,
    energyMax: 3,
  });
  assert.deepEqual(campVitals({ hp: 0, energy: 3 }), {
    life: 0,
    energy: 0,
    energyMax: 3,
  });
  assert.deepEqual(campVitals({ hp: 3, energy: 1 }, true), {
    life: 3,
    energy: 5,
    energyMax: 5,
  });
});
