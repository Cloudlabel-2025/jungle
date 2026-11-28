import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  calendarDay,
  calendarBase,
  monthDates,
  validCalendarDate,
  validateDateOverrides,
} from "../lib/working-calendar-rules.js";
import { working, workingAt } from "../lib/pilot-calendar.js";
import { workingDueAt } from "../lib/support-rules.js";
import { workingMinutes } from "../lib/day-one-rules.js";
import {
  calendarAction,
  calendarSnapshot,
  requireWorkingDay,
} from "../lib/cohort-calendar.js";
import {
  attendanceAction,
  attendanceSnapshot,
  syncAttendance,
} from "../lib/attendance.js";
import {
  attendanceHours,
  attendanceWindow,
  validateAttendanceHours,
} from "../lib/attendance-hours.js";
import { attendanceRule } from "../lib/rules.js";
import { dayOneAction } from "../lib/day-one.js";
import { models, connect } from "../lib/db.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { supportAction } from "../lib/support.js";
import { programAction } from "../lib/week-one-program.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { flightApiAllowed, flightScreens } from "../lib/flight-rules.js";
import { isWorkspaceScreen } from "../lib/workspace-navigation.js";

const base = {
  timeZone: "Asia/Kolkata",
  weekdays: [1, 2, 3, 4, 5],
  holidays: ["2026-11-16"],
  startMinute: 540,
};
const at = (date, time = "09:00") => new Date(`${date}T${time}:00+05:30`);
test("attendance hours default to 09–17, validate changes, use cohort timezone and move lateness with start", () => {
  assert.deepEqual(attendanceHours(), { startTime: "09:00", endTime: "17:00" });
  for (const hours of [
    { startTime: "25:00", endTime: "17:00" },
    { startTime: "17:00", endTime: "09:00" },
    { startTime: "09:00", endTime: "09:00" },
  ])
    assert.throws(() => validateAttendanceHours(hours));
  const window = attendanceWindow(
    {
      workingCalendar: { timeZone: "UTC" },
      attendanceHours: { startTime: "10:00", endTime: "16:00" },
    },
    new Date("2026-11-16T11:00:00Z"),
  );
  assert.equal(window.startAt.toISOString(), "2026-11-16T10:00:00.000Z");
  assert.equal(window.cutoffAt.toISOString(), "2026-11-16T16:00:00.000Z");
  assert.equal(attendanceRule(window.startAt, "", window).onTime, true);
  assert.throws(() =>
    attendanceRule(new Date(+window.startAt + 16 * 60000), "", window),
  );
});
test("working date overrides take priority over holidays/weekends, with real date validation", () => {
  assert.equal(calendarDay(base, "2026-11-16").working, false);
  assert.equal(calendarDay(base, "2026-11-15").working, false);
  const dateOverrides = [
    { date: "2026-11-15", status: "WORKING", label: "Replacement session" },
    { date: "2026-11-16", status: "WORKING", label: "Working day" },
    { date: "2026-11-17", status: "LEAVE", label: "Centre leave" },
  ];
  validateDateOverrides(dateOverrides);
  const c = { ...base, dateOverrides };
  assert.equal(calendarDay(c, "2026-11-15").working, true);
  assert.equal(calendarDay(c, "2026-11-16").working, true);
  assert.equal(calendarDay(c, "2026-11-17").working, false);
  assert.equal(monthDates("2028-02").length, 29);
  assert.equal(monthDates("2026-02").length, 28);
  for (const date of ["2026-02-30", "2026-13-01", "2026-11-1", {}, null])
    assert.equal(validCalendarDate(date), false);
  assert.throws(() => monthDates("2026-13"));
  assert.throws(() =>
    validateDateOverrides([...dateOverrides, dateOverrides[0]]),
  );
  assert.throws(() =>
    validateDateOverrides([
      { date: "2026-02-30", status: "LEAVE", label: "Invalid" },
    ]),
  );
  assert.equal(
    calendarDay(calendarBase(), "2026-11-15").working,
    true,
    "Unconfigured cohorts retain existing all-day availability",
  );
});
test("working-time calculations respect leave and replacement working days, including frozen copies", () => {
  const c = {
    ...base,
    holidays: [],
    dateOverrides: [
      { date: "2026-11-15", status: "WORKING", label: "Session" },
      { date: "2026-11-16", status: "LEAVE", label: "Leave" },
    ],
  };
  assert.equal(working(at("2026-11-15"), c), true);
  assert.equal(working(at("2026-11-16"), c), false);
  assert.equal(
    workingAt(at("2026-11-15", "16:30"), c, 60),
    at("2026-11-17", "09:30").toISOString(),
  );
  assert.equal(
    workingDueAt(at("2026-11-15", "16:30"), c, 60).toISOString(),
    at("2026-11-17", "09:30").toISOString(),
  );
  assert.equal(
    workingMinutes(at("2026-11-15"), at("2026-11-15", "10:00"), {
      ...c,
      startTime: "09:00",
      endTime: "17:00",
    }),
    60,
  );
  const pinned = structuredClone(c);
  c.dateOverrides = [];
  assert.equal(working(at("2026-11-16"), pinned), false);
});
test("calendar navigation is available to all roles; flight players can only read its API", () => {
  for (const role of ["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"])
    assert.equal(isWorkspaceScreen(role, "calendar"), true);
  assert.equal(flightScreens.has("calendar"), true);
  assert.equal(flightApiAllowed("calendar", "GET", true), true);
  assert.equal(flightApiAllowed("calendar", "POST", true), false);
});

