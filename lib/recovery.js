import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { fail, requiredText } from "./day-one-rules.js";
import { finite, iso } from "./week-one-program-rules.js";
import { fraction, atLeast } from "./week-one-fractions.js";
import { copy, event, permit, reason, rosterQuery } from "./week-one-store.js";
import {
  emptyRecovery,
  validateRecoveryConfig,
  recoveryTypes,
  hash,
  humanRequired,
  recoveryScore,
  generateRecoveryTeams,
  validateRecoveryTeams,
} from "./recovery-rules.js";

const C = ["CENTRE_COMMAND"],
  M = ["MISSION_COMMANDER"],
  S = [...C, ...M],
  G = ["GAMER"];
export const recoveryActions = {
  "recovery-policy": C,
  "recovery-save-config": S,
  "recovery-approve-config": C,
  "recovery-invite": C,
  "recovery-choice": G,
  "recovery-attendance": S,
  "recovery-session": S,
  "recovery-start": G,
  "recovery-save": G,
  "recovery-submit": G,
  "recovery-extend": S,
  "recovery-issue": S,
  "recovery-export": S,
  "recovery-import": S,
  "recovery-review": S,
  "recovery-signoff": M,
  "recovery-approve-result": C,
  "recovery-institution": C,
  "recovery-lock-eligible": C,
  "recovery-generate-teams": C,
  "recovery-team-review": M,
  "recovery-team-override": C,
  "recovery-lock-teams": C,
  "recovery-publish-teams": C,
  "recovery-reward-rules": C,
  "recovery-reward": C,
  "recovery-amend-roster": C,
  "recovery-reconcile-results": C,
  "recovery-session-link": C,
};
const approvedConfig = (r) => {
  const c = r.configs.at(-1),
    link = r.sessionLinks?.at(-1);
  return c && link?.configVersion === c.version
    ? { ...c, meetingUrl: link.meetingUrl }
    : c;
};
const participant = (r, id) => {
  const p = r.participants.find((p) => p.userId === id);
  if (!p) fail("Recovery participant not found in this cohort.", 404);
  return p;
};
const attempt = (p, type) => {
  const a = p.attempts[type];
  if (!a) fail("Start this exam first.", 409);
  return a;
};
const decisionDigest = (p) =>
  hash([p.attempts, p.attendance, p.choice, p.institution]);
const currentPublication = (ctx) => {
  const p = ctx.p.publications.at(-1);
  if (!p || !ctx.p.locked || ctx.p.correction)
    fail("Current CC-locked Friday results are required.", 409);
  return p;
};
const invalidate = (p) => {
  p.signoff = null;
  p.decision = null;
};
const validApproval = (p) => p.decision?.digest === decisionDigest(p);
const approvedAttempt = (a) =>
  a?.assessment &&
  a.assessment.verified &&
  a.assessment.source === hash(a.submission);
