import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import {
  attendanceResult,
  attendanceRegister,
  correctAttendance,
  syncAbsences,
} from "../lib/attendance-register.js";
import { syncAttendance } from "../lib/attendance.js";
import { calendarAction } from "../lib/cohort-calendar.js";
import { isWorkspaceScreen } from "../lib/workspace-navigation.js";
import { flightApiAllowed } from "../lib/flight-rules.js";

const at = (day, time = "09:00:00") => new Date(`${day}T${time}+05:30`);
test("daily results exclude days off and untracked dates; reopening hours cannot retain a premature absence", () => {
  const cohort = {
    startDate: "2026-11-01",
    attendanceTrackingStartDay: "2026-11-16",
    workingCalendar: { weekdays: [1, 2, 3, 4, 5] },
    attendanceHours: { startTime: "09:00", endTime: "17:00" },
  };
  const user = { attendanceTrackingStartDay: "2026-11-16" };
  const absent = { automaticAbsentAt: at("2026-11-16", "17:00:00") };
  assert.equal(
    attendanceResult(
      cohort,
      user,
      "2026-11-16",
      null,
      absent,
      at("2026-11-16", "16:59:59"),
    ).status,
    "PENDING",
  );
  assert.equal(
    attendanceResult(
      cohort,
      user,
      "2026-11-16",
      null,
      absent,
      at("2026-11-16", "17:00:00"),
    ).status,
    "ABSENT",
  );
  assert.equal(
    attendanceResult(
      { ...cohort, attendanceHours: { startTime: "09:00", endTime: "18:00" } },
      user,
      "2026-11-16",
      null,
      absent,
      at("2026-11-16", "17:01:00"),
    ).status,
    "PENDING",
  );
  assert.equal(
    attendanceResult(
      cohort,
      user,
      "2026-11-15",
      null,
      { override: "ABSENT" },
      at("2026-11-16"),
    ).status,
    "DAY_OFF",
  );
  assert.equal(
    attendanceResult(cohort, user, "2026-11-13", null, null, at("2026-11-16"))
      .status,
    "NOT_TRACKED",
  );
  assert.equal(
    attendanceResult(
      cohort,
      user,
      "2026-11-16",
      { clockAt: at("2026-11-16"), onTime: false },
      absent,
      at("2026-11-16", "17:00:00"),
    ).status,
    "NEEDS_REVIEW",
  );
});
test("attendance management is staff-only in navigation and flight API", () => {
  assert.equal(isWorkspaceScreen("GAMER", "attendance"), false);
  for (const role of ["MISSION_COMMANDER", "CENTRE_COMMAND"])
    assert.equal(isWorkspaceScreen(role, "attendance"), true);
  assert.equal(flightApiAllowed("attendance/register", "GET", true), false);
  assert.equal(flightApiAllowed("attendance/correct", "POST", true), false);
});
test(
  "automatic absence, leave exclusion, catch-up, scoped staff corrections, concurrency and preserved work",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `absence_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const user = (id, role = "GAMER", extra = {}) => ({
      _id: id,
      name: id,
      email: `${id}@example.invalid`,
      role,
      cohortId: "alpha",
      xp: 75,
      trophies: 15,
      ...extra,
    });
    const cc = user("absence-cc", "CENTRE_COMMAND"),
      mc = user("absence-mc", "MISSION_COMMANDER"),
      limited = user("absence-limited", "MISSION_COMMANDER", {
        permissions: [],
      });
    const p = user("absence-present", "GAMER", { teamId: "absence-team" }),
      a = user("absence-missing", "GAMER", { teamId: "absence-team" }),
      outside = user("absence-outside", "GAMER", { teamId: "other-team" });
    const inactive = user("absence-inactive", "GAMER", {
      active: false,
      teamId: "absence-team",
    });
    const beta = user("absence-beta", "GAMER", { cohortId: "beta" }),
      betaCC = user("absence-beta-cc", "CENTRE_COMMAND", { cohortId: "beta" });
    try {
      await models.User.insertMany([
        cc,
        mc,
        limited,
        p,
        a,
        outside,
        inactive,
        beta,
        betaCC,
      ]);
      await models.Team.insertMany([
        {
          _id: "absence-team",
          name: "Research team",
          code: "A",
          cohortId: "alpha",
          commanderId: mc._id,
        },
        {
          _id: "other-team",
          name: "Other team",
          code: "B",
          cohortId: "alpha",
          commanderId: "another-mc",
        },
      ]);
      await models.Cohort.insertMany(
        ["alpha", "beta"].map((id) => ({
          _id: id,
          name: id,
          college: "Test",
          startDate: "2026-11-01",
          workingCalendar: {
            timeZone: "Asia/Kolkata",
            weekdays: [1, 2, 3, 4, 5],
          },
        })),
      );
      await models.Attendance.create({
        _id: "absence-clock",
        userId: p._id,
        cohortId: "alpha",
        day: "2026-11-16",
        clockAt: at("2026-11-16"),
        onTime: true,
        sessionState: "OUT",
        clockOutAt: at("2026-11-16", "16:30:00"),
      });
      await models.Journal.create({
        _id: "absence-work",
        userId: p._id,
        teamId: p.teamId,
        day: "2026-11-16",
        workDone: "Saved work must remain intact.",
        learnings: "Attendance basics",
        tomorrowPlan: "Continue the mission",
      });
      const originalClock = JSON.stringify(
        await models.Attendance.findById("absence-clock").lean(),
      );
      const work = JSON.stringify(await models.Journal.find().lean());
      await syncAbsences(at("2026-11-16"));
      assert.equal(await models.AttendanceResult.countDocuments(), 0);
      const pending = await attendanceRegister(
        cc,
        "2026-11-16",
        at("2026-11-16", "16:59:59"),
      );
      assert.equal(pending.counts.ABSENT, 0);
      assert.equal(pending.counts.PENDING, 2);
      await Promise.all([
        syncAttendance(at("2026-11-16", "17:00:00")),
        syncAbsences(at("2026-11-16", "17:00:00")),
      ]);
      assert.equal(await models.AttendanceResult.countDocuments(), 4);
      const result = await models.AttendanceResult.findOne({
        userId: a._id,
      }).lean();
      assert.deepEqual(result.automaticAbsentAt, at("2026-11-16", "17:00:00"));
      assert.equal(
        await models.AttendanceResult.countDocuments({ userId: inactive._id }),
        0,
      );
      const view = await attendanceRegister(
        cc,
        "2026-11-16",
        at("2026-11-16", "17:00:00"),
      );
      assert.equal(view.counts.FULL_DAY, 1);
      assert.equal(view.counts.ABSENT, 2);
      assert.equal(view.percentage, 33.3);
      const mcView = await attendanceRegister(
        mc,
        "2026-11-16",
        at("2026-11-16", "17:00:00"),
      );
      assert.deepEqual(
        new Set(mcView.rows.map((r) => r.userId)),
        new Set([p._id, a._id, inactive._id]),
      );
      assert.equal(
        (
          await attendanceRegister(
            betaCC,
            "2026-11-16",
            at("2026-11-16", "17:00:00"),
          )
        ).rows.length,
        1,
      );
      const correction = {
        userId: a._id,
        day: "2026-11-16",
        status: "PRESENT",
        reason: "Clock-in was missed; attendance confirmed by MC.",
        version: 0,
      };
      await assert.rejects(
        attendanceRegister(p, "2026-11-16"),
        (e) => e.status === 403,
      );
      for (const actor of [p, betaCC, limited])
        await assert.rejects(
          correctAttendance(actor, correction, at("2026-11-16", "17:00:00")),
          (e) => e.status === 403,
        );
      await assert.rejects(
        correctAttendance(
          mc,
          { ...correction, userId: outside._id },
          at("2026-11-16", "17:00:00"),
        ),
        (e) => e.status === 403,
      );
      await assert.rejects(
        correctAttendance(cc, { ...correction, cohortId: "beta" }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        correctAttendance(cc, { ...correction, reason: "" }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        correctAttendance(
          cc,
          { ...correction, day: "2026-11-17" },
          at("2026-11-16"),
        ),
        (e) => e.status === 400,
      );
      await correctAttendance(mc, correction, at("2026-11-16", "17:01:00"));
      await syncAbsences(at("2026-11-16", "17:05:00"));
      assert.equal(
        (
          await attendanceRegister(
            mc,
            "2026-11-16",
            at("2026-11-16", "17:05:00"),
          )
        ).percentage,
        100,
      );
      const concurrent = await Promise.allSettled([
        correctAttendance(
          mc,
          { ...correction, status: "EXCUSED", version: 1 },
          at("2026-11-16", "17:06:00"),
        ),
        correctAttendance(
          cc,
          { ...correction, status: "ABSENT", version: 1 },
          at("2026-11-16", "17:06:00"),
        ),
      ]);
      assert.equal(
        concurrent.filter((r) => r.status === "fulfilled").length,
        1,
      );
      assert.equal(
        concurrent.find((r) => r.status === "rejected").reason.status,
        409,
      );
      await correctAttendance(
        cc,
        { ...correction, status: "DEFAULT", version: 2 },
        at("2026-11-16", "17:07:00"),
      );
      assert.equal(
        (
          await attendanceRegister(
            cc,
            "2026-11-16",
            at("2026-11-16", "17:07:00"),
          )
        ).rows.find((r) => r.userId === a._id).status,
        "ABSENT",
      );
      assert.equal(
        await models.AttendanceCorrection.countDocuments({ userId: a._id }),
        3,
      );
      const leave = {
        date: "2026-11-16",
        status: "LEAVE",
        label: "Centre leave",
        reason: "Centre closed for this date.",
        version: 0,
      };
      await calendarAction(cc, leave, at("2026-11-16", "17:08:00"));
      const off = await attendanceRegister(
        cc,
        "2026-11-16",
        at("2026-11-16", "17:09:00"),
      );
      assert.equal(off.counts.ABSENT, 0);
      assert.equal(off.percentage, null);
      assert.ok(off.rows.every((r) => r.status === "DAY_OFF"));
      await assert.rejects(
        correctAttendance(
          cc,
          { ...correction, version: 3 },
          at("2026-11-16", "17:09:00"),
        ),
        (e) => e.status === 409,
      );
      await calendarAction(
        cc,
        { ...leave, status: "WORKING", label: "Working day", version: 1 },
        at("2026-11-16", "17:10:00"),
      );
      assert.equal(
        (
          await attendanceRegister(
            cc,
            "2026-11-16",
            at("2026-11-16", "17:10:00"),
          )
        ).counts.ABSENT,
        2,
      );
      // A leave day during worker downtime is skipped; a missed working day is caught up.
      await calendarAction(
        cc,
        { ...leave, date: "2026-11-17", version: 2 },
        at("2026-11-16", "17:11:00"),
      );
      await models.User.create(
        user("absence-new", "GAMER", { teamId: "absence-team" }),
      );
      await syncAbsences(at("2026-11-19"));
      assert.equal(
        await models.AttendanceResult.countDocuments({
          cohortId: "alpha",
          day: "2026-11-17",
        }),
        0,
      );
      assert.equal(
        await models.AttendanceResult.countDocuments({
          userId: a._id,
          day: "2026-11-18",
        }),
        1,
      );
      assert.equal(
        await models.AttendanceResult.countDocuments({
          userId: "absence-new",
          day: { $lt: "2026-11-19" },
        }),
        0,
      );
      await syncAbsences(at("2026-11-23"));
      assert.equal(
        await models.AttendanceResult.countDocuments({
          day: { $in: ["2026-11-21", "2026-11-22"] },
        }),
        0,
      );
      // Retrospectively converting a leave day is reconciled when that date is viewed.
      await calendarAction(
        cc,
        {
          ...leave,
          date: "2026-11-17",
          status: "WORKING",
          label: "Working day",
          version: 3,
        },
        at("2026-11-23"),
      );
      assert.equal(
        (
          await attendanceRegister(cc, "2026-11-17", at("2026-11-23"))
        ).rows.find((r) => r.userId === a._id).status,
        "ABSENT",
      );
      assert.equal(
        JSON.stringify(
          await models.Attendance.findById("absence-clock").lean(),
        ),
        originalClock,
      );
      assert.equal(JSON.stringify(await models.Journal.find().lean()), work);
      const balance = await models.User.findById(p._id).lean();
      assert.equal(balance.xp, 75);
      assert.equal(balance.trophies, 15);
      assert.equal(balance.hp, 5);
      assert.equal(await models.Attendance.countDocuments(), 1);
      // Staff can correct known historical attendance explicitly, without
      // inventing clock times or enabling retroactive automatic absence.
      await correctAttendance(
        mc,
        {
          ...correction,
          day: "2026-11-13",
          reason: "Confirmed attendance before automatic tracking.",
        },
        at("2026-11-23"),
      );
      assert.equal(
        (
          await attendanceRegister(mc, "2026-11-13", at("2026-11-23"))
        ).rows.find((r) => r.userId === a._id).status,
        "FULL_DAY",
      );
      assert.equal(await models.Attendance.countDocuments(), 1);
      await assert.rejects(
        correctAttendance(
          mc,
          { ...correction, day: "2026-10-31" },
          at("2026-11-23"),
        ),
        (e) => e.status === 409,
      );
      // A cohort first enabled after its day ended starts tomorrow, never retroactively.
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $set: { attendanceHours: { startTime: "10:00", endTime: "18:00" } } },
      );
      await attendanceRegister(cc, "2026-11-16", at("2026-11-23"));
      assert.deepEqual(
        (
          await models.AttendanceResult.findOne({
            userId: a._id,
            day: "2026-11-16",
          }).lean()
        ).automaticAbsentAt,
        at("2026-11-16", "17:00:00"),
      );
      await models.Cohort.create({
        _id: "late-rollout",
        name: "Late rollout",
        college: "Test",
        startDate: "2026-11-01",
      });
      await models.User.create(
        user("late-rollout-player", "GAMER", { cohortId: "late-rollout" }),
      );
      await syncAbsences(at("2026-11-16", "18:00:00"), "late-rollout");
      assert.equal(
        (await models.Cohort.findById("late-rollout").lean())
          .attendanceTrackingStartDay,
        "2026-11-17",
      );
      assert.equal(
        await models.AttendanceResult.countDocuments({
          cohortId: "late-rollout",
        }),
        0,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
