export const frozenRubric = [
  { key: "framing", name: "Problem framing", max: 6 },
  { key: "reasoning", name: "Investigation & reasoning", max: 7 },
  { key: "verification", name: "Experimentation & verification", max: 7 },
  { key: "communication", name: "Requirements communication", max: 8 },
  { key: "adaptability", name: "Initiative & adaptability", max: 5 },
];
export function defaultSetup() {
  return {
    name: "Alpha Cohort 2026",
    timeZone: "Asia/Kolkata",
    day: "",
    startTime: "09:00",
    endTime: "17:00",
    availableAt: "",
    officialStart: "",
    clockCutoff: "",
    closingCutoff: "",
    revealAfter: "",
    weekdays: [1, 2, 3, 4, 5],
    holidays: [],
    durationMinutes: 90,
    genres: ["Automobiles", "Nature", "Economics", "Space"].map((name, i) => ({
      id: `genre-${i + 1}`,
      name,
      question: "",
      version: 1,
    })),
    rubric: frozenRubric,
    rubricVersion: "wild6-day1-v2-33",
    rewardVersion: "day1-v1.2",
    markingInstructions: "",
    championPrompt: "",
    inaccessiblePolicy:
      "Allow a corrected link; retain every revision and reverify before assessment.",
  };
}
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function requiredText(value, label, min = 1, max = 8000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${label} must contain ${min}-${max} characters.`);
  return value.trim();
}
export function threadUrl(value) {
  const raw = requiredText(value, "AI conversation URL", 10, 2000);
  if (/\s/.test(raw))
    fail("Submit exactly one conversation-thread URL, without spaces.");
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("Enter one complete HTTPS conversation-thread URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    url.pathname === "/"
  )
    fail(
      "Enter one HTTPS conversation-thread URL, including its conversation path.",
    );
  return url.href;
}
export function validateSetup(value) {
  const c = structuredClone(value);
  c.name = requiredText(c.name, "Cohort name", 2, 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone: c.timeZone }).format();
  } catch {
    fail("Choose a valid IANA time zone.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.day)) fail("Set the Day 1 date.");
  for (const key of ["startTime", "endTime"])
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c[key]))
      fail("Working hours must use HH:MM.");
  if (c.startTime >= c.endTime)
    fail("Working hours must start before they end.");
  if (
    !Array.isArray(c.weekdays) ||
    !c.weekdays.length ||
    c.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
  )
    fail("Select at least one working weekday.");
  if (
    !Array.isArray(c.holidays) ||
    c.holidays.some((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x))
  )
    fail("Holidays must use YYYY-MM-DD.");
  for (const key of [
    "availableAt",
    "officialStart",
    "clockCutoff",
    "closingCutoff",
    "revealAfter",
  ]) {
    if (
      typeof c[key] !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(c[key]) ||
      !Number.isFinite(Date.parse(c[key]))
    )
      fail(`Set ${key} with an explicit time-zone offset.`);
    c[key] = new Date(c[key]).toISOString();
  }
  if (Date.parse(c.clockCutoff) > Date.parse(c.closingCutoff))
    fail("Clock-in cut-off must precede closing.");
  if (Date.parse(c.availableAt) >= Date.parse(c.closingCutoff))
    fail("Challenge availability must precede closing.");
  if (
    localParts(c.officialStart, c.timeZone).day !== c.day ||
    Date.parse(c.officialStart) >= Date.parse(c.closingCutoff)
  )
    fail("The official start must fall on Day 1 before closing.");
  if (Date.parse(c.revealAfter) < Date.parse(c.closingCutoff))
    fail(
      "Champion reveal cannot precede Day 1 closing. Week 1 closure is also required.",
    );
  if (
    !Array.isArray(c.genres) ||
    c.genres.length !== 4 ||
    new Set(c.genres.map((g) => g.id)).size !== 4
  )
    fail("Configure four distinct genres.");
  c.genres = c.genres.map((g) => ({
    id: requiredText(g.id, "Genre ID", 1, 40),
    name: requiredText(g.name, "Genre name", 2, 80),
    question: requiredText(g.question, "Research question", 20),
    version: c.version || 1,
  }));
  if (JSON.stringify(c.rubric) !== JSON.stringify(frozenRubric))
    fail(
      "The frozen Day 1 rubric must retain its five criteria and 6/7/7/8/5 weights.",
    );
  c.durationMinutes = 90;
  c.rubricVersion = defaultSetup().rubricVersion;
  c.rewardVersion = defaultSetup().rewardVersion;
  c.markingInstructions = requiredText(
    c.markingInstructions,
    "External-AI marking instructions",
    20,
  );
  c.championPrompt = requiredText(
    c.championPrompt,
    "Advanced AI verification prompt",
    20,
  );
  c.inaccessiblePolicy = requiredText(
    c.inaccessiblePolicy,
    "Link correction policy",
    10,
  );
  return c;
}
export function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(date))
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: new Date(
      `${parts.year}-${parts.month}-${parts.day}T12:00:00Z`,
    ).getUTCDay(),
  };
}
// Count real working time, including partial minutes and time-zone/DST changes.
// Trophy windows only need to distinguish <=30, <=60 and >60.
export function workingMinutes(from, to, calendar, cap = 61) {
  let cursor = Date.parse(from),
    end = Date.parse(to),
    total = 0;
  if (!Number.isFinite(cursor) || !Number.isFinite(end) || cursor >= end)
    return 0;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendar.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  while (cursor < end && total < cap) {
    const next = Math.min(end, (Math.floor(cursor / 60000) + 1) * 60000);
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(cursor)).map((x) => [x.type, x.value]),
    );
    const day = `${p.year}-${p.month}-${p.day}`,
      time = `${p.hour}:${p.minute}`;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (
      calendar.weekdays.includes(weekday) &&
      !calendar.holidays.includes(day) &&
      time >= calendar.startTime &&
      time < calendar.endTime
    )
      total += (next - cursor) / 60000;
    cursor = next;
  }
  return Math.min(total, cap);
}
export function baselineScore(ai, human, rubric) {
  if (
    ![ai, human].every(
      (r) =>
        Array.isArray(r) &&
        r.length === rubric.length &&
        r.every(
          (n) =>
            typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 4,
        ),
    )
  )
    fail("Enter all five AI and human ratings from 0 to 4.");
  const criteria = rubric.map((r, i) => ({
    ...r,
    ai: ai[i],
    human: human[i],
    score: ((ai[i] + human[i]) / 8) * r.max,
  }));
  return {
    criteria,
    total: criteria.reduce((sum, r) => sum + r.score, 0),
    max: rubric.reduce((sum, r) => sum + r.max, 0),
    unassessed: 8,
  };
}
export function desiredRewards(record) {
  const d = record.data,
    c = d.config;
  const ack = d.acknowledgedAt
    ? workingMinutes(d.availableAt, d.acknowledgedAt, c)
    : null;
  const submission = d.submissions?.at(-1);
  const currentRules = c.rewardVersion === "day1-v1.2";
  const qualifyingAt = currentRules
    ? d.firstQualifyingSubmissionAt || submission?.at
    : submission?.at;
  const onTimeLink =
    submission &&
    d.startedAt &&
    Date.parse(qualifyingAt) >= Date.parse(d.startedAt) &&
    Date.parse(qualifyingAt) <=
      Date.parse(
        d.deadline ||
          new Date(
            Date.parse(d.startedAt) + c.durationMinutes * 60000,
          ).toISOString(),
      );
  return {
    clock:
      d.clockAt && Date.parse(d.clockAt) <= Date.parse(c.clockCutoff) ? 1 : 0,
    ...(currentRules
      ? { agenda: agendaOnTime(d) ? 4 : 0 }
      : {
          sod:
            d.sod &&
            (!d.startedAt || Date.parse(d.sod.at) <= Date.parse(d.startedAt))
              ? 4
              : 0,
        }),
    acknowledge: ack === null ? 0 : ack <= 30 ? 5 : ack <= 60 ? 2 : 0,
    submission:
      onTimeLink &&
      d.verification?.status === "VERIFIED" &&
      d.verification.revision === submission.id
        ? 6
        : 0,
    eod: d.eod && Date.parse(d.eod.at) <= Date.parse(c.closingCutoff) ? 4 : 0,
  };
}
export function agendaOnTime(d) {
  const start = Date.parse(d.config.officialStart),
    ack = Date.parse(d.agendaAcknowledgedAt);
  return Boolean(
    d.agendaViewedAt &&
    Number.isFinite(start) &&
    ack >= start &&
    ack <= start + 30 * 60000,
  );
}
export function operationalMarkers(d) {
  const provisional = {
    sod: Boolean(
      d.sod &&
      (!d.startedAt || Date.parse(d.sod.at) <= Date.parse(d.startedAt)),
    ),
    agenda: agendaOnTime(d),
    eod: Boolean(
      d.eod && Date.parse(d.eod.at) <= Date.parse(d.config.closingCutoff),
    ),
    acknowledged: Boolean(
      d.acknowledgedAt &&
      workingMinutes(d.availableAt, d.acknowledgedAt, d.config) <= 60,
    ),
    usefulResponse: Boolean(
      d.responses?.some(
        (r) =>
          r.text.length >= 20 &&
          Date.parse(r.at) <= Date.parse(d.config.closingCutoff),
      ),
    ),
  };
  return { ...provisional, ...d.markerOverrides };
}
export function championCandidates(records) {
  const approved = records.filter((r) => r.data.assessment?.approvedAt);
  if (!approved.length) return [];
  const high = Math.max(...approved.map((r) => r.data.assessment.total));
  return approved
    .filter((r) => Math.abs(r.data.assessment.total - high) < 1e-9)
    .map((r) => r.userId);
}
export function publicConfig(config) {
  if (!config) return null;
  const { championPrompt, markingInstructions, ...safe } = config;
  return safe;
}
export function projectRecord(record, role, champion) {
  if (!record) return null;
  const d = record.data;
  const common = {
    _id: record._id,
    userId: record.userId,
    version: record.version,
    energy: record.energy,
    initializedAt: record.initializedAt,
    clockAt: d.clockAt,
    sod: d.sod,
    eod: d.eod,
    genreId: d.genreId,
    acknowledgedAt: d.acknowledgedAt,
    startedAt: d.startedAt,
    deadline:
      d.deadline ||
      (d.startedAt
        ? new Date(
            Date.parse(d.startedAt) + d.config.durationMinutes * 60000,
          ).toISOString()
        : null),
    extensions: d.extensions || [],
    draft: d.draft,
    firstQualifyingSubmissionAt: d.firstQualifyingSubmissionAt,
    agendaViewedAt: d.agendaViewedAt,
    agendaAcknowledgedAt: d.agendaAcknowledgedAt,
    classAt: d.classAt,
    responses: d.responses || [],
    submissions: d.submissions || [],
    verification: d.verification,
    ledger: d.ledger || [],
    trophies: Object.values(desiredRewards(record)).reduce((a, b) => a + b, 0),
    badge: d.verification?.status === "VERIFIED",
    markers: operationalMarkers(d),
    availableAt: d.availableAt,
    config: publicConfig(d.config),
  };
  if (role === "CENTRE_COMMAND")
    return {
      ...common,
      config: d.config,
      assessment: d.assessment,
      markerOverrides: d.markerOverrides,
    };
  if (role === "GAMER")
    return {
      ...common,
      assessmentStatus: d.assessment?.approvedAt
        ? "Approved privately"
        : d.assessment
          ? "Under review"
          : "Awaiting assessment",
      ...(champion?.releasedAt && champion.userId === record.userId
        ? {
            champion: {
              badge: "Research Champion",
              prompt: champion.prompt,
              releasedAt: champion.releasedAt,
            },
          }
        : {}),
    };
  return common;
}
