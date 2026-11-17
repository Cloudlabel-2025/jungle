import { localParts } from "./day-one-rules.js";
import { scheduleInstant } from "./day-one-setup.js";

export function attendanceHours(cohort) {
  return {
    startTime: cohort?.attendanceHours?.startTime || "09:00",
    endTime: cohort?.attendanceHours?.endTime || "17:00",
  };
}

export function validateAttendanceHours(value) {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (
    !value ||
    Object.keys(value).some((k) => !["startTime", "endTime"].includes(k)) ||
    !time.test(value.startTime) ||
    !time.test(value.endTime) ||
    value.startTime >= value.endTime
  )
    throw Object.assign(
      new Error("Choose valid same-day hours with clock-in before clock-out."),
      { status: 400 },
    );
}

export function attendanceWindow(cohort, now) {
  const hours = attendanceHours(cohort);
  const timeZone = cohort?.workingCalendar?.timeZone || "Asia/Kolkata";
  const day = localParts(now, timeZone).day;
  return {
    ...hours,
    timeZone,
    day,
    startAt: new Date(scheduleInstant(day, hours.startTime, timeZone)),
    cutoffAt: new Date(scheduleInstant(day, hours.endTime, timeZone)),
  };
}

export function extraSessionEnd(cohort, day, timeZone) {
  const tomorrow = new Date(Date.parse(day + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  return new Date(
    scheduleInstant(
      tomorrow,
      attendanceHours(cohort).startTime,
      timeZone || cohort?.workingCalendar?.timeZone || "Asia/Kolkata",
    ),
  );
}
