import test from "node:test";
import assert from "node:assert/strict";
import { navigation } from "../lib/catalog.js";
import { weekOneNavigation } from "../lib/week-one-catalog.js";
import {
  workspaceNavigation,
  programmeScreen,
  programmePath,
  validProgrammeScreen,
  legacyWorkspaceData,
} from "../lib/workspace-navigation.js";
test("original workspaces retain every page and gain just one programme entry", () => {
  for (const role of Object.keys(navigation)) {
    const nav = workspaceNavigation(role);
    assert.deepEqual(nav.slice(0, -1), navigation[role]);
    assert.equal(nav.at(-1)[1], "week-one");
    for (const [, screen] of navigation[role])
      assert.equal(programmeScreen(screen), null);
    for (const [, screen] of weekOneNavigation[role]) {
      const path = programmePath(role, screen);
      assert.equal(programmeScreen(path.split("/").at(-1)), screen);
      assert.ok(validProgrammeScreen(role, path.split("/").at(-1)));
    }
  }
});
test("legacy player presentation preserves existing identity, team, balances and energy", () => {
  const user = {
    name: "Explorer",
    assignment: "Existing role",
    teamId: "original-team",
    teamRoleCode: "BLAZE",
    energy: 2,
    trophies: 400,
    weekOneEnergy: 5,
    weekOneTrophies: 10,
  };
  const data = legacyWorkspaceData({ user, weekOneProgram: {} });
  assert.equal(data.user.teamRoleCode, "BLAZE");
  assert.equal(data.user.teamId, "original-team");
  assert.equal(data.user.energy, 2);
  assert.equal(data.user.trophies, 400);
  assert.ok(!("weekOneEnergy" in data.user));
  assert.equal(user.weekOneEnergy, 5);
});
