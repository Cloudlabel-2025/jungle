import { randomUUID } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { cohortOf, permitted, demand } from "./access-scope.js";
import {
  calendarBase,
  calendarDay,
  validCalendarDate,
  monthDates,
} from "./working-calendar-rules.js";
import { localParts } from "./day-one-rules.js";
import {
  attendanceMinimums,
  validateAttendanceMinimums,
} from "./attendance-duration.js";
import {
  attendanceHours,
  attendanceWindow,
  validateAttendanceHours,
} from "./attendance-hours.js";

async function calendarUser(actor, session = null) {
  const user = await models.User.findById(actor?._id).session(session).lean();
  demand(user && user.active !== false, "An active account is required.", 403);
  demand(["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"].includes(user.role));
  return user;
}

export async function requireWorkingDay(
  user,
  now = new Date(),
  session = null,
  allowUat = false,
) {
  // Serialize clock-in with CC calendar edits, including competing tabs.
  const cohort = session
    ? await models.Cohort.findOneAndUpdate(
        { _id: cohortOf(user) },
        { $inc: { calendarAttendanceLock: 1 } },
        { new: true, session },
      ).lean()
    : await models.Cohort.findById(cohortOf(user)).lean();
  const calendar = calendarBase(cohort?.workingCalendar);
  const date = localParts(now, calendar.timeZone).day;
  const window = attendanceWindow(cohort, now);
  if (
    allowUat &&
    (await models.ExtraPlaySession.exists({
      userId: user._id,
      cohortId: cohortOf(user),
      purpose: "UAT",
      state: "ACTIVE",
      plannedEndAt: { $gt: now },
    }).session(session))
  )
    return { date, calendar, ...window, uat: true };
  const status = calendarDay(calendar, date);
  demand(
    status.working,
    `${date} is ${status.label}. Clock-in is unavailable; CC can change this in Calendar.`,
    409,
  );
  demand(
    now >= window.startAt && now < window.cutoffAt,
    `Clock-in is available from ${window.startTime} to ${window.endTime} (${window.timeZone}).`,
    409,
  );
  return { date, calendar, ...window };
}

export async function calendarSnapshot(actor, month, now = new Date()) {
  await connect();
  const user = await calendarUser(actor),
    cohortId = cohortOf(user);
  const cohort = await models.Cohort.findById(cohortId).lean();
  const calendar = calendarBase(cohort?.workingCalendar);
  const today = localParts(now, calendar.timeZone).day;
  month ||= today.slice(0, 7);
  const dates = monthDates(month);
  const canEdit =
    user.role === "CENTRE_COMMAND" && permitted(user, "game:write");
  const history = canEdit
    ? await models.CalendarEvent.find({
        cohortId,
        date: { $gte: dates[0], $lte: dates.at(-1) },
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(30)
        .lean()
    : [];
  return {
    month,
    today,
    timeZone: calendar.timeZone,
    attendanceHours: attendanceHours(cohort),
    attendanceMinimums: attendanceMinimums(cohort),
    weekdays: calendar.weekdays,
    cohortName: cohort?.name || "Your cohort",
    version: cohort?.calendarVersion || 0,
    canEdit,
    days: dates.map((date) => ({ date, ...calendarDay(calendar, date) })),
    history: history.map(({ date, before, after, reason, createdAt }) => ({
      date,
      before,
      after,
      reason,
      createdAt,
    })),
  };
}

export async function calendarAction(actor, body, now = new Date()) {
  await connect();
  if (body?.action === "HOURS") return saveAttendanceHours(actor, body, now);
  if (body?.action === "MINIMUMS")
    return saveAttendanceMinimums(actor, body, now);
  demand(
    body && typeof body === "object" && !Array.isArray(body),
    "Provide a calendar change.",
    400,
  );
  demand(
    Object.keys(body).every((key) =>
      ["date", "status", "label", "reason", "version"].includes(key),
    ),
    "Calendar accepts no member or cohort overrides.",
    400,
  );
  demand(validCalendarDate(body.date), "Choose a valid date.", 400);
  demand(
    ["LEAVE", "WORKING", "DEFAULT"].includes(body.status),
    "Choose leave, working day or default.",
    400,
  );
  demand(
    Number.isInteger(body.version) && body.version >= 0,
    "Refresh the calendar before saving.",
    400,
  );
  demand(
    typeof body.reason === "string" &&
      body.reason.trim().length >= 5 &&
      body.reason.length <= 1000,
    "Enter a reason (5–1000 characters).",
    400,
  );
  const label = body.status === "DEFAULT" ? "" : body.label;
  demand(
    body.status === "DEFAULT" ||
      (typeof label === "string" &&
        label.trim().length > 0 &&
        label.length <= 100),
    "Enter a short calendar label (1–100 characters).",
    400,
  );
  return transaction(async (session) => {
    const user = await calendarUser(actor, session);
    demand(
      user.role === "CENTRE_COMMAND" && permitted(user, "game:write"),
      "Only CC can change the cohort calendar.",
      403,
    );
    const cohortId = cohortOf(user);
    const cohort = await models.Cohort.findById(cohortId).session(session);
    demand(cohort, "Configure your cohort in Expedition setup first.", 409);
    demand(
      (cohort.calendarVersion || 0) === body.version,
      "The calendar changed. Refresh and try again.",
      409,
    );
    const calendar = calendarBase(cohort.workingCalendar?.toObject());
    const before = calendarDay(calendar, body.date);
    const overrides = (calendar.dateOverrides || []).filter(
      (row) => row.date !== body.date,
    );
    if (body.status !== "DEFAULT")
      overrides.push({
        date: body.date,
        status: body.status,
        label: label.trim(),
      });
    demand(
      overrides.length <= 3660,
      "The calendar has reached its date override limit.",
      400,
    );
    calendar.dateOverrides = overrides.sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const after = calendarDay(calendar, body.date);
    cohort.workingCalendar = calendar;
    cohort.calendarVersion = body.version + 1;
    await cohort.save({ session });
    await models.CalendarEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId,
          actorId: user._id,
          date: body.date,
          before,
          after,
          reason: body.reason.trim(),
          createdAt: now,
          version: cohort.calendarVersion,
        },
      ],
      { session },
    );
    return {
      success: true,
      version: cohort.calendarVersion,
      date: body.date,
      ...after,
    };
  });
}

