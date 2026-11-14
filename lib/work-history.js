import { models, connect } from "./db.js";
import { playerStage, requireExpedition } from "./player-stage.js";
import { localParts } from "./day-one-rules.js";
import { scheduleInstant } from "./day-one-setup.js";
import { syncAttendance } from "./attendance.js";
import { sessionAt, workSessions, workTime } from "./work-sessions.js";
import { modules } from "./catalog.js";

const PAGE = 100;
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const dayOneKinds = {
  GENRE: "Research genre selected",
  QUESTION: "Research question locked",
  ACKNOWLEDGE: "Research question acknowledged",
  START: "Research started",
  DRAFT: "Research link draft saved",
  SUBMIT: "Research chat submitted",
  SOD: "Start-of-day plan submitted",
  EOD: "End-of-day reflection submitted",
  CLASS: "Class attendance saved",
  RESPONSE: "Workplace response submitted",
  "AGENDA-ACK": "Agenda acknowledged",
  "REFLECTION-DRAFT": "Reflection draft saved",
};
const weekKinds = {
  ATTEMPT_STARTED: "Activity started",
  "ATTEMPT-SAVE": "Activity draft saved",
  "ATTEMPT-SUBMIT": "Activity submitted",
  CHALLENGE_STARTED: "Challenge started",
  SOD: "Start-of-day plan submitted",
  EOD: "End-of-day reflection submitted",
  REFLECTION_DRAFT: "Reflection draft saved",
  COMPASS: "Weekly reflection submitted",
  "AGENDA-ACK": "Agenda acknowledged",
  "RECAP-ACK": "Class recap acknowledged",
};
const text = (value) =>
  typeof value === "string" ? value.slice(0, 12000) : "";
const lines = (value) =>
  Object.entries(value || {})
    .filter(
      ([, v]) =>
        ["string", "number", "boolean"].includes(typeof v) || Array.isArray(v),
    )
    .map(([key, v]) => ({
      label: key.replace(/[-_]/g, " "),
      text: Array.isArray(v)
        ? v.filter((x) => typeof x === "string").join("\n")
        : text(String(v)),
    }));
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};
const iso = (value) => new Date(workTime(value)).toISOString();
async function ownPlayer(actor) {
  await connect();
  const user = actor && (await models.User.findById(actor._id).lean());
  if (!user || user.role !== "GAMER" || user.active === false)
    fail("Only active players can read their work history.", 403);
  return user;
}

// A stable cursor across sources, including several events at the same millisecond.
function pageFilter(source, field, start, end, cursor) {
  const range = { [field]: { $gte: start, $lt: end } };
  if (!cursor) return range;
  const split = cursor.id.indexOf(":");
  const prefix = cursor.id.slice(0, split),
    raw = cursor.id.slice(split + 1);
  const at = new Date(cursor.at);
  if (source < prefix) return { $and: [range, { [field]: { $lte: at } }] };
  if (source > prefix) return { $and: [range, { [field]: { $lt: at } }] };
  return {
    $and: [
      range,
      { $or: [{ [field]: { $lt: at } }, { [field]: at, _id: { $lt: raw } }] },
    ],
  };
}

