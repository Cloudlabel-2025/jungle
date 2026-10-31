import { models, connect } from "./db.js";
import { cohortOf, dayVisible } from "./week-one-rules.js";
import {
  blankProgram,
  publicActivity,
  emptyDayContent,
} from "./week-one-program-rules.js";
import {
  permit,
  staff,
  runProgram,
  copy,
  event,
  learner,
  saveLearner,
} from "./week-one-store.js";
import {
  configure,
  recap,
  observe,
  startAttempt,
  writeAttempt,
  extendAttempt,
  finishQuiz,
} from "./week-one-activities.js";
import {
  rulesAction,
  ticketAction,
  challengeAction,
  showcaseAction,
} from "./week-one-community.js";
import { assessmentAction } from "./week-one-assessments.js";
import { outcomeAction, outcomeRows } from "./week-one-outcomes.js";
import { dayOneAction } from "./day-one.js";
import { remainingWorkingMinutes } from "./support-rules.js";
import { fail } from "./day-one-rules.js";
import { normaliseLearner } from "./week-one-store.js";
import { provision } from "./week-one-provision.js";
import { deliverCollegeNotices, noticeId } from "./week-one-notifications.js";
import {
  recoveryActions,
  recoveryAction,
  recoveryProjection,
} from "./recovery.js";

const G = ["GAMER"],
  C = ["CENTRE_COMMAND"],
  M = ["MISSION_COMMANDER"];
const handlers = {};
const add = (names, roles, handler) =>
  names.forEach((name) => {
    handlers[name] = { roles, handler };
  });
for (const [name, roles] of Object.entries(recoveryActions))
  add([name], roles, recoveryAction);
