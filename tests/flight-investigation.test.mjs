import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { upgradeFlightInvestigations } from "../lib/flight-content-upgrade.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { blankProgram, validateDayContent } from "../lib/week-one-program-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

test("flight starter missions keep the portal out of Week 1 and preserve the investigation contract", () => {
  const original = fixtureConfig();
  for (const day of [2, 3, 4]) {
    const content = validateDayContent(day, starterFlightContent(day, original), original);
    assert.doesNotMatch(JSON.stringify(content), /alumni|portal|chapter/i);
    if (day === 2) {
      const mission = content.activities.find((a) => a.id === "D2-G02");
      assert.equal(mission.name, "The Lost Flight Signal");
      assert.deepEqual(mission.fields, ["cause", "evidence", "check1", "check2", "update"]);
      assert.equal(mission.durationMinutes, 60);
      assert.deepEqual(mission.variants.map((v) => v.name), ["Navigation Beacon", "Weather Echo", "Supply Manifest", "Radio Relay"]);
      assert.equal(new Set(mission.variants.map((v) => v.brief)).size, 4);
    }
  }
});

test("content correction is audited, idempotent and preserves unrelated saved work; pinned investigations block replacement", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const uri = new URL(process.env.TEST_MONGODB_URI);
  uri.pathname = `/flight_content_${Date.now()}`;
  process.env.MONGODB_URI = uri.toString();
  await connect();
  try {
    for (const model of Object.values(models)) await model.init();
    const original = fixtureConfig();
    const legacyDays = [2, 3, 4].map((day) => {
      const content = starterFlightContent(day, original);
      const activity = content.activities[1];
      if (day === 2) activity.name = "The Vanishing Alumni";
      activity.variants[0].brief = "Legacy alumni portal scenario to replace with a flight investigation.";
      return { day, state: "PREPARED", contentVersion: 1, contentSource: "Starter missions from existing Week 1 topics", content, draft: structuredClone(content) };
    });
    await models.WeekOneRelease.create({ _id: "alpha", days: [{ day: 1, content: original }, ...legacyDays] });
    await models.WeekOneProgram.create({ _id: "alpha", version: 4, data: blankProgram() });
    const saved = await models.WeekOneAttempt.create({ _id: "unrelated", cohortId: "alpha", userId: "p", activityId: "D2-G01", day: 2, version: 9, data: { draft: { finding1: "My saved finding" }, deadline: "2030-01-01", submissions: [{ complete: true }] } });
    const before = JSON.stringify(saved.toObject());
    const result = await upgradeFlightInvestigations("alpha");
    assert.equal(result.replacements.length, 3);
    const release = await models.WeekOneRelease.findById("alpha").lean();
    assert.equal(release.days[1].content.activities[1].name, "The Lost Flight Signal");
    assert.equal(release.days[1].contentVersion, 2);
    assert.deepEqual(release.days[1].content, release.days[1].draft);
    assert.equal(JSON.stringify(await models.WeekOneAttempt.findById("unrelated").lean()), before);
    assert.equal(await models.WeekOneEvent.countDocuments({ kind: "FLIGHT_INVESTIGATIONS_REPLACED" }), 1);
    assert.deepEqual((await upgradeFlightInvestigations("alpha")).replacements, []);
    assert.equal(await models.WeekOneEvent.countDocuments({ kind: "FLIGHT_INVESTIGATIONS_REPLACED" }), 1);
    await models.WeekOneRelease.updateOne({ _id: "alpha" }, { $set: { "days.1": legacyDays[0] } });
    await models.WeekOneAttempt.create({ _id: "pinned", cohortId: "alpha", userId: "p", activityId: "D2-G02", day: 2, version: 1, data: { draft: { cause: "Keep this work" } } });
    await assert.rejects(upgradeFlightInvestigations("alpha"), /pinned investigation/);
    assert.equal((await models.WeekOneRelease.findById("alpha").lean()).days[1].content.activities[1].name, "The Vanishing Alumni");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
