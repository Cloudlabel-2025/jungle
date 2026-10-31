import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { criteria, comparisonActivity } from "./week-one-catalog.js";
import { fail, requiredText } from "./day-one-rules.js";
import { weightedRatings, needsHumanReview } from "./week-one-program-rules.js";
import {
  attempt,
  saveAttempt,
  event,
  reason,
  editable,
  copy,
  fingerprint,
  rosterQuery,
} from "./week-one-store.js";

export async function ensureComparisons(ctx) {
  const fitness = ctx.release.days[4].content?.activities?.find(
    (a) => a.id === "D5-F01",
  );
  if (!fitness)
    fail(
      "Prepare Friday's four-criterion rubric before recalibrating Day 1.",
      409,
    );
  const originals = await models.DayOneRecord.find({ cohortId: ctx.cohortId })
    .session(ctx.session)
    .lean();
  for (const original of originals) {
    if (
      original.data.verification?.status !== "VERIFIED" ||
      !original.data.submissions.length
    )
      continue;
    const id = `${ctx.cohortId}:${original.userId}:D1-C01`;
    if (await models.WeekOneAttempt.exists({ _id: id }).session(ctx.session))
      continue;
    const genre = original.data.config.genres.find(
      (g) => g.id === original.data.genreId,
    );
    const variant = fitness.variants.find(
      (v) => v.id === genre?.id && v.brief === genre.question,
    );
    if (!variant) continue;
    const source = original.data.submissions.at(-1);
    await models.WeekOneAttempt.create(
      [
        {
          _id: id,
          cohortId: ctx.cohortId,
          userId: original.userId,
          activityId: "D1-C01",
          day: 1,
          version: 0,
          data: {
            activity: {
              ...comparisonActivity,
              rubricVersion: fitness.rubricVersion,
              variants: copy(fitness.variants),
            },
            variant: copy(variant),
            anonymousId: randomUUID(),
            sourceRevision: source.id,
            startedAt: original.data.startedAt,
            deadline: original.data.deadline,
            submittedAt: source.at,
            submissions: [
              {
                id: source.id,
                at: source.at,
                complete: true,
                answers: { url: source.url },
              },
            ],
            history: [],
            result: null,
          },
        },
      ],
      { session: ctx.session },
    );
  }
}
export async function assessmentAction(ctx) {
  editable(ctx);
  const { body, action } = ctx;
  if (action === "prepare-comparison") {
    await ensureComparisons(ctx);
    await event(ctx, "COMPARISON_PREPARED", {});
    return;
  }
  if (action === "approve-export") {
    const record = await attempt(ctx, body.attemptId),
      d = record.data,
      submission = d.submissions.at(-1);
    if (
      !submission ||
      d.activity.kind === "QUIZ" ||
      d.activity.kind === "CHALLENGE"
    )
      fail("Choose a submitted research game for anonymised export.");
    d.safeExport = {
      submissionId: submission.id,
      evidence: requiredText(
        body.evidence,
        "Complete de-identified submission evidence",
        20,
        64000,
      ),
      reviewerId: ctx.user._id,
      at: ctx.at,
      reason: reason(body),
    };
    await saveAttempt(ctx, record);
    await event(ctx, "EXPORT_EVIDENCE_APPROVED", {
      attemptId: record._id,
      userId: record.userId,
      submissionId: submission.id,
    });
    return;
  }
  if (action === "export-assessment") {
    const activityId = body.activityId;
    if (activityId === "D1-C01") await ensureComparisons(ctx);
    const records = await models.WeekOneAttempt.find({
      cohortId: ctx.cohortId,
      activityId,
    })
      .session(ctx.session)
      .lean();
    let activity = records[0]?.data.activity;
    if (!activity)
      activity = ctx.release.days
        .filter((d) => ["OPEN", "CLOSED"].includes(d.state))
        .flatMap((d) => d.content.activities || [])
        .find((a) => a.id === activityId);
    if (!activity || !activity.criteria.length)
      fail("Choose a released research game with an assessment rubric.");
    const roster = await models.User.find(rosterQuery(ctx.cohortId))
      .sort({ _id: 1 })
      .session(ctx.session)
      .lean();
    const mappings = [],
      submissions = [];
    for (const user of roster) {
      const record = records.find((r) => r.userId === user._id),
        source = record?.data.submissions.at(-1);
      if (source && record.data.safeExport?.submissionId !== source.id)
        fail(
          `Review and de-identify the current evidence for ${user.name} before exporting this complete batch.`,
          409,
        );
      const anonymousId = record?.data.anonymousId || randomUUID();
      mappings.push({
        anonymousId,
        userId: user._id,
        attemptId: record?._id || null,
        submissionId: source?.id || null,
        rubricVersion:
          record?.data.activity.rubricVersion || activity.rubricVersion,
      });
      submissions.push({
        anonymousId,
        status: source ? "SUBMITTED" : "PENDING_EVIDENCE",
        variantId: record?.data.variant?.id || null,
        sourceVersion:
          record?.data.contentVersion ||
          record?.data.variant?.questionVersion ||
          null,
        submissionRevision: source?.id || null,
        evidence: source ? record.data.safeExport.evidence : null,
      });
    }
    const id = randomUUID();
    const report = {
      batchId: id,
      activityId,
      rubricVersion: activity.rubricVersion,
      ratingScale: "0–4; unobserved criteria are not assessed",
      criteria: activity.criteria.map((key) =>
        criteria.find((c) => c.key === key),
      ),
      references: activity.variants.map((v) => ({
        id: v.id,
        name: v.name,
        brief: v.brief,
        reference: v.reference,
      })),
      submissions,
      outputContract: {
        batchId: id,
        fingerprint: "copy report fingerprint",
        rubricVersion: activity.rubricVersion,
        results: submissions.map((s) => ({
          anonymousId: s.anonymousId,
          ratings:
            s.status === "SUBMITTED"
              ? Object.fromEntries(activity.criteria.map((key) => [key, null]))
              : null,
          unreliable: false,
        })),
      },
    };
    const hash = fingerprint({
      activityId,
      rubricVersion: report.rubricVersion,
      criteria: report.criteria,
      references: report.references,
      submissions: report.submissions,
    });
    report.fingerprint = hash;
    report.outputContract.fingerprint = hash;
    await models.WeekOneBatch.create(
      [
        {
          _id: id,
          cohortId: ctx.cohortId,
          activityId,
          data: {
            mappings,
            report,
            fingerprint: hash,
            createdAt: ctx.at,
            by: ctx.user._id,
          },
        },
      ],
      { session: ctx.session },
    );
    await event(ctx, "ASSESSMENT_EXPORTED", {
      batchId: id,
      activityId,
      fingerprint: hash,
      count: roster.length,
    });
    return { report };
  }
  if (action === "import-assessment") {
    const result = body.result;
    if (!result || !Array.isArray(result.results))
      fail("Supply the structured external-AI JSON result.");
    const batch = await models.WeekOneBatch.findOne({
      _id: result.batchId,
      cohortId: ctx.cohortId,
    }).session(ctx.session);
    if (!batch) fail("Assessment batch not found.", 404);
    const b = batch.data;
    if (b.importedAt)
      fail(
        "This batch was already imported. Export a new revision for further marking.",
        409,
      );
    if (
      result.fingerprint !== b.fingerprint ||
      result.rubricVersion !== b.report.rubricVersion
    )
      fail("Batch fingerprint or rubric version does not match.", 409);
    const ids = result.results.map((r) => r.anonymousId);
    if (
      ids.length !== b.mappings.length ||
      new Set(ids).size !== ids.length ||
      b.mappings.some((m) => !ids.includes(m.anonymousId))
    )
      fail(
        "AI import must cover every anonymous ID exactly once; missing, duplicate or extra IDs are rejected.",
      );
    if (
      result.learningExamples !== undefined &&
      (!Array.isArray(result.learningExamples) ||
        result.learningExamples.length > 3 ||
        result.learningExamples.some(
          (e) =>
            !b.mappings.some(
              (m) => m.anonymousId === e.anonymousId && m.submissionId,
            ),
        ))
    )
      fail(
        "AI-selected examples must reference submitted anonymous IDs in this batch.",
      );
    for (const mapping of b.mappings) {
      const row = result.results.find(
        (r) => r.anonymousId === mapping.anonymousId,
      );
      if (!mapping.submissionId) {
        if (row.ratings !== null)
          fail(
            "A learner without evidence must remain Pending, never receive invented marks.",
          );
        continue;
      }
      const record = await attempt(ctx, mapping.attemptId),
        d = record.data;
      const source = d.submissions.at(-1);
      if (
        source?.id !== mapping.submissionId ||
        d.activity.rubricVersion !== mapping.rubricVersion ||
        d.safeExport?.submissionId !== source.id
      )
        fail("Evidence changed after export. Export a fresh batch.", 409);
      if (row.ratings === null) continue;
      const score = weightedRatings(d.activity.criteria, row.ratings);
      if (typeof row.unreliable !== "boolean")
        fail("Each result must declare evidence reliability.");
      const mustReview = needsHumanReview(
        score.percent,
        row.unreliable || !source.complete || source.late,
      );
      if (d.result)
        d.history.push({ result: copy(d.result), replacedAt: ctx.at });
      d.result = {
        ...score,
        ratings: row.ratings,
        aiRatings: row.ratings,
        status: mustReview ? "HUMAN_REVIEW" : "ACCEPTED",
        needsReview: mustReview,
        method: "EXTERNAL_AI_FIRST",
        batchId: batch._id,
        rubricVersion: d.activity.rubricVersion,
        submissionId: source.id,
        importedAt: ctx.at,
        importedBy: ctx.user._id,
      };
      await saveAttempt(ctx, record);
    }
    b.importedAt = ctx.at;
    b.importedBy = ctx.user._id;
    b.importedJson = copy(result);
    batch.markModified("data");
    await batch.save({ session: ctx.session });
    ctx.changedResults = true;
    await event(ctx, "ASSESSMENT_IMPORTED", {
      batchId: batch._id,
      activityId: batch.activityId,
    });
    return;
  }
  if (action === "review-assessment") {
    const record = await attempt(ctx, body.attemptId),
      d = record.data;
    if (!d.result || d.result.method !== "EXTERNAL_AI_FIRST")
      fail("Import AI-first ratings before human verification.", 409);
    const score = weightedRatings(d.activity.criteria, body.ratings);
    const previous = copy(d.result);
    d.history.push({ result: previous, replacedAt: ctx.at });
    d.result = {
      ...d.result,
      ...score,
      ratings: body.ratings,
      status: "ACCEPTED",
      reviewedBy: ctx.user._id,
      reviewedAt: ctx.at,
      reviewReason: reason(body),
    };
    await saveAttempt(ctx, record);
    ctx.changedResults = true;
    await event(ctx, "HUMAN_ASSESSMENT_VERIFIED", {
      attemptId: record._id,
      userId: record.userId,
      before: previous,
      after: copy(d.result),
    });
  }
}
