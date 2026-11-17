import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import {
  attendanceAction,
  attendanceSnapshot,
  syncAttendance,
  RESPONSE_MS,
} from "../lib/attendance.js";
import { dayOneAction } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { publishFixtureRules } from "./week-one-program-fixture.mjs";
import { flightApiAllowed } from "../lib/flight-rules.js";

test("attendance controls are available before boarding without unlocking research writes", () => {
  assert.equal(flightApiAllowed("attendance/clock-in", "POST", false), true);
  assert.equal(flightApiAllowed("attendance/stay", "POST", false), true);
  assert.equal(flightApiAllowed("day1/genre", "POST", false), false);
  assert.equal(RESPONSE_MS, 120000);
  assert.equal(flightApiAllowed("attendance/continue", "POST", false), true);
});

test(
  "MongoDB attendance: arrival, manual finish, continued play, exact expiry, background reconciliation, retries and scope",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `attendance_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const m of Object.values(models)) await m.init();
    const players = [0, 1, 2].map((i) => ({
      _id: `att-${i}`,
      name: `Player ${i}`,
      email: `att-${i}@example.invalid`,
      role: "GAMER",
      cohortId: "alpha",
    }));
    const [a, b, inactive] = players;
    const cc = {
      _id: "att-cc",
      name: "CC",
      email: "att-cc@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const at = (time, day = "2026-11-13") => new Date(`${day}T${time}+05:30`);
    const act = (u, action, now, body = {}) =>
      attendanceAction(u, action, body, now);
    try {
      await models.User.insertMany([...players, cc]);
      await models.Cohort.create({
        _id: "alpha",
        name: "Attendance QA",
        college: "Synthetic",
        startDate: "2026-11-13",
        currentWeek: 1,
      });
      assert.equal(
        (await attendanceSnapshot(a, at("09:00:00"))).available,
        false,
      );
      assert.equal(
        (await attendanceSnapshot(a, at("09:00:00"))).hasClockedIn,
        false,
      );
      await assert.rejects(
        act(a, "clock-in", at("09:00:00")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        act(cc, "clock-in", at("09:00:00")),
        (e) => e.status === 403,
      );
      await assert.rejects(
        act(a, "clock-in", at("09:00:00"), { userId: b._id }),
        (e) => e.status === 400,
      );
      await models.User.updateOne(
        { _id: inactive._id },
        { $set: { active: false } },
      );
      await assert.rejects(
        act(inactive, "clock-in", at("09:00:00")),
        (e) => e.status === 403,
      );
      const config = {
        ...fixtureConfig(),
        day: "2026-11-13",
        availableAt: at("09:00:00").toISOString(),
        officialStart: at("09:00:00").toISOString(),
        clockCutoff: at("09:30:00").toISOString(),
        closingCutoff: at("17:00:00").toISOString(),
        revealAfter: at("17:00:00", "2026-11-20").toISOString(),
      };
      await dayOneAction(
        cc,
        "release",
        { config, revision: 0 },
        at("08:00:00"),
      );
      await publishFixtureRules(cc, at("08:00:00"));
      await weekOneAction(
        cc,
        "open",
        { day: 1, revision: (await weekOneSnapshot(cc)).revision },
        at("08:00:00"),
      );
      await assert.rejects(
        act(a, "clock-in", at("08:59:59")),
        (e) => e.status === 409 && e.message.includes("09:00"),
      );
      await assert.rejects(
        dayOneAction(a, "clock", {}, at("08:59:59")),
        (e) => e.status === 409 && e.message.includes("09:00"),
      );
      await Promise.all([
        act(a, "clock-in", at("09:00:00")),
        act(a, "clock-in", at("09:00:00")),
      ]);
      // A manual clock-out on an earlier day still suppresses the tutorial,
      // even when today's snapshot has no attendance row or timeout receipt.
      await models.Attendance.create({
        _id: "historical-manual-session",
        userId: b._id,
        cohortId: "alpha",
        day: "2026-11-12",
        clockAt: at("09:00:00", "2026-11-12"),
        sessionState: "OUT",
        clockOutAt: at("17:00:00", "2026-11-12"),
        clockOutReason: "MANUAL",
      });
      assert.equal(
        (await attendanceSnapshot(b, at("08:59:00"))).hasClockedIn,
        true,
      );
      await models.Attendance.deleteOne({ _id: "historical-manual-session" });
      await act(b, "clock-in", at("09:00:00"));
      assert.equal(
        await models.Attendance.countDocuments({ userId: a._id }),
        1,
      );
      assert.equal(
        (await models.Attendance.findOne({ userId: a._id }).lean())
          .sessionEvents.length,
        1,
      );
      const before = await attendanceSnapshot(a, at("16:59:59"));
      assert.equal(before.hasClockedIn, true);
      assert.equal(before.state, "ACTIVE");
      assert.equal(before.warningAt, null);
      await assert.rejects(
        act(a, "stay", at("16:59:00")),
        (e) => e.status === 409,
      );
      const warning = await attendanceSnapshot(a, at("17:00:00"));
      assert.deepEqual(warning.responseDeadline, at("17:02:00"));
      await assert.rejects(
        act(b, "clock-in", at("17:00:00")),
        (e) => e.status === 409 && e.message.includes("17:00"),
      );
      assert.equal(
        (await attendanceSnapshot(b, at("17:01:59"))).state,
        "CHOICE",
      );
      await act(a, "stay", at("17:01:00"));
      assert.equal(
        (await attendanceSnapshot(a, at("17:02:00"))).responseDeadline,
        null,
      );
      await Promise.all([
        syncAttendance(at("17:02:00")),
        syncAttendance(at("17:02:00")),
      ]);
      const out = await models.Attendance.findOne({ userId: b._id }).lean();
      assert.equal(out.sessionState, "OUT");
      assert.deepEqual(out.clockOutAt, at("17:00:00"));
      assert.equal(out.clockOutReason, "SCHEDULED_END");
      assert.equal(out.endDecision, "EXPIRED");
      assert.equal(out.sessionEvents.filter((e) => e.type === "OUT").length, 1);
      assert.deepEqual(out.sessionEvents.at(-1).at, at("17:00:00"));
      await assert.rejects(
        act(b, "stay", at("17:02:00")),
        (e) => e.status === 409,
      );
      await act(a, "clock-out", at("17:10:00"));
      await act(a, "clock-out", at("17:10:01"));
      assert.equal(
        (await models.Attendance.findOne({ userId: a._id }).lean())
          .clockOutReason,
        "SCHEDULED_END",
      );
      await assert.rejects(
        act(a, "clock-in", at("17:11:00")),
        (e) => e.status === 409,
      );
      // Reopening the hours permits resuming, with original clock-in retained.
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $set: { attendanceHours: { startTime: "09:00", endTime: "18:00" } } },
      );
      await act(a, "clock-in", at("17:11:00"));
      const resumed = await models.Attendance.findOne({ userId: a._id }).lean();
      assert.deepEqual(resumed.clockAt, at("09:00:00"));
      assert.deepEqual(resumed.checkDueAt, at("18:00:00"));
      assert.equal(
        await models.DayOneRecord.countDocuments({ userId: a._id }),
        1,
      );
      await syncAttendance(at("18:30:00"));
      assert.deepEqual(
        (await attendanceSnapshot(a, at("18:30:00"))).clockOutAt,
        at("18:00:00"),
      );
      assert.deepEqual(
        (await attendanceSnapshot(b, at("18:30:00"))).clockOutAt,
        at("17:00:00"),
      );
      const next = await attendanceSnapshot(a, at("09:00:00", "2026-11-14"));
      assert.equal(next.hasClockedIn, true);
      assert.equal(next.state, "NOT_IN");
      assert.equal(next.available, false);
      // Day 2 uses a numeric activity day; the calendar date comes from its official start.
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $unset: { attendanceHours: "" } },
      );
      await models.WeekOneRelease.updateOne(
        { _id: "alpha" },
        {
          $set: {
            days: [
              {
                day: 2,
                state: "OPEN",
                officialStart: at("09:00:00", "2026-11-14").toISOString(),
                scheduledEnd: at("17:00:00", "2026-11-14").toISOString(),
                content: { day: 2, timeZone: "Asia/Kolkata" },
              },
            ],
          },
        },
      );
      assert.equal(
        (await attendanceSnapshot(a, at("09:00:00", "2026-11-14"))).available,
        true,
      );
      await act(a, "clock-in", at("09:00:00", "2026-11-14"));
      assert.equal(
        await models.Attendance.countDocuments({ userId: a._id }),
        2,
      );
      assert.equal(await models.Experience.countDocuments(), 0);
      assert.equal((await models.User.findById(a._id).lean()).hp, 5);
      // A check that crosses midnight still belongs to the running session.
      await models.Attendance.updateOne(
        { userId: a._id, day: "2026-11-14" },
        {
          $set: {
            cutoffAt: at("00:00:00", "2026-11-15"),
            checkDueAt: at("00:00:00", "2026-11-15"),
          },
          $unset: { warningAt: "", responseDeadline: "" },
        },
      );
      const overnight = await attendanceSnapshot(
        a,
        at("00:01:00", "2026-11-15"),
      );
      assert.equal(overnight.state, "CHOICE");
      assert.deepEqual(
        overnight.responseDeadline,
        at("00:02:00", "2026-11-15"),
      );
      await act(a, "stay", at("00:01:00", "2026-11-15"));
      await act(a, "clock-out", at("00:10:00", "2026-11-15"));
      assert.equal(
        (
          await models.Attendance.findOne({
            userId: a._id,
            day: "2026-11-14",
          }).lean()
        ).clockOutReason,
        "SCHEDULED_END",
      );
      // Expedition attendance retains the existing reward/lateness policy.
      await models.WeekOneProgram.deleteMany({});
      await models.WeekOneRelease.deleteMany({});
      await models.Cohort.updateOne(
        { _id: "alpha" },
        {
          $set: {
            currentWeek: 2,
            workingCalendar: {
              timeZone: "Asia/Kolkata",
              weekdays: [0, 1, 2, 3, 4, 5, 6],
              intervals: [{ startMinute: 540, endMinute: 1440 }],
            },
          },
        },
      );
      const midnight = await attendanceSnapshot(
        b,
        at("09:00:00", "2026-11-15"),
      );
      assert.deepEqual(midnight.cutoffAt, at("17:00:00", "2026-11-15"));
      await act(b, "clock-in", at("09:00:00", "2026-11-15"));
      await act(b, "clock-out", at("09:10:00", "2026-11-15"));
      await act(b, "clock-in", at("09:11:00", "2026-11-15"));
      assert.equal(await models.Experience.countDocuments(), 1);
      await assert.rejects(
        act(a, "clock-in", at("10:00:00", "2026-11-15")),
        (e) => e.status === 400,
      );
      await assert.rejects(
        act(a, "clock-in", at("10:00:00", "2026-11-15"), {
          latenessReason: { forged: true },
        }),
        (e) => e.status === 400,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