export async function workHistory(actor, params = {}, now = new Date()) {
  const user = await ownPlayer(actor),
    cohortId = user.cohortId || "alpha";
  if (Object.keys(params).some((k) => !["date", "cursor"].includes(k)))
    fail("Choose a date; player identity comes from your sign-in.");
  const [cohort, dayOne, stage] = await Promise.all([
    models.Cohort.findById(cohortId).lean(),
    models.DayOneRecord.findOne({ cohortId, userId: user._id })
      .select("data.config.timeZone")
      .lean(),
    playerStage(user),
  ]);
  let zone =
    cohort?.workingCalendar?.timeZone ||
    dayOne?.data?.config?.timeZone ||
    "Asia/Kolkata";
  const date = params.date || localParts(now, zone).day;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    fail("Choose a valid work date.");
  const attendanceZone = await models.Attendance.findOne({
    userId: user._id,
    day: date,
  })
    .select("timeZone")
    .lean();
  zone = attendanceZone?.timeZone || zone;
  const today = localParts(now, zone).day;
  if (date > today) fail("Choose today or an earlier work date.");
  const start = new Date(scheduleInstant(date, "00:00", zone));
  const following = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  const end = new Date(scheduleInstant(following, "00:00", zone));
  let cursor = null;
  if (params.cursor) {
    try {
      if (params.cursor.length > 2000) throw Error();
      cursor = JSON.parse(
        Buffer.from(params.cursor, "base64url").toString("utf8"),
      );
      if (
        typeof cursor.id !== "string" ||
        !cursor.id.includes(":") ||
        !Number.isFinite(Date.parse(cursor.at)) ||
        workTime(cursor.at) < start.getTime() ||
        workTime(cursor.at) >= end.getTime()
      )
        throw Error();
    } catch {
      fail("This history page link is invalid. Choose the date again.");
    }
  }
  await syncAttendance(now, { userId: user._id });
  const rows = await models.Attendance.find({
    userId: user._id,
    clockAt: { $lt: end },
    $or: [
      { clockAt: { $gte: start } },
      { clockOutAt: { $gte: start } },
      { sessionState: "ACTIVE" },
      { sessionEvents: { $elemMatch: { type: "OUT", at: { $gte: start } } } },
    ],
  })
    .sort({ clockAt: -1 })
    .limit(100)
    .lean();
  const periods = workSessions(rows);
  const sessions = periods
    .filter(
      (s) =>
        s.start < end.getTime() &&
        (s.end ?? s.boundary ?? Infinity) > start.getTime(),
    )
    .map((s) => ({
      id: s.id,
      clockInAt: iso(s.start),
      clockOutAt: s.end == null ? null : iso(s.end),
      reason: s.reason,
      ongoing: !s.unknownEnd && s.end == null && s.boundary == null,
      unknownEnd: Boolean(s.unknownEnd),
      clockedSeconds: s.unknownEnd
        ? null
        : Math.max(
            0,
            Math.floor(
              (Math.min(s.end ?? s.boundary ?? now.getTime(), end.getTime()) -
                Math.max(s.start, start.getTime())) /
                1000,
            ),
          ),
    }));
  const fetchRows = (model, source, field, filter, select) =>
    models[model]
      .find({ ...filter, ...pageFilter(source, field, start, end, cursor) })
      .select(select)
      .sort({ [field]: -1, _id: -1 })
      .limit(PAGE + 1)
      .lean();
  const [
    discovery,
    week,
    tasks,
    projects,
    journals,
    progress,
    checkpoints,
    pilot,
  ] = await Promise.all([
    fetchRows(
      "DayOneEvent",
      "day1",
      "createdAt",
      {
        cohortId,
        userId: user._id,
        actorId: user._id,
        kind: { $in: Object.keys(dayOneKinds) },
      },
      "kind createdAt details.after.sod details.after.eod details.after.draft details.after.reflectionDrafts details.before.reflectionDrafts details.after.researchSelection.genreName details.after.researchAssignment details.after.genreId details.after.config.genres details.after.submissions details.after.responses",
    ),
    fetchRows(
      "WeekOneEvent",
      "week1",
      "createdAt",
      { cohortId, actorId: user._id, kind: { $in: Object.keys(weekKinds) } },
      "kind createdAt details",
    ),
    stage.flight
      ? []
      : fetchRows(
          "TaskEvent",
          "task",
          "createdAt",
          { actorId: user._id },
          "kind createdAt details",
        ),
    stage.flight
      ? []
      : fetchRows(
          "ProjectEvent",
          "project",
          "createdAt",
          { actorId: user._id },
          "kind createdAt details",
        ),
    stage.flight
      ? []
      : fetchRows(
          "Journal",
          "journal",
          "submittedAt",
          { userId: user._id },
          "submittedAt workDone learnings blockers tomorrowPlan",
        ),
    stage.flight
      ? []
      : fetchRows(
          "Progress",
          "module",
          "completedAt",
          { userId: user._id },
          "completedAt moduleId",
        ),
    stage.flight
      ? []
      : fetchRows(
          "LabCheckpoint",
          "workspace",
          "savedAt",
          { cohortId, userId: user._id },
          "savedAt day version files.path",
        ),
    stage.flight
      ? []
      : fetchRows(
          "PilotEvent",
          "programme",
          "createdAt",
          { cohortId, userId: user._id, state: "COMMAND" },
          "createdAt data.action",
        ),
  ]);
  const ids = [
    ...new Set(week.map((e) => e.details?.attemptId).filter(Boolean)),
  ];
  const attempts = await models.WeekOneAttempt.find({
    _id: { $in: ids },
    cohortId,
    userId: user._id,
  })
    .select("data.activity.name data.savedAt data.draft data.submissions")
    .lean();
  const entries = [];
  const add = (
    source,
    row,
    at,
    title,
    status = "Saved",
    details = [],
    extra = {},
  ) => {
    const session = sessionAt(periods, at);
    entries.push({
      id: `${source}:${row._id}`,
      at: iso(at),
      title,
      status,
      details,
      sessionId: session?.id || null,
      ...extra,
    });
  };
  for (const e of discovery) {
    const d = e.details?.after || {};
    let details = [];
    let link = null;
    if (["GENRE", "QUESTION"].includes(e.kind)) {
      const g = d.config?.genres?.find((g) => g.id === d.genreId);
      details = lines({
        Genre:
          d.researchSelection?.genreName ||
          d.researchAssignment?.genreName ||
          g?.name,
        Question:
          d.researchAssignment?.question?.prompt ||
          (e.kind === "QUESTION" ? g?.question : undefined),
      });
    }
    if (e.kind === "DRAFT") details = lines({ "Research link": d.draft?.url });
    if (e.kind === "SUBMIT") {
      const s = d.submissions?.at(-1);
      details = lines({ "Research link": s?.url });
      link = safeUrl(s?.url);
    }
    if (e.kind === "SOD") details = lines({ Plan: d.sod?.text });
    if (e.kind === "EOD") details = lines({ Reflection: d.eod?.text });
    if (e.kind === "RESPONSE")
      details = lines({ Response: d.responses?.at(-1)?.text });
    if (e.kind === "REFLECTION-DRAFT") {
      const kind = ["sod", "eod"].find(
        (k) =>
          d.reflectionDrafts?.[k]?.revision !==
          e.details?.before?.reflectionDrafts?.[k]?.revision,
      );
      details = lines({
        [kind === "sod" ? "Plan draft" : "Reflection draft"]:
          d.reflectionDrafts?.[kind]?.text,
      });
    }
    add(
      "day1",
      e,
      e.createdAt,
      dayOneKinds[e.kind],
      ["DRAFT", "REFLECTION-DRAFT"].includes(e.kind)
        ? "Draft"
        : ["SUBMIT", "SOD", "EOD", "RESPONSE"].includes(e.kind)
          ? "Submitted"
          : "Saved",
      details,
      link ? { link } : {},
    );
  }
  for (const e of week) {
    const a = attempts.find((a) => a._id === e.details?.attemptId);
    let details = [];
    if (e.kind === "REFLECTION_DRAFT") details = lines(e.details.value);
    if (["SOD", "EOD", "COMPASS"].includes(e.kind)) {
      const value = e.details?.observation?.[e.kind.toLowerCase()];
      details = lines({ Text: value?.text, Answers: value?.answers });
    }
    if (e.kind === "ATTEMPT-SAVE")
      details = lines(
        e.details?.draftAnswers ||
          (a?.data?.savedAt === iso(e.createdAt) ? a.data.draft : null),
      );
    if (e.kind === "ATTEMPT-SUBMIT") {
      const s = a?.data?.submissions?.find(
        (s) => s.id === e.details.submissionId || s.at === iso(e.createdAt),
      );
      details = lines(s?.answers);
    }
    const name = e.details?.activityName || a?.data?.activity?.name;
    add(
      "week1",
      e,
      e.createdAt,
      `${weekKinds[e.kind]}${name ? ` · ${name}` : ""}`,
      e.kind.includes("DRAFT") || e.kind === "ATTEMPT-SAVE"
        ? "Draft"
        : ["SOD", "EOD", "COMPASS", "ATTEMPT-SUBMIT"].includes(e.kind)
          ? "Submitted"
          : "Saved",
      details,
    );
  }
  for (const e of tasks)
    add(
      "task",
      e,
      e.createdAt,
      e.kind === "SUBMITTED" ? "Task submitted" : "Task progress saved",
      e.kind === "SUBMITTED" ? "Submitted" : "Saved",
      lines({
        Summary: e.details?.summary,
        Status: e.details?.after,
        Evidence: e.details?.evidenceReferences,
      }),
    );
  for (const e of projects)
    add(
      "project",
      e,
      e.createdAt,
      `Project ${String(e.kind || "progress")
        .toLowerCase()
        .replaceAll("_", " ")}`,
      "Saved",
      lines({
        Summary: e.details?.summary,
        Evidence: e.details?.evidenceReferences,
      }),
    );
  for (const e of journals)
    add(
      "journal",
      e,
      e.submittedAt,
      "Daily journal submitted",
      "Submitted",
      lines({
        "Work done": e.workDone,
        Learnings: e.learnings,
        Blockers: e.blockers,
        "Next plan": e.tomorrowPlan,
      }),
    );
  for (const e of progress)
    add(
      "module",
      e,
      e.completedAt,
      "Learning module completed",
      "Submitted",
      lines({
        Module:
          modules.find((m) => m._id === e.moduleId)?.title ||
          "Completed module",
      }),
    );
  for (const e of checkpoints)
    add(
      "workspace",
      e,
      e.savedAt,
      "Code workspace saved",
      "Saved",
      [{ label: "Files", text: e.files.map((f) => f.path).join("\n") }],
      { download: `/api/player/work-file?id=${encodeURIComponent(e._id)}` },
    );
  for (const e of pilot)
    add(
      "programme",
      e,
      e.createdAt,
      `${String(e.data?.action || "Programme work").replaceAll("-", " ")} saved`,
    );
  entries.sort(
    (a, b) =>
      workTime(b.at) - workTime(a.at) ||
      (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );
  const page = entries.slice(0, PAGE),
    last = page.at(-1);
  return {
    ownerId: user._id,
    date,
    today,
    timeZone: zone,
    sessions,
    clockedSeconds: sessions.reduce((n, s) => n + (s.clockedSeconds || 0), 0),
    entries: page,
    nextCursor:
      entries.length > PAGE
        ? Buffer.from(JSON.stringify({ at: last.at, id: last.id })).toString(
            "base64url",
          )
        : null,
  };
}

export async function workFile(actor, id) {
  const user = await ownPlayer(actor);
  await requireExpedition(user);
  if (typeof id !== "string" || id.length > 2000)
    fail("Choose a saved workspace.");
  const record = await models.LabCheckpoint.findOne({
    _id: id,
    userId: user._id,
    cohortId: user.cohortId || "alpha",
  }).lean();
  if (!record) fail("Saved workspace not found.", 404);
  return {
    day: record.day,
    timeZone: record.timeZone,
    savedAt: record.savedAt,
    version: record.version,
    files: Object.fromEntries(record.files.map((f) => [f.path, f.content])),
  };
}
