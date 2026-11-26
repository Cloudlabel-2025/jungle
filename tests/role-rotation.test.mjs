import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { sprintRoleAssignments, sprintTaskOwners } from "../lib/role-rotation.js";
import { teamRoles, playerRole } from "../lib/team-roles.js";
import { flightIdentity, publicPlayer, completeCrashArrival } from "../lib/player-stage.js";
import { models } from "../lib/db.js";
import { pilotAction } from "../lib/pilot-engine.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";

const members = ["player-c", "player-a", "player-e", "player-b", "player-d"];
test("five players each hold every role once in five sprints, with stable published seats", () => {
  const rolesByPlayer = new Map(members.map(id => [id, new Set()]));
  for (let sprint = 1; sprint <= 5; sprint++) {
    const assignments = sprintRoleAssignments(members, sprint);
    assert.equal(new Set(assignments.map(row => row.code)).size, 5);
    assert.deepEqual(assignments.map(row => row.userId), members);
    for (const role of assignments) rolesByPlayer.get(role.userId).add(role.code);
  }
  for (const roles of rolesByPlayer.values()) assert.equal(roles.size, 5);
  assert.equal(sprintRoleAssignments(members, 6)[0].code, teamRoles[0].code);
  assert.throws(() => sprintRoleAssignments(["a", "a"], 1), /distinct/);
  assert.throws(() => sprintRoleAssignments(members, 0), /positive/);
});
test("small teams keep unique rotating roles and explicit MC coverage for vacant task seats", () => {
  for (let sprint = 1; sprint <= 5; sprint++) {
    const roles = sprintRoleAssignments(members.slice(0, 3), sprint);
    assert.equal(new Set(roles.map(row => row.code)).size, 3);
  }
  const owners = sprintTaskOwners("ABCDE".split("").map(owner => ({ id: owner, owner })), members.slice(0, 3), "mc");
  assert.deepEqual(owners, { A: members[0], B: members[1], C: members[2], D: "mc", E: "mc" });
});
test("flight projections conceal historical roles and rotation metadata", () => {
  const person = { role: "GAMER", teamRoleCode: "BACKEND", assignment: "Backend Architect", roleRotation: { sprintNumber: 2 } };
  const hidden = flightIdentity(person, { flight: true });
  assert.equal(hidden.teamRoleCode, null);
  assert.equal(hidden.roleRotation, null);
  assert.equal(playerRole({ ...person, story: { flight: true } }), null);
});
test("MongoDB: jungle entry assigns roles; draft and approval do not rotate them; each release rotates atomically and preserves old work", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const uri = new URL(process.env.TEST_MONGODB_URI);
  uri.pathname = `/role_rotation_${Date.now()}`;
  process.env.MONGODB_URI = uri.toString();
  try {
    const { cc, mc, gamers, teams } = await pilotFixture(1);
    const first = gamers[0];
    await models.FlightOpening.create({ _id: JSON.stringify(["alpha", first._id]), cohortId: "alpha", userId: first._id, completedAt: new Date() });
    assert.equal((await publicPlayer(first)).teamRoleCode, null);
    assert.equal((await models.User.findById(first._id).lean()).teamRoleCode, undefined);
    await completeCrashArrival(first, {});
    assert.equal((await models.User.findById(first._id).lean()).teamRoleCode, teamRoles[0].code);
    let command = 0;
    const act = (action, body = {}) => pilotAction(cc, action, { ...body, requestId: randomUUID() }, new Date(Date.parse("2026-11-10T10:00:00Z") + ++command * 1000));
    const config = structuredClone(sprintConfig(teams, mc));
    config.teams[0].members.reverse();
    config.teams[0].owners = Object.fromEntries(Object.keys(config.teams[0].owners).map(key => [key, first._id]));
    await act("draft", { config });
    let sprint = await models.PilotSprint.findOne().lean();
    assert.deepEqual(sprint.data.teams[0].members, teams[0].members);
    assert.equal(sprint.data.teams[0].owners["BE-01"], gamers[1]._id);
    await act("approve", { reason: "Approved rotation configuration" });
    await act("load", { reason: "Release the first weekly sprint" });
    const originalTasks = await models.PilotTask.find({ sprintId: sprint._id }).sort({ _id: 1 }).lean();
    for (let number = 2; number <= 5; number++) {
      await models.PilotSprint.updateOne({ _id: sprint._id }, { $set: { state: "CLOSED", "data.acceptances": [{ teamId: teams[0].id, decision: "ACCEPTED", key: `Key ${number - 1}` }] } });
      // Use the approved Part B manifest when the core Part A catalogue ends.
      const next = structuredClone(number <= 2 ? sprintConfig(teams, mc, number) : config);
      next.number = number;
      if (number >= 3) next.contentApproval = "Approved frozen Curriculum content";
      const { default: partB } = await import("../lib/pilot-part-b.json", { with: { type: "json" } });
      const { default: partA } = await import("../lib/pilot-manifests.json", { with: { type: "json" } });
      const manifest = [...partA.sprints, ...partB.sprints].find(row => row.number === number);
      next.resources = Object.fromEntries(manifest.tasks.map(task => [task.id, { author: "CURRICULUM", url: "https://example.invalid/approved-resource", version: "1", approval: "Approved resource reference" }]));
      await act("draft", { config: next });
      sprint = await models.PilotSprint.findOne({ state: "DRAFT" }).lean();
      assert.equal((await publicPlayer(await models.User.findById(first._id).lean())).teamRoleCode, teamRoles[number - 2].code);
      await act("approve", { reason: "Approve the next sprint package" });
      assert.equal((await models.User.findById(first._id).lean()).teamRoleCode, teamRoles[number - 2].code);
      await act("load", { reason: "Release the next weekly sprint" });
      const players = await models.User.find({ _id: { $in: teams[0].members } }).lean();
      assert.equal(new Set(players.map(row => row.teamRoleCode)).size, 5);
      assert.equal(players.find(row => row._id === first._id).teamRoleCode, teamRoles[number - 1].code);
      await act("load", { reason: "Repeated release must not rotate twice" }).then(() => assert.fail("duplicate release accepted"), () => {});
    }
    const firstSprintTasks = await models.PilotTask.find({ sprintId: originalTasks[0].sprintId }).sort({ _id: 1 }).lean();
    assert.deepEqual(firstSprintTasks, originalTasks);
  } finally {
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  }
});
