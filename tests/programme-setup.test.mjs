import test from "node:test";
import assert from "node:assert/strict";
import { programmeSetupConfig, programmeSetupPayload, programmeTimeInput, programmeTimeValue } from "../lib/programme-setup.js";

const format = () => ({ config: {
  number: 1,
  kickoffStart: "2026-11-27T04:30:00.000Z",
  kickoffEnd: "2026-11-27T06:30:00.000Z",
  dueAt: "2026-12-03T11:30:00.000Z",
  calendar: { timeZone: "Asia/Kolkata", holidays: [], weekdays: [1, 2, 3, 4, 5], dateOverrides: [{ date: "2026-11-28", working: true }] },
  teams: [{ teamId: "team-1", members: ["a", "b", "c"], commanderId: "mc-1", owners: { "FE-01": "a" } }],
  resources: { "FE-01": { url: "https://example.com/lesson", author: "CURRICULUM", version: "1", approval: "Approved lesson" } },
} });
test("India schedule fields round-trip without depending on the computer timezone", () => {
  assert.equal(programmeTimeInput("2026-11-27T04:30:00.000Z"), "2026-11-27T10:00");
  assert.equal(programmeTimeValue("2026-11-27T10:00"), "2026-11-27T04:30:00.000Z");
  assert.equal(programmeTimeInput("2026-11-27T20:30:00Z"), "2026-11-28T02:00");
  assert.equal(programmeTimeValue(""), "");
});
test("existing drafts retain allocations and resources without mutating saved data", () => {
  const initial = format();
  const draft = { state: "DRAFT", data: structuredClone(initial.config) };
  draft.data.teams[0].owners["FE-01"] = "c";
  const editable = programmeSetupConfig(initial, draft);
  assert.equal(editable.teams[0].owners["FE-01"], "c");
  editable.resources["FE-01"].version = "2";
  assert.equal(draft.data.resources["FE-01"].version, "1");
  assert.deepEqual(programmeSetupConfig(initial, { ...draft, state: "CLOSED" }), initial.config);
});
test("manual payload keeps team ownership and calendar overrides, normalizes holiday input", () => {
  const config = format().config;
  config.calendar.holidays = ["2026-12-01", "", " 2026-12-01 ", "2026-12-02"];
  const body = programmeSetupPayload(config, "  Configure this sprint  ");
  assert.deepEqual(body.config.calendar.holidays, ["2026-12-01", "2026-12-02"]);
  assert.deepEqual(body.config.teams.map(({ roleAssignments, ...team }) => team), config.teams);
  assert.equal(body.config.teams[0].roleAssignments.length, 3);
  assert.deepEqual(body.config.calendar.dateOverrides, config.calendar.dateOverrides);
  assert.equal(body.reason, "Configure this sprint");
  assert.equal(config.calendar.holidays.length, 4);
});
test("manual setup rejects missing dates, invalid deadlines and a short Sprint 1 kickoff", () => {
  const config = format().config;
  assert.throws(() => programmeSetupPayload({ ...config, dueAt: "" }, "reason"), /Complete all three/);
  assert.throws(() => programmeSetupPayload({ ...config, dueAt: config.kickoffEnd }, "reason"), /deadline/);
  assert.throws(() => programmeSetupPayload({ ...config, kickoffEnd: "2026-11-27T05:30:00Z" }, "reason"), /two-hour/);
  assert.doesNotThrow(() => programmeSetupPayload(config, "reason"));
});
