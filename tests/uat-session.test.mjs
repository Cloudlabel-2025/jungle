import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { attendanceSnapshot, attendanceAction } from "../lib/attendance.js";
import { workHistory } from "../lib/work-history.js";
import { requireWorkingDay } from "../lib/cohort-calendar.js";
const at = (time, day = "2026-11-16") => new Date(`${day}T${time}:00+05:30`);
test(
  "a scoped UAT session bypasses the old clock-out without changing official history or other players",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `uat_session_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const player = {
      _id: "uat-player",
      name: "UAT player",
      email: "uat-player@example.invalid",
      role: "GAMER",
      cohortId: "alpha",
    };
    const other = {
      ...player,
      _id: "uat-other",
      name: "Other player",
      email: "uat-other@example.invalid",
    };
    try {
      await models.User.insertMany([player, other]);
      await models.Cohort.create({
        _id: "alpha",
        name: "UAT fixture",
        college: "Test",
        startDate: "2026-11-01",
        currentWeek: 2,
      });
      await models.Attendance.create({
        _id: "uat-old",
        userId: player._id,
        cohortId: "alpha",
        day: "2026-11-15",
        clockAt: at("09:00", "2026-11-15"),
        clockOutAt: at("17:00", "2026-11-15"),
        sessionState: "OUT",
        clockOutReason: "TIMEOUT",
      });
      const before = JSON.stringify(await models.Attendance.find().lean());
      await assert.rejects(
        models.ExtraPlaySession.create({
          _id: "invalid-extra",
          userId: other._id,
          cohortId: "alpha",
          day: "2026-11-16",
          startAt: at("18:00"),
          state: "ACTIVE",
        }),
      );
      await models.ExtraPlaySession.create({
        _id: "uat-open",
        purpose: "UAT",
        reason: "Requested test access",
        createdBy: "test",
        userId: player._id,
        cohortId: "alpha",
        day: "2026-11-16",
        startAt: at("18:00"),
        plannedEndAt: at("09:00", "2026-11-17"),
        state: "ACTIVE",
        timeZone: "Asia/Kolkata",
      });
      const view = await attendanceSnapshot(player, at("18:01"));
      assert.equal(view.state, "EXTRA");
      assert.equal(view.extraSession.purpose, "UAT");
      assert.equal(view.responseDeadline, null);
      assert.equal(view.officialAttendance.minutes, 0);
      assert.equal(
        (await requireWorkingDay(player, at("18:01"), null, true)).uat,
        true,
      );
      await assert.rejects(
        requireWorkingDay(player, at("18:01")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        requireWorkingDay(other, at("18:01"), null, true),
        (e) => e.status === 409,
      );
      assert.equal(
        JSON.stringify(await models.Attendance.find().lean()),
        before,
      );
      assert.equal(
        await models.ExtraPlaySession.countDocuments({ userId: other._id }),
        0,
      );
      await assert.rejects(
        attendanceAction(other, "continue", {}, at("18:02")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        attendanceAction(player, "continue", { purpose: "UAT" }, at("18:02")),
        (e) => e.status === 400,
      );
      const history = await workHistory(
        player,
        { date: "2026-11-16" },
        at("19:00"),
      );
      assert.equal(history.clockedSeconds, 0);
      assert.equal(history.extraSeconds, 3600);
      assert.equal(
        (await attendanceSnapshot(player, at("08:59", "2026-11-17"))).state,
        "EXTRA",
      );
      assert.equal(
        (await attendanceSnapshot(player, at("09:00", "2026-11-17"))).state,
        "NOT_IN",
      );
      assert.equal(
        await models.Attendance.countDocuments({ day: "2026-11-17" }),
        0,
      );
      assert.equal(
        JSON.stringify(await models.Attendance.find().lean()),
        before,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
