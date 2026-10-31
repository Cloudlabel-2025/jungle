import { randomUUID } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { cohortOf, prepareDay, dayVisible } from "./week-one-rules.js";
import { ensureWeekOne, lockWeekOne } from "./week-one.js";
import {
  defaultSetup,
  validateSetup,
  fail,
  requiredText,
  threadUrl,
  baselineScore,
  desiredRewards,
  championCandidates,
  projectRecord,
  publicConfig,
  localParts,
} from "./day-one-rules.js";

const plain = (value) => JSON.parse(JSON.stringify(value));
const scope = (cohortId) =>
  cohortId === "alpha"
    ? { $or: [{ cohortId }, { cohortId: { $exists: false } }] }
    : { cohortId };
const safeUser = (u) => ({
  _id: u._id,
  name: u.name,
  role: u.role,
  cohortId: cohortOf(u),
});
export async function activeDayOne(user, session) {
  const release = await models.WeekOneRelease.findById(cohortOf(user))
    .session(session || null)
    .lean();
  return release?.days[0]?.state === "OPEN";
}
function permit(user, roles) {
  if (!roles.includes(user.role))
    fail("Your role cannot perform this action.", 403);
}
async function audit(user, kind, details, session, userId = user._id) {
  const event = {
    _id: randomUUID(),
    cohortId: cohortOf(user),
    userId,
    actorId: user._id,
    kind,
    createdAt: new Date(),
    details,
  };
  await models.DayOneEvent.create([event], { session });
  return event._id;
}
export async function dayOneSignIn(user) {
  await audit(user, "SIGN_IN", { role: user.role, cohortId: cohortOf(user) });
}
export async function dayOneSnapshot(user, now = new Date()) {
  await connect();
  const cohortId = cohortOf(user),
    cc = user.role === "CENTRE_COMMAND",
    gamer = user.role === "GAMER";
  const setup = await models.DayOneSetup.findById(cohortId).lean();
  const release = await models.WeekOneRelease.findById(cohortId).lean();
  const day = release?.days[0];
  const visible = dayVisible(day);
  if (gamer && !visible)
    return {
      user: safeUser(user),
      cohortId,
      serverTime: now,
      state: "LOCKED",
      config: null,
      records: [],
      roster: [safeUser(user)],
      events: [],
    };
  const roster = gamer
    ? [safeUser(user)]
    : (
        await models.User.find({
          role: "GAMER",
          active: { $ne: false },
          ...scope(cohortId),
        })
          .select("_id name role cohortId")
          .sort({ name: 1 })
          .lean()
      ).map(safeUser);
  const raw = await models.DayOneRecord.find({
    cohortId,
    ...(gamer ? { userId: user._id } : {}),
  }).lean();
  const events = await models.DayOneEvent.find({
    cohortId,
    ...(gamer ? { userId: user._id } : {}),
    ...(!cc
      ? {
          kind: {
            $nin: [
              "ASSESSMENT_SAVED",
              "BASELINE_APPROVED",
              "CHAMPION_SELECTED",
              "CHAMPION_RELEASED",
              "SETUP_SAVED",
              "GAME_RELEASED",
            ],
          },
        }
      : {}),
  })
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  return plain({
    user: safeUser(user),
    cohortId,
    serverTime: now,
    state: day?.state || "DRAFT",
    agenda: visible ? day.agenda || null : null,
    roster,
    config: publicConfig(
      visible ? day.content : gamer ? null : setup?.released,
    ),
    revision: setup?.editVersion || 0,
    ...(cc
      ? {
          draft: setup?.draft || defaultSetup(),
          needsBaselineUpgrade: Boolean(
            setup?.draft &&
            setup.draft.rubricVersion !== defaultSetup().rubricVersion,
          ),
          versions: (setup?.versions || []).map((c) => ({
            version: c.version,
            releasedAt: c.releasedAt,
          })),
          champion: setup?.champion || null,
          candidates: championCandidates(raw),
        }
      : {}),
    records: raw.map((r) => projectRecord(r, user.role, setup?.champion)),
    events: cc
      ? events
      : events.map((e) => ({
          ...e,
          details: e.details?.before
            ? {
                before: projectRecord(
                  {
                    _id: e.userId,
                    userId: e.userId,
                    energy: 5,
                    data: e.details.before,
                  },
                  user.role,
                ),
                after: projectRecord(
                  {
                    _id: e.userId,
                    userId: e.userId,
                    energy: 5,
                    data: e.details.after,
                  },
                  user.role,
                ),
                reason: e.details.reason,
              }
            : e.details,
        })),
  });
}
function reconcileRewards(record, eventId, actorId, now) {
  const desired = desiredRewards(record),
    d = record.data;
  d.ledger ||= [];
  for (const [rule, amount] of Object.entries(desired)) {
    const current = d.ledger
      .filter((l) => l.rule === rule)
      .reduce((sum, l) => sum + l.amount, 0);
    if (current === amount) continue;
    d.ledger.push({
      id: randomUUID(),
      rule,
      amount: amount - current,
      eventId,
      ruleVersion: d.config.rewardVersion,
      eventTime:
        rule === "clock"
          ? d.clockAt
          : rule === "sod"
            ? d.sod?.at
            : rule === "agenda"
              ? d.agendaAcknowledgedAt
              : rule === "acknowledge"
                ? d.acknowledgedAt
                : rule === "submission"
                  ? d.submissions.at(-1)?.at
                  : d.eod?.at,
      verification:
        rule === "submission" ? d.verification?.status : "EVENT_CONFIRMED",
      actorId,
      at: now,
      reason: current
        ? "Amended eligibility; previous ledger entries retained."
        : "Qualifying Day 1 event.",
    });
  }
}
export async function dayOneAction(user, action, body, now = new Date()) {
  const gamerActions = [
    "clock",
    "sod",
    "genre",
    "acknowledge",
    "start",
    "submit",
    "class",
    "eod",
    "response",
    "agenda-view",
    "agenda-ack",
    "draft",
  ];
  const ccActions = [
    "save-setup",
    "release",
    "select-champion",
    "reveal-champion",
    "verify",
    "assessment",
    "approve",
  ];
  if (gamerActions.includes(action)) permit(user, ["GAMER"]);
  else if (ccActions.includes(action)) permit(user, ["CENTRE_COMMAND"]);
  else if (["markers", "extend"].includes(action))
    permit(user, ["MISSION_COMMANDER", "CENTRE_COMMAND"]);
  else fail("Unknown Day 1 action.", 404);
  const cohortId = cohortOf(user),
    at = now.toISOString();
  // Always acquire the release lock before the Day 1 lock so closing and
  // participant writes cannot race, including requests from separate servers.
  await ensureWeekOne(cohortId);
  await models.DayOneSetup.updateOne(
    { _id: cohortId },
    { $setOnInsert: { revision: 0, draft: defaultSetup(), versions: [] } },
    { upsert: true },
  );
  return transaction(async (session) => {
    const release = await lockWeekOne(cohortId, session);
    const day = release.days[0];
    const setup = await models.DayOneSetup.findOneAndUpdate(
      { _id: cohortId },
      { $inc: { revision: 1 } },
      { new: true, session },
    );
    if (["save-setup", "release"].includes(action)) {
      permit(user, ["CENTRE_COMMAND"]);
      if (body.revision !== (setup.editVersion || 0))
        fail("Setup changed in another session. Refresh before saving.", 409);
      setup.editVersion = (setup.editVersion || 0) + 1;
      if (setup.champion?.releasedAt)
        fail("This cohort has completed its Day 1 release.", 409);
      if (!body.config || typeof body.config !== "object")
        fail("Supply a game configuration.");
      const draft = plain(body.config);
      if (!draft || JSON.stringify(draft).length > 50000)
        fail("Invalid game configuration.");
      setup.draft = draft;
      if (action === "release") {
        const c = validateSetup(draft);
        c.version = (setup.released?.version || 0) + 1;
        c.genres = c.genres.map((g) => ({ ...g, version: c.version }));
        c.releasedAt = at;
        const previousState = day.state;
        prepareDay(release, 1, c, user._id, at);
        release.markModified("days");
        await release.save({ session });
        await models.WeekOneEvent.create(
          [
            {
              _id: randomUUID(),
              cohortId,
              actorId: user._id,
              kind: "PREPARE",
              createdAt: now,
              details: {
                day: 1,
                previousState,
                state: "PREPARED",
                contentVersion: c.version,
              },
            },
          ],
          { session },
        );
        setup.released = c;
        setup.draft = c;
        setup.versions.push(c);
      }
      setup.markModified("draft");
      setup.markModified("released");
      await setup.save({ session });
      await audit(
        user,
        action === "release" ? "GAME_RELEASED" : "SETUP_SAVED",
        { version: setup.released?.version, config: publicConfig(draft) },
        session,
      );
      return { success: true };
    }
    if (["select-champion", "reveal-champion"].includes(action)) {
      permit(user, ["CENTRE_COMMAND"]);
      const records = await models.DayOneRecord.find({ cohortId })
        .session(session)
        .lean();
      const outstanding = records.some(
        (r) =>
          r.data.submissions?.length &&
          r.data.verification?.status !== "INACCESSIBLE" &&
          (!r.data.assessment?.approvedAt ||
            r.data.verification?.status !== "VERIFIED"),
      );
      if (outstanding)
        fail(
          "Resolve or approve every submitted baseline before selecting the Champion.",
          409,
        );
      if (day.state !== "CLOSED")
        fail("Champion selection is available after Day 1 closes.", 409);
      const candidates = championCandidates(records);
      if (action === "select-champion") {
        if (setup.champion?.releasedAt)
          fail("Champion has already been revealed.", 409);
        if (!candidates.includes(body.userId))
          fail("Choose a Gamer with the highest approved baseline.");
        const reason = requiredText(
          body.reason,
          "Champion decision reason",
          10,
          2000,
        );
        setup.champion = {
          userId: body.userId,
          reason,
          selectedBy: user._id,
          selectedAt: at,
          prompt: setup.released.championPrompt,
          revealAfter: setup.released.revealAfter,
        };
      } else {
        if (setup.champion?.releasedAt) return { success: true };
        const outcomes = await models.WeekOneProgram.findById(cohortId)
          .session(session)
          .lean();
        if (!outcomes?.data.locked || !outcomes.data.publications?.length)
          fail(
            "Research Champion release requires MC signoff and CC publication of Week 1 results.",
            409,
          );
        if (!setup.champion || !candidates.includes(setup.champion.userId))
          fail("Select and document an eligible Champion first.", 409);
        if (
          release.days[4].state !== "CLOSED" ||
          now < new Date(setup.champion.revealAfter)
        )
          fail(
            "The Champion badge and prompt stay locked until the end of Week 1.",
            409,
          );
        requiredText(body.reason, "Week 1 announcement confirmation", 10, 2000);
        setup.champion = {
          ...setup.champion,
          releasedAt: at,
          releasedBy: user._id,
          releaseReason: body.reason,
        };
      }
      setup.markModified("champion");
      await setup.save({ session });
      await audit(
        user,
        action === "select-champion"
          ? "CHAMPION_SELECTED"
          : "CHAMPION_RELEASED",
        setup.champion,
        session,
        setup.champion.userId,
      );
      return { success: true };
    }
    if (
      gamerActions.includes(action) &&
      day.state !== "OPEN" &&
      !["submit", "draft"].includes(action)
    )
      fail("Day 1 is not open. Closed days are read-only.", 409);
    const userId =
      user.role === "GAMER"
        ? user._id
        : requiredText(body.userId, "Gamer ID", 1, 100);
    const target = await models.User.findOne({
      _id: userId,
      role: "GAMER",
      active: { $ne: false },
      ...scope(cohortId),
    }).session(session);
    if (!target) fail("Gamer not found in your cohort.", 404);
    let record = await models.DayOneRecord.findById(
      `${cohortId}:${userId}`,
    ).session(session);
    if (action === "clock" && !record) {
      if (!day.content) fail("MC or CC has not opened the game yet.", 409);
      if (localParts(now, day.content.timeZone).day !== day.content.day)
        fail("Clock-in is available on the configured Day 1 date.", 409);
      record = new models.DayOneRecord({
        _id: `${cohortId}:${userId}`,
        cohortId,
        userId,
        energy: 5,
        initializedAt: now,
        version: 0,
        data: {
          config: plain(day.content),
          availableAt: new Date(
            Math.max(
              Date.parse(day.content.availableAt),
              Date.parse(day.openedAt),
            ),
          ).toISOString(),
          submissions: [],
          ledger: [],
        },
      });
    }
    if (!record) fail("The Gamer must clock in first.", 409);
    if (body.version !== undefined && body.version !== record.version)
      fail("This record changed. Refresh and review it before saving.", 409);
    const d = record.data,
      before = plain(d);
    if (
      gamerActions.includes(action) &&
      day.state !== "OPEN" &&
      !(
        ["submit", "draft"].includes(action) &&
        d.extensions?.at(-1) &&
        now <= new Date(d.deadline)
      )
    )
      fail(
        "Day 1 is not open. Closed days are read-only without an authorised extension.",
        409,
      );
    const locked = Boolean(setup.champion?.releasedAt);
    if (locked && !["clock", "class"].includes(action))
      fail("Day 1 records are locked after the Week 1 announcement.", 409);
    if (action === "clock") {
      if (d.clockAt) return { success: true };
      const existing = await models.Attendance.findOne({
        userId,
        day: d.config.day,
      })
        .session(session)
        .lean();
      d.clockAt = existing?.clockAt
        ? new Date(existing.clockAt).toISOString()
        : at;
      await models.Attendance.updateOne(
        { userId, day: d.config.day },
        {
          $setOnInsert: {
            _id: randomUUID(),
            userId,
            day: d.config.day,
            clockAt: new Date(d.clockAt),
            onTime: Date.parse(d.clockAt) <= Date.parse(d.config.clockCutoff),
          },
        },
        { upsert: true, session },
      );
    }
    if (action === "sod") {
      if (d.sod) return { success: true };
      d.sod = {
        text: requiredText(body.text, "Start-of-day plan", 10, 4000),
        at,
      };
    }
    if (["agenda-view", "agenda-ack"].includes(action)) {
      if (!day.agenda)
        fail("The MC has not published today's agenda yet.", 409);
      if (action === "agenda-view") {
        if (d.agendaViewedAt) return { success: true };
        d.agendaViewedAt = at;
        d.agendaVersion = day.agenda.version;
      } else {
        if (d.agendaAcknowledgedAt) return { success: true };
        if (!d.agendaViewedAt)
          fail("Open and read the agenda before acknowledging it.", 409);
        d.agendaAcknowledgedAt = at;
      }
    }
    if (action === "genre") {
      if (d.startedAt || d.acknowledgedAt)
        fail("Your genre is locked after challenge acknowledgement.", 409);
      if (!d.config.genres.some((g) => g.id === body.genreId))
        fail("Choose one of the four released genres.");
      d.genreId = body.genreId;
    }
    if (action === "acknowledge") {
      if (d.acknowledgedAt) return { success: true };
      if (!d.genreId) fail("Choose a genre first.");
      if (now < new Date(d.availableAt))
        fail("The challenge is not yet available.", 409);
      d.acknowledgedAt = at;
    }
    if (action === "start") {
      if (d.startedAt) return { success: true };
      if (!d.acknowledgedAt) fail("Read and acknowledge your challenge first.");
      d.startedAt = at;
      d.deadline = new Date(
        now.getTime() + d.config.durationMinutes * 60000,
      ).toISOString();
    }
    if (action === "extend") {
      const deadline = Date.parse(body.deadline);
      if (
        typeof body.deadline !== "string" ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(body.deadline) ||
        !Number.isFinite(deadline) ||
        !d.startedAt ||
        deadline <=
          Math.max(
            now.getTime(),
            Date.parse(
              d.deadline ||
                new Date(Date.parse(d.startedAt) + 90 * 60000).toISOString(),
            ),
          )
      )
        fail(
          "Extend a started attempt to a valid future deadline with a time-zone offset.",
        );
      (d.extensions ||= []).push({
        previousDeadline: d.deadline,
        deadline: new Date(deadline).toISOString(),
        reason: requiredText(body.reason, "Extension reason", 10, 2000),
        actorId: user._id,
        at,
      });
      d.deadline = new Date(deadline).toISOString();
    }
    if (action === "draft") {
      if (!d.startedAt) fail("Start your research mission first.", 409);
      if (typeof body.url !== "string" || body.url.length > 2000)
        fail("Draft URL must contain at most 2000 characters.");
      d.draft = { url: body.url, savedAt: at };
    }
    if (action === "submit") {
      if (!d.startedAt) fail("Start your research mission first.");
      const url = threadUrl(body.url);
      if (d.submissions.at(-1)?.url === url) return { success: true };
      const reason = d.submissions.length
        ? requiredText(body.reason, "Link revision reason", 10, 2000)
        : "Initial submission";
      d.submissions.push({
        id: randomUUID(),
        url,
        at,
        reason,
        actorId: user._id,
        configVersion: d.config.version,
        late:
          now >
          new Date(
            d.deadline ||
              Date.parse(d.startedAt) + d.config.durationMinutes * 60000,
          ),
      });
      d.verification = { status: "PENDING", revision: d.submissions.at(-1).id };
      d.draft = null;
      d.assessment = null;
    }
    if (action === "class") {
      if (d.classAt) return { success: true };
      d.classAt = at;
    }
    if (action === "eod") {
      if (d.eod) return { success: true };
      d.eod = {
        text: requiredText(body.text, "End-of-day reflection", 10, 6000),
        mode: body.mode === "VOICE" ? "VOICE" : "TEXT",
        at,
      };
    }
    if (action === "response") {
      const text = requiredText(body.text, "Workplace response", 20, 2000);
      if (d.responses?.at(-1)?.text === text) return { success: true };
      d.responses = [...(d.responses || []), { text, at, actorId: user._id }];
    }
    if (action === "verify") {
      const current = d.submissions.at(-1);
      if (!current || body.revisionId !== current.id)
        fail("Review the current submission revision.", 409);
      if (!["VERIFIED", "INACCESSIBLE"].includes(body.status))
        fail("Choose accessible or inaccessible.");
      d.verification = {
        status: body.status,
        revision: current.id,
        actorId: user._id,
        at,
        reason: requiredText(body.reason, "Verification note", 10, 2000),
      };
      if (
        body.status === "VERIFIED" &&
        !d.firstQualifyingSubmissionAt &&
        Date.parse(current.at) >= Date.parse(d.startedAt) &&
        Date.parse(current.at) <=
          Date.parse(
            d.deadline ||
              new Date(
                Date.parse(d.startedAt) + d.config.durationMinutes * 60000,
              ).toISOString(),
          )
      )
        d.firstQualifyingSubmissionAt = current.at;
      if (body.status !== "VERIFIED") d.assessment = null;
    }
    if (action === "assessment") {
      if (d.verification?.status !== "VERIFIED")
        fail("Verify link access before entering ratings.", 409);
      const score = baselineScore(body.ai, body.human, d.config.rubric);
      d.assessment = {
        ...score,
        ai: body.ai,
        human: body.human,
        revisionId: d.submissions.at(-1).id,
        rubricVersion: d.config.rubricVersion,
        version: (d.assessment?.version || 0) + 1,
        actorId: user._id,
        at,
        notes: requiredText(
          body.notes,
          "Assessment evidence / reason",
          10,
          4000,
        ),
      };
    }
    if (action === "approve") {
      if (
        !d.assessment ||
        d.verification?.status !== "VERIFIED" ||
        d.assessment.revisionId !== d.submissions.at(-1)?.id
      )
        fail("Save a verified assessment of the current link first.", 409);
      if (d.assessment.approvedAt) return { success: true };
      d.assessment = { ...d.assessment, approvedAt: at, approvedBy: user._id };
      d.originalBaseline ||= plain(d.assessment);
    }
    if (action === "markers") {
      if (
        !["sod", "eod", "acknowledged", "usefulResponse"].includes(
          body.marker,
        ) ||
        typeof body.value !== "boolean"
      )
        fail("Choose a valid behaviour marker.");
      requiredText(body.reason, "Override reason", 10, 2000);
      d.markerOverrides = { ...d.markerOverrides, [body.marker]: body.value };
    }
    if (
      ["submit", "verify", "assessment", "approve"].includes(action) &&
      setup.champion
    ) {
      setup.champion = null;
      setup.markModified("champion");
      await setup.save({ session });
    }
    const kind =
      action === "assessment"
        ? "ASSESSMENT_SAVED"
        : action === "approve"
          ? "BASELINE_APPROVED"
          : action.toUpperCase();
    const eventId = await audit(
      user,
      kind,
      { before, after: plain(d), reason: body.reason },
      session,
      userId,
    );
    reconcileRewards(record, eventId, user._id, at);
    // Autosaving a URL must not invalidate the learner's submission form.
    if (action !== "draft") record.version += 1;
    record.markModified("data");
    await record.save({ session });
    return { success: true };
  });
}
