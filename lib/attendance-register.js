import { createHash, randomUUID } from "node:crypto";
import { connect, models, transaction } from "./db.js";
import { attendanceWindow } from "./attendance-hours.js";
import { calendarDay, validCalendarDate } from "./working-calendar-rules.js";
import {
  attendanceMinimums,
  durationAttendance,
  officialDuration,
} from "./attendance-duration.js";
import {
  cohortOf,
  tenantOf,
  scope,
  demand,
  permitted,
} from "./access-scope.js";

const resultId = (cohort, user, day) =>
  createHash("sha256")
    .update(JSON.stringify([cohort, user, day]))
    .digest("hex");
const previousDay = (day) =>
  new Date(Date.parse(day + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
const nextDay = (day) =>
  new Date(Date.parse(day + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
const startDay = (cohort, user) =>
  validCalendarDate(cohort.attendanceTrackingStartDay) &&
  validCalendarDate(user.attendanceTrackingStartDay)
    ? [
        cohort.startDate,
        cohort.attendanceTrackingStartDay,
        user.attendanceTrackingStartDay,
      ]
        .filter(validCalendarDate)
        .sort()
        .at(-1)
    : null;

export function attendanceResult(cohort, user, day, clock, result, now) {
  const window = attendanceWindow(cohort, now);
  const calendar = calendarDay(cohort.workingCalendar, day);
  if (!calendar.working)
    return { status: "DAY_OFF", label: calendar.label, counted: false };
  if (result?.override) {
    const status = ["PRESENT", "LATE"].includes(result.override)
      ? "FULL_DAY"
      : result.override;
    const duration = officialDuration(cohort, day, clock, now);
    return {
      status,
      label: "Staff correction",
      counted: ["FULL_DAY", "HALF_DAY", "ABSENT"].includes(status),
      credit: status === "FULL_DAY" ? 1 : status === "HALF_DAY" ? 0.5 : 0,
      officialMilliseconds: duration.officialMilliseconds,
      officialMinutes: Math.floor(duration.officialMilliseconds / 60000),
    };
  }
  if (
    !clock?.clockAt &&
    (!startDay(cohort, user) || day < startDay(cohort, user))
  )
    return {
      status: "NOT_TRACKED",
      label: "Before attendance tracking",
      counted: false,
    };
  if (clock?.clockAt)
    return durationAttendance(cohort, day, clock, result, now);
  if (user.active === false && !result?.automaticAbsentAt)
    return { status: "NOT_TRACKED", label: "Inactive account", counted: false };
  // A changed calendar or later end time can reopen today's attendance window.
  const ended =
    day < window.day || (day === window.day && now >= window.cutoffAt);
  if (ended && result?.automaticAbsentAt)
    return {
      status: "ABSENT",
      label: "No clock-in by end of day",
      counted: true,
      credit: 0,
    };
  return { status: "PENDING", label: "Not checked in", counted: false };
}

// Separate daily results never fabricate clock-ins or alter work/reward records.
export async function syncAbsences(
  now = new Date(),
  onlyCohort = null,
  requestedDay = null,
) {
  await connect();
  let marked = 0;
  const cohorts = await models.Cohort.find(
    onlyCohort ? { _id: onlyCohort } : {},
  ).lean();
  for (const initial of cohorts) {
    marked += await transaction(async (session) => {
      let inserted = 0;
      const cohort = await models.Cohort.findOneAndUpdate(
        { _id: initial._id },
        { $inc: { calendarAttendanceLock: 1 } },
        { new: true, session },
      );
      if (!cohort) return 0;
      const window = attendanceWindow(cohort, now);
      const trackingStart =
        now >= window.cutoffAt ? nextDay(window.day) : window.day;
      if (!cohort.attendanceTrackingStartDay)
        cohort.attendanceTrackingStartDay = trackingStart;
      const users = await models.User.find({
        $and: [
          tenantOf({ cohortId: cohort._id }),
          { role: "GAMER", active: { $ne: false } },
        ],
      }).session(session);
      for (const user of users)
        if (!user.attendanceTrackingStartDay) {
          user.attendanceTrackingStartDay = trackingStart;
          await user.save({ session });
        }
      const last =
        now >= window.cutoffAt ? window.day : previousDay(window.day);
      let first = cohort.attendanceAssessedThrough
        ? nextDay(cohort.attendanceAssessedThrough)
        : cohort.attendanceTrackingStartDay;
      // Reconcile today's changes too, without overwriting manual corrections.
      if (first > last && last === window.day) first = window.day;
      if (first < cohort.attendanceTrackingStartDay)
        first = cohort.attendanceTrackingStartDay;
      // Bound a run after prolonged downtime; the durable cursor catches up next tick.
      const dates = [];
      for (
        let day = first;
        day <= last && dates.length < 31;
        day = nextDay(day)
      )
        dates.push(day);
      const through = dates.at(-1);
      if (
        validCalendarDate(requestedDay) &&
        requestedDay >= cohort.attendanceTrackingStartDay &&
        requestedDay <= last &&
        !dates.includes(requestedDay)
      )
        dates.push(requestedDay);
      for (const day of dates) {
        if (validCalendarDate(cohort.startDate) && day < cohort.startDate)
          continue;
        if (calendarDay(cohort.workingCalendar, day).working) {
          const clocks = await models.Attendance.find({
            userId: { $in: users.map((u) => u._id) },
            day,
            clockAt: { $exists: true, $ne: null },
          })
            .session(session)
            .lean();
          const results = await models.AttendanceResult.find({
            cohortId: cohort._id,
            day,
          })
            .session(session)
            .lean();
          for (const user of users) {
            if (day < startDay(cohort, user)) continue;
            const prior = results.find((row) => row.userId === user._id);
            const assessment = durationAttendance(
              cohort,
              day,
              clocks.find((row) => row.userId === user._id),
              prior,
              now,
            );
            if (assessment.provisional) continue;
            const due = assessment.officialCutoffAt;
            const saved = await models.AttendanceResult.updateOne(
              { _id: resultId(cohort._id, user._id, day) },
              [
                {
                  $set: {
                    cohortId: { $literal: cohort._id },
                    userId: { $literal: user._id },
                    day: { $literal: day },
                    version: { $ifNull: ["$version", 0] },
                    automaticStatus: assessment.status,
                    officialMilliseconds: assessment.officialMilliseconds,
                    durationPolicy: {
                      $ifNull: [
                        "$durationPolicy",
                        { $literal: assessment.durationPolicy },
                      ],
                    },
                    assessedAt: due,
                    automaticAbsentAt:
                      assessment.status === "ABSENT"
                        ? day === window.day
                          ? due
                          : { $ifNull: ["$automaticAbsentAt", due] }
                        : { $ifNull: ["$automaticAbsentAt", "$$REMOVE"] },
                  },
                },
              ],
              { upsert: true, session },
            );
            if (saved.upsertedCount && assessment.status === "ABSENT")
              inserted++;
          }
        }
      }
      if (
        through &&
        (!cohort.attendanceAssessedThrough ||
          through > cohort.attendanceAssessedThrough)
      )
        cohort.attendanceAssessedThrough = through;
      await cohort.save({ session });
      return inserted;
    });
  }
  return { markedAbsent: marked };
}

async function staffScope(actor, session = null, writing = false) {
  const access = await scope(actor, session);
  demand(
    ["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(access.user.role),
    "MC or CC access is required.",
    403,
  );
  if (writing)
    demand(
      permitted(access.user, "game:write"),
      "Attendance editing is not permitted for this account.",
      403,
    );
  return access;
}

export async function attendanceRegister(actor, day, now = new Date()) {
  await connect();
  const access = await staffScope(actor);
  const cohortId = cohortOf(access.user);
  demand(!day || validCalendarDate(day), "Choose a valid date.", 400);
  await syncAbsences(now, cohortId, day);
  const cohort = await models.Cohort.findById(cohortId).lean();
  demand(cohort, "Configure the cohort first.", 409);
  const window = attendanceWindow(cohort, now);
  day ||= window.day;
  demand(
    validCalendarDate(day) && day <= window.day,
    "Choose today or an earlier valid date.",
    400,
  );
  const users = await models.User.find({ _id: { $in: access.userIds } })
    .select("name teamId active attendanceTrackingStartDay")
    .sort({ name: 1 })
    .lean();
  const [clocks, results, history] = await Promise.all([
    models.Attendance.find({ userId: { $in: access.userIds }, day }).lean(),
    models.AttendanceResult.find({
      cohortId,
      userId: { $in: access.userIds },
      day,
    }).lean(),
    models.AttendanceCorrection.find({
      cohortId,
      userId: { $in: access.userIds },
      day,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean(),
  ]);
  const actors = await models.User.find({
    _id: { $in: history.map((entry) => entry.actorId) },
  })
    .select("name")
    .lean();
  const extras = await models.ExtraPlaySession.find({
    userId: { $in: access.userIds },
    day,
  }).lean();
  const rows = users.map((user) => {
    const clock = clocks.find((row) => row.userId === user._id);
    const result = results.find((row) => row.userId === user._id);
    return {
      userId: user._id,
      name: user.name,
      team:
        access.teams.find((t) => t._id === user.teamId)?.name || "Unassigned",
      active: user.active !== false,
      ...attendanceResult(cohort, user, day, clock, result, now),
      clockAt: clock?.clockAt || null,
      clockOutAt: clock?.clockOutAt || null,
      late: clock?.onTime === false || result?.override === "LATE",
      extraMinutes: Math.floor(
        extras
          .filter((s) => s.userId === user._id)
          .reduce(
            (total, s) =>
              total +
              Math.max(
                0,
                Math.min(+(s.endAt || s.plannedEndAt || now), +now) -
                  +s.startAt,
              ),
            0,
          ) / 60000,
      ),
      extraActive: extras.some(
        (s) =>
          s.userId === user._id &&
          s.state === "ACTIVE" &&
          (!s.plannedEndAt || s.plannedEndAt > now),
      ),
      source: result?.override
        ? "MANUAL"
        : clock?.clockAt
          ? "CLOCK_IN"
          : "SYSTEM",
      reason: result?.reason || "",
      version: result?.version || 0,
    };
  });
  const counts = Object.fromEntries(
    [
      "FULL_DAY",
      "HALF_DAY",
      "IN_PROGRESS",
      "NEEDS_REVIEW",
      "ABSENT",
      "EXCUSED",
      "PENDING",
      "DAY_OFF",
      "NOT_TRACKED",
    ].map((status) => [status, rows.filter((r) => r.status === status).length]),
  );
  const counted = rows.filter((r) => r.counted).length;
  return {
    day,
    today: window.day,
    timeZone: window.timeZone,
    cohortName: cohort.name,
    trackingStartDay: cohort.attendanceTrackingStartDay,
    hours: { startTime: window.startTime, endTime: window.endTime },
    minimums: attendanceMinimums(cohort, day),
    calendar: calendarDay(cohort.workingCalendar, day),
    canEdit: permitted(access.user, "game:write"),
    counts,
    percentage: counted
      ? Math.round(
          (rows.reduce((total, row) => total + (row.credit || 0), 0) * 1000) /
            counted,
        ) / 10
      : null,
    rows,
    history: history.map(
      ({ userId, before, after, reason, createdAt, actorId }) => ({
        userId,
        before,
        after,
        reason,
        createdAt,
        actorId,
        actorName:
          actors.find((actor) => actor._id === actorId)?.name || actorId,
      }),
    ),
  };
}

export async function correctAttendance(actor, body, now = new Date()) {
  await connect();
  demand(
    body &&
      typeof body === "object" &&
      Object.keys(body).every((k) =>
        ["userId", "day", "status", "reason", "version"].includes(k),
      ),
    "Provide only attendance correction fields.",
    400,
  );
  demand(
    typeof body.userId === "string" &&
      body.userId.length <= 200 &&
      validCalendarDate(body.day),
    "Choose a player and valid date.",
    400,
  );
  demand(
    [
      "PRESENT",
      "LATE",
      "FULL_DAY",
      "HALF_DAY",
      "ABSENT",
      "EXCUSED",
      "DEFAULT",
    ].includes(body.status),
    "Choose a valid attendance result.",
    400,
  );
  demand(
    Number.isInteger(body.version) && body.version >= 0,
    "Refresh attendance before saving.",
    400,
  );
  demand(
    typeof body.reason === "string" &&
      body.reason.trim().length >= 5 &&
      body.reason.length <= 1000,
    "Enter a correction reason (5–1000 characters).",
    400,
  );
  return transaction(async (session) => {
    const access = await staffScope(actor, session, true);
    demand(
      access.userIds.includes(body.userId),
      "This player is outside your assigned scope.",
      403,
    );
    const cohortId = cohortOf(access.user);
    const cohort = await models.Cohort.findOneAndUpdate(
      { _id: cohortId },
      { $inc: { calendarAttendanceLock: 1 } },
      { new: true, session },
    ).lean();
    demand(cohort, "Configure the cohort first.", 409);
    const user = await models.User.findById(body.userId)
      .session(session)
      .lean();
    const clock = await models.Attendance.findOne({
      userId: body.userId,
      day: body.day,
    })
      .session(session)
      .lean();
    const window = attendanceWindow(cohort, now);
    demand(
      body.day <= window.day,
      "Future attendance cannot be corrected.",
      400,
    );
    demand(
      !validCalendarDate(cohort.startDate) || body.day >= cohort.startDate,
      "This date is before the cohort began.",
      409,
    );
    demand(
      body.status === "DEFAULT" ||
        calendarDay(cohort.workingCalendar, body.day).working,
      "Leave days are excluded from attendance. Change the calendar first.",
      409,
    );
    const id = resultId(cohortId, body.userId, body.day);
    let result = await models.AttendanceResult.findById(id).session(session);
    demand(
      (result?.version || 0) === body.version,
      "Attendance changed. Refresh and try again.",
      409,
    );
    const before = attendanceResult(cohort, user, body.day, clock, result, now);
    result ||= new models.AttendanceResult({
      _id: id,
      cohortId,
      userId: body.userId,
      day: body.day,
    });
    result.override = body.status === "DEFAULT" ? undefined : body.status;
    result.reason = body.reason.trim();
    result.updatedBy = access.user._id;
    result.updatedAt = now;
    result.version = body.version + 1;
    await result.save({ session });
    const after = attendanceResult(cohort, user, body.day, clock, result, now);
    await models.AttendanceCorrection.create(
      [
        {
          _id: randomUUID(),
          cohortId,
          userId: user._id,
          day: body.day,
          actorId: access.user._id,
          before,
          after,
          reason: body.reason.trim(),
          createdAt: now,
          version: result.version,
        },
      ],
      { session },
    );
    return { success: true, version: result.version, status: after.status };
  });
}
