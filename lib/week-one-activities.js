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
import { completionBased } from "./flight-progression.js";
import { requireWorkingDay } from "./cohort-calendar.js";
import { reconcileFlightLevel, flightLevelId } from "./week-one-levels.js";
import { flightGameState } from "./final-flight-games.js";
import { labStateFor } from "./signal-lab.js";
import { spendMissionEnergy } from "./mission-energy.js";

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
    if (["OPEN", "CLOSED"].includes(day.state) || day.completionPinnedAt)
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
        !completionBased(p) &&
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
  const day = dayAt(ctx, ctx.body.day, !completionBased(ctx.p));
  if (completionBased(ctx.p) && !day.content)
    fail("Prepare this mission before recording classes or recaps.", 409);
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
  // Completing a self-paced level closes its mission starts, not its journal.
  // Reflections and check-in remain available until results are finalised.
  const day = dayAt(ctx, ctx.body.day, !ctx.playerLevels),
    record = await learner(ctx),
    d = (record.data.days[day.day] ||= {});
  const { action, body, at, now } = ctx;
  if (day.day === 1) fail("Day 1 observations use the original Day 1 record.");
  if (action === "reflection-draft") {
    if (body.ownerId !== ctx.user._id)
      fail("This draft belongs to another signed-in player.", 403);
    if (!d.clockAt) fail("Clock in before saving a reflection draft.", 409);
    if (!["sod", "eod"].includes(body.kind)) fail("Choose a SOD or EOD draft.");
    if (d[body.kind]) fail("This reflection has already been submitted.", 409);
    const value =
      body.kind === "sod" ? { text: body.text } : { answers: body.answers };
    if (
      body.kind === "sod" &&
      (typeof body.text !== "string" || body.text.length > 4000)
    )
      fail("SOD draft must contain at most 4000 characters.");
    if (
      body.kind === "eod" &&
      (!Array.isArray(body.answers) ||
        body.answers.length !== eodQuestions[day.day].length ||
        body.answers.some((a) => typeof a !== "string" || a.length > 2000))
    )
      fail(
        "Save one draft answer for each EOD prompt, at most 2000 characters each.",
      );
    d.reflectionDrafts ||= {};
    const old = d.reflectionDrafts[body.kind];
    const mode = body.mode === "VOICE" ? "VOICE" : "TEXT";
    if (
      old &&
      JSON.stringify(old.value) === JSON.stringify(value) &&
      old.mode === mode
    )
      return { draftVersion: old.revision };
    if (body.draftVersion !== (old?.revision || 0))
      fail(
        "This draft changed in another tab. Reopen the saved reflection before editing.",
        409,
      );
    const revision = (old?.revision || 0) + 1;
    d.reflectionDrafts[body.kind] = { value, mode, savedAt: at, revision };
    await saveLearner(ctx, record);
    await event(ctx, "REFLECTION_DRAFT", {
      day: day.day,
      userId: record.userId,
      kind: body.kind,
      value,
      mode,
    });
    return { draftVersion: revision };
  }
  if (action === "clock") {
    if (!d.clockAt) {
      const schedule = await requireWorkingDay(ctx.user, now, ctx.session, true);
      if (
        !ctx.playerLevels &&
        localParts(now, day.content.timeZone).day !==
          localParts(day.officialStart, day.content.timeZone).day
      )
        fail("Clock in on the configured day.", 409);
      d.clockAt = at;
      const date = localParts(
        ctx.playerLevels ? now : day.officialStart,
        day.content.timeZone,
      ).day;
      if (!schedule.uat) await models.Attendance.updateOne(
        { userId: record.userId, day: date },
        {
          $setOnInsert: {
            _id: randomUUID(),
            userId: record.userId,
            day: date,
            officialStartAt: schedule.startAt,
            cohortId: ctx.user.cohortId || "alpha", timeZone: schedule.timeZone,
            sessionState: "ACTIVE", cutoffAt: schedule.cutoffAt, checkDueAt: schedule.cutoffAt,
            sessionEvents: [{ type: "IN", at: now, source: "PLAYER" }],
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
  } else if (action === "sod") {
    d.sod ||= { text: requiredText(body.text, "SOD reflection", 10, 4000), at };
    if (d.reflectionDrafts) delete d.reflectionDrafts.sod;
  } else if (action === "eod") {
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
    if (d.reflectionDrafts) delete d.reflectionDrafts.eod;
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
  if (!ctx.playerLevels && ctx.now < new Date(day.officialStart))
    fail("The activity window has not started.", 409);
  const id = `${ctx.cohortId}:${ctx.user._id}:${activity.id}`;
  const existing = await models.WeekOneAttempt.findById(id).session(
    ctx.session,
  );
  if (existing) return { attemptId: existing._id };
  const levelState = await models.WeekOneLevel.findById(flightLevelId(ctx.cohortId, ctx.user._id, day.day)).session(ctx.session).lean();
  await learner(ctx); // Verify current roster membership.
  if (ctx.playerLevels) {
    ctx.release.days[day.day - 1].completionPinnedAt ||= ctx.at;
  }
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
  // The replay version is monotonic even though staff replays delete attempts.
  const attemptVersion = levelState?.data.nextVersions?.[activity.id] || 0;
  const energySpent = await spendMissionEnergy(
    ctx.user._id, `mission:${id}:${attemptVersion}`, ctx.session, ctx.now,
  );
  const record = new models.WeekOneAttempt({
    _id: id,
    cohortId: ctx.cohortId,
    userId: ctx.user._id,
    activityId: activity.id,
    day: day.day,
    version: attemptVersion,
    data: {
      energySpent: { at: ctx.at, cost: 1, ...energySpent },
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
    deadline: d.deadline,
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
  await reconcileFlightLevel(ctx, record.userId, record.day, { submission: true });
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
    !(ctx.playerLevels?.[record.day - 1]?.available && ctx.playerLevels[record.day - 1].completed) &&
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
    if (ctx.body.labState !== undefined) {
      try { d.labState = labStateFor(record.activityId, ctx.body.labState); }
      catch (e) { fail(e.message); }
    }
    if (ctx.body.gameState !== undefined) {
      try { d.gameState = flightGameState(record.activityId, ctx.body.gameState); }
      catch(e) { fail(e.message); }
    }
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
      deadline: d.deadline,
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
  if (ctx.action === "attempt-submit") await reconcileFlightLevel(ctx, record.userId, record.day, { submission: true });
  await event(ctx, ctx.action.toUpperCase(), {
    userId: record.userId,
    attemptId: record._id,
    revision: record.version,
    expired,
    activityName: d.activity.name,
    ...(ctx.action === "attempt-save"
      ? { draftAnswers: copy(answers) }
      : { submissionId: d.submissions.at(-1)?.id }),
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
