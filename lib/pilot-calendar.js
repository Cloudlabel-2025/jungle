export function text(v, label = "Evidence", min = 10, max = 8000) {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    throw Object.assign(
      new Error(`${label}: ${min}–${max} characters required.`),
      { status: 400 },
    );
  return v.trim();
}
export function number(v, min, max) {
  if (!Number.isFinite(v) || v < min || v > max)
    throw Object.assign(
      new Error(`Number must be between ${min} and ${max}.`),
      { status: 400 },
    );
  return v;
}
export const day = (now, c) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: c.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
export function intervals(c) {
  return (
    c.intervals || [
      { startMinute: c.startMinute, endMinute: c.startMinute + 480 },
    ]
  );
}
export function validateCalendar(c) {
  text(c?.timeZone, "Timezone", 1, 100);
  new Intl.DateTimeFormat("en", { timeZone: c.timeZone });
  if (
    !Array.isArray(c.weekdays) ||
    !c.weekdays.length ||
    c.weekdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6) ||
    !Array.isArray(c.holidays)
  )
    throw new Error("Working weekdays and holidays required.");
  const slots = intervals(c);
  if (
    !slots.length ||
    slots.length > 8 ||
    slots.some(
      (s, i) =>
        !Number.isInteger(s.startMinute) ||
        !Number.isInteger(s.endMinute) ||
        s.startMinute < 0 ||
        s.endMinute > 1440 ||
        s.endMinute <= s.startMinute ||
        (i && s.startMinute < slots[i - 1].endMinute),
    )
  )
    throw new Error("Ordered non-overlapping work windows required.");
  for (const d of c.holidays)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw new Error("Valid holiday dates required.");
  return c;
}
export function working(now, c) {
  const n = new Date(now),
    p = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: c.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(n)
        .map((p) => [p.type, p.value]),
    );
  const d = `${p.year}-${p.month}-${p.day}`,
    m = +p.hour * 60 + +p.minute;
  return (
    c.weekdays.includes(new Date(d + "T12:00:00Z").getUTCDay()) &&
    !c.holidays.includes(d) &&
    intervals(c).some((s) => m >= s.startMinute && m < s.endMinute)
  );
}
export function workingAt(value, c, minutes) {
  validateCalendar(c);
  number(minutes, -525600, 525600);
  let cursor = new Date(value).getTime(),
    left = Math.abs(minutes) * 60000,
    dir = minutes < 0 ? -1 : 1;
  if (!Number.isFinite(cursor)) throw new Error("Valid timestamp required.");
  const end = cursor + dir * 370 * 86400000;
  while (left > 0 && (dir > 0 ? cursor < end : cursor > end)) {
    const span = Math.min(
      left,
      dir > 0 ? 60000 - (cursor % 60000) : cursor % 60000 || 60000,
    );
    if (working(cursor + (dir < 0 ? -1 : 0), c)) {
      left -= span;
      cursor += dir * span;
    } else
      cursor +=
        dir * (dir > 0 ? 60000 - (cursor % 60000) : cursor % 60000 || 60000);
  }
  if (left) throw new Error("No working time in the next year.");
  return new Date(cursor).toISOString();
}
export function graph(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) throw new Error("Duplicate task code.");
  const done = new Set(),
    visiting = new Set();
  function visit(id) {
    if (done.has(id)) return;
    if (visiting.has(id) || !ids.has(id))
      throw new Error("Missing or circular task dependency.");
    visiting.add(id);
    const t = tasks.find((t) => t.id === id);
    for (const dep of [...t.depends, ...(t.releaseGates || [])]) visit(dep);
    visiting.delete(id);
    done.add(id);
  }
  for (const t of tasks) {
    if (!/^[A-Z]{2}-\d{2}$/.test(t.id) || !Array.isArray(t.depends))
      throw new Error("Stable task codes and dependencies required.");
    visit(t.id);
  }
  return true;
}
export function cap(members, scores) {
  return members.length === 5 &&
    members.every((id) =>
      Number.isFinite(scores.find((s) => s.userId === id)?.score),
    ) &&
    members.reduce(
      (n, id) => n + scores.find((s) => s.userId === id).score,
      0,
    ) /
      5 >
      82
    ? 5
    : 3;
}
export const stages = [
  "Understand/Clarify",
  "Design",
  "Build/Configure",
  "Unit Test",
  "UAT Handover",
];
