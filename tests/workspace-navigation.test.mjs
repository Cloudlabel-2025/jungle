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
test("CC dashboard comes first with and without college management access", () => {
  for (const includeManagement of [false, true]) {
    const nav = workspaceNavigation("CENTRE_COMMAND", { includeManagement });
    assert.equal(nav[0][1], "dashboard");
    assert.equal(nav[0][2], "Dashboard");
    assert.equal(nav.filter((entry) => entry[1] === "dashboard").length, 1);
    assert.equal(nav[1][1], includeManagement ? "college-management" : "setup");
    assert.equal(nav.some((entry) => entry[1] === "college-management"), includeManagement);
  }
});

test("management navigation preserves Guide access and stays out of player navigation", () => {
  assert.equal(workspaceNavigation("MISSION_COMMANDER", { includeManagement: true })[0][1], "college-management");
  assert.deepEqual(workspaceNavigation("GAMER", { includeManagement: true }), workspaceNavigation("GAMER"));
});

test("original workspaces retain every page and add programme, calendar and notification entries", () => {
  for (const role of Object.keys(navigation)) {
    const nav = workspaceNavigation(role);
    const extras = 4;
    assert.deepEqual(nav.slice(0, -extras), navigation[role]);
    assert.equal(nav.at(role === "GAMER" ? -3 : -4)[1], "week-one");
    if(role === "GAMER") assert.equal(nav.at(-4)[1], "objectives");
    assert.equal(nav.at(role === "GAMER" ? -2 : -3)[1], "calendar");
    if (role !== "GAMER") assert.equal(nav.at(-2)[1], "attendance");
    assert.equal(nav.at(-1)[1], "notifications");
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