add(["settings", "operations", "save-day", "prepare-day"], C, configure);
add(["provision"], C, provision);
add(["publish-recap", "complete-class"], staff, recap);
add(
  [
    "clock",
    "agenda-view",
    "agenda-ack",
    "recap-view",
    "recap-ack",
    "sod",
    "eod",
    "compass",
  ],
  G,
  observe,
);
add(["attempt-start"], G, startAttempt);
add(["attempt-save", "attempt-submit"], G, writeAttempt);
add(["extend-attempt"], staff, extendAttempt);
add(["publish-rules"], C, rulesAction);
add(["rules-ack"], G, rulesAction);
add(["publish-faq"], staff, rulesAction);
add(["ask"], G, ticketAction);
add(["reply", "escalate", "group-questions"], staff, ticketAction);
add(["publish-challenge"], C, challengeAction);
add(["start-challenge"], G, challengeAction);
add(["review-challenge"], staff, challengeAction);
add(
  [
    "showcase-groups",
    "share-work",
    "open-vote",
    "close-vote",
    "approve-question",
    "score-showcase",
  ],
  staff,
  showcaseAction,
);
add(
  ["share-consent", "showcase-read", "vote", "showcase-question"],
  G,
  showcaseAction,
);
add(
  [
    "prepare-comparison",
    "approve-export",
    "export-assessment",
    "import-assessment",
    "review-assessment",
  ],
  staff,
  assessmentAction,
);
add(["propose-exception", "propose-recognition"], staff, outcomeAction);
add(
  ["approve-exception", "publish-results", "begin-correction", "approve-team"],
  C,
  outcomeAction,
);
add(["signoff", "team-request", "specialist-review"], M, outcomeAction);
add(["dismiss-notification"], G, async (ctx) => {
  if (typeof ctx.body.id !== "string" || ctx.body.id.length > 150)
    fail("Choose a notification.");
  const l = await learner(ctx);
  l.data.dismissed ||= [];
  if (!l.data.dismissed.includes(ctx.body.id))
    l.data.dismissed.push(ctx.body.id);
  await saveLearner(ctx, l);
});
export async function programAction(user, action, body = {}, now = new Date()) {
  if (action === "deliver-college-notices")
    return {
      success: true,
      delivery: await deliverCollegeNotices(user, { now }),
    };
  const handler = handlers[action];
  if (!handler) fail("Unknown Week 1 programme action.", 404);
  permit(user, handler.roles);
  if (
    body.day === 1 &&
    ["clock", "agenda-view", "agenda-ack", "sod", "eod"].includes(action)
  ) {
    const values =
      action === "eod" && Array.isArray(body.answers)
        ? { text: body.answers.join("\n\n"), mode: body.mode }
        : body;
    return dayOneAction(user, action, values, now);
  }
  const result = await runProgram(user, action, body, now, handler.handler);
  if (["publish-results", "recovery-invite"].includes(action)) {
    try {
      result.delivery = await deliverCollegeNotices(user, { now });
    } catch {
      result.delivery = {
        pending: true,
        message:
          "Results are published; scheduling notice delivery needs review.",
      };
    }
  }
  return result;
}
async function expireQuizzes(user, now) {
  const query = {
    cohortId: cohortOf(user),
    "data.activity.kind": "QUIZ",
    "data.submittedAt": { $exists: false },
    "data.deadline": { $lt: now.toISOString() },
    ...(user.role === "GAMER" ? { userId: user._id } : {}),
  };
  if (!(await models.WeekOneAttempt.exists(query))) return;
  await runProgram(user, "QUIZ_EXPIRY", {}, now, async (ctx) => {
    const pending = await models.WeekOneAttempt.find(query).session(
      ctx.session,
    );
    for (const record of pending) {
      await finishQuiz(ctx, record, record.data.draft, true);
      await event(ctx, "QUIZ_EXPIRED", {
        userId: record.userId,
        attemptId: record._id,
      });
    }
  });
}
export async function programSnapshot(user, now = new Date()) {
  await connect();
  await expireQuizzes(user, now);
  const cohortId = cohortOf(user),
    gamer = user.role === "GAMER",
    cc = user.role === "CENTRE_COMMAND";
  const [program, release, learnerRows, attemptRows, tickets, batches] =
    await Promise.all([
      models.WeekOneProgram.findById(cohortId).lean(),
      models.WeekOneRelease.findById(cohortId).lean(),
      models.WeekOneLearner.find({
        cohortId,
        ...(gamer ? { userId: user._id } : {}),
      }).lean(),
      models.WeekOneAttempt.find({
        cohortId,
        ...(gamer ? { userId: user._id } : {}),
      }).lean(),
      models.WeekOneTicket.find({
        cohortId,
        ...(gamer ? { userId: user._id } : {}),
      }).lean(),
      gamer ? [] : models.WeekOneBatch.find({ cohortId }).lean(),
    ]);
  const p = program?.data || blankProgram(),
    days = release?.days || [];
  learnerRows.forEach(normaliseLearner);
  const publication = p.publications.at(-1),
    ownPublished = publication?.results.find((r) => r.userId === user._id);
  const deliveries =
    !gamer && publication
      ? await models.WeekOneDelivery.find({
          cohortId,
          publicationVersion: publication.version,
        }).lean()
      : [];
  const own = learnerRows.find((l) => l.userId === user._id),
    group = p.groups.find((g) => g.members.includes(user._id));
  const results = gamer
    ? ownPublished
      ? [ownPublished]
      : []
    : await outcomeRows({
        cohortId,
        release: release || { days: [] },
        p,
        session: null,
      });
  if (user.role === "MISSION_COMMANDER" && !publication)
    results.forEach((r) => {
      r.baseline = null;
    });
  const safeAttempts = attemptRows
    .filter((a) => !gamer || dayVisible(days[a.day - 1]))
    .map((a) => {
      const d = a.data;
      if (!gamer) return a;
      const { reference, ...variant } = d.variant || {};
      const publishedAssessment = ownPublished?.assessments?.find(
        (v) => v.activityId === a.activityId,
      );
      return {
        _id: a._id,
        activityId: a.activityId,
        day: a.day,
        version: a.version,
        data: {
          activity: publicActivity(d.activity),
          variant,
          draft: d.draft,
          submissions: d.submissions,
          startedAt: d.startedAt,
          deadline: d.deadline,
          submittedAt: d.submittedAt,
          savedAt: d.savedAt,
          firstQualifyingAt: d.firstQualifyingAt,
          review: d.review
            ? {
                genuine: d.review.genuine,
                reason: d.review.reason,
                at: d.review.at,
              }
            : null,
          result:
            publishedAssessment ||
            (d.result
              ? {
                  status:
                    d.result.status === "ACCEPTED"
                      ? "AWAITING_RELEASE"
                      : "HUMAN_REVIEW",
                }
              : null),
          originalUrl: d.originalUrl,
          extensions: d.extensions,
        },
      };
    });
  const notifications = [];
  if (gamer) {
    for (const day of days.filter((d) => d.state === "OPEN")) {
      for (const r of day.recaps || [])
        if (!own?.data.days[day.day]?.recaps?.[r.session])
          notifications.push({
            id: `recap:${day.day}:${r.session}`,
            message: `Class ${r.session} recap is ready. Please read and acknowledge it within 20 minutes.`,
            screen: "announcements",
          });
      if (day.content.nudgeAt && now >= new Date(day.content.nudgeAt))
        notifications.push({
          id: `discovery:${day.day}`,
          message:
            "Today's Discovery and the optional weekly challenge are available.",
          screen: "challenges",
        });
    }
    const rules = p.rules.at(-1);
    if (rules && !own?.data.ruleAcks[rules.version]) {
      const elapsed = remainingWorkingMinutes(
        rules.publishedAt,
        now,
        p.settings.calendar,
      );
      if (elapsed >= 120)
        notifications.push({
          id: `rules:${rules.version}:${Math.floor(elapsed / 120)}`,
          message:
            'Please read the current Game Rules and select "Yes, I understand", or ask MC for clarification.',
          screen: "game-rules",
        });
    }
  }
  const safeRounds = p.rounds
    .filter((r) => !gamer || r.groupId === group?.id)
    .map((r) => ({
      id: r.id,
      day: r.day,
      groupId: r.groupId,
      kind: r.kind,
      state: r.state,
      round: r.round,
      voteEndsAt: r.voteEndsAt,
      closedAt: r.closedAt,
      candidates: r.candidates.map((c) =>
        gamer
          ? {
              id: c.id,
              summary: c.summary,
              own: c.userId === user._id,
              read: r.reads[user._id]?.includes(c.id) || false,
            }
          : c,
      ),
      voted: r.ballots.some((b) => b.userId === user._id),
      ballotCount: gamer ? undefined : r.ballots.length,
      ...(gamer
        ? { selected: r.selectedUserId === user._id }
        : {
            selectedUserId: r.selectedUserId,
            participation: r.ballots.map((b) => b.userId),
            tally: r.candidates.map((c) => ({
              candidateId: c.id,
              count: r.ballots.filter((b) => b.candidateId === c.id).length,
            })),
          }),
      questions: r.questions
        .filter(
          (q) => !gamer || q.status === "APPROVED" || q.userId === user._id,
        )
        .map((q) =>
          gamer
            ? {
                id: q.id,
                text: q.safeText || q.text,
                status: q.status,
                own: q.userId === user._id,
              }
            : q,
        ),
    }));
  const finalTeams =
    p.teamRevisions
      ?.filter((r) => r.publicationVersion === publication?.version)
      .at(-1)?.teams ||
    publication?.teams ||
    [];
  return copy({
    recovery: recoveryProjection(p, user, now),
    version: program?.version || 0,
    settings: gamer
      ? {
          weights: p.settings.weights,
          clearance: p.settings.clearance,
          distinction: p.settings.distinction,
          compassQuestions: p.settings.compassQuestions,
        }
      : p.settings,
    days: days
      .filter((d) => !gamer || dayVisible(d))
      .map((d) => ({
        day: d.day,
        title: d.title,
        state: d.state,
        officialStart: d.officialStart,
        scheduledEnd: d.scheduledEnd,
        agenda: d.agenda,
        recaps: d.recaps || [],
        classes: d.classes || [],
        ...(d.day > 1 && d.content
          ? {
              activities: d.content.activities?.map(publicActivity) || [],
              discovery: d.content.discovery,
            }
          : {}),
        ...(!gamer
          ? { draft: d.draft || (d.day > 1 ? emptyDayContent(d.day) : null) }
          : {}),
      })),
    learners: gamer
      ? learnerRows.map((l) => ({
          ...l,
          data: {
            days: l.data.days,
            ruleAcks: l.data.ruleAcks,
            ledger: l.data.ledger,
            sharing: l.data.sharing,
            presented: Boolean(l.data.showcase),
            exceptions: l.data.exceptions,
          },
        }))
      : learnerRows,
    attempts: safeAttempts,
    tickets,
    rules: gamer ? p.rules.slice(-1) : p.rules,
    faq: p.faq,
    groups: gamer
      ? group
        ? [
            {
              id: group.id,
              name: group.name,
              memberCount: group.members.length,
            },
          ]
        : []
      : p.groups,
    rounds: safeRounds,
    challenges: p.challenges,
    notifications: notifications.filter(
      (n) => !own?.data.dismissed?.includes(n.id),
    ),
    results,
    publication: publication
      ? {
          version: publication.version,
          at: publication.at,
          recognition: {
            weekChampion: publication.results.find(
              (r) => r.userId === publication.recognition.weekChampionId,
            )?.name,
            researchChampion: publication.results.find(
              (r) => r.userId === publication.recognition.researchChampionId,
            )?.name,
            examples: publication.recognition.examples.map((e) => ({
              anonymousId: e.anonymousId,
              summary: e.summary,
            })),
            awards: publication.recognition.awards.map((a) => ({
              id: a.id,
              name: a.name,
              userId: a.userId,
              recipientName: publication.results.find(
                (r) => r.userId === a.userId,
              )?.name,
            })),
          },
          teams: gamer ? [] : finalTeams,
          rescue: gamer
            ? publication.rescue.filter((r) => r.userId === user._id)
            : publication.rescue,
        }
      : null,
    ...(!gamer
      ? {
          batches: batches.map((b) => ({
            id: b._id,
            activityId: b.activityId,
            createdAt: b.data.createdAt,
            importedAt: b.data.importedAt,
            learningExamples: b.data.importedJson?.learningExamples || [],
          })),
          signoff: p.signoff,
          locked: p.locked || false,
          correction: p.correction || null,
          recognition: p.recognition,
          exceptionRequests: p.exceptionRequests || [],
          teamRequests: p.teamRequests,
          specialistReviews: p.specialistReviews,
          questionGroups: p.questionGroups || [],
          collegeNotices: (p.collegeNotices || []).map((n) => ({
            ...n,
            ...(deliveries.find(
              (d) =>
                d._id ===
                (n.noticeId ||
                  noticeId(cohortId, n.publicationVersion, n.userId)),
            ) || {}),
          })),
          overdueReviews: attemptRows
            .filter(
              (a) =>
                a.data.submittedAt &&
                now.getTime() - Date.parse(a.data.submittedAt) >= 86400000 &&
                (a.data.activity.kind === "CHALLENGE"
                  ? !a.data.review
                  : a.data.result?.status !== "ACCEPTED"),
            )
            .map((a) => ({
              attemptId: a._id,
              userId: a.userId,
              activityId: a.activityId,
            })),
        }
      : {}),
    ...(cc
      ? {
          publicationHistory: p.publications.map((v) => ({
            version: v.version,
            by: v.by,
            at: v.at,
            correction: v.correction,
          })),
        }
      : {}),
  });
}
export async function programAudit(user, { cursor, kind } = {}) {
  permit(user, staff);
  await connect();
  const query = { cohortId: cohortOf(user) };
  if (kind) {
    if (typeof kind !== "string" || !/^[A-Z_-]{1,64}$/.test(kind))
      fail("Choose a valid audit category.");
    query.kind = kind;
  }
  if (cursor) {
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch {
      fail("Invalid audit cursor.");
    }
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(parsed.id) ||
      !Number.isFinite(Date.parse(parsed.at))
    )
      fail("Invalid audit cursor.");
    query.$or = [
      { createdAt: { $lt: new Date(parsed.at) } },
      { createdAt: new Date(parsed.at), _id: { $lt: parsed.id } },
    ];
  }
  const rows = await models.WeekOneEvent.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(51)
    .lean();
  const events = rows.slice(0, 50),
    last = events.at(-1);
  return copy({
    events,
    nextCursor:
      rows.length > 50
        ? Buffer.from(
            JSON.stringify({ at: last.createdAt, id: last._id }),
          ).toString("base64url")
        : null,
  });
}
