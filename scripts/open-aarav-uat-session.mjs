// Explicit, one-player UAT operation. Does not reset clock history or game progress.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { existingWorkspaceMongo } from "./dev-runtime.mjs";
import { connect, models, transaction } from "../lib/db.js";
import { attendanceWindow, extraSessionEnd } from "../lib/attendance-hours.js";
import { attendanceSnapshot } from "../lib/attendance.js";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!process.env.MONGODB_URI)
  process.env.MONGODB_URI = await existingWorkspaceMongo(
    27019,
    fileURLToPath(new URL("../.data/mongo/", import.meta.url)),
  );
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
try {
  await connect();
  const user = await models.User.findById("usr_g01").lean();
  assert.equal(user?.name, "Aarav Patel");
  assert.equal(user.role, "GAMER");
  assert.notEqual(user.active, false);
  const cohortId = user.cohortId || "alpha";
  const cohort = await models.Cohort.findById(cohortId).lean();
  assert.ok(cohort);
  const now = new Date(),
    window = attendanceWindow(cohort, now),
    end = extraSessionEnd(cohort, window.day, window.timeZone);
  const official = await models.Attendance.find({ userId: user._id })
    .sort({ _id: 1 })
    .lean();
  const otherSessions = await models.ExtraPlaySession.find({
    userId: { $ne: user._id },
  })
    .sort({ _id: 1 })
    .lean();
  const existing = await models.ExtraPlaySession.findOne({
    userId: user._id,
    state: "ACTIVE",
  }).lean();
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify({
        preview: true,
        player: user.name,
        day: window.day,
        uatUntil: end,
        alreadyPlaying: Boolean(existing),
      }),
    );
  } else {
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/aarav-uat-${Date.now()}.json`;
    await writeFile(
      backup,
      JSON.stringify(
        { user, attendance: official, existingSession: existing },
        null,
        2,
      ),
      { flag: "wx" },
    );
    await transaction(async (session) => {
      const current = await models.User.findById(user._id)
        .session(session)
        .lean();
      assert.equal(current?.name, "Aarav Patel");
      assert.notEqual(current.active, false);
      await models.User.updateOne(
        { _id: user._id },
        { $inc: { effortLock: 1 } },
        { session },
      );
      const active = await models.ExtraPlaySession.findOne({
        userId: user._id,
        state: "ACTIVE",
      })
        .session(session)
        .lean();
      if (active) return;
      await models.ExtraPlaySession.create(
        [
          {
            _id: randomUUID(),
            userId: user._id,
            cohortId,
            day: window.day,
            purpose: "UAT",
            reason:
              "User requested Aarav-only play access for UAT after the official clock-out.",
            createdBy: "local-user-request",
            startAt: now,
            plannedEndAt: end,
            state: "ACTIVE",
            timeZone: window.timeZone,
          },
        ],
        { session },
      );
    });
    const view = await attendanceSnapshot(user, new Date());
    assert.equal(view.state, "EXTRA");
    assert.equal(
      fingerprint(
        await models.Attendance.find({ userId: user._id })
          .sort({ _id: 1 })
          .lean(),
      ),
      fingerprint(official),
      "Official clock history changed.",
    );
    assert.equal(
      fingerprint(
        await models.ExtraPlaySession.find({ userId: { $ne: user._id } })
          .sort({ _id: 1 })
          .lean(),
      ),
      fingerprint(otherSessions),
      "Another player's session changed.",
    );
    console.log(
      JSON.stringify({
        player: user.name,
        state: view.state,
        purpose: view.extraSession.purpose,
        uatUntil: view.extraSession.plannedEndAt,
        officialAttendanceUnchanged: true,
        otherPlayersUnchanged: true,
        backup,
      }),
    );
  }
} finally {
  await mongoose.disconnect();
}
