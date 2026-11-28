import { randomUUID } from "node:crypto";
import { connect, models, transaction } from "./db.js";
import { attendanceWindow, extraSessionEnd } from "./attendance-hours.js";
import { requireWorkingDay } from "./cohort-calendar.js";
import { calendarDay } from "./working-calendar-rules.js";
import { dayOneAction } from "./day-one.js";
import { attendanceRule } from "./rules.js";
import { award, deduct } from "./engine.js";
import { RESPONSE_MS } from "./attendance-policy.js";
import { syncAbsences, attendanceResult } from "./attendance-register.js";
import { attendanceMinimums } from "./attendance-duration.js";

const fail = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};

export async function syncAttendance(now = new Date(), filter = {}) {
  await connect();
  const cohorts = new Map();
  async function cohortFor(row) {
    const id =
      row.cohortId ||
      (await models.User.findById(row.userId).select("cohortId").lean())
        ?.cohortId ||
      "alpha";
    if (!cohorts.has(id))
      cohorts.set(id, await models.Cohort.findById(id).lean());
    return { id, cohort: cohorts.get(id) };
  }
  const yesterday = new Date(+now - 86400000).toISOString().slice(0, 10);
  const active = await models.Attendance.find({
    ...filter,
    $or: [
      { sessionState: "ACTIVE" },
      {
        sessionState: { $exists: false },
        clockOutAt: { $exists: false },
        day: { $gte: yesterday },
      },
    ],
  }).lean();
  for (const row of active) {
    const { id, cohort } = await cohortFor(row);
    const window = attendanceWindow(cohort, now);
    if (row.day !== window.day) continue; // Keep historical clock records intact.
    if (
      row.sessionState === "ACTIVE" &&
      row.officialStartAt &&
      +new Date(row.cutoffAt) === +window.cutoffAt &&
      +new Date(row.checkDueAt) === +window.cutoffAt
    )
      continue;
    await models.Attendance.updateOne(
      {
        _id: row._id,
        sessionState: row.sessionState || { $exists: false },
        cutoffAt: row.cutoffAt || { $exists: false },
      },
      {
        $set: {
          cohortId: id,
          timeZone: window.timeZone,
          sessionState: "ACTIVE",
          officialStartAt: row.officialStartAt || window.startAt,
          cutoffAt: window.cutoffAt,
          checkDueAt: window.cutoffAt,
        },
      },
    );
  }
  // Attendance ends at the configured cutoff, never at the prompt deadline.
  const closed = await models.Attendance.updateMany(
    { ...filter, sessionState: "ACTIVE", cutoffAt: { $lte: now } },
    [
      {
        $set: {
          sessionState: "OUT",
          clockOutAt: "$cutoffAt",
          clockOutReason: "SCHEDULED_END",
          endDecision: "PENDING",
          warningAt: "$cutoffAt",
          responseDeadline: { $add: ["$cutoffAt", RESPONSE_MS] },
          sessionEvents: {
            $concatArrays: [
              { $ifNull: ["$sessionEvents", []] },
              [{ type: "OUT", at: "$cutoffAt", source: "SCHEDULED_END" }],
            ],
          },
        },
      },
    ],
  );
  await models.Attendance.updateMany(
    {
      ...filter,
      sessionState: "OUT",
      endDecision: "PENDING",
      responseDeadline: { $lte: now },
    },
    {
      $set: { endDecision: "EXPIRED" },
      $unset: { warningAt: "", responseDeadline: "" },
    },
  );
  const extraFilter = Object.fromEntries(
    Object.entries(filter).filter(([key]) =>
      ["userId", "cohortId"].includes(key),
    ),
  );
  for (const extra of await models.ExtraPlaySession.find({
    ...extraFilter,
    state: "ACTIVE",
  }).lean()) {
    const { id, cohort } = await cohortFor(extra);
    const end = extraSessionEnd(cohort, extra.day, extra.timeZone);
    if (now < end && +new Date(extra.plannedEndAt) === +end) continue;
    await transaction(async (session) => {
      // Serialize expiry with CC hour changes; an old cached start time must
      // not close extra play after CC has already moved that start later.
      const freshCohort = await models.Cohort.findOneAndUpdate(
        { _id: id },
        { $inc: { calendarAttendanceLock: 1 } },
        { new: true, session },
      ).lean();
      const currentExtra = await models.ExtraPlaySession.findOne({
        _id: extra._id,
        state: "ACTIVE",
      })
        .session(session)
        .lean();
      if (!currentExtra) return;
      const boundary = extraSessionEnd(
        freshCohort,
        currentExtra.day,
        currentExtra.timeZone,
      );
      await models.ExtraPlaySession.updateOne(
        { _id: extra._id, state: "ACTIVE" },
        {
          $set:
            now >= boundary
              ? {
                  plannedEndAt: boundary,
                  endAt: boundary,
                  state: "OUT",
                  endReason: "NEXT_DAY",
                }
              : { plannedEndAt: boundary },
        },
        { session },
      );
    });
  }
  const absence = Object.keys(filter).length ? {} : await syncAbsences(now);
  return { clockedOut: closed.modifiedCount, ...absence };
}