function scored(p) {
  const t = p.attempts.TECHNOLOGY,
    f = p.attempts.FUN;
  return recoveryScore(
    approvedAttempt(t) ? t.assessment.score : null,
    approvedAttempt(f) ? f.assessment.score : null,
    Boolean(
      t?.assessment?.genuine &&
      f?.assessment?.genuine &&
      p.attendance?.status === "ATTENDED",
    ),
  );
}
function expire(p, now) {
  for (const a of Object.values(p.attempts))
    if (a.status === "STARTED" && now > new Date(a.deadline)) {
      a.status = "EXPIRED";
      a.submission = {
        answers: copy(a.draft),
        at: a.deadline,
        incomplete: true,
      };
    }
}
function rosterDigest(r, publication) {
  return hash([
    publication.version,
    r.participants.map((p) => [
      p.userId,
      p.choice,
      p.institution,
      p.decision,
      p.attendance,
      p.attempts,
    ]),
  ]);
}
export function eligibleRecoveryRows(r, publication) {
  return publication.results.flatMap((row) => {
    const p = r.participants.find((p) => p.userId === row.userId);
    if (p?.institution?.status === "WITHDRAWN") return [];
    const exact = row.totalRatio
      ? fraction(row.totalRatio)
      : fraction(row.total);
    const fridayCleared = atLeast(exact, fraction(60));
    if (
      !fridayCleared &&
      !(p && validApproval(p) && p.decision.status === "CLEARED")
    )
      return [];
    return [
      {
        userId: row.userId,
        name: row.name,
        score:
          !fridayCleared && approvedConfig(r)?.teamScoreBasis === "RECOVERY"
            ? p.decision.total
            : row.total,
      },
    ];
  });
}
function requireEligible(r, pub) {
  if (!r.eligible || r.eligible.digest !== rosterDigest(r, pub))
    fail("CC must lock the current eligible roster; outcomes changed.", 409);
  return r.eligible.rows;
}
export async function recoveryAction(ctx) {
  const { body: b, action, user, at, now } = ctx;
  permit(user, recoveryActions[action] || []);
  const r = (ctx.p.recovery ||= emptyRecovery());
  const audit = (details) =>
    event(ctx, action.toUpperCase().replaceAll("-", "_"), details);
  if (action === "recovery-policy") {
    if (r.published)
      fail(
        "Published teams require an explicit roster amendment before policy changes.",
        409,
      );
    const why = reason(b);
    if (r.policy) fail("Pack 3A policy is already active.", 409);
    r.policy = {
      version: "pack3a-v1.1",
      threshold: 60,
      previous: copy(ctx.p.settings),
      by: user._id,
      at,
      reason: why,
    };
    ctx.p.settings.clearance = 60;
    ctx.p.settings.version++;
    ctx.p.signoff = null;
    if (ctx.p.locked)
      ctx.p.correction = {
        by: user._id,
        at,
        reason: why,
        policyMigration: true,
      };
    await audit(r.policy);
    return;
  }
  if (!r.policy) fail("CC must activate Pack 3A policy first.", 409);
  if (action === "recovery-session-link") {
    const c = approvedConfig(r);
    if (!c) fail("Approve the recovery session first.", 409);
    let url;
    try {
      url = new URL(b.meetingUrl);
    } catch {
      fail("Supply an approved HTTPS meeting link.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail("Supply an approved HTTPS meeting link.");
    r.sessionLinks ||= [];
    r.sessionLinks.push({
      configVersion: c.version,
      meetingUrl: url.href,
      by: user._id,
      at,
      reason: reason(b),
    });
    await audit(r.sessionLinks.at(-1));
    return;
  }
  if (action === "recovery-reconcile-results") {
    if (r.published)
      fail("Open an audited roster amendment before reconciling results.", 409);
    const pub = currentPublication(ctx),
      why = reason(b);
    for (const p of r.participants) {
      const row = pub.results.find((v) => v.userId === p.userId);
      if (!row || row.configVersion !== ctx.p.settings.version)
        fail("Current Friday results do not cover the recovery cohort.", 409);
      p.history.push({
        kind: "FRIDAY_RECONCILIATION",
        fridayVersion: p.fridayVersion,
        fridayScore: p.fridayScore,
        at,
        by: user._id,
        reason: why,
      });
      p.fridayVersion = pub.version;
      p.fridayScore = row.total;
    }
    r.fridayVersion = pub.version;
    delete r.reconciliationRequired;
    delete r.eligible;
    await audit({ fridayVersion: pub.version, reason: why });
    return;
  }
  if (action === "recovery-amend-roster") {
    if (!r.published) fail("No published roster to amend.", 409);
    r.publicationHistory ||= [];
    r.publicationHistory.push(copy(r.published));
    r.amendment = { by: user._id, at, reason: reason(b) };
    delete r.published;
    delete r.eligible;
    await audit(r.amendment);
    return;
  }
  if (action === "recovery-save-config") {
    if (!b.config || JSON.stringify(b.config).length > 150000)
      fail("Supply a curriculum/session configuration under 150 KB.");
    r.draft = copy(b.config);
    r.draftVersion = (r.draftVersion || 0) + 1;
    r.draftBy = user._id;
    await audit({ version: r.draftVersion });
    return;
  }
  if (action === "recovery-approve-config") {
    if (r.published) fail("Teams are already published.", 409);
    const config = validateRecoveryConfig(r.draft);
    if (r.participants.some((p) => Object.keys(p.attempts).length))
      fail(
        "Exam content is pinned by active attempts. Use audited exam extensions for technical issues.",
        409,
      );
    r.configs.push({
      ...config,
      version: r.configs.length + 1,
      by: user._id,
      at,
      reason: reason(b),
    });
    r.session = null;
    for (const p of r.participants) {
      p.configVersion = r.configs.length;
      p.choice = null;
      p.invitedAt = at;
      invalidate(p);
    }
    await audit({ version: r.configs.length });
    return;
  }
  if (action === "recovery-invite") {
    const pub = currentPublication(ctx),
      c = approvedConfig(r);
    if (!c)
      fail(
        "Approve the shared session and all eight exam variants first.",
        409,
      );
    if (
      ctx.p.settings.clearance !== 60 ||
      pub.results.some((row) => row.configVersion !== ctx.p.settings.version)
    )
      fail(
        "Republish Friday results with current MC signoff under the Pack 3A policy.",
        409,
      );
    if (
      r.participants.some(
        (p) =>
          p.fridayVersion !== pub.version && Object.keys(p.attempts).length,
      )
    )
      fail(
        "Friday correction affects active recovery: institution review required.",
        409,
      );
    for (const row of pub.results) {
      if (row.total == null) continue;
      if (
        atLeast(
          row.totalRatio ? fraction(row.totalRatio) : fraction(row.total),
          fraction(60),
        )
      )
        continue;
      if (
        !r.participants.some(
          (p) => p.userId === row.userId && p.fridayVersion === pub.version,
        )
      ) {
        r.participants = r.participants.filter((p) => p.userId !== row.userId);
        r.participants.push({
          userId: row.userId,
          name: row.name,
          fridayScore: row.total,
          fridayVersion: pub.version,
          configVersion: c.version,
          invitedAt: at,
          choice: null,
          attempts: {},
          history: [],
        });
        await event(ctx, "RECOVERY_INVITED", {
          userId: row.userId,
          fridayVersion: pub.version,
          sessionVersion: c.version,
          threshold: 60,
        });
      }
    }
    r.fridayVersion = pub.version;
    ctx.p.collegeNotices = r.participants
      .filter((p) => p.fridayVersion === pub.version)
      .map((p) => ({
        userId: p.userId,
        publicationVersion: pub.version,
        status: "READY_FOR_AUTHORISED_DELIVERY",
        noticeId: `${ctx.cohortId}:${pub.version}:${p.userId}:recovery-${p.configVersion}`,
      }));
    await audit({ count: r.participants.length, fridayVersion: pub.version });
    return;
  }
  if (action === "recovery-session") {
    const c = approvedConfig(r);
    if (!c) fail("Approve a session first.", 409);
    if (!["CLASS_STARTED", "CLASS_COMPLETED", "EXAMS_OPEN"].includes(b.state))
      fail("Choose a session transition.");
    if (b.state === "CLASS_STARTED" && (r.session || now < new Date(c.start)))
      fail("Start the class at the approved time, once.", 409);
    if (
      b.state === "CLASS_COMPLETED" &&
      (r.session?.state !== "CLASS_STARTED" ||
        now - new Date(r.session.startedAt) < 90 * 60000)
    )
      fail("Complete the 90-minute class before the break.", 409);
    if (
      b.state === "EXAMS_OPEN" &&
      (r.session?.state !== "CLASS_COMPLETED" ||
        now - new Date(r.session.completedAt) < 20 * 60000)
    )
      fail("Complete the 20-minute break before opening exams.", 409);
    r.session = {
      ...r.session,
      state: b.state,
      by: user._id,
      at,
      ...(b.state === "CLASS_STARTED"
        ? { startedAt: at }
        : b.state === "CLASS_COMPLETED"
          ? { completedAt: at }
          : { examsOpenedAt: at }),
    };
    await audit(r.session);
    return;
  }
  if (
    [
      "recovery-choice",
      "recovery-attendance",
      "recovery-start",
      "recovery-save",
      "recovery-submit",
      "recovery-extend",
      "recovery-review",
      "recovery-signoff",
      "recovery-approve-result",
      "recovery-institution",
    ].includes(action)
  ) {
    const p = participant(r, user.role === "GAMER" ? user._id : b.userId),
      c = r.configs.find((c) => c.version === p.configVersion);
    if (p.fridayVersion !== currentPublication(ctx).version)
      fail("Friday results changed; CC must reconcile recovery routing.", 409);
    expire(p, now);
    if (r.published && action !== "recovery-choice")
      fail(
        "Team roster is published. Open an audited roster amendment before changing recovery evidence.",
        409,
      );
    if (action === "recovery-choice") {
      if (p.choice || now > new Date(c.choiceDeadline))
        fail("Choice is recorded or its deadline passed; contact MC/CC.", 409);
      if (!["CONTINUE", "LEAVE"].includes(b.choice))
        fail("Choose Continue or Request Leave.");
      p.choice = { value: b.choice, at, by: user._id };
      p.history.push({ kind: "CHOICE", ...p.choice });
    } else if (action === "recovery-attendance") {
      if (!["ATTENDED", "ABSENT"].includes(b.status) || now < new Date(c.start))
        fail("Record attendance after the session starts.");
      p.attendance = { status: b.status, reason: reason(b), by: user._id, at };
      invalidate(p);
    } else if (action === "recovery-institution") {
      if (!["PENDING", "WITHDRAWN", "RESOLVED", "CONTINUE"].includes(b.status))
        fail(
          "Record a pending institutional case, approved withdrawal, or resolution.",
        );
      p.institution = {
        status: b.status,
        reference: requiredText(
          b.reference,
          "Institution approval/policy reference",
          10,
          2000,
        ),
        reason: reason(b),
        by: user._id,
        at,
      };
      invalidate(p);
      if (b.status === "WITHDRAWN")
        await models.User.updateOne(
          { _id: p.userId, ...rosterQuery(ctx.cohortId) },
          { $set: { active: false } },
          { session: ctx.session },
        );
      p.history.push({ kind: "INSTITUTION", ...copy(p.institution) });
      if (b.status === "RESOLVED" || b.status === "CONTINUE") {
        if (
          p.history.some(
            (v) => v.kind === "INSTITUTION" && v.status === "WITHDRAWN",
          )
        )
          fail(
            "Withdrawal reinstatement requires an institution enrolment decision outside recovery.",
            409,
          );
        delete p.institution;
        if (b.status === "CONTINUE") {
          p.choice = {
            value: "CONTINUE",
            at,
            by: user._id,
            exceptionReason: reason(b),
          };
          p.history.push({ kind: "CHOICE_EXCEPTION", ...p.choice });
        }
      }
    } else if (action === "recovery-start") {
      if (p.fridayScore >= 60)
        fail(
          "This learner is Friday-cleared and does not need recovery exams.",
          409,
        );
      if (
        p.choice?.value !== "CONTINUE" ||
        p.institution ||
        p.attendance?.status !== "ATTENDED" ||
        r.session?.state !== "EXAMS_OPEN"
      )
        fail(
          "Continue, recorded attendance and released exam access are required.",
          409,
        );
      if (!recoveryTypes.includes(b.type)) fail("Choose an exam type.");
      if (p.attempts[b.type]) fail("This exam already has an attempt.", 409);
      if (now >= new Date(c.examClose))
        fail("The exam start window is closed.", 409);
      if (
        c.lateAccess === "SEQUENTIAL" &&
        b.type === "FUN" &&
        !["SUBMITTED", "EXPIRED"].includes(p.attempts.TECHNOLOGY?.status)
      )
        fail(
          "Finish Technology before starting Fun under this session policy.",
          409,
        );
      if (Object.values(p.attempts).some((a) => a.status === "STARTED"))
        fail("Complete the current exam first.", 409);
      const exam = c.exams.find((e) => e.type === b.type),
        variant = exam.variants.find((v) => v.id === b.variantId);
      if (!variant) fail("Choose one of the four approved variants.");
      p.attempts[b.type] = {
        id: randomUUID(),
        type: b.type,
        variant: copy(variant),
        rubric: exam.rubric,
        configVersion: c.version,
        startedAt: at,
        deadline: new Date(now.getTime() + 30 * 60000).toISOString(),
        status: "STARTED",
        draft: {},
        history: [],
      };
    } else if (action === "recovery-save" || action === "recovery-submit") {
      const a = attempt(p, b.type);
      if (a.status !== "STARTED")
        fail("This attempt is sealed; saved evidence remains available.", 409);
      if (
        !b.answers ||
        typeof b.answers !== "object" ||
        Array.isArray(b.answers) ||
        JSON.stringify(b.answers).length > 20000
      )
        fail("Supply evidence under 20 KB.");
      const answers = {
        response:
          typeof b.answers.response === "string" ? b.answers.response : "",
        evidence:
          typeof b.answers.evidence === "string" ? b.answers.evidence : "",
      };
      a.draft = answers;
      a.savedAt = at;
      if (action === "recovery-submit") {
        requiredText(answers.response, "Investigation response", 20, 16000);
        requiredText(
          answers.evidence,
          "AI conversation / source and verification evidence",
          10,
          4000,
        );
        a.submission = { answers: copy(answers), at, incomplete: false };
        a.status = "SUBMITTED";
      }
      invalidate(p);
    } else if (action === "recovery-extend") {
      const a = attempt(p, b.type),
        deadline = iso(b.deadline, "extended deadline");
      if (new Date(deadline) <= now || deadline <= a.deadline)
        fail("Choose a later future deadline.");
      a.history.push(copy(a));
      a.deadline = deadline;
      a.status = "STARTED";
      delete a.submission;
      delete a.assessment;
      a.extension = { by: user._id, at, reason: reason(b) };
      invalidate(p);
    } else if (action === "recovery-review") {
      const a = attempt(p, b.type);
      if (!a.assessment) fail("Import this exam's AI assessment first.", 409);
      finite(b.score, 0, 100, "Verified percentage");
      if (typeof b.genuine !== "boolean")
        fail("Confirm whether this is a genuine assessable attempt.");
      a.assessment.history ||= [];
      a.assessment.history.push(copy({ ...a.assessment, history: undefined }));
      Object.assign(a.assessment, {
        score: b.score,
        genuine: b.genuine,
        verified: true,
        by: user._id,
        at,
        reason: reason(b),
      });
      invalidate(p);
    } else if (action === "recovery-signoff") {
      const score = scored(p);
      if (score.status === "INCOMPLETE")
        fail(
          "Both genuine exams, attendance and all human checks are required.",
          409,
        );
      if (p.institution || p.choice?.value !== "CONTINUE")
        fail("Resolve the institutional case before signoff.", 409);
      p.signoff = {
        digest: decisionDigest(p),
        by: user._id,
        at,
        reason: reason(b),
      };
    } else if (action === "recovery-approve-result") {
      if (!p.signoff || p.signoff.digest !== decisionDigest(p))
        fail("A current MC signoff is required.", 409);
      const score = scored(p);
      if (score.status === "INCOMPLETE")
        fail("Both verified exams are required.", 409);
      p.decision = {
        ...score,
        digest: decisionDigest(p),
        by: user._id,
        at,
        reason: reason(b),
      };
      p.history.push({ kind: "APPROVAL", decision: copy(p.decision) });
    }
    await audit({
      userId: p.userId,
      type: b.type,
      status: p.decision?.status,
      reason: b.reason,
    });
    return;
  }
  if (action === "recovery-issue") {
    participant(r, b.userId);
    r.incidents.push({
      id: randomUUID(),
      userId: b.userId,
      text: requiredText(b.text, "Technical/attendance issue", 10, 4000),
      at,
      by: user._id,
      status: "ESCALATED_TO_CC",
    });
    await audit(r.incidents.at(-1));
    return;
  }
  if (action === "recovery-export") {
    if (!recoveryTypes.includes(b.type)) fail("Choose an exam type.");
    reason(b);
    currentPublication(ctx);
    const rows = r.participants
      .filter((p) => p.choice?.value === "CONTINUE" && !p.institution)
      .map((p) => {
        expire(p, now);
        const a = p.attempts[b.type];
        return { p, a };
      })
      .filter(({ a }) => a?.submission);
    if (!rows.length) fail("No submitted or expired evidence to export.", 409);
    const batch = {
      id: randomUUID(),
      type: b.type,
      at,
      by: user._id,
      reason: b.reason,
      entries: rows.map(({ p, a }) => ({
        anonymousId: randomUUID(),
        userId: p.userId,
        attemptId: a.id,
        source: hash(a.submission),
        variantId: a.variant.id,
        configVersion: a.configVersion,
      })),
    };
    r.batches.push(batch);
    const report = {
      batchId: batch.id,
      type: b.type,
      instructions:
        "Assess evidence against the pinned rubric, including honest failed checks. Return JSON {batchId, rows:[{anonymousId,variantId,source,score:0-100,genuine:boolean,feedback:string,reliable:boolean}]}. Missing/invalid evidence must be flagged. Do not infer a score from learner identity.",
      entries: batch.entries.map((e) => {
        const a = participant(r, e.userId).attempts[b.type];
        return {
          anonymousId: e.anonymousId,
          variantId: e.variantId,
          source: e.source,
          configVersion: e.configVersion,
          rubric: a.rubric,
          submission: a.submission,
        };
      }),
      packs: [...new Set(rows.map(({ a }) => a.configVersion))].map((v) => ({
        version: v,
        exam: r.configs
          .find((c) => c.version === v)
          .exams.find((e) => e.type === b.type),
      })),
    };
    await event(ctx, "AI_BATCH_EXPORTED", {
      batchId: batch.id,
      type: b.type,
      count: rows.length,
    });
    return { report };
  }
  if (action === "recovery-import") {
    const report = b.report,
      batch = r.batches.find((v) => v.id === report?.batchId);
    if (!batch || batch.importedAt)
      fail("Choose an unimported recovery batch.", 409);
    if (
      !Array.isArray(report.rows) ||
      report.rows.length !== batch.entries.length ||
      new Set(report.rows.map((v) => v.anonymousId)).size !==
        batch.entries.length
    )
      fail("Supply every batch ID exactly once.");
    for (const e of batch.entries) {
      const row = report.rows.find((v) => v.anonymousId === e.anonymousId),
        p = participant(r, e.userId),
        a = attempt(p, batch.type);
      if (
        !row ||
        row.variantId !== e.variantId ||
        row.source !== e.source ||
        hash(a.submission) !== e.source ||
        a.id !== e.attemptId
      )
        fail(
          "Batch evidence or variant does not match the pinned attempt.",
          409,
        );
      finite(row.score, 0, 100, "AI percentage");
      requiredText(row.feedback, "Feedback", 10, 4000);
      if (typeof row.genuine !== "boolean" || typeof row.reliable !== "boolean")
        fail("Include genuine and reliable assessment flags.");
      a.assessment = {
        score: row.score,
        genuine: row.genuine,
        feedback: row.feedback,
        source: e.source,
        ai: copy(row),
        verified:
          !humanRequired(row.score) &&
          row.reliable &&
          row.genuine &&
          !a.submission.incomplete,
        at,
        by: user._id,
        batchId: batch.id,
      };
      invalidate(p);
    }
    batch.raw = copy(report);
    batch.importedAt = at;
    batch.importedBy = user._id;
    await event(ctx, "AI_BATCH_IMPORTED", { batchId: batch.id });
    return;
  }
  if (action === "recovery-lock-eligible") {
    const pub = currentPublication(ctx);
    if (r.fridayVersion !== pub.version)
      fail(
        "Reconcile recovery invitations against current Friday results first.",
        409,
      );
    if (r.published) fail("The roster is already published.", 409);
    r.eligible = {
      version: (r.eligible?.version || 0) + 1,
      rows: eligibleRecoveryRows(r, pub),
      digest: rosterDigest(r, pub),
      at,
      by: user._id,
      reason: reason(b),
    };
    await audit({ version: r.eligible.version, count: r.eligible.rows.length });
    return;
  }
  if (action === "recovery-generate-teams") {
    if (r.published)
      fail(
        "Published roster changes require a separate audited amendment.",
        409,
      );
    const rows = requireEligible(r, currentPublication(ctx)),
      why = reason(b),
      seed = randomUUID();
    r.proposals.push({
      id: randomUUID(),
      seed,
      eligibleDigest: r.eligible.digest,
      teams: generateRecoveryTeams(rows, seed),
      at,
      by: user._id,
      reason: why,
    });
    await audit({ proposalId: r.proposals.at(-1).id, seed });
    return;
  }
  if (
    [
      "recovery-team-review",
      "recovery-team-override",
      "recovery-lock-teams",
      "recovery-publish-teams",
    ].includes(action)
  ) {
    const rows = requireEligible(r, currentPublication(ctx)),
      proposal = r.proposals.at(-1);
    if (!proposal || proposal.eligibleDigest !== r.eligible.digest)
      fail("Generate a current proposal first.", 409);
    if (r.published) fail("This roster is already published.", 409);
    proposal.history ||= [];
    proposal.history.push({
      action,
      by: user._id,
      at,
      reason: b.reason,
      previousReview: copy(proposal.review || null),
      previousOverride: copy(proposal.override || null),
    });
    if (action === "recovery-team-review") {
      if (proposal.locked) fail("The proposal is locked.", 409);
      const teams = b.teams ? validateRecoveryTeams(b.teams, rows) : null;
      proposal.review = { by: user._id, at, reason: reason(b), teams };
      delete proposal.override;
    } else if (action === "recovery-team-override") {
      if (!proposal.review?.teams || proposal.locked)
        fail("An unlocked MC override request is required.", 409);
      if (typeof b.approve !== "boolean") fail("Choose approve or reject.");
      proposal.override = {
        approve: b.approve,
        reason: reason(b),
        by: user._id,
        at,
      };
      if (b.approve) {
        proposal.originalTeams ||= copy(proposal.teams);
        proposal.teams = validateRecoveryTeams(proposal.review.teams, rows);
      }
    } else if (action === "recovery-lock-teams") {
      if (!proposal.review || (proposal.review.teams && !proposal.override))
        fail(
          "MC review and a CC decision on requested changes are required.",
          409,
        );
      validateRecoveryTeams(proposal.teams, rows);
      proposal.locked = { by: user._id, at, reason: reason(b) };
    } else {
      if (!proposal.locked) fail("CC must lock teams first.", 409);
      r.published = {
        version: r.proposals.length,
        proposalId: proposal.id,
        teams: copy(proposal.teams),
        eligibleDigest: r.eligible.digest,
        by: user._id,
        at,
        reason: reason(b),
      };
      await event(ctx, "TEAM_ROSTER_PUBLISHED", {
        cohortId: ctx.cohortId,
        ...r.published,
        effectiveWeek: 2,
      });
    }
    await audit({
      proposalId: proposal.id,
      reason: b.reason,
      teamsDigest: hash(proposal.teams),
    });
    return;
  }
  if (action === "recovery-reward-rules") {
    const rules = b.rules;
    if (
      !Array.isArray(rules) ||
      rules.length > 20 ||
      new Set(rules.map((v) => v.id)).size !== rules.length
    )
      fail("Supply distinct reward rules.");
    r.rewardRules = rules.map((v) => ({
      id: requiredText(v.id, "Rule ID", 1, 80),
      name: requiredText(v.name, "Reward name", 1, 100),
      amount: finite(v.amount, 0, 10000, "Trophies"),
      minimum: finite(v.minimum, 60, 100, "Minimum recovery score"),
      eligibility: requiredText(v.eligibility, "Eligibility", 10, 2000),
    }));
    r.rewardRuleVersion = (r.rewardRuleVersion || 0) + 1;
    await audit({ version: r.rewardRuleVersion, reason: reason(b) });
    return;
  }
  if (action === "recovery-reward") {
    const p = participant(r, b.userId),
      rule = r.rewardRules?.find((v) => v.id === b.ruleId);
    if (!rule) fail("Saturday recognition is Not Configured.", 409);
    if (
      !validApproval(p) ||
      p.decision.status !== "CLEARED" ||
      p.decision.total < rule.minimum
    )
      fail("A qualifying CC-approved outcome is required.", 409);
    if (r.rewards.some((v) => v.userId === p.userId && v.ruleId === rule.id))
      fail("This reward was already issued.", 409);
    r.rewards.push({
      id: randomUUID(),
      userId: p.userId,
      ruleId: rule.id,
      ruleVersion: r.rewardRuleVersion,
      ...copy(rule),
      at,
      by: user._id,
      reason: reason(b),
    });
    await audit(r.rewards.at(-1));
    return;
  }
  fail("Unknown recovery action.", 404);
}
export function recoveryProjection(p, user, now = new Date()) {
  const r = p.recovery;
  if (!r) return null;
  const gamer = user.role === "GAMER",
    c = approvedConfig(r),
    pub = p.publications.at(-1);
  const current = pub && !p.correction && r.fridayVersion === pub.version;
  const participants = r.participants
    .filter((v) => !gamer || v.userId === user._id)
    .map((original) => {
      const v = copy(original);
      expire(v, now);
      const approved = validApproval(v);
      v.state =
        v.institution?.status === "WITHDRAWN"
          ? "WITHDRAWN"
          : !current
            ? "RESULTS_REVIEW"
            : validApproval(v)
              ? v.decision.status
              : v.institution ||
                  v.choice?.value === "LEAVE" ||
                  v.attendance?.status === "ABSENT" ||
                  (!v.choice && c && now > new Date(c.choiceDeadline))
                ? "INSTITUTION_PENDING"
                : v.choice?.value === "CONTINUE"
                  ? "SCHEDULED"
                  : "RECOVERY_REQUIRED";
      v.verificationOverdue = Object.values(v.attempts).some(
        (a) =>
          a.submission &&
          !approvedAttempt(a) &&
          now - new Date(a.submission.at) > 86400000,
      );
      if (gamer) {
        for (const a of Object.values(v.attempts)) {
          delete a.variant.reference;
          delete a.rubric;
          delete a.history;
          if (!approved) delete a.assessment;
          else if (a.assessment) {
            delete a.assessment.ai;
            delete a.assessment.history;
          }
        }
        delete v.signoff;
        delete v.history;
        delete v.institution;
        if (!approved) delete v.decision;
      }
      return v;
    });
  const config = c
    ? {
        version: c.version,
        start: c.start,
        timeZone: c.timeZone,
        choiceDeadline: c.choiceDeadline,
        examClose: c.examClose,
        meetingUrl: c.meetingUrl,
        policyUrl: c.policyUrl,
        policyReference: c.policyReference,
        orientation: c.orientation,
        lateAccess: c.lateAccess,
        exams: c.exams.map((e) => ({
          type: e.type,
          variants: e.variants.map((v) => ({ id: v.id, name: v.name })),
        })),
      }
    : null;
  return {
    policy: r.policy ? { version: r.policy.version, threshold: 60 } : null,
    config,
    session: r.session,
    participants,
    published:
      current && r.published
        ? gamer
          ? { version: r.published.version, at: r.published.at }
          : r.published
        : null,
    rewards: r.rewards.filter((v) => !gamer || v.userId === user._id),
    team:
      current && r.published
        ? r.published.teams
            .filter((t) => !gamer || t.members.includes(user._id))
            .map((t) => ({
              ...t,
              members: t.members.map((id) => ({
                userId: id,
                name: pub.results.find((v) => v.userId === id)?.name || id,
              })),
            }))
        : [],
    ...(!gamer
      ? {
          draft: r.draft,
          draftVersion: r.draftVersion,
          configs: r.configs,
          eligible: r.eligible,
          proposals: r.proposals,
          batches: r.batches.map(({ raw, ...b }) => b),
          incidents: r.incidents,
          rewardRules: r.rewardRules || [],
          fridayVersion: r.fridayVersion,
        }
      : {}),
  };
}
