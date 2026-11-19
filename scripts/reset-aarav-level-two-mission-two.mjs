// Explicit operator reset of one unfinished mission, with archive and stale-tab protection.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { cohortFilter, scope, permitted } from "../lib/access-scope.js";
import { runProgram, editable, event } from "../lib/week-one-store.js";
import { flightLevelId, reconcileFlightLevel } from "../lib/week-one-levels.js";
import { programSnapshot } from "../lib/week-one-program.js";

const userId = "usr_g01", day = 2, activityId = "D2-G02";
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function protectedRecords(cohortId) {
  return {
    users: await models.User.find(cohortFilter({ cohortId })).sort({ _id: 1 }).lean(),
    dayOne: await models.DayOneRecord.find({ cohortId }).sort({ _id: 1 }).lean(),
    attempts: await models.WeekOneAttempt.find({ cohortId, $nor: [{ userId, activityId }] }).sort({ _id: 1 }).lean(),
    levels: await models.WeekOneLevel.find({ cohortId, $nor: [{ userId, day }] }).sort({ _id: 1 }).lean(),
  };
}
try {
  await connect();
  const player = await models.User.findById(userId).lean();
  assert.equal(player?.name, "Aarav Patel");
  const cohortId = player.cohortId || "alpha";
  const query = { cohortId, userId, activityId, day };
  const target = await models.WeekOneAttempt.findOne(query).lean();
  assert.ok(target, "Second mission is already fresh; no reset needed.");
  assert.equal(target.data.submissions?.length || 0, 0, "This reset is scoped to an unfinished second mission.");
  const level = await models.WeekOneLevel.findById(flightLevelId(cohortId, userId, day)).lean();
  assert.ok(level);
  assert.equal(level.data.creditedTrophies || 0, 0);
  assert.ok(!level.data.override?.completed);
  const staff = await models.User.findOne({ ...cohortFilter(player), role: "CENTRE_COMMAND", active: { $ne: false } }).lean();
  assert.ok(staff);
  const before = hash(await protectedRecords(cohortId));
  await mkdir(".data/backups", { recursive: true });
  const backup = `.data/backups/aarav-level-two-mission-two-${Date.now()}.json`;
  await writeFile(backup, JSON.stringify({ player, level, attempt: target }, null, 2), { flag: "wx" });
  await runProgram(staff, "activity-reset", { userId, activityId, day }, new Date(), async (ctx) => {
    editable(ctx);
    const access = await scope(ctx.user, ctx.session);
    assert.ok(access.userIds.includes(userId) && permitted(access.user, "game:write"));
    const current = await models.WeekOneAttempt.findOne(query).session(ctx.session).lean();
    const state = await models.WeekOneLevel.findById(level._id).session(ctx.session);
    assert.equal(current?.version, target.version, "Mission changed; refresh before resetting.");
    assert.equal(state.version, level.version, "Level changed; refresh before resetting.");
    const reason = "User requested only Aarav's second Level 2 mission to be reset; preserve the first mission.";
    (state.data.activityResetHistory ||= []).push({ activityId, attempt: current, actorId: staff._id, at: ctx.at, reason, backup });
    state.data.nextVersions ||= {};
    state.data.nextVersions[activityId] = current.version + 1;
    state.version++;
    state.markModified("data");
    await state.save({ session: ctx.session });
    const removed = await models.WeekOneAttempt.deleteOne({ ...query, version: current.version }).session(ctx.session);
    assert.equal(removed.deletedCount, 1);
    await reconcileFlightLevel(ctx, userId, day);
    await event(ctx, "FLIGHT_ACTIVITY_RESET", { userId, day, activityId, reason, backup, previousVersion: current.version });
    ctx.changedResults = true;
  });
  assert.equal(await models.WeekOneAttempt.countDocuments(query), 0);
  assert.equal(hash(await protectedRecords(cohortId)), before, "Other missions, balances, or players changed.");
  const view = await programSnapshot(player);
  assert.equal(view.progression.levels[0].completed, true);
  assert.equal(view.progression.levels[1].completed, false);
  assert.equal(view.progression.levels[1].open, true);
  console.log(JSON.stringify({ player: player.name, reset: activityId, firstMissionPreserved: true, otherProgressPreserved: true, secondMissionFresh: true, backup }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