export async function attendanceSnapshot(
  context,
  user,
  now = new Date(),
  story,
  known=null,
) {
  if (user.role !== "GAMER") return null;
  await connect();
  const c = await context(user, now, story, known);
  if(c.attendanceRequired===false)return {day:c.day,timeZone:c.zone,state:"FREE_PLAY",attendanceRequired:false,available:c.available,reason:c.reason,cutoffAt:null};
  await syncAttendance(now, { userId: user._id });
  const [today, extra, pending] = await Promise.all([
    models.Attendance.findOne({ userId: user._id, day: c.day }).lean(),
    models.ExtraPlaySession.findOne({
      userId: user._id,
      state: "ACTIVE",
    }).lean(),
    models.Attendance.findOne({
      userId: user._id,
      endDecision: "PENDING",
      responseDeadline: { $gt: now },
    })
      .sort({ clockAt: -1 })
      .lean(),
  ]);
  const row = extra
    ? extra.attendanceId
      ? await models.Attendance.findById(extra.attendanceId).lean()
      : today
    : today?.sessionState === "ACTIVE"
      ? today
      : pending ||
        today ||
        (await models.Attendance.findOne({
          userId: user._id,
          $or: [{ endDecision: "EXPIRED" }, { clockOutReason: "TIMEOUT" }],
        })
          .sort({ clockAt: -1 })
          .lean());
  const cohort = await models.Cohort.findById(user.cohortId || "alpha").lean();
  const window = attendanceWindow(cohort, now);
  const extraAvailable = Boolean(
    today?.clockAt &&
    today.sessionState === "OUT" &&
    now >= window.cutoffAt &&
    calendarDay(cohort?.workingCalendar, c.day).working,
  );
  const choice =
    !extra && row?.endDecision === "PENDING" && row.responseDeadline > now;
  const reportDay = extra || pending ? row?.day || c.day : c.day;
  const [result, tracking] = await Promise.all([
    models.AttendanceResult.findOne({
      cohortId: user.cohortId || "alpha",
      userId: user._id,
      day: reportDay,
    }).lean(),
    models.User.findById(user._id).select("attendanceTrackingStartDay").lean(),
  ]);
  const attendance = attendanceResult(
    cohort || {},
    { ...user, ...tracking },
    reportDay,
    row?.day === reportDay ? row : null,
    result,
    now,
  );
  const minimums =
    attendance.durationPolicy || attendanceMinimums(cohort, reportDay);
  return {
    day: c.day,
    timeZone: c.zone,
    available: c.available,
    reason: c.reason,
    cutoffAt: c.cutoffAt,
    state: extra
      ? "EXTRA"
      : choice
        ? "CHOICE"
        : row?.day === c.day || choice
          ? row?.sessionState || "NOT_IN"
          : "NOT_IN",
    hasClockedIn: Boolean(
      row?.clockAt ||
      (await models.Attendance.exists({
        userId: user._id,
        clockAt: { $exists: true, $ne: null },
      })),
    ),
    clockAt: row?.clockAt || null,
    clockOutAt: row?.clockOutAt || null,
    clockOutReason: row?.clockOutReason || null,
    officialDay: row?.day || null,
    endDecision: row?.endDecision || null,
    warningAt: choice ? row.warningAt : null,
    responseDeadline: choice ? row.responseDeadline : null,
    responseMinutes: RESPONSE_MS / 60000,
    extraAvailable: extraAvailable || Boolean(choice),
    officialAttendance: {
      day: reportDay,
      status: attendance.status,
      minutes: attendance.officialMinutes || 0,
      fullDayMinutes: minimums.fullDayMinutes,
      halfDayMinutes: minimums.halfDayMinutes,
      provisional: Boolean(attendance.provisional),
      corrected: Boolean(result?.override),
    },
    extraSession: extra
      ? {
          startAt: extra.startAt,
          plannedEndAt: extra.plannedEndAt,
          day: extra.day,
          purpose: extra.purpose || "EXTRA",
        }
      : null,
  };
}

