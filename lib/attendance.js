import { models } from "./db.js";
import { localParts } from "./day-one-rules.js";
import { attendanceWindow } from "./attendance-hours.js";
import { playerStage } from "./player-stage.js";
import { completionBased } from "./flight-progression.js";
import { calendarDay } from "./working-calendar-rules.js";
import {
  attendanceAction as sessionAction,
  attendanceSnapshot as sessionSnapshot,
} from "./attendance-session.js";
export { syncAttendance } from "./attendance-session.js";
export { RESPONSE_MS } from "./attendance-policy.js";
async function context(user, now, story, known=null) {
  const cohortId = user.cohortId || "alpha";
  if(known?.cohortId!==cohortId)known=null;
  const [release, cohort, program] = await Promise.all([
    known?known.release:models.WeekOneRelease.findById(cohortId).lean(),
    known?known.cohort:models.Cohort.findById(cohortId).lean(),
    known?known.program:models.WeekOneProgram.findById(cohortId).lean(),
  ]);
  const open = release?.days?.find((d) => d.state === "OPEN");
  const window = attendanceWindow(cohort, now);
  const zone = window.timeZone;
  const local = localParts(now, zone);
  const flight = (story || (await playerStage(user))).flight;
  if(flight && completionBased(program?.data))return {cohortId,day:local.day,zone,available:Boolean(release?.days[0]?.content),flight:true,dayNumber:1,attendanceRequired:false,cutoffAt:null,reason:release?.days[0]?.content?"":"Your first mission is being prepared."};
  const calendarStatus = calendarDay(cohort?.workingCalendar, local.day);
  if (!calendarStatus.working)
    return {
      cohortId,
      day: local.day,
      zone,
      available: false,
      flight,
      dayNumber: 1,
      cutoffAt: null,
      reason: `${local.day} is ${calendarStatus.label}. Clock-in is unavailable; check Calendar or ask CC.`,
    };
  if (now < window.startAt || now >= window.cutoffAt)
    return {
      cohortId,
      day: local.day,
      zone,
      available: false,
      flight,
      dayNumber: 1,
      cutoffAt: window.cutoffAt,
      reason: `Clock-in is available from ${window.startTime} to ${window.endTime} (${zone}).`,
    };
  if (flight && completionBased(program?.data)) {
    return {
      cohortId,
      day: local.day,
      zone,
      available: Boolean(release?.days[0]?.content),
      flight,
      dayNumber: 1,
      cutoffAt: window.cutoffAt,
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
      cutoffAt: window.cutoffAt,
      reason: available
        ? ""
        : open && scheduledDay && scheduledDay !== local.day
          ? `Day ${open.day} is scheduled for ${scheduledDay} (${zone}). Clock-in is available on that date. Ask MC or CC to check the schedule.`
          : "Your next day has not opened yet. Ask MC or CC to release the day's schedule.",
    };
  }
  const available = calendarStatus.working;
  return {
    cohortId,
    day: local.day,
    zone,
    available,
    flight,
    cutoffAt: window.cutoffAt,
    reason: available ? "" : "Today is outside your cohort's working calendar.",
  };
}

export const attendanceSnapshot = (...args) =>
  sessionSnapshot(context, ...args);
export const attendanceAction = (...args) => sessionAction(context, ...args);
