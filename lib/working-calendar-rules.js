export function validCalendarDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}

export function calendarDay(calendar, date) {
  const override = calendar?.dateOverrides?.find(
    (entry) => entry.date === date,
  );
  if (override)
    return {
      working: override.status === "WORKING",
      label:
        override.label ||
        (override.status === "WORKING" ? "Working day" : "Leave day"),
      source: "OVERRIDE",
    };
  if (calendar?.holidays?.includes(date))
    return { working: false, label: "Holiday", source: "HOLIDAY" };
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const working =
    !calendar?.weekdays?.length || calendar.weekdays.includes(weekday);
  return {
    working,
    label: working ? "Working day" : "Weekly off",
    source: "WEEKLY",
  };
}

export function validateDateOverrides(entries) {
  if (entries === undefined) return;
  if (!Array.isArray(entries) || entries.length > 3660)
    throw new Error("Use at most 3660 calendar date overrides.");
  const dates = new Set();
  for (const row of entries) {
    if (
      !row ||
      !validCalendarDate(row.date) ||
      !["LEAVE", "WORKING"].includes(row.status) ||
      typeof row.label !== "string" ||
      !row.label.trim() ||
      row.label.length > 100 ||
      dates.has(row.date)
    )
      throw new Error(
        "Use unique, valid dates with a leave/working status and a short label.",
      );
    dates.add(row.date);
  }
}

export function monthDates(month) {
  if (
    typeof month !== "string" ||
    !/^\d{4}-\d{2}$/.test(month) ||
    !validCalendarDate(month + "-01")
  )
    throw Object.assign(new Error("Choose a valid month (YYYY-MM)."), {
      status: 400,
    });
  const last = new Date(month + "-01T12:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const length = last.getUTCDate();
  return Array.from(
    { length },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

export function calendarBase(calendar) {
  const base = {
    timeZone: "Asia/Kolkata",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    holidays: [],
    startMinute: 540,
    ...JSON.parse(JSON.stringify(calendar || {})),
  };
  if (!base.weekdays?.length) base.weekdays = [0, 1, 2, 3, 4, 5, 6];
  return base;
}