export async function attendanceAction(
  context,
  actor,
  action,
  body = {},
  now = new Date(),
) {
  if (actor.role !== "GAMER" || actor.active === false)
    fail("An active Player account is required.", 403);
  if (!["clock-in", "clock-out", "continue", "stay"].includes(action))
    fail("Unknown attendance action.", 404);
  if (Object.keys(body).some((key) => key !== "latenessReason"))
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
  const c = await context(user, now);
  if(c.attendanceRequired===false){
    if(action==="clock-in"){
      if(!c.available)fail(c.reason);
      await dayOneAction(user,"clock",{},now);
    }
    return {success:true,mode:"FREE_PLAY"};
  }
  await syncAttendance(now, { userId: user._id });
  if (action === "clock-in") {
    if (!c.available) fail(c.reason);
    if (c.flight && c.dayNumber === 1)
      await dayOneAction(user, "clock", {}, now);
  }
  return transaction(async (session) => {
    const current = await models.User.findById(user._id)
      .session(session)
      .lean();
    if (!current || current.active === false || current.role !== "GAMER")
      fail("An active Player account is required.", 403);
    await models.User.updateOne(
      { _id: user._id },
      { $inc: { effortLock: 1 } },
      { session },
    );
    let row = await models.Attendance.findOne({
      userId: user._id,
      day: c.day,
    }).session(session);
    let extra = await models.ExtraPlaySession.findOne({
      userId: user._id,
      state: "ACTIVE",
    }).session(session);
    if (action === "continue" || action === "stay") {
      if (extra) return { success: true, mode: "EXTRA" };
      const pending = await models.Attendance.findOne({
        userId: user._id,
        endDecision: "PENDING",
        responseDeadline: { $gt: now },
      })
        .sort({ clockAt: -1 })
        .session(session);
      row = pending || row;
      const cohort = await models.Cohort.findOneAndUpdate(
        { _id: user.cohortId || "alpha" },
        { $inc: { calendarAttendanceLock: 1 } },
        { new: true, session },
      ).lean();
      const window = attendanceWindow(cohort, now);
      if (
        !row?.clockAt ||
        row.sessionState !== "OUT" ||
        (row.cohortId && row.cohortId !== (user.cohortId || "alpha"))
      )
        fail("Complete an official clock-in before starting extra play.");
      if (action === "stay" && !pending)
        fail("This check has ended. Open attendance to start extra play.");
      if (
        !pending &&
        (row.day !== c.day ||
          now < window.cutoffAt ||
          !calendarDay(cohort?.workingCalendar, c.day).working)
      )
        fail("Extra play is available after your official working day ends.");
      const end = extraSessionEnd(cohort, row.day, row.timeZone || c.zone);
      if (now >= end)
        fail("This day's extra play has ended. Clock in for the new day.");
      await models.ExtraPlaySession.create(
        [
          {
            _id: randomUUID(),
            userId: user._id,
            cohortId: user.cohortId || "alpha",
            attendanceId: row._id,
            day: row.day,
            startAt: now,
            plannedEndAt: end,
            state: "ACTIVE",
            timeZone: row.timeZone || c.zone,
          },
        ],
        { session },
      );
      row.endDecision = "CONTINUED";
      row.warningAt = undefined;
      row.responseDeadline = undefined;
      await row.save({ session });
      return { success: true, mode: "EXTRA" };
    }
    if (action === "clock-out") {
      if (extra) {
        extra.state = "OUT";
        extra.endAt = now;
        extra.endReason = "MANUAL";
        await extra.save({ session });
      }
      if (!row || row.sessionState !== "ACTIVE") {
        await models.Attendance.updateMany(
          { userId: user._id, endDecision: "PENDING" },
          {
            $set: { endDecision: "FINISHED" },
            $unset: { warningAt: "", responseDeadline: "" },
          },
          { session },
        );
        return { success: true };
      }
      row.sessionState = "OUT";
      row.clockOutAt = now;
      row.clockOutReason = "MANUAL";
      row.endDecision = "FINISHED";
      row.warningAt = undefined;
      row.responseDeadline = undefined;
      row.sessionEvents.push({ type: "OUT", at: now, source: "MANUAL" });
      await row.save({ session });
      return { success: true };
    }
    if (row?.sessionState === "ACTIVE") return { success: true };
    const schedule = await requireWorkingDay(current, now, session);
    if (extra) {
      extra.state = "OUT";
      extra.endAt = now;
      extra.endReason = "OFFICIAL_START";
      await extra.save({ session });
    }
    if (!row) {
      let onTime = true;
      if (!c.flight) {
        try {
          ({ onTime } = attendanceRule(
            now,
            body.latenessReason || "",
            schedule,
          ));
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
    row.officialStartAt ||= schedule.startAt;
    row.timeZone = c.zone;
    row.sessionState = "ACTIVE";
    row.cutoffAt = schedule.cutoffAt;
    row.checkDueAt = schedule.cutoffAt;
    row.warningAt = undefined;
    row.responseDeadline = undefined;
    row.clockOutAt = undefined;
    row.clockOutReason = undefined;
    row.endDecision = undefined;
    row.sessionEvents.push({ type: "IN", at: now, source: "PLAYER" });
    await row.save({ session });
    return { success: true };
  });
}
