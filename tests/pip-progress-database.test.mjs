import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { pipProgressSnapshot, savePipProgress } from "../lib/pip-progress.js";
import { flightApiAllowed } from "../lib/flight-rules.js";

test("account Kiko progress: cross-device reads, atomic merging, identity isolation, resets and no game rewards changed", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const uri = new URL(process.env.TEST_MONGODB_URI); uri.pathname = `/pip_progress_${Date.now()}`;
  process.env.MONGODB_URI = uri.toString(); await connect();
  const p = { _id: "p", role: "GAMER", cohortId: "a", name: "Player", email: "p@test.invalid", xp: 75, trophies: 15 };
  const q = { ...p, _id: "q", cohortId: "b", email: "q@test.invalid" };
  const staff = { ...p, _id: "cc", role: "CENTRE_COMMAND", email: "cc@test.invalid" };
  const patch = (user, fields, generation = 1) => ({ generation, account: JSON.stringify([user._id, user.cohortId, generation]), ...fields });
  try {
    await models.User.insertMany([p, q, staff]); await models.PipProgress.init();
    const before = await models.User.findById(p._id).lean();
    await Promise.all([
      savePipProgress(p, patch(p, { seen: ["travelling"], dismissed: ["genre"] })),
      savePipProgress(p, patch(p, { seen: ["map-start"], completed: ["clock-in"], following: true })),
    ]);
    const anotherBrowser = await pipProgressSnapshot({ _id: p._id });
    assert.deepEqual(anotherBrowser.seen.sort(), ["map-start", "travelling"]);
    assert.deepEqual(anotherBrowser.dismissed, ["genre"]);
    assert.deepEqual(anotherBrowser.completed, ["clock-in"]);
    assert.equal(anotherBrowser.following, true);
    assert.equal(anotherBrowser.version, 2);
    assert.equal(await models.PipProgress.countDocuments(), 1);
    assert.deepEqual((await pipProgressSnapshot(q)).seen, []);
    assert.deepEqual(await models.User.findById(p._id).lean(), before);
    for (const bad of [{ userId: "q" }, { xp: 900 }, { seen: ["unknown"] }, { following: "yes" }, { seen: [{ $ne: "" }] }])
      await assert.rejects(savePipProgress(p, patch(p, bad)), (e) => e.status === 400);
    await assert.rejects(savePipProgress(q, patch(p, { seen: ["question"] })), (e) => e.status === 409);
    await assert.rejects(savePipProgress(staff, patch(staff, {})), (e) => e.status === 403);
    await models.User.updateOne({ _id: p._id }, { $set: { active: false } });
    await assert.rejects(savePipProgress(p, patch(p, {})), (e) => e.status === 403);
    await models.User.updateOne({ _id: p._id }, { $set: { active: true, pipGeneration: 2 } });
    assert.deepEqual((await pipProgressSnapshot(p)).seen, []);
    await assert.rejects(savePipProgress(p, patch(p, { seen: ["genre"] })), (e) => e.status === 409);
    await savePipProgress(p, patch(p, { seen: ["boarding"] }, 2));
    assert.deepEqual((await pipProgressSnapshot(p)).seen, ["boarding"]);
    for (const method of ["GET", "POST"]) assert.equal(flightApiAllowed("player/pip-progress", method, false), true);
    assert.equal(flightApiAllowed("player/pip-progress", "DELETE", false), false);
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});
