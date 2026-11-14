import { defaultSetup, localParts } from "./day-one-rules.js";

// Convert the chosen wall-clock time in the cohort's zone, not the browser's zone.
export function scheduleInstant(day, time, zone) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error("Choose a date and valid start and finish times.");
  const target = Date.parse(`${day}T${time}:00Z`);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = localParts(instant, zone);
    const difference = target - Date.parse(`${p.day}T${p.time}:00Z`);
    if (!difference && p.day === day && p.time === time)
      return new Date(instant).toISOString();
    instant += difference;
  }
  throw new Error(
    "That local time does not exist in your time zone. Choose another time.",
  );
}

export function suggestedResearchGroups(roster, saved = []) {
  const ids = roster.map((p) => p._id);
  const previous = saved.flatMap((g) => g.members || []);
  if (
    saved.length &&
    saved.every((g) => g.members?.length === 5) &&
    previous.length === ids.length &&
    new Set(previous).size === ids.length &&
    ids.every((id) => previous.includes(id))
  )
    return saved.map((g) => ({ members: [...g.members] }));
  return Array.from({ length: Math.ceil(ids.length / 5) }, (_, i) => ({
    members: ids.slice(i * 5, i * 5 + 5),
  }));
}

export function preparedSetupMatches(draft, prepared) {
  if (!draft || !prepared) return false;
  const comparable = (c) => ({
    schedule: [
      c.day,
      c.timeZone,
      c.startTime,
      c.endTime,
      c.availableAt,
      c.officialStart,
      c.clockCutoff,
      c.closingCutoff,
      c.revealAfter,
    ],
    calendar: [c.weekdays, c.holidays],
    mode: c.selectionMode || "legacy",
    questions:
      c.selectionMode === "research-2026-11-12"
        ? [
            c.questionSelection,
            c.bankApproval,
            (c.researchGroups || []).map((g) => g.members),
          ]
        : c.genres?.map((g) => [g.id, g.name, g.question]),
  });
  return (
    JSON.stringify(comparable(draft)) === JSON.stringify(comparable(prepared))
  );
}

export function buildDayOneSetup(base, values) {
  const defaults = defaultSetup();
  const zone = base.timeZone || "Asia/Kolkata";
  const complete = Boolean(values.day && values.startTime && values.endTime);
  if (!complete && values.preparing)
    throw new Error("Choose the Day 1 date, start time and finish time.");
  const start = complete
    ? scheduleInstant(values.day, values.startTime, zone)
    : "";
  const end = complete ? scheduleInstant(values.day, values.endTime, zone) : "";
  if (complete && Date.parse(start) >= Date.parse(end))
    throw new Error("Finish time must be after start time.");
  if (complete && Date.parse(end) - Date.parse(start) < 90 * 60000)
    throw new Error("Allow at least 90 minutes for the research mission.");
  const weekday = complete ? localParts(start, zone).weekday : null;
  const config = {
    ...defaults,
    ...base,
    name: base.name || defaults.name,
    timeZone: zone,
    day: values.day,
    startTime: values.startTime,
    endTime: values.endTime,
    selectionMode: values.selectionMode,
    availableAt: start,
    officialStart: start,
    clockCutoff: complete
      ? new Date(Date.parse(start) + 30 * 60000).toISOString()
      : "",
    closingCutoff: end,
    revealAfter: !complete
      ? ""
      : base.revealAfter && Date.parse(base.revealAfter) >= Date.parse(end)
        ? base.revealAfter
        : new Date(Date.parse(end) + 7 * 86400000).toISOString(),
    weekdays: [
      ...new Set([
        ...(base.weekdays || defaults.weekdays),
        ...(weekday == null ? [] : [weekday]),
      ]),
    ],
    holidays: (base.holidays || []).filter((day) => day !== values.day),
    rubric: defaults.rubric,
    rubricVersion: defaults.rubricVersion,
    rewardVersion: defaults.rewardVersion,
    markingInstructions:
      base.markingInstructions ||
      "Rate all five observable criteria from zero to four using the submitted evidence. Explain each rating and verify claims. Human review is required before approval.",
    championPrompt:
      base.championPrompt ||
      "Explain one verified research claim, demonstrate your reasoning without assistance, and describe one limitation and the independent evidence used.",
    inaccessiblePolicy: base.inaccessiblePolicy || defaults.inaccessiblePolicy,
  };
  if (values.selectionMode === "research-2026-11-12") {
    const groups = values.groups || [];
    const members = groups.flatMap((g) => g.members);
    const ids = values.roster.map((p) => p._id);
    if (
      values.preparing &&
      (!groups.length ||
        groups.some((g) => g.members.length !== 5) ||
        members.length !== ids.length ||
        new Set(members).size !== ids.length ||
        ids.some((id) => !members.includes(id)))
    )
      throw new Error(
        "Put every active player into one research group of exactly five.",
      );
    if (values.preparing && !values.reviewed)
      throw new Error(
        "Review all 51 questions and confirm the question bank before preparing Day 1.",
      );
    config.researchGroups = groups.map((g) => ({ members: [...g.members] }));
    config.questionSelection = "PLAYER_CHOICE";
    config.bankApproval = values.reviewed
      ? base.bankApproval ||
        "Centre Command confirmed review of all 51 supplied research questions, including Movies, Social Media and Relationships, for this cohort."
      : "";
  }
  return config;
}
