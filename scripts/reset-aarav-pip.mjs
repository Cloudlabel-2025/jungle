// Operator-only, one-player tutorial reset. Archived Pip history stays recoverable.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connect, models, transaction } from "../lib/db.js";
import { existingWorkspaceMongo } from "./dev-runtime.mjs";
import { pipProgressSnapshot } from "../lib/pip-progress.js";

try { process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url))); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.MONGODB_URI)
  process.env.MONGODB_URI = await existingWorkspaceMongo(27019, fileURLToPath(new URL("../.data/mongo/", import.meta.url)));
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const protectedModels = ["PipProgress", "DayOneRecord", "WeekOneLevel", "WeekOneAttempt", "WeekOneLearner", "Experience", "Trophy", "ProjectAttempt", "Task", "Attendance", "ExtraPlaySession", "Progress"];
async function protectedState(session) {
  const result = {};
  for (const name of protectedModels)
    result[name] = digest(await models[name].find({}).sort({ _id: 1 }).session(session).lean());
  return result;
}
try {
  await connect();
  const user = await models.User.findById("usr_g01").lean();
  assert.equal(user?.name, "Aarav Patel");
  assert.equal(user.role, "GAMER");
  assert.notEqual(user.active, false);
  const previous = user.pipGeneration || 1, generation = previous + 1;
  assert.equal(await models.PipProgress.countDocuments({ userId: user._id, generation }), 0, "The next tutorial generation already exists.");
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ preview: true, player: user.name, previousGeneration: previous, newGeneration: generation, xp: user.xp, trophies: user.trophies }));
  } else {
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/aarav-pip-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify({ user, pip: await models.PipProgress.find({ userId: user._id }).lean(), reason: "User requested only Aarav's Pip tutorial reset for cross-browser UAT." }, null, 2), { flag: "wx" });
    await transaction(async (session) => {
      const current = await models.User.findById(user._id).session(session).lean();
      assert.equal(current?.name, "Aarav Patel");
      assert.equal(current.role, "GAMER");
      assert.notEqual(current.active, false);
      assert.equal(current.pipGeneration || 1, previous);
      const protectedBefore = await protectedState(session);
      const otherPlayers = digest(await models.User.find({ _id: { $ne: user._id } }).sort({ _id: 1 }).session(session).lean());
      const saved = await models.User.updateOne({ _id: user._id, pipGeneration: current.pipGeneration ?? { $exists: false } }, { $set: { pipGeneration: generation } }, { session });
      assert.equal(saved.modifiedCount, 1);
      const updated = await models.User.findById(user._id).session(session).lean();
      delete current.pipGeneration; delete updated.pipGeneration;
      assert.deepEqual(updated, current, "Aarav's non-tutorial account fields changed.");
      assert.deepEqual(await protectedState(session), protectedBefore, "Game progress or saved Pip history changed.");
      assert.equal(digest(await models.User.find({ _id: { $ne: user._id } }).sort({ _id: 1 }).session(session).lean()), otherPlayers, "Another player changed.");
    });
    const tutorial = await pipProgressSnapshot(user);
    assert.equal(tutorial.generation, generation);
    assert.deepEqual(tutorial.seen, []);
    assert.deepEqual(tutorial.dismissed, []);
    assert.deepEqual(tutorial.completed, []);
    assert.equal(tutorial.following, false);
    console.log(JSON.stringify({ player: user.name, tutorialReset: true, generation, xp: user.xp, trophies: user.trophies, gameProgressAndStarsUnchanged: true, otherPlayersUnchanged: true, oldBrowserFlagsIgnored: true, backup }));
  }
} finally { await mongoose.disconnect(); }