async function saveAttendanceHours(actor, body, now) {
  demand(
    Object.keys(body).every((k) =>
      ["action", "hours", "reason", "version"].includes(k),
    ),
    "Hours accept no member or cohort overrides.",
    400,
  );
  validateAttendanceHours(body.hours);
  demand(
    Number.isInteger(body.version) && body.version >= 0,
    "Refresh the calendar before saving.",
    400,
  );
  demand(
    typeof body.reason === "string" &&
      body.reason.trim().length >= 5 &&
      body.reason.length <= 1000,
    "Enter a reason (5–1000 characters).",
    400,
  );
  return transaction(async (session) => {
    const user = await calendarUser(actor, session);
    demand(
      user.role === "CENTRE_COMMAND" && permitted(user, "game:write"),
      "Only CC can change attendance hours.",
      403,
    );
    const cohort = await models.Cohort.findById(cohortOf(user)).session(
      session,
    );
    demand(cohort, "Configure your cohort first.", 409);
    demand(
      (cohort.calendarVersion || 0) === body.version,
      "The calendar changed. Refresh and try again.",
      409,
    );
    const before = attendanceHours(cohort);
    const configured = cohort.attendanceMinimumsHistory?.at(-1);
    if (configured)
      validateAttendanceMinimums(
        {
          fullDayMinutes: configured.fullDayMinutes,
          halfDayMinutes: configured.halfDayMinutes,
        },
        body.hours,
      );
    cohort.attendanceHours = body.hours;
    cohort.calendarVersion = body.version + 1;
    await cohort.save({ session });
    const window = attendanceWindow(cohort, now);
    await models.Attendance.updateMany(
      {
        cohortId: cohort._id,
        day: window.day,
        sessionState: "ACTIVE",
        warningAt: { $exists: false },
        cutoffAt: { $exists: true },
        $expr: { $eq: ["$checkDueAt", "$cutoffAt"] },
      },
      { $set: { cutoffAt: window.cutoffAt, checkDueAt: window.cutoffAt } },
      { session },
    );
    await models.CalendarEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId: cohort._id,
          actorId: user._id,
          date: attendanceWindow(cohort, now).day,
          before: { ...before, label: `${before.startTime}–${before.endTime}` },
          after: {
            ...body.hours,
            label: `${body.hours.startTime}–${body.hours.endTime}`,
          },
          reason: body.reason.trim(),
          version: cohort.calendarVersion,
          createdAt: now,
        },
      ],
      { session },
    );
    return { success: true, version: cohort.calendarVersion };
  });
}

async function saveAttendanceMinimums(actor, body, now) {
  demand(
    Object.keys(body).every((key) =>
      ["action", "minimums", "reason", "version"].includes(key),
    ),
    "Minimum hours accept no member or cohort overrides.",
    400,
  );
  demand(
    Number.isInteger(body.version) && body.version >= 0,
    "Refresh the calendar before saving.",
    400,
  );
  demand(
    typeof body.reason === "string" &&
      body.reason.trim().length >= 5 &&
      body.reason.length <= 1000,
    "Enter a reason (5–1000 characters).",
    400,
  );
  return transaction(async (session) => {
    const user = await calendarUser(actor, session);
    demand(
      user.role === "CENTRE_COMMAND" && permitted(user, "game:write"),
      "Only CC can change minimum attendance hours.",
      403,
    );
    const cohort = await models.Cohort.findById(cohortOf(user)).session(
      session,
    );
    demand(cohort, "Configure your cohort first.", 409);
    demand(
      (cohort.calendarVersion || 0) === body.version,
      "The calendar changed. Refresh and try again.",
      409,
    );
    validateAttendanceMinimums(body.minimums, attendanceHours(cohort));
    const window = attendanceWindow(cohort, now);
    const effectiveDay =
      now >= window.cutoffAt
        ? new Date(Date.parse(window.day + "T12:00:00Z") + 86400000)
            .toISOString()
            .slice(0, 10)
        : window.day;
    const before = attendanceMinimums(cohort);
    const entries = (cohort.attendanceMinimumsHistory || [])
      .filter((row) => row.effectiveDay !== effectiveDay)
      .map((row) => (row.toObject ? row.toObject() : row));
    entries.push({ ...body.minimums, effectiveDay });
    demand(entries.length <= 3660, "Minimum-hours history is full.", 409);
    cohort.attendanceMinimumsHistory = entries.sort((a, b) =>
      a.effectiveDay.localeCompare(b.effectiveDay),
    );
    cohort.calendarVersion = body.version + 1;
    await cohort.save({ session });
    const label = (policy) =>
      `Full ${policy.fullDayMinutes / 60} h / half ${policy.halfDayMinutes / 60} h`;
    await models.CalendarEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId: cohort._id,
          actorId: user._id,
          date: window.day,
          before: { ...before, label: label(before) },
          after: {
            ...body.minimums,
            effectiveDay,
            label: label(body.minimums),
          },
          reason: body.reason.trim(),
          version: cohort.calendarVersion,
          createdAt: now,
        },
      ],
      { session },
    );
    return { success: true, version: cohort.calendarVersion, effectiveDay };
  });
}
