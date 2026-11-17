import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import {
  attendanceMinimums,
  validateAttendanceMinimums,
  officialDuration,
  durationAttendance,
} from "../lib/attendance-duration.js";
import {
  attendanceResult,
  attendanceRegister,
  syncAbsences,
  correctAttendance,
} from "../lib/attendance-register.js";
import { calendarAction, calendarSnapshot } from "../lib/cohort-calendar.js";
import { attendanceSnapshot } from "../lib/attendance.js";

const day = "2026-11-16";
const at = (time, date = day) => new Date(`${date}T${time}+05:30`);
const cohort = {
  startDate: "2026-11-01",
  attendanceTrackingStartDay: day,
  attendanceHours: { startTime: "09:00", endTime: "17:00" },
  workingCalendar: { timeZone: "Asia/Kolkata", weekdays: [1, 2, 3, 4, 5] },
};
const clock = (stop, date = day, start = "09:00:00") => ({
  day: date,
  clockAt: at(start, date),
  officialStartAt: at("09:00:00", date),
  cutoffAt: at("17:00:00", date),
  clockOutAt: at(stop, date),
  sessionState: "OUT",
  timeZone: "Asia/Kolkata",
});

test("duration boundaries are exact, half days earn half credit, and unfinished days stay provisional", () => {
  const now = at("17:00:00");
  for (const [stop, status, minutes] of [
    ["15:00:00", "FULL_DAY", 360],
    ["14:59:59.999", "HALF_DAY", 359],
    ["13:00:00", "HALF_DAY", 240],
    ["12:59:59.999", "ABSENT", 239],
    ["09:00:00", "ABSENT", 0],
  ]) {
    const result = durationAttendance(cohort, day, clock(stop), null, now);
    assert.equal(result.status, status);
    assert.equal(result.officialMinutes, minutes);
    assert.equal(
      result.credit,
      status === "FULL_DAY" ? 1 : status === "HALF_DAY" ? 0.5 : 0,
    );
  }
  const provisional = durationAttendance(
    cohort,
    day,
    clock("15:00:00"),
    null,
    at("16:59:59"),
  );
  assert.equal(provisional.status, "IN_PROGRESS");
  assert.equal(provisional.counted, false);
  assert.equal(provisional.projectedStatus, "FULL_DAY");
  const unknown = durationAttendance(
    cohort,
    day,
    { clockAt: at("09:00:00") },
    null,
    now,
  );
  assert.equal(unknown.status, "NEEDS_REVIEW");
  assert.equal(unknown.counted, false);
});
test("only official intervals count: breaks, duplicate events, early arrival, late clock-out and extra sessions", () => {
  const split = {
    ...clock("17:00:00"),
    sessionEvents: [
      { type: "IN", at: at("09:00:00") },
      { type: "IN", at: at("09:00:00") },
      { type: "OUT", at: at("12:00:00") },
      { type: "OUT", at: at("12:00:00") },
      { type: "IN", at: at("13:00:00") },
      { type: "OUT", at: at("17:00:00") },
    ],
  };
  assert.equal(
    officialDuration(cohort, day, split, at("18:00:00")).officialMilliseconds,
    7 * 3600000,
  );
  assert.equal(
    officialDuration(
      cohort,
      day,
      clock("18:00:00", day, "08:00:00"),
      at("18:00:00"),
    ).officialMilliseconds,
    8 * 3600000,
  );
  assert.equal(
    officialDuration(
      cohort,
      day,
      { ...clock("23:00:00"), sessionKind: "EXTRA" },
      at("23:00:00"),
    ).officialMilliseconds,
    0,
  );
  const active = {
    ...clock("17:00:00"),
    clockOutAt: undefined,
    sessionState: "ACTIVE",
  };
  assert.equal(
    officialDuration(cohort, day, active, at("12:00:00")).officialMilliseconds,
    3 * 3600000,
  );
});
test("policy history, pinned results, timezone boundaries, defaults and validation", () => {
  assert.deepEqual(attendanceMinimums(cohort), {
    fullDayMinutes: 360,
    halfDayMinutes: 240,
    effectiveDay: null,
  });
  const changed = {
    ...cohort,
    attendanceMinimumsHistory: [
      { effectiveDay: "2026-11-17", fullDayMinutes: 300, halfDayMinutes: 120 },
    ],
  };
  assert.equal(attendanceMinimums(changed, day).fullDayMinutes, 360);
  assert.equal(attendanceMinimums(changed, "2026-11-17").fullDayMinutes, 300);
  assert.equal(
    durationAttendance(
      changed,
      "2026-11-17",
      clock("14:00:00", "2026-11-17"),
      { durationPolicy: { fullDayMinutes: 360, halfDayMinutes: 240 } },
      at("17:00:00", "2026-11-17"),
    ).status,
    "HALF_DAY",
  );
  const utc = {
    ...clock("15:00:00"),
    timeZone: "UTC",
    clockAt: new Date(day + "T09:00:00Z"),
    officialStartAt: new Date(day + "T09:00:00Z"),
    cutoffAt: new Date(day + "T17:00:00Z"),
    clockOutAt: new Date(day + "T15:00:00Z"),
  };
  assert.equal(
    durationAttendance(cohort, day, utc, null, new Date(day + "T17:00:00Z"))
      .officialMinutes,
    360,
  );
  for (const invalid of [
    { fullDayMinutes: 360, halfDayMinutes: 360 },
    { fullDayMinutes: 60, halfDayMinutes: 0 },
    { fullDayMinutes: 481, halfDayMinutes: 240 },
    { fullDayMinutes: "360", halfDayMinutes: 240 },
    { fullDayMinutes: NaN, halfDayMinutes: 240 },
  ])
    assert.throws(() =>
      validateAttendanceMinimums(invalid, cohort.attendanceHours),
    );
  assert.equal(
    attendanceResult(
      {
        ...cohort,
        workingCalendar: {
          dateOverrides: [{ date: day, status: "LEAVE", label: "Leave" }],
        },
      },
      {},
      day,
      clock("15:00:00"),
      { override: "HALF_DAY" },
      at("17:00:00"),
    ).status,
    "DAY_OFF",
  );
});
test(
  "database: CC minimums, finalized policies, full/half/absent, excluded extra play, weighted credit and scoped corrections",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `duration_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const user = (id, role = "GAMER", extra = {}) => ({
      _id: id,
      name: id,
      email: `${id}@example.invalid`,
      role,
      cohortId: "alpha",
      teamId: "duration-team",
      xp: 75,
      trophies: 15,
      ...extra,
    });
    const cc = user("duration-cc", "CENTRE_COMMAND"),
      mc = user("duration-mc", "MISSION_COMMANDER"),
      limited = user("duration-limited", "CENTRE_COMMAND", { permissions: [] });
    const full = user("duration-full"),
      half = user("duration-half"),
      short = user("duration-short"),
      missing = user("duration-missing", "GAMER", { teamId: "other-team" });
    const beta = user("duration-beta", "CENTRE_COMMAND", { cohortId: "beta" });
    const save = (version, fullDayMinutes, halfDayMinutes, when) =>
      calendarAction(
        cc,
        {
          action: "MINIMUMS",
          minimums: { fullDayMinutes, halfDayMinutes },
          reason: "Set official attendance minimum hours.",
          version,
        },
        when,
      );
    try {
      await models.User.insertMany([
        cc,
        mc,
        limited,
        full,
        half,
        short,
        missing,
        beta,
      ]);
      await models.Team.insertMany([
        {
          _id: "duration-team",
          name: "Duration team",
          code: "D",
          cohortId: "alpha",
          commanderId: mc._id,
        },
        {
          _id: "other-team",
          name: "Other team",
          code: "O",
          cohortId: "alpha",
          commanderId: "other-mc",
        },
      ]);
      await models.Cohort.insertMany([
        {
          _id: "alpha",
          name: "Duration alpha",
          college: "Test",
          currentWeek: 2,
          ...cohort,
        },
        { _id: "beta", name: "Duration beta", college: "Test", startDate: day },
      ]);
      await syncAbsences(at("08:00:00"));
      const insertClock = async (
        person,
        stop,
        date = day,
        start = "09:00:00",
      ) =>
        models.Attendance.create({
          _id: `${person._id}:${date}`,
          userId: person._id,
          cohortId: "alpha",
          ...clock(stop, date, start),
          onTime: person._id !== half._id,
        });
      await insertClock(full, "15:00:00");
      await insertClock(half, "13:15:00", day, "09:15:00");
      await insertClock(short, "12:00:00");
      await models.ExtraPlaySession.create({
        _id: "duration-extra",
        userId: short._id,
        cohortId: "alpha",
        attendanceId: `${short._id}:${day}`,
        day,
        startAt: at("17:01:00"),
        endAt: at("23:00:00"),
        state: "OUT",
      });
      const raw = JSON.stringify(
        await models.Attendance.find().sort({ _id: 1 }).lean(),
      );
      const pending = await attendanceRegister(cc, day, at("16:59:59"));
      assert.equal(pending.counts.IN_PROGRESS, 3);
      assert.equal(pending.counts.PENDING, 1);
      assert.equal(pending.percentage, null);
      await Promise.all([
        syncAbsences(at("17:00:00")),
        syncAbsences(at("17:00:00")),
      ]);
      let view = await attendanceRegister(cc, day, at("18:00:00"));
      assert.equal(view.counts.FULL_DAY, 1);
      assert.equal(view.counts.HALF_DAY, 1);
      assert.equal(view.counts.ABSENT, 2);
      assert.equal(view.percentage, 37.5);
      assert.equal(
        view.rows.find((r) => r.userId === short._id).officialMinutes,
        180,
      );
      assert.equal(
        view.rows.find((r) => r.userId === short._id).status,
        "ABSENT",
      );
      assert.equal(
        view.rows.find((r) => r.userId === short._id).extraMinutes,
        59,
      );
      assert.equal(view.rows.find((r) => r.userId === half._id).late, true);
      assert.equal(
        (await attendanceSnapshot(full, at("18:00:00"))).officialAttendance
          .status,
        "FULL_DAY",
      );
      assert.equal(
        (await attendanceSnapshot(half, at("18:00:00"))).officialAttendance
          .status,
        "HALF_DAY",
      );
      await models.Attendance.create({
        _id: "old-expired-missing",
        userId: missing._id,
        cohortId: "alpha",
        ...clock("17:00:00", "2026-11-12"),
        endDecision: "EXPIRED",
      });
      assert.equal(
        (await attendanceSnapshot(missing, at("18:00:00"))).officialAttendance
          .day,
        day,
      );
      assert.equal(
        (await attendanceSnapshot(missing, at("18:00:00"))).officialAttendance
          .status,
        "ABSENT",
      );
      const request = {
        action: "MINIMUMS",
        minimums: { fullDayMinutes: 300, halfDayMinutes: 120 },
        reason: "Updated minimum attendance hours.",
        version: 0,
      };
      for (const actor of [mc, full, limited])
        await assert.rejects(
          calendarAction(actor, request, at("18:00:00")),
          (e) => e.status === 403,
        );
      await assert.rejects(
        calendarAction(cc, { ...request, cohortId: "beta" }, at("18:00:00")),
        (e) => e.status === 400,
      );
      await assert.rejects(
        save(0, 600, 240, at("18:00:00")),
        (e) => e.status === 400,
      );
      const saved = await save(0, 300, 120, at("18:00:00"));
      assert.equal(saved.effectiveDay, "2026-11-17");
      await assert.rejects(
        save(0, 300, 120, at("18:00:00")),
        (e) => e.status === 409,
      );
      assert.equal(
        (await calendarSnapshot(beta, "2026-11")).attendanceMinimums
          .fullDayMinutes,
        360,
      );
      view = await attendanceRegister(cc, day, at("18:01:00"));
      assert.equal(view.percentage, 37.5);
      assert.equal(
        (
          await models.AttendanceResult.findOne({
            userId: short._id,
            day,
          }).lean()
        ).durationPolicy.halfDayMinutes,
        240,
      );
      const correction = {
        userId: short._id,
        day,
        status: "HALF_DAY",
        reason: "Half-day attendance confirmed by assigned MC.",
        version: 0,
      };
      await assert.rejects(
        correctAttendance(
          mc,
          { ...correction, userId: missing._id },
          at("18:00:00"),
        ),
        (e) => e.status === 403,
      );
      await correctAttendance(mc, correction, at("18:00:00"));
      await assert.rejects(
        correctAttendance(cc, correction, at("18:00:00")),
        (e) => e.status === 409,
      );
      view = await attendanceRegister(cc, day, at("18:01:00"));
      assert.equal(view.percentage, 50);
      await syncAbsences(at("18:02:00"));
      assert.equal(
        (await attendanceRegister(mc, day, at("18:02:00"))).rows.find(
          (r) => r.userId === short._id,
        ).status,
        "HALF_DAY",
      );
      const audit = await models.AttendanceCorrection.findOne({
        userId: short._id,
      }).lean();
      assert.equal(audit.before.status, "ABSENT");
      assert.equal(audit.after.status, "HALF_DAY");
      await correctAttendance(
        cc,
        { ...correction, status: "DEFAULT", version: 1 },
        at("18:03:00"),
      );
      assert.equal(
        (await attendanceRegister(cc, day, at("18:03:00"))).rows.find(
          (r) => r.userId === short._id,
        ).status,
        "ABSENT",
      );
      const second = "2026-11-17";
      await insertClock(full, "13:59:00", second);
      await insertClock(half, "11:00:00", second);
      await insertClock(short, "10:00:00", second);
      const changed = await save(1, 240, 90, at("12:00:00", second));
      assert.equal(changed.effectiveDay, second);
      await syncAbsences(at("17:00:00", second));
      view = await attendanceRegister(cc, second, at("17:00:00", second));
      assert.equal(view.counts.FULL_DAY, 1);
      assert.equal(view.counts.HALF_DAY, 1);
      assert.equal(view.percentage, 37.5);
      await assert.rejects(
        calendarAction(
          cc,
          {
            action: "HOURS",
            hours: { startTime: "09:00", endTime: "12:00" },
            reason: "Shorter work shift requested.",
            version: 2,
          },
          at("18:00:00", second),
        ),
        (e) => e.status === 400,
      );
      await save(2, 420, 240, at("18:00:00", second));
      assert.equal(
        (
          await attendanceRegister(cc, second, at("18:01:00", second))
        ).rows.find((r) => r.userId === full._id).status,
        "FULL_DAY",
      );
      assert.equal(
        (
          await models.AttendanceResult.findOne({
            userId: full._id,
            day: second,
          }).lean()
        ).durationPolicy.fullDayMinutes,
        240,
      );
      // Unknown historical clock-out is reviewable and cannot become a guessed full day.
      await models.Attendance.create({
        _id: "duration-unknown",
        userId: full._id,
        cohortId: "alpha",
        day: "2026-11-13",
        clockAt: at("09:00:00", "2026-11-13"),
      });
      const review = await attendanceRegister(
        cc,
        "2026-11-13",
        at("18:00:00", second),
      );
      assert.equal(review.counts.NEEDS_REVIEW, 1);
      assert.equal(review.percentage, null);
      await correctAttendance(
        mc,
        { ...correction, userId: full._id, day: "2026-11-13" },
        at("18:00:00", second),
      );
      assert.equal(
        (
          await attendanceRegister(cc, "2026-11-13", at("18:01:00", second))
        ).rows.find((r) => r.userId === full._id).status,
        "HALF_DAY",
      );
      assert.equal(
        (await models.Attendance.findById("duration-unknown").lean())
          .clockOutAt,
        undefined,
      );
      assert.equal(
        JSON.stringify(
          await models.Attendance.find({ day }).sort({ _id: 1 }).lean(),
        ),
        raw,
      );
      const balance = await models.User.findById(full._id).lean();
      assert.equal(balance.xp, 75);
      assert.equal(balance.trophies, 15);
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
