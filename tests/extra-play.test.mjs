import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models, transaction } from "../lib/db.js";
import {
  attendanceAction,
  attendanceSnapshot,
  syncAttendance,
} from "../lib/attendance.js";
import {
  attendanceRegister,
  syncAbsences,
} from "../lib/attendance-register.js";
import { calendarAction } from "../lib/cohort-calendar.js";
import { workHistory } from "../lib/work-history.js";
import {
  workSessions,
  extraWorkSessions,
  sessionAt,
} from "../lib/work-sessions.js";
import { saveLabWork } from "../lib/lab-work.js";

const at = (time, day = "2026-11-16") => new Date(`${day}T${time}:00+05:30`);
test("official periods stop at the cutoff; extra periods have a separate identity and next-start boundary", () => {
  const official = workSessions([
    {
      _id: "official",
      clockAt: at("09:00"),
      cutoffAt: at("17:00"),
      sessionState: "ACTIVE",
    },
  ]);
  assert.equal(sessionAt(official, at("17:00")), null);
  const extra = extraWorkSessions([
    {
      _id: "extra",
      startAt: at("17:01"),
      plannedEndAt: at("09:00", "2026-11-17"),
      state: "ACTIVE",
    },
  ]);
  assert.equal(sessionAt(extra, at("18:30")).kind, "EXTRA");
  assert.equal(sessionAt(extra, at("09:00", "2026-11-17")), null);
});
test(
  "official 17:00 close, optional extra play, no repeat prompts, saved work, absence, CC timing and next day",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `extra_play_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const make = (id, role = "GAMER") => ({
      _id: id,
      name: id,
      email: `${id}@example.invalid`,
      cohortId: "alpha",
      role,
      teamId: "extra-team",
    });
    const p = make("extra-player"),
      q = make("extra-missing"),
      r = make("extra-finish"),
      cc = make("extra-cc", "CENTRE_COMMAND");
    try {
      await models.User.insertMany([p, q, r, cc]);
      await models.Team.create({
        _id: "extra-team",
        name: "Extra team",
        code: "EX",
        cohortId: "alpha",
      });
      await models.Cohort.create({
        _id: "alpha",
        name: "Extra test",
        college: "Test",
        startDate: "2026-11-16",
        currentWeek: 2,
        workingCalendar: {
          timeZone: "Asia/Kolkata",
          weekdays: [1, 2, 3, 4, 5],
        },
      });
      await syncAbsences(at("09:00"));
      for (const player of [p, r])
        await attendanceAction(player, "clock-in", {}, at("09:00"));
      const balance = await models.User.findById(p._id).lean();
      await assert.rejects(
        attendanceAction(p, "continue", {}, at("16:59")),
        (e) => e.status === 409,
      );
      assert.equal((await attendanceSnapshot(p, at("16:59"))).state, "ACTIVE");
      await Promise.all([
        syncAttendance(at("17:00")),
        syncAttendance(at("17:00")),
      ]);
      const official = await models.Attendance.findOne({
        userId: p._id,
      }).lean();
      assert.equal(official.sessionState, "OUT");
      assert.deepEqual(official.clockOutAt, at("17:00"));
      assert.equal(
        official.sessionEvents.filter((e) => e.type === "OUT").length,
        1,
      );
      const choice = await attendanceSnapshot(p, at("17:00"));
      assert.equal(choice.state, "CHOICE");
      assert.deepEqual(choice.responseDeadline, at("17:02"));
      await assert.rejects(
        attendanceAction(q, "continue", {}, at("17:01")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        attendanceAction(cc, "continue", {}, at("17:01")),
        (e) => e.status === 403,
      );
      await assert.rejects(
        attendanceAction(p, "continue", { userId: q._id }, at("17:01")),
        (e) => e.status === 400,
      );
      await Promise.all([
        attendanceAction(p, "continue", {}, at("17:01")),
        attendanceAction(p, "continue", {}, at("17:01")),
      ]);
      assert.equal(
        await models.ExtraPlaySession.countDocuments({ userId: p._id }),
        1,
      );
      await attendanceAction(r, "clock-out", {}, at("17:01"));
      assert.equal(
        (await models.Attendance.findOne({ userId: r._id }).lean()).endDecision,
        "FINISHED",
      );
      assert.equal(
        await models.ExtraPlaySession.countDocuments({ userId: r._id }),
        0,
      );
      for (const time of ["17:31", "18:01", "23:00"]) {
        const s = await attendanceSnapshot(p, at(time));
        assert.equal(s.state, "EXTRA");
        assert.equal(s.responseDeadline, null);
        assert.deepEqual(s.clockOutAt, at("17:00"));
      }
      const files = {
        "src/App.jsx": "extra session source",
        "src/styles.css": "body { color: green; }",
        "tests/ledger.test.js": "extra session test",
      };
      await transaction((session) =>
        saveLabWork(
          p,
          { ownerId: p._id, files, expectedVersion: 0 },
          session,
          at("17:45"),
        ),
      );
      const checkpoint = await models.LabCheckpoint.findOne({
        userId: p._id,
      }).lean();
      assert.ok(checkpoint.sessionId.includes("extra:"));
      const history = await workHistory(p, { date: "2026-11-16" }, at("18:00"));
      assert.equal(history.clockedSeconds, 8 * 3600);
      assert.equal(history.extraSeconds, 59 * 60);
      assert.equal(
        history.sessions.filter((s) => s.kind === "EXTRA").length,
        1,
      );
      assert.ok(history.entries.some((e) => e.sessionId?.includes("extra:")));
      const staff = await attendanceRegister(cc, "2026-11-16", at("18:00"));
      assert.equal(
        staff.rows.find((row) => row.userId === q._id).status,
        "ABSENT",
      );
      assert.equal(
        staff.rows.find((row) => row.userId === p._id).extraMinutes,
        59,
      );
      assert.deepEqual(
        staff.rows.find((row) => row.userId === p._id).clockOutAt,
        at("17:00"),
      );
      const after = await models.User.findById(p._id).lean();
      assert.equal(after.xp, balance.xp);
      assert.equal(after.trophies, balance.trophies);
      await attendanceAction(p, "clock-out", {}, at("18:15"));
      await attendanceAction(p, "clock-out", {}, at("18:15"));
      const ended = await models.ExtraPlaySession.findOne({
        userId: p._id,
      }).lean();
      assert.deepEqual(ended.endAt, at("18:15"));
      assert.deepEqual(
        (await models.Attendance.findById(official._id).lean()).clockOutAt,
        at("17:00"),
      );
      // Explicitly reopening extra play never reopens official attendance.
      await attendanceAction(p, "continue", {}, at("19:00"));
      await calendarAction(
        cc,
        {
          action: "HOURS",
          hours: { startTime: "10:00", endTime: "16:00" },
          reason: "New attendance hours for the cohort.",
          version: 0,
        },
        at("20:00"),
      );
      assert.equal(
        (await attendanceSnapshot(p, at("09:59", "2026-11-17"))).state,
        "EXTRA",
      );
      await assert.rejects(
        attendanceAction(p, "clock-in", {}, at("09:59", "2026-11-17")),
        (e) => e.status === 409,
      );
      await syncAttendance(at("10:00", "2026-11-17"));
      const rollover = await models.ExtraPlaySession.findOne({
        userId: p._id,
        startAt: at("19:00"),
      }).lean();
      assert.equal(rollover.state, "OUT");
      assert.equal(rollover.endReason, "NEXT_DAY");
      assert.deepEqual(rollover.endAt, at("10:00", "2026-11-17"));
      assert.equal(
        await models.Attendance.countDocuments({
          userId: p._id,
          day: "2026-11-17",
        }),
        0,
      );
      for (const player of [p, q])
        await attendanceAction(
          player,
          "clock-in",
          {},
          at("10:00", "2026-11-17"),
        );
      const dayTwo = await attendanceSnapshot(p, at("16:00", "2026-11-17"));
      assert.equal(dayTwo.state, "CHOICE");
      assert.deepEqual(dayTwo.clockOutAt, at("16:00", "2026-11-17"));
      await syncAttendance(at("16:02", "2026-11-17"));
      const noReply = await attendanceSnapshot(q, at("16:02", "2026-11-17"));
      assert.equal(noReply.state, "OUT");
      assert.equal(noReply.endDecision, "EXPIRED");
      assert.deepEqual(noReply.clockOutAt, at("16:00", "2026-11-17"));
      assert.equal(
        await models.ExtraPlaySession.countDocuments({ userId: q._id }),
        0,
      );
      // A delayed/background run records the cutoff, not the worker's later run time.
      await attendanceAction(p, "clock-in", {}, at("10:00", "2026-11-18"));
      await syncAttendance(at("18:00", "2026-11-18"));
      const delayed = await models.Attendance.findOne({
        userId: p._id,
        day: "2026-11-18",
      }).lean();
      assert.deepEqual(delayed.clockOutAt, at("16:00", "2026-11-18"));
      assert.equal(delayed.endDecision, "EXPIRED");
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
