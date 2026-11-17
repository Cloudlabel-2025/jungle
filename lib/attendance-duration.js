import { attendanceHours, attendanceWindow } from "./attendance-hours.js";
import { scheduleInstant } from "./day-one-setup.js";
import { workSessions } from "./work-sessions.js";

export function shiftMinutes(hours) {
  const minutes = (value) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return minutes(hours.endTime) - minutes(hours.startTime);
}

export function attendanceMinimums(
  cohort,
  day = null,
  availableMinutes = null,
) {
  const entries = (cohort?.attendanceMinimumsHistory || [])
    .filter((row) => !day || row.effectiveDay <= day)
    .sort((a, b) => a.effectiveDay.localeCompare(b.effectiveDay));
  const entry = entries.at(-1);
  if (entry)
    return {
      fullDayMinutes: entry.fullDayMinutes,
      halfDayMinutes: entry.halfDayMinutes,
      effectiveDay: entry.effectiveDay,
    };
  const span = availableMinutes ?? shiftMinutes(attendanceHours(cohort));
  return {
    fullDayMinutes: Math.min(360, span),
    halfDayMinutes: Math.min(240, span / 2),
    effectiveDay: null,
  };
}

export function validateAttendanceMinimums(value, hours) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !["fullDayMinutes", "halfDayMinutes"].includes(key),
    ) ||
    !Number.isInteger(value.fullDayMinutes) ||
    !Number.isInteger(value.halfDayMinutes) ||
    value.halfDayMinutes <= 0 ||
    value.fullDayMinutes <= value.halfDayMinutes ||
    value.fullDayMinutes > shiftMinutes(hours)
  )
    throw Object.assign(
      new Error(
        "Minimum hours must be positive, half day must be below full day, and both must fit within official working hours.",
      ),
      { status: 400 },
    );
}

export function officialDuration(cohort, day, clock, now = new Date()) {
  const window = attendanceWindow(cohort, now);
  const zone = clock?.timeZone || window.timeZone;
  const hours =
    day < window.day
      ? { startTime: "09:00", endTime: "17:00" }
      : attendanceHours(cohort);
  const start = clock?.officialStartAt
    ? +new Date(clock.officialStartAt)
    : Date.parse(scheduleInstant(day, hours.startTime, zone));
  const cutoff = clock?.cutoffAt
    ? +new Date(clock.cutoffAt)
    : Date.parse(scheduleInstant(day, hours.endTime, zone));
  if (!Number.isFinite(start) || !Number.isFinite(cutoff) || cutoff <= start)
    return {
      officialMilliseconds: 0,
      unknown: true,
      startAt: new Date(start),
      cutoffAt: new Date(scheduleInstant(day, hours.endTime, zone)),
      availableMinutes: Math.max(1, shiftMinutes(hours)),
    };
  const intervals = [];
  let unknown = false;
  for (const period of clock && clock.sessionKind !== "EXTRA"
    ? workSessions([clock])
    : []) {
    if (period.unknownEnd) {
      unknown = true;
      continue;
    }
    const stop =
      period.end ??
      period.boundary ??
      (clock.sessionState === "ACTIVE" ? +now : NaN);
    if (!Number.isFinite(stop)) {
      unknown = true;
      continue;
    }
    if (stop < period.start) {
      unknown = true;
      continue;
    }
    const from = Math.max(period.start, start);
    const to = Math.min(stop, cutoff, +now);
    if (to > from) intervals.push([from, to]);
  }
  // Union intervals so duplicate events or repeated clock-ins cannot inflate time.
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of intervals) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return {
    officialMilliseconds: merged.reduce((n, [from, to]) => n + to - from, 0),
    unknown,
    startAt: new Date(start),
    cutoffAt: new Date(cutoff),
    availableMinutes: Math.max(0, (cutoff - start) / 60000),
  };
}

export function durationAttendance(cohort, day, clock, result, now) {
  const duration = officialDuration(cohort, day, clock, now);
  const today = attendanceWindow(cohort, now).day;
  const policy =
    result?.durationPolicy ||
    attendanceMinimums(
      cohort,
      day,
      day < today
        ? duration.availableMinutes
        : shiftMinutes(attendanceHours(cohort)),
    );
  const projected =
    duration.officialMilliseconds >= policy.fullDayMinutes * 60000
      ? "FULL_DAY"
      : duration.officialMilliseconds >= policy.halfDayMinutes * 60000
        ? "HALF_DAY"
        : "ABSENT";
  const final = day < today || +now >= +duration.cutoffAt;
  const status = !final
    ? "IN_PROGRESS"
    : duration.unknown && projected !== "FULL_DAY"
      ? "NEEDS_REVIEW"
      : projected;
  return {
    status,
    counted: ["FULL_DAY", "HALF_DAY", "ABSENT"].includes(status),
    credit: status === "FULL_DAY" ? 1 : status === "HALF_DAY" ? 0.5 : 0,
    officialMilliseconds: duration.officialMilliseconds,
    officialMinutes: Math.floor(duration.officialMilliseconds / 60000),
    provisional: !final,
    projectedStatus: projected,
    durationPolicy: policy,
    officialCutoffAt: duration.cutoffAt,
    label: !final
      ? "Official time accumulating; final result at day end"
      : status === "NEEDS_REVIEW"
        ? "Clock-out information is incomplete; staff review required"
        : status === "ABSENT"
          ? `Below ${policy.halfDayMinutes / 60} h half-day minimum`
          : status === "HALF_DAY"
            ? `At least ${policy.halfDayMinutes / 60} h official time`
            : `At least ${policy.fullDayMinutes / 60} h official time`,
  };
}
