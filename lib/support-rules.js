export const umbrellas = [
  "EXPERIENCE",
  "COGNITION",
  "EXPERT_INTERVENTION_NEEDED",
];
export const interventions = {
  INT01: "1:1 with MC",
  INT02: "1:1 with CC",
  INT03: "Guidance by MC",
  INT04: "Guidance by CC",
  INT05: "Email reply",
  INT06: "Human voice-note response",
};
export const transitions = {
  NEW: ["TRIAGED"],
  TRIAGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS", "RESPONDED"],
  IN_PROGRESS: ["RESPONDED"],
  RESPONDED: ["RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
};
export function validateCalendar(calendar) {
  if (
    !calendar ||
    typeof calendar.timeZone !== "string" ||
    !calendar.timeZone ||
    !Number.isInteger(calendar.startMinute) ||
    calendar.startMinute < 0 ||
    calendar.startMinute + 480 > 1440 ||
    !Array.isArray(calendar.weekdays) ||
    !calendar.weekdays.length ||
    calendar.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    !Array.isArray(calendar.holidays) ||
    calendar.holidays.some(
      (d) =>
        typeof d !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
        !Number.isFinite(Date.parse(`${d}T00:00:00Z`)) ||
        new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d,
    )
  )
    throw new Error(
      "Configure an eight-hour window, working weekdays (0–6), and ISO holiday dates.",
    );
  new Intl.DateTimeFormat("en", { timeZone: calendar.timeZone }).format(
    new Date(),
  );
  return calendar;
}
function formatter(calendar) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: calendar.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
function working(date, calendar, format) {
  const p = Object.fromEntries(
    format.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const day = `${p.year}-${p.month}-${p.day}`;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const minute = Number(p.hour) * 60 + Number(p.minute);
  return (
    calendar.weekdays.includes(weekday) &&
    !calendar.holidays.includes(day) &&
    minute >= calendar.startMinute &&
    minute < calendar.startMinute + 480
  );
}
// Integrate real elapsed time within configured local working windows, including DST.
export function workingDueAt(assignedAt, calendar, minutes = 60) {
  validateCalendar(calendar);
  const format = formatter(calendar);
  let cursor = new Date(assignedAt).getTime(),
    remaining = minutes * 60000;
  if (!Number.isFinite(cursor))
    throw new Error("Invalid assignment timestamp.");
  const limit = cursor + 370 * 86400000;
  while (remaining > 0 && cursor < limit) {
    const next = Math.floor(cursor / 60000) * 60000 + 60000;
    if (working(new Date(cursor), calendar, format)) {
      const elapsed = Math.min(next - cursor, remaining);
      remaining -= elapsed;
      cursor += elapsed;
    } else cursor = next;
  }
  if (remaining)
    throw new Error("No working time available within the next year.");
  return new Date(cursor);
}
export function remainingWorkingMinutes(from, dueAt, calendar) {
  validateCalendar(calendar);
  let cursor = new Date(from).getTime();
  const end = new Date(dueAt).getTime(),
    format = formatter(calendar);
  if (
    !Number.isFinite(cursor) ||
    !Number.isFinite(end) ||
    end - cursor > 370 * 86400000
  )
    throw new Error("Invalid SLA interval.");
  let elapsed = 0;
  while (cursor < end) {
    const next = Math.min(end, Math.floor(cursor / 60000) * 60000 + 60000);
    if (working(new Date(cursor), calendar, format)) elapsed += next - cursor;
    cursor = next;
  }
  return elapsed / 60000;
}
export function weightedAssessment(scores) {
  const weights = [40, 20, 25, 15];
  if (
    !Array.isArray(scores) ||
    scores.length !== 4 ||
    scores.some((s) => s !== null && (!Number.isFinite(s) || s < 0 || s > 100))
  )
    throw new Error(
      "Supply four scores from 0–100; use null for unobserved dimensions.",
    );
  return scores.includes(null)
    ? null
    : scores.reduce((sum, s, i) => sum + (s * weights[i]) / 100, 0);
}
