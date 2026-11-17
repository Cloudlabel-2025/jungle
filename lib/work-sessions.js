import { RESPONSE_MS } from "./attendance-policy.js";
export const workTime = (value) =>
  typeof value === "number"
    ? value
    : value instanceof Date
      ? value.getTime()
      : Date.parse(value);
export function workSessions(records) {
  const sessions = [];
  for (const row of records) {
    const original = workTime(row.clockAt);
    if (!Number.isFinite(original)) continue;
    const events = [
      { type: "IN", at: row.clockAt },
      ...(row.sessionEvents || []),
    ]
      .map((e, i) => ({ ...e, index: i, ms: workTime(e.at) }))
      .filter((e) => Number.isFinite(e.ms))
      .sort((a, b) => a.ms - b.ms || a.index - b.index);
    let current = null;
    for (const event of events) {
      if (event.type === "IN") {
        if (current && current.start === event.ms) continue;
        if (current) {
          current.boundary = event.ms;
          sessions.push(current);
        }
        current = {
          id: JSON.stringify([row._id, new Date(event.ms).toISOString()]),
          attendanceId: row._id,
          kind: row.sessionKind || "OFFICIAL",
          start: event.ms,
          end: null,
          reason: null,
          timeZone: row.timeZone,
          pendingDeadline:
            row.sessionState === "ACTIVE"
              ? workTime(row.cutoffAt) ||
                workTime(row.responseDeadline) ||
                workTime(row.checkDueAt) + RESPONSE_MS
              : null,
        };
      } else if (event.type === "OUT" && current) {
        current.end = event.ms;
        current.reason = event.source || "OUT";
        sessions.push(current);
        current = null;
      }
    }
    if (current) {
      if (
        row.sessionState === "OUT" &&
        Number.isFinite(workTime(row.clockOutAt))
      ) {
        current.end = workTime(row.clockOutAt);
        current.reason = row.clockOutReason;
      }
      if (current.end == null && row.sessionState !== "ACTIVE")
        current.unknownEnd = true;
      sessions.push(current);
    }
  }
  return sessions.sort((a, b) => a.start - b.start);
}
export function extraWorkSessions(records) {
  return workSessions(
    records.map((row) => ({
      _id: `extra:${row._id}`,
      sessionKind: "EXTRA",
      clockAt: row.startAt,
      clockOutAt: row.endAt,
      clockOutReason: row.endReason,
      sessionState: row.state,
      cutoffAt: row.plannedEndAt,
      timeZone: row.timeZone,
    })),
  );
}
export function sessionAt(sessions, at) {
  const ms = workTime(at);
  return (
    sessions
      .filter(
        (s) =>
          !s.unknownEnd &&
          s.start <= ms &&
          Math.min(
            s.end ?? Infinity,
            s.boundary ?? Infinity,
            Number.isFinite(s.pendingDeadline) ? s.pendingDeadline : Infinity,
          ) > ms,
      )
      .at(-1) || null
  );
}
