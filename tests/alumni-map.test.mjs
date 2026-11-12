import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { alumniLevels, buildAlumniMap, missingSprintKeys } from "../lib/alumni-map.js";
import { alumniMapSnapshot } from "../lib/alumni-map-store.js";
import { models } from "../lib/db.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";

const user = { _id: "g1", teamId: "team1" };
const sprint = (number, extra = {}) => ({ _id: `s${number}`, state: "ACTIVE", createdAt: new Date(),
  data: { number, teams: [{ teamId: "team1", members: ["g1"], kickoff: true }], acceptances: [], gates: [], ...extra } });

test("Alumni map has five milestones across all three preserved terrain regions", () => {
  assert.deepEqual(alumniLevels.map(l => l.number), [1, 2, 3, 4, 5]);
  assert.deepEqual([...new Set(alumniLevels.map(l => l.mapAnchor.region))], [0, 1, 2]);
  const levels = buildAlumniMap(user, [], [], []);
  assert.equal(levels[0].state, "WAITING_RELEASE");
  assert.equal(levels[1].state, "LOCKED");
  assert.ok(levels.every(l => !l.canOpen));
});
test("Keys require team-specific explicit acceptance; completing tasks alone cannot clear a level", () => {
  const s1 = sprint(1);
  const tasks = [{ _id: "t", sprintId: "s1", teamId: "team1", userId: "g1", state: "Accepted", data: { code: "FE-01", title: "Login" } }];
  let map = buildAlumniMap(user, [s1, sprint(2)], tasks, []);
  assert.equal(map[0].state, "REVIEW");
  assert.equal(map[1].state, "LOCKED");
  s1.data.acceptances = [{ teamId: "other", decision: "ACCEPTED", key: "Key 1" }];
  assert.deepEqual(missingSprintKeys([s1], "team1", 2), [1]);
  s1.data.acceptances.push({ teamId: "team1", decision: "ACCEPTED", key: "Key 1" });
  map = buildAlumniMap(user, [s1, sprint(2)], tasks, []);
  assert.equal(map[0].state, "CLEARED");
  assert.equal(map[1].state, "ACTIVE");
  assert.equal(map[1].canOpen, true);
  assert.equal(buildAlumniMap({ ...user, teamId: "former-team" }, [s1, sprint(2)], tasks, [])[1].state, "ACTIVE");
  assert.equal(buildAlumniMap(user, [s1], tasks, [])[1].state, "WAITING_RELEASE");
});
test("Map distinguishes kickoff, rework and client checks, hides drafts and excludes optional cards", () => {
  const s = sprint(1, { teams: [{ teamId: "team1", members: ["g1"] }],
    gates: [{ teamId: "team1", code: "AC-1", decision: "PASS" }] });
  const cards = [{ _id: "t", sprintId: "s1", teamId: "team1", userId: "g1", state: "Rework", data: { code: "A", title: "Fix", evidence: "private" } },
    { _id: "extension", sprintId: "s1", teamId: "team1", data: { extensionId: "x" } }];
  let map = buildAlumniMap(user, [s], [], [{ number: 1, acceptance: [{ id: "AC1", text: "Check login" }] }]);
  assert.equal(map[0].state, "KICKOFF");
  assert.equal(map[0].acceptance[0].decision, "PASS");
  map = buildAlumniMap(user, [s], cards, []);
  assert.equal(map[0].state, "REWORK");
  assert.equal(map[0].tasks.length, 1);
  assert.equal(map[0].tasks[0].mine, true);
  assert.equal(JSON.stringify(map).includes("private"), false);
  assert.equal(buildAlumniMap(user, [{ ...s, state: "DRAFT" }], cards, [])[0].state, "WAITING_RELEASE");
});

test("Alumni map uses scoped sprint records and server release rejects missing previous team keys", { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 }, async t => {
  const uri = new URL(process.env.TEST_MONGODB_URI);
  uri.pathname = `/alumni_map_${Date.now()}`;
  process.env.MONGODB_URI = uri.toString();
  t.after(() => mongoose.disconnect());
  const { cc, mc, gamers, teams, cohortId } = await pilotFixture(2);
  const call = (action, body = {}) => pilotAction(cc, action, { requestId: randomUUID(), reason: "Synthetic map release verification.", ...body }, new Date("2026-11-14T07:00:00Z"));
  const keys = teams.map(team => ({ teamId: team.id, decision: "ACCEPTED", key: "Key 1" }));
  await models.PilotSprint.create({ _id: "closed-1", cohortId, state: "CLOSED", data: { number: 1,
    teams: teams.map(team => ({ teamId: team.id, members: team.members })), acceptances: [], gates: [] } });
  await call("draft", { config: sprintConfig(teams, mc, 2) });
  await call("approve");
  await assert.rejects(call("load"), /accepted Sprints 1–1/);
  await models.PilotSprint.updateOne({ _id: "closed-1" }, { $set: { "data.acceptances": [keys[0]] } });
  await assert.rejects(call("load"), /accepted Sprints 1–1/);
  await models.PilotSprint.updateOne({ _id: "closed-1" }, { $set: { "data.acceptances": keys } });
  await call("load");
  const map = await alumniMapSnapshot(gamers[0]);
  assert.equal(map[0].state, "CLEARED");
  assert.equal(map[1].state, "KICKOFF");
  assert.equal(map[1].acceptance.length, 7);
  assert.ok(map[1].tasks.length > 0);
  assert.ok(map[1].tasks.every(task => teams[0].members.includes(task.userId)));
  const selected = await pilotSnapshot(gamers[0], new Date(), map[1].sprintId);
  assert.equal(selected.sprint.data.number, 2);
  assert.ok(selected.tasks.every(task => task.teamId === teams[0].id));
  await assert.rejects(pilotSnapshot({ _id: "other-college" }, new Date(), map[1].sprintId), error => error.status === 404);
  await models.PilotSprint.updateOne({ _id: "closed-1" }, { $set: { "data.acceptances": [keys[1]] } });
  await assert.rejects(pilotSnapshot(gamers[0], new Date(), map[1].sprintId), /earlier Alumni Connect keys/);
});
