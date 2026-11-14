import { randomUUID } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { localParts } from "./day-one-rules.js";
import { scheduleInstant } from "./day-one-setup.js";
import { playerStage } from "./player-stage.js";
import { dayOneAction } from "./day-one.js";
import { completionBased } from "./flight-progression.js";
import { attendanceRule } from "./rules.js";
import { award, deduct } from "./engine.js";

import { RESPONSE_MS, CONTINUE_MS } from "./attendance-policy.js";
export { RESPONSE_MS, CONTINUE_MS } from "./attendance-policy.js";
const fail = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};

// Only server time and released cohort schedules determine attendance deadlines.
async function context(user, now, story) {
  const cohortId = user.cohortId || "alpha";
  const [release, cohort, program] = await Promise.all([
    models.WeekOneRelease.findById(cohortId).lean(),
    models.Cohort.findById(cohortId).lean(),
    models.WeekOneProgram.findById(cohortId).lean(),
  ]);
  const open = release?.days?.find((d) => d.state === "OPEN");
  const zone =
    open?.content?.timeZone ||
    cohort?.workingCalendar?.timeZone ||
    "Asia/Kolkata";
  const local = localParts(now, zone);
  const flight = (story || (await playerStage(user))).flight;
  if (flight && completionBased(program?.data)) {
    const nextDay = new Date(Date.parse(local.day) + 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      cohortId,
      day: local.day,
      zone,
      available: Boolean(release?.days[0]?.content),
      flight,
      dayNumber: 1,
      cutoffAt: new Date(scheduleInstant(nextDay, "00:00", zone)),
      reason: release?.days[0]?.content
        ? ""
        : "Your first mission is being prepared.",
    };
  }
  if (flight) {
    const scheduledDay =
      typeof open?.content?.day === "string"
        ? open.content.day
        : open?.officialStart || open?.content?.officialStart
          ? localParts(open.officialStart || open.content.officialStart, zone)
              .day
          : null;
    const cutoff = open?.scheduledEnd || open?.content?.closingCutoff;
    const available = Boolean(
      open &&
      scheduledDay === local.day &&
      cutoff &&
      Number.isFinite(Date.parse(cutoff)),
    );
    return {
      cohortId,
      day: local.day,
      zone,
      available,
      flight,
      dayNumber: open?.day,
      cutoffAt: available ? new Date(cutoff) : null,
      reason: available
        ? ""
        : open && scheduledDay && scheduledDay !== local.day
          ? `Day ${open.day} is scheduled for ${scheduledDay} (${zone}). Clock-in is available on that date. Ask MC or CC to check the schedule.`
          : "Your next day has not opened yet. Ask MC or CC to release the day's schedule.",
    };
  }
  const calendar = cohort?.workingCalendar;
  const intervals = calendar?.intervals;
  const end = intervals?.length
    ? Math.max(...intervals.map((i) => i.endMinute))
    : 18 * 60;
  const endTime =
    end === 1440
      ? "00:00"
      : `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  const endDay =
    end === 1440
      ? new Date(Date.parse(local.day) + 86400000).toISOString().slice(0, 10)
      : local.day;
  const available =
    (!calendar?.weekdays?.length ||
      calendar.weekdays.includes(local.weekday)) &&
    !(calendar?.holidays || []).includes(local.day);
  return {
    cohortId,
    day: local.day,
    zone,
    available,
    flight,
    cutoffAt: new Date(scheduleInstant(endDay, endTime, zone)),
    reason: available ? "" : "Today is outside your cohort's working calendar.",
  };
}

export async function syncAttendance(now = new Date(), filter = {}) {
  await connect();
  // The due time is fixed even if the browser is closed or a worker runs late.
  await models.Attendance.updateMany(
    {
      ...filter,
      sessionState: "ACTIVE",
      warningAt: { $exists: false },
      checkDueAt: { $lte: now },
    },
    [
      {
        $set: {
          warningAt: "$checkDueAt",
          responseDeadline: { $add: ["$checkDueAt", RESPONSE_MS] },
        },
      },
    ],
  );
  const result = await models.Attendance.updateMany(
    { ...filter, sessionState: "ACTIVE", responseDeadline: { $lte: now } },
    [
      {
        $set: {
          sessionState: "OUT",
          clockOutAt: "$responseDeadline",
          clockOutReason: "TIMEOUT",
          sessionEvents: {
            $concatArrays: [
              { $ifNull: ["$sessionEvents", []] },
              [{ type: "OUT", at: "$responseDeadline", source: "TIMEOUT" }],
            ],
          },
        },
      },
    ],
  );
  return { clockedOut: result.modifiedCount };
}

export async function attendanceSnapshot(user, now = new Date(), story) {
  if (user.role !== "GAMER") return null;
  await connect();
  const c = await context(user, now, story);
  const filter = { userId: user._id };
  // Adopt attendance from existing Day 1 and expedition check-in controls.
  if (c.available)
    await models.Attendance.updateOne(
      { userId: user._id, day: c.day, sessionState: { $exists: false } },
      {
        $set: {
          cohortId: c.cohortId,
          timeZone: c.zone,
          sessionState: "ACTIVE",
          cutoffAt: c.cutoffAt,
          checkDueAt: c.cutoffAt,
        },
      },
    );
  await syncAttendance(now, filter);
  const todayRecord = await models.Attendance.findOne({
    userId: user._id,
    day: c.day,
  }).lean();
  const record =
    todayRecord?.sessionState === "ACTIVE"
      ? todayRecord
      : (await models.Attendance.findOne({
          userId: user._id,
          sessionState: "ACTIVE",
        })
          .sort({ clockAt: -1 })
          .lean()) || todayRecord;
  // Surface an overnight timeout once, even if the player returns on the next day.
  const last =
    record ||
    (await models.Attendance.findOne({
      userId: user._id,
      clockOutReason: "TIMEOUT",
    })
      .sort({ clockOutAt: -1 })
      .lean());
  const hasClockedIn = Boolean(
    record?.clockAt ||
    last?.clockAt ||
    (await models.Attendance.exists({
      userId: user._id,
      clockAt: { $exists: true, $ne: null },
    })),
  );
  return {
    day: c.day,
    timeZone: c.zone,
    available: c.available,
    reason: c.reason,
    cutoffAt: c.cutoffAt,
    state: record?.sessionState || "NOT_IN",
    hasClockedIn,
    clockAt: record?.clockAt || null,
    clockOutAt: last?.clockOutAt || null,
    clockOutReason: last?.clockOutReason || null,
    warningAt:
      record?.sessionState === "ACTIVE" ? record.warningAt || null : null,
    responseDeadline:
      record?.sessionState === "ACTIVE"
        ? record.responseDeadline || null
        : null,
    responseMinutes: RESPONSE_MS / 60000,
    continueMinutes: CONTINUE_MS / 60000,
  };
}

export async function attendanceAction(
  actor,
  action,
  body = {},
  now = new Date(),
) {
  if (actor.role !== "GAMER" || actor.active === false)
    fail("An active Player account is required.", 403);
  if (!["clock-in", "clock-out", "stay"].includes(action))
    fail("Unknown attendance action.", 404);
  if (Object.keys(body).some((k) => k !== "latenessReason"))
    fail("Attendance accepts no identity or deadline overrides.", 400);
  if (
    body.latenessReason != null &&
    (typeof body.latenessReason !== "string" ||
      body.latenessReason.length > 2000)
  )
    fail("Enter a short lateness reason.", 400);
  await connect();
  const user = await models.User.findById(actor._id).lean();
  if (!user || user.role !== "GAMER" || user.active === false)
    fail("An active Player account is required.", 403);
  await syncAttendance(now, { userId: user._id });
  const c = await context(user, now);
  if (action === "clock-in") {
    if (!c.available) fail(c.reason);
    const existing = await models.Attendance.findOne({
      userId: user._id,
      day: c.day,
    }).lean();
    if (!existing && now >= c.cutoffAt)
      fail("Today's clock-in window has ended. Ask MC about the next session.");
    // Reuse the established Week 1 attendance record and its reward behavior.
    if (c.flight && c.dayNumber === 1)
      await dayOneAction(user, "clock", {}, now);
  }
  return transaction(async (session) => {
    const current = await models.User.findById(user._id)
      .session(session)
      .lean();
    if (!current || current.active === false || current.role !== "GAMER")
      fail("An active Player account is required.", 403);
    // Serialize competing tabs and keep attendance rewards unique.
    await models.User.updateOne(
      { _id: user._id },
      { $inc: { effortLock: 1 } },
      { session },
    );
    let row = await models.Attendance.findOne({
      userId: user._id,
      day: c.day,
    }).session(session);
    if (!row || row.sessionState !== "ACTIVE")
      row =
        (await models.Attendance.findOne({
          userId: user._id,
          sessionState: "ACTIVE",
        })
          .sort({ clockAt: -1 })
          .session(session)) || row;
    if (action === "clock-in") {
      if (row?.sessionState === "ACTIVE") return { success: true };
      if (!row) {
        let onTime = true;
        if (!c.flight) {
          try {
            ({ onTime } = attendanceRule(now, body.latenessReason || ""));
          } catch (error) {
            fail(error.message, 400);
          }
        }
        row = new models.Attendance({
          _id: randomUUID(),
          userId: user._id,
          day: c.day,
          clockAt: now,
          onTime,
          reason: body.latenessReason || "",
        });
        if (!c.flight) {
          if (onTime)
            await award(
              user._id,
              1,
              "On-time punch-in",
              `attendance:${user._id}:${c.day}`,
              session,
            );
          else
            await deduct(
              user._id,
              "Late attendance",
              1,
              `late:${user._id}:${c.day}`,
              session,
            );
        }
      }
      row.cohortId = c.cohortId;
      row.timeZone = c.zone;
      row.sessionState = "ACTIVE";
      row.cutoffAt = c.cutoffAt;
      row.checkDueAt =
        now < c.cutoffAt ? c.cutoffAt : new Date(now.getTime() + CONTINUE_MS);
      row.warningAt = undefined;
      row.responseDeadline = undefined;
      row.clockOutAt = undefined;
      row.clockOutReason = undefined;
      row.sessionEvents.push({ type: "IN", at: now, source: "PLAYER" });
    } else {
      if (!row || row.sessionState !== "ACTIVE") {
        if (action === "clock-out") return { success: true };
        fail("You have already been clocked out. Clock in again to resume.");
      }
      if (action === "stay") {
        if (!row.responseDeadline || now >= row.responseDeadline)
          fail("This check has ended. Clock in again to resume.");
        row.checkDueAt = new Date(now.getTime() + CONTINUE_MS);
        row.warningAt = undefined;
        row.responseDeadline = undefined;
        row.sessionEvents.push({ type: "STAY", at: now, source: "PLAYER" });
      } else {
        row.sessionState = "OUT";
        row.clockOutAt = now;
        row.clockOutReason = "MANUAL";
        row.warningAt = undefined;
        row.responseDeadline = undefined;
        row.sessionEvents.push({ type: "OUT", at: now, source: "MANUAL" });
      }
    }
    await row.save({ session });
    return { success: true };
  });
}
