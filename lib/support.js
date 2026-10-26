import { randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import {
  umbrellas,
  interventions,
  transitions,
  validateCalendar,
  workingDueAt,
  weightedAssessment,
  remainingWorkingMinutes,
} from "./support-rules.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const text = (value, label, min = 1, max = 4000) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${label}: enter ${min}–${max} characters.`);
  return value.trim();
};
const cc = (u) => {
  if (u.role !== "CENTRE_COMMAND")
    fail("Centre Command permission required.", 403);
};
const staff = (u) => {
  if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(u.role))
    fail("Command permission required.", 403);
};
const cohortId = (u) => u.cohortId || "alpha";
export const ticketScope = (u) => ({
  cohortId: cohortId(u),
  ...(u.role === "GAMER"
    ? { createdBy: u._id }
    : u.role === "MISSION_COMMANDER"
      ? { assignedTo: u._id }
      : {}),
});
async function event(user, entityId, kind, details, session) {
  await models.SupportEvent.create(
    [
      {
        _id: randomUUID(),
        cohortId: cohortId(user),
        ticketId: entityId,
        actorId: user._id,
        kind,
        details,
        createdAt: new Date(),
      },
    ],
    { session },
  );
}
async function student(userId, session) {
  const u = await models.User.findOne({ _id: userId, role: "GAMER" }).session(
    session,
  );
  if (!u) fail("Student not found.", 404);
  return u;
}
export async function supportSnapshot(user) {
  const now = new Date();
  // Persist the breach once, preserving it even after a response or reassignment.
  const overdue = await models.HelpTicket.find({
    ...ticketScope(user),
    firstResponseAt: null,
    dueAt: { $lt: now },
    breachedAt: null,
  }).lean();
  for (const t of overdue)
    await transaction(async (session) => {
      const changed = await models.HelpTicket.updateOne(
        { _id: t._id, firstResponseAt: null, breachedAt: null },
        { $set: { breachedAt: now, escalated: true } },
        { session },
      );
      if (changed.modifiedCount)
        await event(
          user,
          t._id,
          "SLA_BREACHED",
          { dueAt: t.dueAt, detectedBy: "SERVER" },
          session,
        );
    });
  const tickets = await models.HelpTicket.find(ticketScope(user))
    .sort({ createdAt: -1 })
    .lean();
  const ids = tickets.map((t) => t._id);
  const [
    events,
    attempts,
    sessions,
    cases,
    baselines,
    growth,
    operators,
    cohort,
  ] = await Promise.all([
    models.SupportEvent.find({
      cohortId: cohortId(user),
      ticketId: { $in: ids },
    })
      .sort({ createdAt: 1 })
      .lean(),
    models.SupportAttempt.find({ ticketId: { $in: ids } }).lean(),
    models.SupportIntervention.find({ ticketId: { $in: ids } }).lean(),
    models.KnowledgeCase.find({
      cohortId: cohortId(user),
      ...(user.role === "CENTRE_COMMAND" ? {} : { status: "PUBLISHED" }),
    }).lean(),
    models.DiscoveryBaseline.find({
      cohortId: cohortId(user),
      ...(user.role === "GAMER" ? { userId: user._id } : {}),
    }).lean(),
    models.GrowthReport.find({
      cohortId: cohortId(user),
      ...(user.role === "GAMER"
        ? {
            userId: user._id,
            status: { $in: ["VALIDATED", "CORRECTION_REQUESTED"] },
          }
        : {}),
    }).lean(),
    user.role !== "GAMER"
      ? models.User.find({
          role: { $in: ["MISSION_COMMANDER", "CENTRE_COMMAND"] },
        })
          .select("_id name role")
          .lean()
      : [],
    models.Cohort.findById(cohortId(user)).lean(),
  ]);
  return {
    tickets: tickets.map((t) => ({
      ...t,
      unassignedWaitMinutes: Math.floor(
        ((t.assignedAt || now) - t.createdAt) / 60000,
      ),
      remainingWorkingMinutes: t.dueAt
        ? remainingWorkingMinutes(
            t.firstResponseAt || now,
            t.dueAt,
            t.calendarSnapshot,
          )
        : null,
    })),
    events,
    attempts,
    interventions: sessions,
    // Public cases never include provenance IDs or raw source records.
    cases:
      user.role === "CENTRE_COMMAND"
        ? cases
        : cases.map((c) => ({
            _id: c._id,
            version: c.version,
            content: Object.fromEntries(
              [
                "title",
                "cause",
                "unsuccessful",
                "successful",
                "applicability",
                "prerequisites",
              ].map((k) => [k, c.content[k]]),
            ),
          })),
    issues:
      user.role === "GAMER"
        ? []
        : await models.TechnicalIssue.find({
            _id: { $in: tickets.map((t) => t.issueId).filter(Boolean) },
            cohortId: cohortId(user),
          }).lean(),
    caseVersions:
      user.role === "CENTRE_COMMAND"
        ? await models.CaseVersion.find({
            caseId: { $in: cases.map((c) => c._id) },
          })
            .sort({ version: -1 })
            .lean()
        : [],
    governance:
      user.role === "CENTRE_COMMAND"
        ? await models.SupportEvent.find({
            cohortId: cohortId(user),
            ticketId: { $nin: ids },
          })
            .sort({ createdAt: -1 })
            .lean()
        : [],
    baselines,
    growth,
    operators,
    calendar: cohort?.workingCalendar?.timeZone ? cohort.workingCalendar : null,
    discovery: {
      prompt: cohort?.discoveryPrompt || "",
      version: cohort?.discoveryVersion || 0,
    },
  };
}
export async function supportAction(user, action, body) {
  await transaction(async (session) => {
    const now = new Date();
    const record = (entity, kind, details) =>
      event(user, entity, kind, details, session);
    if (action === "calendar") {
      cc(user);
      const calendar = validateCalendar(body.calendar);
      const cohort = await models.Cohort.findById(cohortId(user)).session(
        session,
      );
      if (!cohort) fail("Cohort not found.", 404);
      const before = cohort.workingCalendar?.toObject();
      cohort.workingCalendar = calendar;
      await cohort.save({ session });
      await record(cohort._id, "CALENDAR_CONFIGURED", {
        before,
        after: calendar,
      });
      return;
    }
    if (action === "discovery-prompt") {
      cc(user);
      const cohort = await models.Cohort.findById(cohortId(user)).session(
        session,
      );
      if (!cohort) fail("Cohort not found.", 404);
      cohort.discoveryPrompt = text(body.prompt, "Unfamiliar challenge", 20);
      cohort.discoveryVersion += 1;
      await cohort.save({ session });
      await record(cohort._id, "DISCOVERY_PROMPT", {
        version: cohort.discoveryVersion,
        prompt: cohort.discoveryPrompt,
      });
      return;
    }
    if (action === "baseline") {
      if (user.role !== "GAMER")
        fail("Only students submit their reflection.", 403);
      const cohort = await models.Cohort.findById(cohortId(user)).session(
        session,
      );
      if (!cohort?.discoveryPrompt)
        fail("Centre Command must publish a discovery challenge first.", 409);
      const baseline = {
        _id: randomUUID(),
        cohortId: cohortId(user),
        userId: user._id,
        prompt: cohort.discoveryPrompt,
        promptVersion: cohort.discoveryVersion,
        priorExposure: text(body.priorExposure, "Prior exposure"),
        activity: text(body.activity, "Activity", 10),
        helpUsed: text(body.helpUsed, "Help used"),
        reflection: text(body.reflection, "Reflection", 20),
        createdAt: now,
        updatedAt: now,
      };
      await models.DiscoveryBaseline.create([baseline], { session });
      await record(baseline._id, "BASELINE_SUBMITTED", {
        userId: user._id,
        promptVersion: baseline.promptVersion,
      });
      return;
    }
    if (action === "baseline-review") {
      staff(user);
      const baseline = await models.DiscoveryBaseline.findOne({
        _id: body.baselineId,
        cohortId: cohortId(user),
      }).session(session);
      if (!baseline) fail("Baseline not found.", 404);
      const before = {
        reasoning: baseline.reasoning,
        commanderNotes: baseline.commanderNotes,
      };
      baseline.reasoning = text(body.reasoning, "Observable reasoning", 10);
      baseline.commanderNotes = text(body.notes, "Narrative comments", 10);
      baseline.reviewerId = user._id;
      baseline.updatedAt = now;
      await baseline.save({ session });
      await record(baseline._id, "BASELINE_REVIEWED", {
        before,
        reasoning: baseline.reasoning,
        notes: baseline.commanderNotes,
      });
      return;
    }
    if (action === "growth-propose") {
      if (user.role !== "MISSION_COMMANDER")
        fail("The Mission Commander proposes growth reports.", 403);
      await student(body.userId, session);
      const evidenceIds = Array.isArray(body.evidenceIds)
        ? [...new Set(body.evidenceIds)]
        : [];
      if (
        !evidenceIds.length ||
        evidenceIds.length > 30 ||
        evidenceIds.some((i) => typeof i !== "string")
      )
        fail("Link 1–30 evidence IDs.");
      for (const evidenceId of evidenceIds) {
        const found =
          (await models.DiscoveryBaseline.exists({
            _id: evidenceId,
            userId: body.userId,
          }).session(session)) ||
          (await models.HelpTicket.exists({
            _id: evidenceId,
            createdBy: body.userId,
            assignedTo: user._id,
          }).session(session)) ||
          (await models.Task.exists({
            _id: evidenceId,
            assigneeId: body.userId,
          }).session(session)) ||
          (await models.Journal.exists({
            _id: evidenceId,
            userId: body.userId,
          }).session(session));
        if (!found)
          fail(
            "Evidence must belong to this student and be accessible to you.",
            403,
          );
      }
      const total = weightedAssessment(body.scores);
      const fields = {
        cohortId: cohortId(user),
        userId: body.userId,
        proposedBy: user._id,
        status: "PROPOSED",
        validatedBy: null,
        strengths: text(body.strengths, "Strengths", 10),
        unobserved: text(body.unobserved, "Unobserved areas"),
        trajectory: text(body.trajectory, "Trajectory", 10),
        support: text(body.support, "Assistance history", 10),
        pathway: text(
          body.pathway || "Insufficient evidence",
          "Possible directions",
        ),
        comparison: text(
          body.comparison,
          "Complexity and opportunity comparison",
          20,
        ),
        evidenceIds,
        scores: body.scores,
        total,
        rubricVersion: "V2-40/20/25/15",
        updatedAt: now,
      };
      const before = await models.GrowthReport.findOne({ userId: body.userId })
        .session(session)
        .lean();
      await models.GrowthReport.updateOne(
        { userId: body.userId },
        { $set: fields, $setOnInsert: { _id: randomUUID() } },
        { upsert: true, session, runValidators: true },
      );
      await record(body.userId, "GROWTH_PROPOSED", { before, after: fields });
      return;
    }
    if (["growth-validate", "growth-correction"].includes(action)) {
      const report = await models.GrowthReport.findOne({
        _id: body.reportId,
        cohortId: cohortId(user),
      }).session(session);
      if (!report) fail("Report not found.", 404);
      if (action === "growth-validate") {
        cc(user);
        if (report.status !== "PROPOSED")
          fail("Only proposed reports can be validated.", 409);
        report.status = "VALIDATED";
        report.validatedBy = user._id;
      } else {
        if (
          user.role !== "GAMER" ||
          report.userId !== user._id ||
          report.status !== "VALIDATED"
        )
          fail("Only your validated report can be corrected.", 403);
        report.correction = text(body.reason, "Correction requested", 10);
        report.status = "CORRECTION_REQUESTED";
      }
      report.updatedAt = now;
      await report.save({ session });
      await record(report._id, action, {
        reason: body.reason,
        status: report.status,
      });
      return;
    }
    if (action === "case-draft") {
      cc(user);
      const ticket = await models.HelpTicket.findOne({
        _id: body.ticketId,
        cohortId: cohortId(user),
        state: { $in: ["RESOLVED", "CLOSED"] },
      }).session(session);
      if (!ticket) fail("Select a resolved ticket.", 409);
      const attempts = await models.SupportAttempt.find({
        ticketId: ticket._id,
      }).session(session);
      if (
        !attempts.some((a) => a.result === "SUCCESSFUL" && a.verifiedBy) ||
        !attempts.some((a) => a.result === "UNSUCCESSFUL")
      )
        fail(
          "A case requires failed attempts and verified successful recovery.",
        );
      const content = {};
      for (const field of [
        "title",
        "cause",
        "unsuccessful",
        "successful",
        "applicability",
        "prerequisites",
        "anonymisation",
        "validationEvidence",
      ])
        content[field] = text(body[field], field, field === "title" ? 5 : 10);
      const entry = {
        _id: randomUUID(),
        cohortId: cohortId(user),
        ticketId: ticket._id,
        status: "DRAFT",
        version: 1,
        authorId: user._id,
        content,
        updatedAt: now,
      };
      await models.KnowledgeCase.create([entry], { session });
      await models.CaseVersion.create(
        [
          {
            _id: randomUUID(),
            caseId: entry._id,
            version: 1,
            actorId: user._id,
            status: "DRAFT",
            content,
            createdAt: now,
          },
        ],
        { session },
      );
      await record(entry._id, "CASE_DRAFTED", {
        ticketId: ticket._id,
        attemptIds: attempts.map((a) => a._id),
      });
      return;
    }
    if (["case-publish", "case-withdraw", "case-revise"].includes(action)) {
      cc(user);
      const entry = await models.KnowledgeCase.findOne({
        _id: body.caseId,
        cohortId: cohortId(user),
      }).session(session);
      if (!entry) fail("Case not found.", 404);
      if (action === "case-publish") {
        if (entry.status !== "DRAFT")
          fail("Only a reviewed draft can be published.", 409);
        if (
          body.redactionConfirmed !== true ||
          body.resolutionConfirmed !== true
        )
          fail("Confirm redaction and evidence validation before publication.");
        entry.status = "PUBLISHED";
        entry.reviewerId = user._id;
      } else if (action === "case-withdraw") {
        entry.status = "WITHDRAWN";
      } else {
        const content = {};
        for (const field of [
          "title",
          "cause",
          "unsuccessful",
          "successful",
          "applicability",
          "prerequisites",
          "anonymisation",
          "validationEvidence",
        ])
          content[field] = text(body[field], field, field === "title" ? 5 : 10);
        entry.content = content;
        entry.status = "DRAFT";
        entry.reviewerId = null;
      }
      const reason = text(body.reason, "Review / correction reason", 10);
      entry.version += 1;
      entry.updatedAt = now;
      await entry.save({ session });
      await models.CaseVersion.create(
        [
          {
            _id: randomUUID(),
            caseId: entry._id,
            version: entry.version,
            actorId: user._id,
            status: entry.status,
            content: entry.content,
            createdAt: now,
          },
        ],
        { session },
      );
      await record(entry._id, action, { reason, version: entry.version });
      return;
    }
    if (action === "ticket-create") {
      if (user.role !== "GAMER") fail("Students file support tickets.", 403);
      if (
        body.taskId &&
        !(await models.Task.exists({
          _id: body.taskId,
          teamId: user.teamId,
        }).session(session))
      )
        fail("Task outside your team.", 403);
      const ticket = {
        _id: randomUUID(),
        cohortId: cohortId(user),
        teamId: user.teamId,
        createdBy: user._id,
        taskId: body.taskId || undefined,
        description: text(body.description, "Description", 20),
        state: "NEW",
        createdAt: now,
        updatedAt: now,
      };
      await models.HelpTicket.create([ticket], { session });
      await record(ticket._id, "CREATED", { state: "NEW" });
      return;
    }
    const ticket = await models.HelpTicket.findOne({
      _id: body.ticketId,
      ...ticketScope(user),
    }).session(session);
    if (!ticket) fail("Ticket not found or access denied.", 404);
    const beforeState = ticket.state;
    if (action === "ticket-classify") {
      cc(user);
      if (!umbrellas.includes(body.category))
        fail("Choose one of the three support umbrellas.");
      if (
        !Array.isArray(body.tags) ||
        body.tags.length > 12 ||
        body.tags.some((t) => typeof t !== "string" || t.length > 60)
      )
        fail("Supply up to 12 secondary tags.");
      const before = { category: ticket.category, tags: ticket.tags };
      ticket.category = body.category;
      ticket.tags = body.tags;
      if (ticket.state === "NEW") ticket.state = "TRIAGED";
      await record(ticket._id, "CLASSIFIED", {
        before,
        after: { category: ticket.category, tags: ticket.tags },
        reason: text(body.reason, "Classification reason", 10),
      });
    } else if (action === "ticket-assign") {
      cc(user);
      if (!ticket.category) fail("Classify before assignment.");
      const owner = await models.User.findOne({
        _id: body.userId,
        role: { $in: ["MISSION_COMMANDER", "CENTRE_COMMAND"] },
      }).session(session);
      if (!owner) fail("Select a command owner.");
      if (["RESOLVED", "CLOSED"].includes(ticket.state))
        fail("Reopen the ticket before reassigning.", 409);
      const previous = ticket.assignedTo;
      ticket.assignedTo = owner._id;
      if (!ticket.assignedAt) {
        const cohort = await models.Cohort.findById(cohortId(user)).session(
          session,
        );
        const calendar = cohort?.workingCalendar?.toObject();
        ticket.dueAt = workingDueAt(now, calendar);
        ticket.calendarSnapshot = calendar;
        ticket.assignedAt = now;
        ticket.state = "ASSIGNED";
      }
      await record(ticket._id, "ASSIGNED", {
        previous,
        ownerId: owner._id,
        assignedAt: now,
        originalAssignedAt: ticket.assignedAt,
        dueAt: ticket.dueAt,
        remainingWorkingMinutes: remainingWorkingMinutes(
          now,
          ticket.dueAt,
          ticket.calendarSnapshot,
        ),
        reason: text(body.reason, "Assignment reason", 10),
      });
    } else if (action === "ticket-acknowledge") {
      staff(user);
      ticket.acknowledgedAt ||= now;
      await record(ticket._id, "ACKNOWLEDGED", { substantive: false });
    } else if (action === "ticket-response") {
      staff(user);
      if (!["ASSIGNED", "IN_PROGRESS", "RESPONDED"].includes(ticket.state))
        fail("Ticket must be assigned and open.", 409);
      const guidance = text(
        body.guidance,
        "Substantive guidance and next action",
        20,
      );
      ticket.firstResponseAt ||= now;
      ticket.state = "RESPONDED";
      await record(ticket._id, "SUBSTANTIVE_RESPONSE", { guidance });
    } else if (action === "ticket-state") {
      if (!transitions[ticket.state]?.includes(body.state))
        fail("Invalid ticket transition.", 409);
      if (
        user.role === "GAMER" &&
        !(
          body.state === "IN_PROGRESS" &&
          ["RESOLVED", "CLOSED"].includes(ticket.state)
        )
      )
        fail("Students can reopen their resolved tickets.", 403);
      if (["TRIAGED", "ASSIGNED", "RESPONDED"].includes(body.state))
        fail(
          "Use classification, assignment, or explicit substantive response.",
        );
      if (
        body.state === "RESOLVED" &&
        !(await models.SupportAttempt.exists({
          ticketId: ticket._id,
          result: "SUCCESSFUL",
          verifiedBy: { $ne: null },
        }).session(session))
      )
        fail("Verify a successful recovery with evidence before resolving.");
      ticket.state = body.state;
      if (body.state === "RESOLVED") ticket.resolvedAt = now;
      await record(ticket._id, "STATE_CHANGED", {
        before: beforeState,
        after: ticket.state,
        reason: text(body.reason, "Transition reason", 10),
      });
    } else if (action === "ticket-escalate") {
      staff(user);
      ticket.escalated = true;
      await record(ticket._id, "ESCALATED", {
        reason: text(body.reason, "Escalation reason", 10),
      });
    } else if (action === "intervention") {
      staff(user);
      if (!interventions[body.kind]) fail("Unknown intervention type.");
      if (!ticket.assignedTo) fail("Assign the ticket first.");
      const performer = await models.User.findOne({
        _id: body.performerId,
        role: { $in: ["MISSION_COMMANDER", "CENTRE_COMMAND"] },
      }).session(session);
      if (!performer) fail("Select a command performer.");
      if (
        ["INT01", "INT03"].includes(body.kind) &&
        performer.role !== "MISSION_COMMANDER"
      )
        fail("This route requires an MC performer.");
      if (
        ["INT02", "INT04"].includes(body.kind) &&
        performer.role !== "CENTRE_COMMAND"
      )
        fail("This route requires a CC performer.");
      const plannedAt = body.plannedAt ? new Date(body.plannedAt) : undefined;
      const actualAt = body.actualAt ? new Date(body.actualAt) : undefined;
      if (
        (plannedAt && !Number.isFinite(+plannedAt)) ||
        (actualAt && !Number.isFinite(+actualAt))
      )
        fail("Supply valid appointment times with timezone.");
      if (["INT01", "INT02"].includes(body.kind) && !plannedAt && !actualAt)
        fail("A 1:1 needs a planned or actual appointment time.");
      const entry = {
        _id: randomUUID(),
        ticketId: ticket._id,
        kind: body.kind,
        approvedBy: user._id,
        performerId: performer._id,
        guidance: text(body.guidance, "Guidance level and next action", 20),
        plannedAt,
        actualAt,
        outcome: text(body.outcome, "Outcome / planned outcome", 10),
        artifact: text(body.artifact, "Session / response evidence", 3, 1000),
        createdAt: now,
      };
      await models.SupportIntervention.create([entry], { session });
      await record(ticket._id, "INTERVENTION", {
        interventionId: entry._id,
        kind: entry.kind,
      });
    } else if (action === "attempt") {
      if (!["SUCCESSFUL", "UNSUCCESSFUL"].includes(body.result))
        fail("Record success or failure.");
      const entry = {
        _id: randomUUID(),
        ticketId: ticket._id,
        actorId: user._id,
        approach: text(body.approach, "What was attempted", 10),
        rationale: text(body.rationale, "Rationale", 10),
        result: body.result,
        artifact: text(body.artifact, "Artifact reference", 3, 1000),
        createdAt: now,
      };
      await models.SupportAttempt.create([entry], { session });
      await record(ticket._id, "ATTEMPT", { attemptId: entry._id });
    } else if (action === "attempt-verify") {
      staff(user);
      const attempt = await models.SupportAttempt.findOne({
        _id: body.attemptId,
        ticketId: ticket._id,
        result: "SUCCESSFUL",
      }).session(session);
      if (!attempt) fail("Successful attempt not found.", 404);
      attempt.verifiedBy = user._id;
      await attempt.save({ session });
      await record(ticket._id, "RECOVERY_VERIFIED", {
        attemptId: attempt._id,
        reason: text(body.reason, "Verification evidence", 10),
      });
    } else if (action === "issue") {
      staff(user);
      if (body.issueId) {
        const issue = await models.TechnicalIssue.findOne({
          _id: body.issueId,
          cohortId: cohortId(user),
        }).session(session);
        if (!issue) fail("Issue not found.", 404);
        ticket.issueId = issue._id;
      } else {
        if (
          body.recurrenceOf &&
          !(await models.TechnicalIssue.exists({
            _id: body.recurrenceOf,
            cohortId: cohortId(user),
          }).session(session))
        )
          fail("Recurrence issue not found.");
        const issue = {
          _id: randomUUID(),
          cohortId: cohortId(user),
          symptom: text(body.symptom, "Symptom", 10),
          cause: text(body.cause, "Cause taxonomy", 3),
          taskId: ticket.taskId,
          recurrenceOf: body.recurrenceOf || undefined,
          createdBy: user._id,
          createdAt: now,
        };
        await models.TechnicalIssue.create([issue], { session });
        ticket.issueId = issue._id;
      }
      await record(ticket._id, "ISSUE_LINKED", { issueId: ticket.issueId });
    } else fail("Unknown support action.", 404);
    // A late response must record a breach even if no poll ran while overdue.
    if (
      ticket.dueAt &&
      now > ticket.dueAt &&
      (!ticket.firstResponseAt || ticket.firstResponseAt > ticket.dueAt) &&
      !ticket.breachedAt
    ) {
      ticket.breachedAt = now;
      ticket.escalated = true;
      await record(ticket._id, "SLA_BREACHED", {
        dueAt: ticket.dueAt,
        detectedBy: "SERVER",
      });
    }
    ticket.updatedAt = now;
    await ticket.save({ session });
  });
}
