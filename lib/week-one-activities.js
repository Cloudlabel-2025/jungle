import { randomUUID } from "node:crypto";
import { quizRatio } from "./week-one-program-rules.js";
import { models } from "./db.js";
import { activities, eodQuestions } from "./week-one-catalog.js";
import { fail, requiredText, localParts } from "./day-one-rules.js";
import { prepareDay, dayNumber } from "./week-one-rules.js";
import { validateCalendar } from "./support-rules.js";
import {
  validateSettings,
  validateDayContent,
  answersFor,
  completeAnswers,
  quizScore,
  iso,
  finite,
} from "./week-one-program-rules.js";
import {
  editable,
  dayAt,
  learner,
  saveLearner,
  attempt,
  saveAttempt,
  event,
  reason,
  copy,
} from "./week-one-store.js";
import { reconcileTrophies } from "./week-one-ledger.js";

export async function configure(ctx) {
  const { body, p, release } = ctx;
  if (ctx.action === "settings") {
    if (release.days.some((d) => ["OPEN", "CLOSED"].includes(d.state)))
      fail("Readiness settings are locked once the cohort starts.", 409);
    const settings = validateSettings(body.settings);
    if (p.recovery?.policy && settings.clearance !== 60)
      fail("Pack 3A clearance is frozen at 60%.");
    settings.calendar = validateCalendar(settings.calendar);
    settings.version = p.settings.version + 1;
    p.settings = settings;
    await event(ctx, "SETTINGS_VERSION", {
      version: settings.version,
      settings,
    });
  } else if (ctx.action === "operations") {
    // Scheduling and curriculum prompts can be completed after teaching starts;
    // scoring weights and thresholds cannot change through this action.
    editable(ctx);
    const settings = validateSettings({
      ...p.settings,
      compassQuestions: body.compassQuestions ?? p.settings.compassQuestions,
      awardDefinitions: body.awardDefinitions ?? p.settings.awardDefinitions,
      rescueSlots: body.rescueSlots ?? p.settings.rescueSlots,
    });
    for (const key of ["compassQuestions", "awardDefinitions", "rescueSlots"])
      p.settings[key] = settings[key];
    ctx.changedResults = true;
    await event(ctx, "OPERATIONS_CONFIGURED", {
      reason: reason(body),
      compassQuestions: settings.compassQuestions,
      awardDefinitions: settings.awardDefinitions,
      rescueSlots: settings.rescueSlots,
    });
  } else {
    const number = dayNumber(body.day);
    if (number === 1)
      fail("Use the Day 1 configuration to preserve original baselines.");
    const day = dayAt(ctx, number);
    if (["OPEN", "CLOSED"].includes(day.state))
      fail("Opened day content is version-locked.", 409);
    if (!body.content || JSON.stringify(body.content).length > 85000)
      fail("Supply a content pack below 85 KB.");
    if (ctx.action === "save-day") {
      day.draft = copy(body.content);
      await event(ctx, "DAY_DRAFT_SAVED", { day: number });
    } else {
      const content = validateDayContent(
        number,
        body.content,
        release.days[0].content,
      );
      if (number === 5 && p.settings.compassQuestions.length !== 3)
        fail(
          "Configure the three approved Compass Check prompts before preparing Friday.",
          409,
        );
      const previous = release.days[number - 2];
      if (
        previous.scheduledEnd &&
        Date.parse(content.officialStart) <= Date.parse(previous.scheduledEnd)
      )
        fail("The next day must start after the previous day ends.");
      content.version = (day.contentVersion || 0) + 1;
      const previousState = day.state;
      prepareDay(release, number, content, ctx.user._id, ctx.at);
      day.draft = content;
      await event(ctx, "PREPARE", {
        day: number,
        previousState,
        state: "PREPARED",
        contentVersion: content.version,
      });
    }
  }
}
export async function recap(ctx) {
  const day = dayAt(ctx, ctx.body.day, true);
  if (day.day === 1) fail("Day 1 has no two-session recap workflow.");
  const session = ctx.body.session;
  if (![1, 2].includes(session)) fail("Choose class session 1 or 2.");
  day.classes ||= [];
  if (ctx.action === "complete-class") {
    if (day.classes.some((c) => c.session === session))
      fail("Class completion is already recorded.", 409);
    day.classes.push({ session, completedAt: ctx.at, by: ctx.user._id });
    await event(ctx, "CLASS_COMPLETED", { day: day.day, session });
    return;
  }
  if (!day.classes.some((c) => c.session === session))
    fail("Record this class as completed before publishing its recap.", 409);
  day.recaps ||= [];
  if (day.recaps.some((r) => r.session === session))
    fail("This recap is already published.", 409);
  day.recaps.push({
    session,
    version: 1,
    text: requiredText(ctx.body.text, "Class recap", 10, 4000),
    publishedAt: ctx.at,
    publishedBy: ctx.user._id,
    deadline: new Date(ctx.now.getTime() + 20 * 60000).toISOString(),
  });
  await event(ctx, "CLASS_RECAP", { day: day.day, session });
}
export async function observe(ctx) {
  editable(ctx);
  const day = dayAt(ctx, ctx.body.day, true),
    record = await learner(ctx),
    d = (record.data.days[day.day] ||= {});
  const { action, body, at, now } = ctx;
  if (day.day === 1) fail("Day 1 observations use the original Day 1 record.");
  if (action === "clock") {
    if (!d.clockAt) {
      if (
        localParts(now, day.content.timeZone).day !==
        localParts(day.officialStart, day.content.timeZone).day
      )
        fail("Clock in on the configured day.", 409);
      d.clockAt = at;
      const date = localParts(day.officialStart, day.content.timeZone).day;
      await models.Attendance.updateOne(
        { userId: record.userId, day: date },
        {
          $setOnInsert: {
            _id: randomUUID(),
            userId: record.userId,
            day: date,
            clockAt: now,
            onTime: now <= new Date(day.officialStart),
          },
        },
        { upsert: true, session: ctx.session },
      );
    }
  } else if (action === "agenda-view") {
    if (!day.agenda) fail("The agenda has not been published.", 409);
    d.agendaViewedAt ||= at;
  } else if (action === "agenda-ack") {
    if (!day.agenda || !d.agendaViewedAt)
      fail("Open the agenda before acknowledging it.", 409);
    d.agendaAcknowledgedAt ||= at;
  } else if (action === "recap-view") {
    if (!day.recaps?.some((r) => r.session === body.session))
      fail("The recap has not been published.", 409);
    d.recapViews ||= {};
    d.recapViews[body.session] ||= at;
  } else if (action === "recap-ack") {
    const recap = day.recaps?.find((r) => r.session === body.session);
    if (!recap) fail("The recap has not been published.", 409);
    if (!d.recapViews?.[body.session])
      fail("Open the recap before acknowledging it.", 409);
    d.recaps ||= {};
    d.recaps[body.session] ||= at;
  } else if (action === "sod")
    d.sod ||= { text: requiredText(body.text, "SOD reflection", 10, 4000), at };
  else if (action === "eod") {
    if (
      !Array.isArray(body.answers) ||
      body.answers.length !== eodQuestions[day.day].length
    )
      fail("Answer every EOD prompt.");
    d.eod ||= {
      answers: body.answers.map((a) => requiredText(a, "EOD answer", 1, 2000)),
      mode: body.mode === "VOICE" ? "VOICE" : "TEXT",
      at,
    };
  } else if (action === "compass") {
    if (
      day.day !== 5 ||
      ctx.p.settings.compassQuestions.length !== 3 ||
      !Array.isArray(body.answers) ||
      body.answers.length !== 3
    )
      fail("Complete the three configured Compass Check prompts on Friday.");
    d.compass ||= {
      answers: body.answers.map((a) =>
        requiredText(a, "Compass answer", 1, 2000),
      ),
      at,
    };
  }
  await reconcileTrophies(ctx, record);
  await saveLearner(ctx, record);
  ctx.changedResults = true;
  await event(ctx, action.toUpperCase(), {
    day: day.day,
    userId: record.userId,
    observation: copy(d),
  });
}
export async function startAttempt(ctx) {
  editable(ctx);
  const day = dayAt(ctx, ctx.body.day, true);
  const activity = day.content.activities?.find(
    (a) => a.id === ctx.body.activityId,
  );
  if (!activity) fail("Activity is not released for this day.", 404);
  if (ctx.now < new Date(day.officialStart))
    fail("The activity window has not started.", 409);
  const id = `${ctx.cohortId}:${ctx.user._id}:${activity.id}`;
  const existing = await models.WeekOneAttempt.findById(id).session(
    ctx.session,
  );
  if (existing) return { attemptId: existing._id };
  await learner(ctx); // Verify current roster membership.
  let variant =
    activity.kind === "QUIZ"
      ? null
      : activity.variants.find((v) => v.id === ctx.body.variantId);
  let original;
  if (activity.kind === "FITNESS") {
    original = await models.DayOneRecord.findOne({
      cohortId: ctx.cohortId,
      userId: ctx.user._id,
    })
      .session(ctx.session)
      .lean();
    const genre = original?.data.config.genres.find(
      (g) => g.id === original.data.genreId,
    );
    if (!genre)
      fail(
        "Your original Day 1 genre and question are required for the Fitness Test.",
        409,
      );
    const reference = activity.variants.find((v) => v.id === genre.id);
    if (!reference || reference.brief !== genre.question)
      fail(
        "CC must supply a reference pack for your pinned Day 1 question version.",
        409,
      );
    variant = {
      ...reference,
      brief: genre.question,
      questionVersion: genre.version,
      sourceUrl: original.data.submissions.at(-1)?.url || null,
    };
  }
  if (activity.kind !== "QUIZ" && !variant) fail("Choose a released variant.");
  const record = new models.WeekOneAttempt({
    _id: id,
    cohortId: ctx.cohortId,
    userId: ctx.user._id,
    activityId: activity.id,
    day: day.day,
    version: 0,
    data: {
      activity: copy(activity),
      variant: copy(variant),
      contentVersion: day.contentVersion,
      anonymousId: randomUUID(),
      startedAt: ctx.at,
      deadline: new Date(
        ctx.now.getTime() + activity.durationMinutes * 60000,
      ).toISOString(),
      draft: {},
      submissions: [],
      result: null,
      history: [],
      extensions: [],
      ...(original
        ? {
            originalQuestionVersion: original.data.config.version,
            originalUrl: original.data.submissions.at(-1)?.url,
            originalUrls: original.data.submissions.map((s) => s.url),
          }
        : {}),
    },
  });
  await record.save({ session: ctx.session });
  await event(ctx, "ATTEMPT_STARTED", {
    day: day.day,
    userId: record.userId,
    attemptId: id,
    contentVersion: day.contentVersion,
  });
  return { attemptId: id };
}
export async function finishQuiz(ctx, record, answers, expired = false) {
  const d = record.data;
  if (d.submittedAt) return;
  d.draft = answersFor(d.activity, null, answers);
  d.submissions.push({
    id: randomUUID(),
    at: ctx.at,
    answers: copy(d.draft),
    expired,
  });
  d.submittedAt = ctx.at;
  d.result = {
    percent: quizScore(d.activity, d.draft),
    ratio: quizRatio(d.activity, d.draft),
    status: "ACCEPTED",
    method: "ANSWER_KEY",
    at: ctx.at,
  };
  await saveAttempt(ctx, record);
  const l = await learner(ctx, record.userId);
  await reconcileTrophies(ctx, l);
  await saveLearner(ctx, l);
  ctx.changedResults = true;
}
export async function writeAttempt(ctx) {
  const record = await attempt(ctx, ctx.body.attemptId, true),
    d = record.data;
  const day = dayAt(ctx, record.day);
  const extension = d.extensions.at(-1);
  const challenge = d.activity.kind === "CHALLENGE";
  if (
    !challenge ||
    (d.activity.challengeKind === "DAILY" && d.submittedAt && d.review)
  )
    editable(ctx);
  if (challenge) {
    const cohort = await models.Cohort.findById(ctx.cohortId)
      .session(ctx.session)
      .lean();
    if ((cohort?.currentWeek || 1) > 6)
      fail("The Week 6 challenge submission window has ended.", 409);
  }
  if (
    !challenge &&
    day.state !== "OPEN" &&
    !(extension && ctx.now <= new Date(extension.deadline))
  )
    fail("Closed attempts are read-only without an authorised extension.", 409);
  if (
    ctx.body.attemptVersion !== undefined &&
    ctx.body.attemptVersion !== record.version
  )
    fail("Attempt changed in another session. Refresh before saving.", 409);
  const expired = ctx.now > new Date(d.deadline);
  if (d.activity.kind === "QUIZ") {
    if (d.submittedAt) fail("The quiz permits one completed attempt.", 409);
    if (expired) {
      await finishQuiz(ctx, record, d.draft, true);
      return { expired: true };
    }
  }
  if (expired && ctx.action === "attempt-save")
    fail(
      "The timer expired. Your last saved evidence is retained; ask MC for an extension.",
      409,
    );
  const answers = answersFor(
    d.activity,
    d.variant,
    expired && !challenge ? d.draft : ctx.body.answers,
    ctx.action === "attempt-submit",
  );
  if (ctx.action === "attempt-save") {
    d.draft = answers;
    d.savedAt = ctx.at;
    if (challenge && answers.evidence) d.firstEvidenceAt ||= ctx.at;
  } else if (d.activity.kind === "QUIZ") {
    await finishQuiz(ctx, record, answers);
    return;
  } else {
    if (
      d.activity.kind === "FITNESS" &&
      answers.url &&
      (d.originalUrls || [d.originalUrl]).includes(answers.url)
    )
      fail("Use a fresh AI conversation URL for the Day 5 attempt.");
    const complete = completeAnswers(d.activity, d.variant, answers);
    const submission = {
      id: randomUUID(),
      at: ctx.at,
      answers,
      complete,
      late: expired,
    };
    d.submissions.push(submission);
    d.submittedAt = ctx.at;
    d.draft = answers;
    if (complete && !expired) d.firstQualifyingAt ||= ctx.at;
    if (challenge && answers.evidence) d.firstEvidenceAt ||= ctx.at;
    if (d.result)
      d.history.push({
        result: d.result,
        invalidatedAt: ctx.at,
        reason: "New evidence revision",
      });
    d.result = null;
    ctx.changedResults =
      !challenge || (d.activity.challengeKind === "DAILY" && !ctx.p.locked);
    d.safeExport = null;
    if (challenge) d.review = null;
  }
  await saveAttempt(ctx, record);
  const l = await learner(ctx);
  await reconcileTrophies(ctx, l);
  await saveLearner(ctx, l);
  await event(ctx, ctx.action.toUpperCase(), {
    userId: record.userId,
    attemptId: record._id,
    revision: record.version,
    expired,
  });
  return { attemptVersion: record.version };
}
export async function extendAttempt(ctx) {
  editable(ctx);
  const record = await attempt(ctx, ctx.body.attemptId),
    d = record.data;
  if (d.activity.kind === "QUIZ" && d.submittedAt)
    fail("A completed quiz cannot be restarted.", 409);
  const deadline = iso(ctx.body.deadline, "extension deadline");
  if (
    Date.parse(deadline) <= Math.max(ctx.now.getTime(), Date.parse(d.deadline))
  )
    fail("An extension must extend the existing deadline into the future.");
  const extension = {
    deadline,
    previousDeadline: d.deadline,
    reason: reason(ctx.body),
    actorId: ctx.user._id,
    at: ctx.at,
  };
  d.extensions.push(extension);
  d.deadline = deadline;
  await saveAttempt(ctx, record);
  await event(ctx, "ATTEMPT_EXTENDED", {
    userId: record.userId,
    attemptId: record._id,
    extension,
  });
  ctx.changedResults = true;
}
