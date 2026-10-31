import { models } from "./db.js";
import { fraction, sum, over, numeric, stored } from "./week-one-fractions.js";
import { normaliseLearner } from "./week-one-store.js";
import { criteria } from "./week-one-catalog.js";
import { fail } from "./day-one-rules.js";
import {
  readiness,
  balancedTeams,
  bookRescues,
} from "./week-one-program-rules.js";
import { professionalEvidence } from "./week-one-ledger.js";
import { recoveryAction } from "./recovery.js";
import {
  rosterQuery,
  learner,
  saveLearner,
  fingerprint,
  reason,
  event,
  copy,
  editable,
} from "./week-one-store.js";

export function capabilityScores(attempts) {
  const observed = criteria.map((c) => {
    const ratings = attempts
      .filter(
        (a) =>
          a.activityId !== "D1-C01" && a.data.result?.status === "ACCEPTED",
      )
      .flatMap((a) => a.data.result.criteria || [])
      .filter((v) => v.key === c.key);
    return {
      ...c,
      observations: ratings.length,
      percent: ratings.length
        ? ratings.reduce((n, v) => n + (v.rating / 4) * 100, 0) / ratings.length
        : null,
    };
  });
  return [...new Set(criteria.map((c) => c.area))].map((area) => {
    const mapped = observed.filter((c) => c.area === area),
      assessed = mapped.filter((c) => c.percent !== null);
    return {
      area,
      criteria: mapped,
      observations: assessed.reduce((n, c) => n + c.observations, 0),
      percent: assessed.length
        ? assessed.reduce((n, c) => n + c.percent * c.weight, 0) /
          assessed.reduce((n, c) => n + c.weight, 0)
        : null,
    };
  });
}
export async function outcomeRows(ctx) {
  const historical = ctx.p?.publications
    ?.at(-1)
    ?.results.map((row) => row.userId);
  const rosterScope = rosterQuery(ctx.cohortId);
  if (historical?.length) {
    delete rosterScope.active;
    rosterScope._id = { $in: historical };
  }
  const [roster, learners, attempts, originals] = await Promise.all([
    models.User.find(rosterScope)
      .sort({ _id: 1 })
      .session(ctx.session || null)
      .lean(),
    models.WeekOneLearner.find({ cohortId: ctx.cohortId })
      .session(ctx.session || null)
      .lean(),
    models.WeekOneAttempt.find({ cohortId: ctx.cohortId })
      .session(ctx.session || null)
      .lean(),
    models.DayOneRecord.find({ cohortId: ctx.cohortId })
      .session(ctx.session || null)
      .lean(),
  ]);
  learners.forEach(normaliseLearner);
  return roster.map((user) => {
    const l = learners.find((l) => l.userId === user._id),
      own = attempts.filter((a) => a.userId === user._id),
      original = originals.find((r) => r.userId === user._id);
    const score = (id) => own.find((a) => a.activityId === id)?.data.result;
    const accepted = (id) =>
      score(id)?.status === "ACCEPTED" ? score(id).percent : null;
    const average = (ids) =>
      ids.every((id) => accepted(id) !== null)
        ? ids.reduce((n, id) => n + accepted(id), 0) / ids.length
        : null;
    const professional = professionalEvidence(
      ctx.release,
      l,
      own,
      original,
      ctx.p,
    );
    const discoveryPending = own.some(
      (a) =>
        a.data.activity.kind === "CHALLENGE" &&
        a.data.activity.challengeKind === "DAILY" &&
        a.data.submittedAt &&
        a.data.review?.submissionId !== a.data.submissions.at(-1)?.id,
    );
    const parts = {
      fitness: accepted("D5-F01"),
      general: average(["D2-G01", "D3-G01", "D4-G01"]),
      technical: average(["D2-G02", "D3-G02", "D4-G02"]),
      quiz: accepted("D5-Q01"),
      showcase: l?.data.showcase ? l.data.showcase.total * 10 : null,
      professional:
        ctx.release.days.every((d) => d.state === "CLOSED") &&
        !discoveryPending &&
        !professional.pending
          ? professional.total * 10
          : null,
    };
    const comparable =
      original?.data.verification?.status === "VERIFIED"
        ? accepted("D1-C01")
        : null;
    const fitness = accepted("D5-F01");
    const comparison =
      comparable === null || fitness === null
        ? { status: "PENDING_EVIDENCE" }
        : {
            status: "READY",
            before: comparable,
            after: fitness,
            delta: fitness - comparable,
            rubricVersion: score("D5-F01").rubricVersion,
            reflection: own
              .find((a) => a.activityId === "D5-F01")
              ?.data.submissions.at(-1)?.answers.reflection,
          };
    const ratioOf = (id) =>
      score(id)?.ratio
        ? fraction(score(id).ratio)
        : over(fraction(accepted(id) || 0), fraction(100));
    const averageRatio = (ids) =>
      stored(over(sum(ids.map(ratioOf)), fraction(ids.length)));
    const ratios = {
      fitness: stored(ratioOf("D5-F01")),
      general: averageRatio(["D2-G01", "D3-G01", "D4-G01"]),
      technical: averageRatio(["D2-G02", "D3-G02", "D4-G02"]),
      quiz: stored(ratioOf("D5-Q01")),
      showcase: stored(
        over(fraction(l?.data.showcase?.total || 0), fraction(10)),
      ),
      professional: professional.ratio,
    };
    const originalBaseline =
      original?.data.originalBaseline || original?.data.assessment;
    return {
      userId: user._id,
      name: user.name,
      ...readiness(parts, ctx.p.settings, ratios),
      professional,
      comparison,
      assessments: own
        .filter((a) => a.data.result?.status === "ACCEPTED")
        .map((a) => ({ activityId: a.activityId, ...a.data.result })),
      baseline: originalBaseline?.approvedAt
        ? {
            total: originalBaseline.total,
            maximum: originalBaseline.max,
            rubricVersion: originalBaseline.rubricVersion,
          }
        : null,
      capabilities: capabilityScores(own),
      compass: Boolean(l?.data.days[5]?.compass),
      specialistRecommendations: capabilityScores(own)
        .filter(
          (a) => a.percent !== null && a.percent > ctx.p.settings.specialist,
        )
        .map((a) => ({
          area: a.area,
          percent: a.percent,
          observations: a.observations,
          status:
            ctx.p.specialistReviews.find(
              (r) => r.userId === user._id && r.area === a.area,
            )?.status || "EVIDENCE_AND_MC_REVIEW_REQUIRED",
          message: `Consider a matching Week 3 Level 2 task in ${a.area}.`,
        })),
    };
  });
}
const digestRows = (rows, settings) => fingerprint({ settings, rows });
export async function outcomeAction(ctx) {
  const { action, body, p } = ctx;
  if (action === "begin-correction") {
    if (!p.locked || p.correction)
      fail("A new correction requires published, locked results.", 409);
    p.correction = {
      approvedBy: ctx.user._id,
      at: ctx.at,
      reason: reason(body),
    };
    p.signoff = null;
    await event(ctx, "RESULT_CORRECTION_AUTHORISED", p.correction);
    return;
  }
  if (action === "propose-exception") {
    editable(ctx);
    const l = await learner(ctx, body.userId);
    if (
      !Number.isInteger(body.day) ||
      body.day < 1 ||
      body.day > 5 ||
      !Array.isArray(body.excluded)
    )
      fail("Choose a day and factual event exclusions.");
    const allowed = [
      "clock",
      "agenda",
      "eod",
      "research",
      "recap1",
      "recap2",
      "rules",
      "ballot",
      "D2-G01",
      "D2-G02",
      "D3-G01",
      "D3-G02",
      "D4-G01",
      "D4-G02",
      "D5-F01",
      "D5-Q01",
    ];
    if (body.excluded.some((id) => !allowed.includes(id)))
      fail("Unknown professional event exclusion.");
    p.exceptionRequests ||= [];
    const request = {
      id: fingerprint([ctx.at, l.userId, body.day, ctx.program.version]),
      userId: l.userId,
      day: body.day,
      excluded: [...new Set(body.excluded)],
      discoveryExcused: body.discoveryExcused === true,
      excused: body.excused === true,
      reason: reason(body),
      proposedBy: ctx.user._id,
      at: ctx.at,
      status: "PENDING",
    };
    p.exceptionRequests.push(request);
    await event(ctx, "PROFESSIONAL_EXCEPTION_PROPOSED", request);
    return;
  }
  if (action === "approve-exception") {
    editable(ctx);
    const request = p.exceptionRequests?.find(
      (r) => r.id === body.requestId && r.status === "PENDING",
    );
    if (!request) fail("Pending exception not found.", 404);
    const l = await learner(ctx, request.userId);
    request.status = body.approve === true ? "APPROVED" : "REJECTED";
    request.decisionReason = reason(body);
    request.decidedBy = ctx.user._id;
    request.decidedAt = ctx.at;
    if (body.approve === true) {
      l.data.exceptions[request.day] = copy(request);
      await saveLearner(ctx, l);
      ctx.changedResults = true;
    }
    await event(ctx, "PROFESSIONAL_EXCEPTION_DECIDED", request);
    return;
  }
  const rows = await outcomeRows(ctx);
  if (action === "specialist-review") {
    const row = rows.find((r) => r.userId === body.userId),
      area = row?.capabilities.find((c) => c.area === body.area);
    if (!area || area.percent === null || area.percent <= p.settings.specialist)
      fail(
        "Specialist consideration requires strictly greater than the configured capability threshold with observed evidence.",
      );
    p.specialistReviews = p.specialistReviews.filter(
      (r) => !(r.userId === body.userId && r.area === body.area),
    );
    p.specialistReviews.push({
      userId: body.userId,
      area: body.area,
      status: body.approve === true ? "MC_APPROVED" : "MORE_EVIDENCE_REQUIRED",
      evidence: reason(body),
      by: ctx.user._id,
      at: ctx.at,
    });
    ctx.changedResults = true;
    await event(
      ctx,
      "SPECIALIST_RECOMMENDATION_REVIEWED",
      p.specialistReviews.at(-1),
    );
    return;
  }
  if (action === "propose-recognition") {
    editable(ctx);
    if (
      p.settings.awardDefinitions.length !== 13 ||
      !Array.isArray(body.awards) ||
      body.awards.length !== 13 ||
      new Set(body.awards.map((a) => a.userId)).size !== 13 ||
      new Set(body.awards.map((a) => a.awardId)).size !== 13
    )
      fail(
        "Nominate 13 different recipients for the five Skill and eight Growth award definitions.",
      );
    const awards = body.awards.map((a) => {
      const definition = p.settings.awardDefinitions.find(
        (d) => d.id === a.awardId,
      );
      if (!definition || !rows.some((r) => r.userId === a.userId))
        fail("Award or recipient is outside the cohort.");
      return { ...definition, userId: a.userId, evidence: reason(a) };
    });
    if (!Array.isArray(body.examples) || body.examples.length !== 3)
      fail("Approve three external-AI-selected learning examples.");
    const examples = [];
    for (const e of body.examples) {
      const batch = await models.WeekOneBatch.findOne({
        _id: e.batchId,
        cohortId: ctx.cohortId,
      })
        .session(ctx.session)
        .lean();
      if (
        !batch?.data.importedJson?.learningExamples?.some(
          (v) => v.anonymousId === e.anonymousId,
        ) ||
        !batch.data.mappings.some(
          (m) => m.anonymousId === e.anonymousId && m.submissionId,
        )
      )
        fail(
          "Each example must reference a submitted source selected in an imported AI batch.",
        );
      examples.push({
        batchId: e.batchId,
        anonymousId: e.anonymousId,
        summary: reason(e),
      });
    }
    if (
      new Set(examples.map((e) => `${e.batchId}:${e.anonymousId}`)).size !== 3
    )
      fail("Choose three distinct learning examples.");
    p.recognition = {
      awards,
      examples,
      weekChampionId: body.weekChampionId,
      championReason: reason(body),
      proposedBy: ctx.user._id,
      at: ctx.at,
    };
    p.signoff = null;
    await event(ctx, "RECOGNITION_PROPOSED", p.recognition);
    return;
  }
  if (action === "signoff") {
    editable(ctx);
    if (ctx.release.days.some((d) => d.state !== "CLOSED"))
      fail("Close all five days before final signoff.", 409);
    if (!p.rules.length)
      fail(
        "Publish and review the Game Rules workflow before final signoff.",
        409,
      );
    if (rows.length !== 25 || rows.some((r) => r.status === "PENDING"))
      fail(
        "All 25 readiness records need accepted component marks. Pending evidence is never zero.",
        409,
      );
    if (rows.some((r) => !r.compass))
      fail(
        "Complete or resolve the required weekly Compass Check records before signoff.",
        409,
      );
    if (p.exceptionRequests?.some((r) => r.status === "PENDING"))
      fail("Resolve pending factual exceptions before signoff.", 409);
    if (
      p.groups.length !== 5 ||
      ctx.release.days.some((d) => {
        const rounds = p.rounds.filter(
          (r) => r.day === d.day && r.state === "ASSESSED",
        );
        return (
          rounds.length !== 5 ||
          new Set(rounds.map((r) => r.groupId)).size !== 5 ||
          rounds.filter((r) => r.kind === "TECHNICAL").length !==
            (d.day === 1 ? 0 : 3)
        );
      })
    )
      fail(
        "Complete five assessed group presentations per day with the approved technical/general mix.",
        409,
      );
    if (
      new Set(p.rounds.map((r) => r.selectedUserId).filter(Boolean)).size !== 25
    )
      fail("All 25 Gamers must present exactly once.", 409);
    p.signoff = {
      by: ctx.user._id,
      at: ctx.at,
      digest: digestRows(rows, p.settings),
      reason: reason(body),
    };
    await event(ctx, "MC_SIGNOFF", p.signoff);
    return;
  }
  if (action === "publish-results") {
    if (p.locked && !p.correction)
      fail(
        "Results are already published. Authorise a correction to publish a revision.",
        409,
      );
    if (!p.signoff || p.signoff.digest !== digestRows(rows, p.settings))
      fail(
        "A current MC signoff is required. Recheck changed evidence before publication.",
        409,
      );
    if (
      !p.recognition ||
      p.recognition.awards.length !== 13 ||
      p.recognition.examples.length !== 3
    )
      fail(
        "Approve the 13 awards and three learning examples before publication.",
        409,
      );
    const champion = rows.find(
      (r) => r.userId === p.recognition.weekChampionId,
    );
    if (!champion || champion.total !== Math.max(...rows.map((r) => r.total)))
      fail(
        "The Week 1 Champion must have the highest verified readiness score; document any tied selection.",
      );
    const originalSetup = await models.DayOneSetup.findById(
      ctx.cohortId,
    ).session(ctx.session);
    if (!originalSetup?.champion)
      fail(
        "CC must record the private Day 1 Research Champion decision before publication.",
        409,
      );
    const version = p.publications.length + 1;
    const rescue = p.recovery?.policy
      ? []
      : bookRescues(
          rows,
          p.settings.rescueSlots,
          p.settings.calendar.timeZone,
          ctx.release.days[4].scheduledEnd,
        );
    const teams = p.recovery?.policy ? [] : balancedTeams(rows);
    const publication = {
      version,
      results: copy(rows),
      recognition: {
        ...copy(p.recognition),
        researchChampionId: originalSetup.champion.userId,
      },
      rescue,
      teams,
      by: ctx.user._id,
      at: ctx.at,
      signoff: copy(p.signoff),
      reason: reason(body),
      correction: p.correction || null,
    };
    p.publications.push(publication);
    p.locked = true;
    p.correction = null;
    p.collegeNotices = rescue.map((r) => ({
      userId: r.userId,
      publicationVersion: version,
      status: "READY_FOR_AUTHORISED_DELIVERY",
      rescue: r,
    }));
    originalSetup.champion = {
      ...originalSetup.champion,
      releasedAt: ctx.at,
      releasedBy: ctx.user._id,
      resultVersion: version,
      releaseReason: publication.reason,
    };
    originalSetup.markModified("champion");
    await originalSetup.save({ session: ctx.session });
    await event(ctx, "CC_RESULTS_LOCKED_AND_PUBLISHED", {
      version,
      signoff: p.signoff,
      rescue,
      teams,
      reason: publication.reason,
    });
    if (
      p.recovery?.policy &&
      p.recovery.participants.some(
        (person) => Object.keys(person.attempts).length,
      )
    ) {
      p.recovery.reconciliationRequired = version;
      await event(ctx, "RECOVERY_RESULTS_RECONCILIATION_REQUIRED", {
        publicationVersion: version,
      });
    } else if (p.recovery?.policy && p.recovery.configs.length)
      await recoveryAction({ ...ctx, action: "recovery-invite", body: {} });
    return;
  }
  if (action === "team-request") {
    if (p.recovery?.policy)
      fail("Use Pack 3A final team review after recovery.", 409);
    const published = p.publications.at(-1);
    if (!published)
      fail(
        "Publish Friday's provisional allocation before proposing changes.",
        409,
      );
    validateTeamProposal(body.teams, published.results);
    p.teamRequests.push({
      id: fingerprint([ctx.at, ctx.user._id, p.teamRequests.length]),
      teams: body.teams,
      reason: reason(body),
      proposedBy: ctx.user._id,
      status: "PENDING",
      at: ctx.at,
    });
    await event(ctx, "TEAM_ADJUSTMENT_REQUESTED", p.teamRequests.at(-1));
    return;
  }
  if (action === "approve-team") {
    if (p.recovery?.policy)
      fail("Use Pack 3A final team approval after recovery.", 409);
    const request = p.teamRequests.find(
        (r) => r.id === body.requestId && r.status === "PENDING",
      ),
      published = p.publications.at(-1);
    if (!request || !published) fail("Pending team request not found.", 404);
    validateTeamProposal(request.teams, published.results);
    request.status = body.approve === true ? "APPROVED" : "REJECTED";
    request.decidedBy = ctx.user._id;
    request.decisionReason = reason(body);
    request.decidedAt = ctx.at;
    // Preserve the locked publication; append allocation revisions separately.
    if (body.approve === true) {
      p.teamRevisions ||= [];
      p.teamRevisions.push({
        publicationVersion: published.version,
        teams: request.teams.map((t, i) => ({
          id: `week1-team-${i + 1}`,
          members: t.members,
          status: "PROVISIONAL",
        })),
        requestId: request.id,
        approvedBy: ctx.user._id,
        at: ctx.at,
      });
    }
    await event(ctx, "TEAM_ADJUSTMENT_DECIDED", request);
  }
}
function validateTeamProposal(teams, results) {
  const cleared = results
    .filter((r) => r.status === "CLEARED")
    .map((r) => r.userId)
    .sort();
  if (
    !Array.isArray(teams) ||
    teams.some(
      (t) =>
        !Array.isArray(t.members) || !t.members.length || t.members.length > 5,
    ) ||
    teams
      .flatMap((t) => t.members)
      .sort()
      .join() !== cleared.join()
  )
    fail(
      "Provisional teams must include every cleared learner exactly once, with at most five per team. Rescue-pending learners remain unallocated.",
    );
}