test(
  "database calendar: CC-only changes, scope, concurrency, holiday clock-in, conversion, audit and preservation",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `calendar_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const player = {
      _id: "cal-player",
      name: "Calendar Player",
      email: "cal-p@example.invalid",
      role: "GAMER",
      cohortId: "alpha",
      xp: 75,
      trophies: 15,
    };
    const cc = {
      _id: "cal-cc",
      name: "Calendar CC",
      email: "cal-cc@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const mc = {
      ...cc,
      _id: "cal-mc",
      email: "cal-mc@example.invalid",
      role: "MISSION_COMMANDER",
    };
    const other = {
      ...cc,
      _id: "cal-other",
      email: "cal-other@example.invalid",
      cohortId: "beta",
    };
    const limited = {
      ...cc,
      _id: "cal-limited",
      email: "cal-limited@example.invalid",
      permissions: [],
    };
    const change = (
      version,
      status,
      date = "2026-11-16",
      label = status === "LEAVE" ? "Centre holiday" : "Replacement session",
    ) => ({ date, status, label, reason: "Calendar test by CC", version });
    try {
      await models.User.insertMany([player, cc, mc, other, limited]);
      await models.Cohort.insertMany([
        {
          _id: "alpha",
          name: "Calendar Alpha",
          college: "Test",
          startDate: "2026-11-01",
          currentWeek: 1,
          workingCalendar: { ...base, holidays: [] },
        },
        {
          _id: "beta",
          name: "Calendar Beta",
          college: "Test",
          startDate: "2026-11-01",
          currentWeek: 1,
        },
      ]);
      const config = {
        ...fixtureConfig(),
        day: "2026-11-16",
        officialStart: at("2026-11-16").toISOString(),
        availableAt: at("2026-11-16").toISOString(),
        clockCutoff: at("2026-11-16", "09:15").toISOString(),
        closingCutoff: at("2026-11-16", "17:00").toISOString(),
      };
      const program = blankProgram();
      program.progressionMode = "SCHEDULED";
      await models.WeekOneProgram.create({
        _id: "alpha",
        version: 0,
        data: program,
      });
      await models.WeekOneRelease.create({
        _id: "alpha",
        days: [
          {
            day: 1,
            title: "First discovery",
            state: "OPEN",
            content: config,
            officialStart: config.officialStart,
            openedAt: config.officialStart,
            scheduledEnd: config.closingCutoff,
          },
        ],
      });
      await models.DayOneSetup.create({
        _id: "alpha",
        released: config,
        draft: config,
      });
      await models.Attendance.create({
        _id: "cal-past",
        userId: player._id,
        cohortId: "alpha",
        day: "2026-11-13",
        clockAt: at("2026-11-13"),
        sessionState: "OUT",
        clockOutAt: at("2026-11-13", "17:00"),
      });
      const savedAttendance = JSON.stringify(
        await models.Attendance.find().lean(),
      );
      for (const actor of [player, mc, limited])
        await assert.rejects(
          calendarAction(actor, change(0, "LEAVE")),
          (e) => e.status === 403,
        );
      await assert.rejects(
        calendarAction(cc, { ...change(0, "LEAVE"), cohortId: "beta" }),
        (e) => e.status === 400,
      );
      await calendarAction(cc, change(0, "LEAVE"));
      assert.equal(
        (await calendarSnapshot(player, "2026-11")).days.find(
          (d) => d.date === "2026-11-16",
        ).working,
        false,
      );
      assert.equal(
        (await calendarSnapshot(player, "2026-11")).history.length,
        0,
      );
      assert.equal((await calendarSnapshot(mc, "2026-11")).canEdit, false);
      assert.equal((await calendarSnapshot(other, "2026-11")).version, 0);
      await assert.rejects(
        calendarAction(cc, change(0, "WORKING")),
        (e) => e.status === 409,
      );
      // Free first-part play ignores attendance dates; scheduled programmes do not.
      await models.WeekOneProgram.updateOne({_id:"alpha"},{$set:{"data.progressionMode":"COMPLETION"}});
      const freePlay=await attendanceSnapshot(player,at("2026-11-16"));
      assert.equal(freePlay.available,true);
      assert.equal(freePlay.attendanceRequired,false);
      await models.WeekOneProgram.updateOne({_id:"alpha"},{$set:{"data.progressionMode":"SCHEDULED"}});
      assert.equal(
        (await attendanceSnapshot(player, at("2026-11-16"))).available,
        false,
      );
      await assert.rejects(
        attendanceAction(player, "clock-in", {}, at("2026-11-16")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        dayOneAction(player, "clock", {}, at("2026-11-16")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        requireWorkingDay(player, at("2026-11-16")),
        (e) => e.status === 409,
      );
      assert.equal(
        JSON.stringify(await models.Attendance.find().lean()),
        savedAttendance,
      );
      await calendarAction(cc, change(1, "WORKING"));
      assert.equal(
        (await attendanceSnapshot(player, at("2026-11-16"))).available,
        true,
      );
      await attendanceAction(player, "clock-in", {}, at("2026-11-16"));
      assert.equal(
        await models.Attendance.countDocuments({
          userId: player._id,
          day: "2026-11-16",
        }),
        1,
      );
      // A retrospective calendar edit preserves actual work and attendance.
      await calendarAction(cc, change(2, "LEAVE"));
      await models.DayOneRecord.updateOne(
        { cohortId: "alpha", userId: player._id },
        { $set: { "data.levelOne.override": { completed: true, stars: 1 } } },
      );
      await models.WeekOneRelease.updateOne(
        { _id: "alpha" },
        {
          $push: {
            days: {
              day: 2,
              title: "Explore",
              state: "OPEN",
              content: starterFlightContent(2, config),
              officialStart: config.officialStart,
            },
          },
        },
      );
      await assert.rejects(
        programAction(player, "clock", { day: 2 }, at("2026-11-16")),
        (e) => e.status === 409 && e.message.includes("Centre holiday"),
      );
      assert.equal(
        await models.Attendance.countDocuments({
          userId: player._id,
          day: "2026-11-16",
        }),
        1,
      );
      await attendanceAction(
        player,
        "clock-out",
        {},
        at("2026-11-16", "10:00"),
      );
      await calendarAction(cc, change(3, "WORKING", "2026-11-15"));
      assert.equal(
        (await calendarSnapshot(player, "2026-11")).days.find(
          (d) => d.date === "2026-11-15",
        ).working,
        true,
      );
      await calendarAction(cc, change(4, "DEFAULT", "2026-11-15"));
      assert.equal(
        (await calendarSnapshot(player, "2026-11")).days.find(
          (d) => d.date === "2026-11-15",
        ).working,
        false,
      );
      // The older working-hours form cannot silently erase date exceptions.
      await assert.rejects(
        supportAction(limited, "calendar", {
          calendar: { ...base, holidays: [] },
        }),
        (e) => e.status === 403,
      );
      await supportAction(cc, "calendar", {
        calendar: { ...base, holidays: [] },
      });
      assert.equal(
        (await calendarSnapshot(cc, "2026-11")).days.find(
          (d) => d.date === "2026-11-16",
        ).working,
        false,
      );
      const version = (await calendarSnapshot(cc, "2026-11")).version;
      const competing = await Promise.allSettled([
        calendarAction(cc, change(version, "WORKING", "2026-11-17")),
        calendarAction(cc, change(version, "LEAVE", "2026-11-18")),
      ]);
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        competing.find((r) => r.status === "rejected").reason.status,
        409,
      );
      const view = await calendarSnapshot(cc, "2026-11");
      assert.equal(view.history.length, 6);
      assert.equal(view.canEdit, true);
      const balance = await models.User.findById(player._id).lean();
      assert.equal(balance.xp, 75);
      assert.equal(balance.trophies, 15);
      const hoursChange = {
        action: "HOURS",
        hours: { startTime: "10:00", endTime: "16:00" },
        reason: "Adjusted cohort hours",
        version: view.version,
      };
      for (const actor of [player, limited])
        await assert.rejects(
          calendarAction(actor, hoursChange),
          (e) => e.status === 403,
        );
      await assert.rejects(
        calendarAction(cc, {
          ...hoursChange,
          hours: { startTime: "18:00", endTime: "09:00" },
        }),
        (e) => e.status === 400,
      );
      await calendarAction(cc, hoursChange, at("2026-11-16", "09:00"));
      assert.deepEqual(
        (await calendarSnapshot(player, "2026-11")).attendanceHours,
        hoursChange.hours,
      );
      await assert.rejects(
        calendarAction(cc, hoursChange),
        (e) => e.status === 409,
      );
      await calendarAction(cc, change(view.version + 1, "WORKING"));
      assert.equal(
        (await attendanceSnapshot(player, at("2026-11-16", "09:59"))).available,
        false,
      );
      await assert.rejects(
        attendanceAction(player, "clock-in", {}, at("2026-11-16", "09:59")),
        (e) => e.status === 409,
      );
      await assert.rejects(
        requireWorkingDay(player, at("2026-11-16", "16:00")),
        (e) => e.status === 409,
      );
      await attendanceAction(player, "clock-in", {}, at("2026-11-16", "10:00"));
      assert.deepEqual(
        (await attendanceSnapshot(player, at("2026-11-16", "10:00"))).cutoffAt,
        at("2026-11-16", "16:00"),
      );
      // Today's pending check follows an edit; historical rows are not rewritten.
      await calendarAction(
        cc,
        {
          ...hoursChange,
          hours: { startTime: "10:00", endTime: "15:00" },
          version: view.version + 2,
        },
        at("2026-11-16", "14:00"),
      );
      assert.deepEqual(
        (
          await models.Attendance.findOne({
            userId: player._id,
            day: "2026-11-16",
          }).lean()
        ).checkDueAt,
        at("2026-11-16", "15:00"),
      );
      await syncAttendance(at("2026-11-16", "14:59"));
      assert.equal(
        (await attendanceSnapshot(player, at("2026-11-16", "14:59")))
          .responseDeadline,
        null,
      );
      assert.deepEqual(
        (await attendanceSnapshot(player, at("2026-11-16", "15:00")))
          .responseDeadline,
        at("2026-11-16", "15:02"),
      );
      await attendanceAction(player, "stay", {}, at("2026-11-16", "15:01"));
      // Extra play stays separate when CC changes hours after official attendance closed.
      await calendarAction(
        cc,
        {
          ...hoursChange,
          hours: { startTime: "10:00", endTime: "18:00" },
          version: view.version + 3,
        },
        at("2026-11-16", "15:01"),
      );
      assert.deepEqual(
        (
          await models.Attendance.findOne({
            userId: player._id,
            day: "2026-11-16",
          }).lean()
        ).checkDueAt,
        at("2026-11-16", "15:00"),
      );
      await syncAttendance(at("2026-11-16", "15:02"));
      assert.equal(
        (await attendanceSnapshot(player, at("2026-11-16", "15:02"))).state,
        "EXTRA",
      );
      await syncAttendance(at("2026-11-16", "15:33"));
      assert.deepEqual(
        (await attendanceSnapshot(player, at("2026-11-16", "15:33")))
          .clockOutAt,
        at("2026-11-16", "15:00"),
      );
      assert.deepEqual(
        (await models.Attendance.findById("cal-past").lean()).clockOutAt,
        at("2026-11-13", "17:00"),
      );
      await models.User.updateOne({ _id: cc._id }, { $set: { active: false } });
      await assert.rejects(
        calendarAction(cc, change(view.version, "LEAVE")),
        (e) => e.status === 403,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
