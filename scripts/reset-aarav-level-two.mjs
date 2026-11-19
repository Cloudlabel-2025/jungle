// Scoped operator reset through the audited replay service. No cohort reset.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { programSnapshot } from "../lib/week-one-program.js";
import { flightLevelId, flightLevelStaffAction } from "../lib/week-one-levels.js";
import { runProgram } from "../lib/week-one-store.js";
import { cohortFilter } from "../lib/access-scope.js";

const userId = "usr_g01", day = 2;
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function unaffected(cohortId) {
  return {
    users: await models.User.find({ cohortId }).sort({ _id: 1 }).lean(),
    dayOne: await models.DayOneRecord.find({ cohortId }).sort({ _id: 1 }).lean(),
    attempts: await models.WeekOneAttempt.find({ cohortId, $nor: [{ userId, day }] }).sort({ _id: 1 }).lean(),
    levels: await models.WeekOneLevel.find({ cohortId, $nor: [{ userId, day }] }).sort({ _id: 1 }).lean(),
  };
}
try {
  await connect();
  const player = await models.User.findById(userId).lean();
  assert.equal(player?.name, "Aarav Patel");
  const cohortId = player.cohortId || "alpha";
  const level = await models.WeekOneLevel.findById(flightLevelId(cohortId, userId, day)).lean();
  const attempts = await models.WeekOneAttempt.find({ cohortId, userId, day }).lean();
  // This operator request targets an uncompleted level; do not silently retain an earned result.
  assert.equal(level?.data.creditedTrophies || 0, 0, "Earned rewards require an explicit result revocation before reset.");
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ player: player.name, day, attempts: attempts.length, mode: "preview" }));
  } else {
    const staff = await models.User.findOne({ ...cohortFilter(player), role: "CENTRE_COMMAND", active: { $ne: false } }).lean();
    assert.ok(staff, "An active CC account is required for the audited reset.");
    const before = digest(await unaffected(cohortId));
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/aarav-level-two-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify({ player, level, attempts }, null, 2), { flag: "wx" });
    await runProgram(staff, "level-result", {
      day, userId, operation: "replay", members: [userId], versions: { [userId]: level?.version || 0 },
      reason: "User requested Aarav's Level 2 reset to start both missions again from the beginning.",
    }, new Date(), async (ctx) => {
      // An explicit operator reset can restart a previously granted replay.
      // Clear its pending flag only inside this transaction; the replay service
      // still validates scope/version, archives attempts, and writes its audit.
      await models.WeekOneLevel.updateOne(
        { _id: flightLevelId(cohortId, userId, day), version: level?.version || 0 },
        { $set: { "data.replayPending": false } },
        { session: ctx.session },
      );
      return flightLevelStaffAction(ctx);
    });
    assert.equal(await models.WeekOneAttempt.countDocuments({ cohortId, userId, day }), 0);
    assert.equal(digest(await unaffected(cohortId)), before, "Unrelated player records must remain unchanged.");
    const view = await programSnapshot(player);
    assert.equal(view.progression.levels[0].completed, true);
    assert.equal(view.progression.levels[1].completed, false);
    assert.equal(view.progression.levels[1].open, true);
    console.log(JSON.stringify({ player: player.name, resetLevel: day, attempts: 0, levelOnePreserved: true, otherPlayersUnchanged: true, backup }));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
