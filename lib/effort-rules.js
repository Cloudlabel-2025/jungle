export function activeMinutes(sessions) {
  return sessions.reduce(
    (sum, s) =>
      sum +
      (!s.deletedAt && s.sessionKind === "ACTIVE" && s.endedAt
        ? (new Date(s.endedAt) - new Date(s.startedAt)) / 60000
        : 0),
    0,
  );
}
export function durationLabel(minutes, signed = false) {
  const rounded = Math.round(Math.abs(minutes) * 100) / 100;
  return `${minutes < 0 ? "−" : signed && minutes > 0 ? "+" : ""}${Math.floor(rounded / 60)}h ${Math.round((rounded % 60) * 100) / 100}m`;
}
export function overlaps(a, b) {
  return (
    +new Date(a.startedAt) < (b.endedAt ? +new Date(b.endedAt) : Infinity) &&
    +new Date(b.startedAt) < (a.endedAt ? +new Date(a.endedAt) : Infinity)
  );
}
export function comparisonTotals(records) {
  const live = records.filter((r) => !r.deletedAt);
  const verified = live.filter((r) => r.status === "VERIFIED");
  return {
    sampleCount: verified.length,
    deltaMinutes: verified.reduce((n, r) => n + r.deltaMinutes, 0),
    pendingCount: live.filter((r) => r.status === "PENDING").length,
    rejectedCount: live.filter((r) => r.status === "REJECTED").length,
  };
}
