import { randomUUID, createHash } from "node:crypto";
import { models } from "./db.js";
import { activeMinutes, overlaps, comparisonTotals } from "./effort-rules.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, name) => {
  if (typeof v !== "string" || v.trim().length < 3 || v.length > 4000)
    fail(`${name}: enter 3–4000 characters.`);
  return v.trim();
};
const cc = (u) => {
  if (u.role !== "CENTRE_COMMAND")
    fail("Centre Command permission required.", 403);
};
const cohortId = (u) => u.cohortId || "alpha";
const scope = (u) => ({
  cohortId: cohortId(u),
  ...(u.role === "GAMER"
    ? { createdBy: u._id }
    : u.role === "MISSION_COMMANDER"
      ? { assignedTo: u._id }
      : {}),
});
const ticketFor = async (u, id, session) => {
  const t = await models.HelpTicket.findOne({ ...scope(u), _id: id }).session(
    session,
  );
  if (!t) fail("Ticket not found or access denied.", 404);
  return t;
};
async function audit(u, ticketId, kind, details, session) {
  await models.SupportEvent.create(
    [
      {
        _id: randomUUID(),
        cohortId: cohortId(u),
        ticketId,
        actorId: u._id,
        kind,
        details,
        createdAt: new Date(),
      },
    ],
    { session },
  );
}
async function minutes(id, session) {
  return activeMinutes(
    await models.EffortSession.find({ ticketId: id }).session(session).lean(),
  );
}
async function lockTickets(ids, session) {
  for (const id of [...new Set(ids)].sort())
    await models.HelpTicket.updateOne(
      { _id: id },
      { $inc: { effortVersion: 1 } },
      { session },
    );
}
async function invalidate(u, id, session) {
  const records = await models.VerifiedComparison.find({
    deletedAt: null,
    $or: [{ originalTicketId: id }, { repeatTicketId: id }],
  }).session(session);
  for (const r of records) {
    const before = r.toObject();
    r.status = "PENDING";
    r.reviewerId = undefined;
    r.reviewedAt = undefined;
    r.reviewReason = "Source effort changed; a fresh human review is required.";
    r.originalMinutes = await minutes(r.originalTicketId, session);
    r.repeatMinutes = await minutes(r.repeatTicketId, session);
    r.deltaMinutes = r.originalMinutes - r.repeatMinutes;
    r.version++;
    r.updatedAt = new Date();
    await r.save({ session });
    await audit(
      u,
      id,
      "COMPARISON_INVALIDATED",
      { before, after: r.toObject() },
      session,
    );
  }
}
export const effortActions = new Set([
  "effort-create",
  "effort-start",
  "effort-stop",
  "effort-update",
  "effort-delete",
  "comparison-link",
  "comparison-unlink",
  "comparison-review",
  "comparison-policy",
  "case-comparison",
]);
export async function effortAction(u, action, body, session) {
  const now = new Date();
  const key = text(body.idempotencyKey, "Idempotency key");
  // Serialize writes by the actor before checking receipts; concurrent retries
  // then see the committed receipt on MongoDB's transaction retry.
  await models.User.updateOne(
    { _id: u._id },
    { $inc: { effortLock: 1 } },
    { session },
  );
  const receiptId = createHash("sha256")
    .update(`${u._id}:${key}`)
    .digest("hex");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ action, body }))
    .digest("hex");
  const receipt = await models.EffortWrite.findById(receiptId).session(session);
  if (receipt) {
    if (receipt.fingerprint !== fingerprint)
      fail("Idempotency key already used for different input.", 409);
    return;
  }
  if (action === "comparison-policy") {
    cc(u);
    const ids = [...new Set(body.reviewerIds || [])];
    if (ids.some((i) => typeof i !== "string") || ids.length > 20)
      fail("Invalid reviewer list.");
    const found = await models.User.find({
      _id: { $in: ids },
      role: "MISSION_COMMANDER",
      active: true,
    }).session(session);
    if (
      found.length !== ids.length ||
      found.some((x) => cohortId(x) !== cohortId(u))
    )
      fail("Select active MCs in this cohort.");
    const c = await models.Cohort.findById(cohortId(u)).session(session);
    if (!c) fail("Cohort not found.", 404);
    const before = c.comparisonReviewers;
    c.comparisonReviewers = ids;
    await c.save({ session });
    await audit(
      u,
      c._id,
      "COMPARISON_POLICY",
      { before, after: ids, reason: text(body.reason, "Policy reason") },
      session,
    );
  } else if (action.startsWith("effort-")) {
    const t = await ticketFor(u, body.ticketId, session);
    // Every writer for a learner takes the same lock, including staff corrections.
    if (t.createdBy !== u._id)
      await models.User.updateOne(
        { _id: t.createdBy },
        { $inc: { effortLock: 1 } },
        { session },
      );
    await lockTickets([t._id], session);
    const creating = ["effort-create", "effort-start"].includes(action);
    const entry = creating
      ? new models.EffortSession({
          _id: randomUUID(),
          cohortId: cohortId(u),
          ticketId: t._id,
          learnerId: t.createdBy,
          submittedBy: u._id,
          createdAt: now,
        })
      : await models.EffortSession.findOne({
          _id: body.sessionId,
          ticketId: t._id,
          deletedAt: null,
        }).session(session);
    if (!entry) fail("Session not found.", 404);
    if (!creating && entry.version !== body.version)
      fail("Session changed. Refresh before correcting.", 409);
    const before = creating ? null : entry.toObject();
    entry.reason = text(body.reason, "Session / correction reason");
    if (action === "effort-delete") entry.deletedAt = now;
    else if (action === "effort-stop") {
      if (entry.origin !== "TIMER" || entry.endedAt)
        fail("Timer is already stopped.", 409);
      entry.endedAt = now;
    } else {
      entry.sessionKind = body.sessionKind;
      if (!["ACTIVE", "WAITING", "BLOCKED"].includes(entry.sessionKind))
        fail("Invalid session kind.");
      entry.origin = action === "effort-start" ? "TIMER" : "MANUAL";
      if (
        entry.origin === "MANUAL" &&
        [body.startedAt, body.endedAt].some(
          (v) => typeof v !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(v),
        )
      )
        fail(
          "Manual timestamps must include UTC Z or an explicit timezone offset.",
        );
      entry.startedAt =
        action === "effort-start" ? now : new Date(body.startedAt);
      entry.endedAt =
        action === "effort-start" ? undefined : new Date(body.endedAt);
      if (
        !Number.isFinite(+entry.startedAt) ||
        +entry.startedAt > +now ||
        (entry.origin !== "TIMER" &&
          (!Number.isFinite(+entry.endedAt) ||
            entry.endedAt <= entry.startedAt ||
            entry.endedAt > now))
      )
        fail("Use a valid past UTC interval with end after start.");
      entry.manualMinutes =
        entry.origin === "MANUAL"
          ? (entry.endedAt - entry.startedAt) / 60000
          : undefined;
    }
    if (!entry.deletedAt) {
      const others = await models.EffortSession.find({
        learnerId: entry.learnerId,
        _id: { $ne: entry._id },
        deletedAt: null,
      })
        .session(session)
        .lean();
      if (others.some((s) => overlaps(entry, s)))
        fail("Session overlaps another recorded period for this learner.", 409);
    }
    if (!creating) entry.version++;
    entry.updatedAt = now;
    await entry.save({ session });
    await audit(
      u,
      t._id,
      action.toUpperCase().replaceAll("-", "_"),
      { before, after: entry.toObject() },
      session,
    );
    await invalidate(u, t._id, session);
  } else if (action === "case-comparison") {
    cc(u);
    const c = await models.KnowledgeCase.findOne({
      _id: body.caseId,
      cohortId: cohortId(u),
      status: "DRAFT",
    }).session(session);
    if (!c) fail("Select a draft case.", 404);
    const r = await models.VerifiedComparison.findOne({
      _id: body.comparisonId,
      cohortId: cohortId(u),
      status: "VERIFIED",
      deletedAt: null,
    }).session(session);
    if (!r || ![r.originalTicketId, r.repeatTicketId].includes(c.ticketId))
      fail("Link a verified comparison from this case's source ticket.");
    c.comparisonId = r._id;
    c.comparisonVersion = r.version;
    c.version += 1;
    c.updatedAt = now;
    await c.save({ session });
    await models.CaseVersion.create(
      [
        {
          _id: randomUUID(),
          caseId: c._id,
          version: c.version,
          actorId: u._id,
          status: c.status,
          content: {
            ...c.content,
            comparisonId: r._id,
            comparisonVersion: r.version,
          },
          createdAt: now,
        },
      ],
      { session },
    );
    await audit(
      u,
      c._id,
      "CASE_COMPARISON_LINKED",
      { comparisonId: r._id, reason: text(body.reason, "Review reason") },
      session,
    );
  } else {
    let r;
    if (action === "comparison-link") {
      const original = await ticketFor(u, body.originalTicketId, session);
      const repeat = await ticketFor(u, body.repeatTicketId, session);
      if (original._id === repeat._id || original.createdAt >= repeat.createdAt)
        fail("Select a different, later repeat ticket.");
      r = new models.VerifiedComparison({
        _id: randomUUID(),
        cohortId: cohortId(u),
        originalTicketId: original._id,
        repeatTicketId: repeat._id,
        proposedBy: u._id,
        createdAt: now,
        status: "PENDING",
      });
      for (const k of [
        "rationale",
        "technology",
        "difficulty",
        "environment",
        "aiUse",
        "humanGuidance",
        "evidence",
      ])
        r[k] = text(body[k], k);
    } else {
      r = await models.VerifiedComparison.findOne({
        _id: body.comparisonId,
        cohortId: cohortId(u),
        deletedAt: null,
      }).session(session);
      if (!r) fail("Comparison not found.", 404);
      await ticketFor(u, r.originalTicketId, session);
      await ticketFor(u, r.repeatTicketId, session);
      if (r.version !== body.version)
        fail("Comparison changed. Refresh before review.", 409);
    }
    await lockTickets([r.originalTicketId, r.repeatTicketId], session);
    const before = r.isNew ? null : r.toObject();
    if (action === "comparison-review") {
      if (u.role === "GAMER") fail("Students cannot review comparisons.", 403);
      // Lock policy too: revocation and approval cannot race.
      const c = await models.Cohort.findOneAndUpdate(
        { _id: cohortId(u) },
        { $inc: { rosterVersion: 1 } },
        { session, new: true },
      );
      if (
        u.role !== "CENTRE_COMMAND" &&
        !c?.comparisonReviewers.includes(u._id)
      )
        fail("CC must explicitly delegate comparison review.", 403);
      if (r.proposedBy === u._id && u.role !== "CENTRE_COMMAND")
        fail("A different authorised reviewer must review this proposal.", 403);
      if (!["VERIFIED", "REJECTED"].includes(body.status))
        fail("Choose VERIFIED or REJECTED.");
      const sources = await models.HelpTicket.find({
        _id: { $in: [r.originalTicketId, r.repeatTicketId] },
      }).session(session);
      if (sources.some((t) => t.createdBy === u._id))
        fail("You cannot approve your own effort comparison.", 403);
      if (body.status === "VERIFIED") {
        if (body.comparabilityConfirmed !== true)
          fail("Confirm comparable complexity and available assistance.");
        if (
          await models.EffortSession.exists({
            ticketId: { $in: sources.map((t) => t._id) },
            endedAt: null,
            deletedAt: null,
          }).session(session)
        )
          fail("Stop source timers before verification.", 409);
        for (const t of sources)
          if (
            !(await models.EffortSession.exists({
              ticketId: t._id,
              endedAt: { $ne: null },
              sessionKind: "ACTIVE",
              deletedAt: null,
            }).session(session))
          )
            fail("Both tickets need completed active effort evidence.");
      }
      r.status = body.status;
      r.reviewerId = u._id;
      r.reviewedAt = now;
      r.reviewReason = text(body.reason, "Review reason");
    } else if (action === "comparison-unlink") {
      if (
        u.role !== "CENTRE_COMMAND" &&
        (r.proposedBy !== u._id || r.status !== "PENDING")
      )
        fail(
          "Only CC or the proposer of a pending candidate can unlink it.",
          403,
        );
      r.deletedAt = now;
      r.reviewReason = text(body.reason, "Unlink reason");
    }
    r.originalMinutes = await minutes(r.originalTicketId, session);
    r.repeatMinutes = await minutes(r.repeatTicketId, session);
    r.deltaMinutes = r.originalMinutes - r.repeatMinutes;
    if (!r.isNew) r.version++;
    r.updatedAt = now;
    await r.save({ session });
    await audit(
      u,
      r.repeatTicketId,
      action.toUpperCase().replaceAll("-", "_"),
      { before, after: r.toObject() },
      session,
    );
  }
  await models.EffortWrite.create(
    [{ _id: receiptId, actorId: u._id, fingerprint, createdAt: now }],
    { session },
  );
}
export async function effortSnapshot(u, tickets) {
  const ids = tickets.map((t) => t._id);
  const [sessions, comparisons, cohort] = await Promise.all([
    models.EffortSession.find({ ticketId: { $in: ids }, deletedAt: null })
      .sort({ startedAt: 1 })
      .lean(),
    models.VerifiedComparison.find({
      cohortId: cohortId(u),
      originalTicketId: { $in: ids },
      repeatTicketId: { $in: ids },
      deletedAt: null,
    }).lean(),
    models.Cohort.findById(cohortId(u)).lean(),
  ]);
  return {
    sessions,
    comparisons,
    totals: comparisonTotals(comparisons),
    reviewerIds: u.role === "GAMER" ? [] : cohort?.comparisonReviewers || [],
    canReview:
      u.role === "CENTRE_COMMAND" ||
      (u.role === "MISSION_COMMANDER" &&
        cohort?.comparisonReviewers?.includes(u._id)),
  };
}
