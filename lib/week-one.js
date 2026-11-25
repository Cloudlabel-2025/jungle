import { randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import { fail } from "./day-one-rules.js";
import { playerFlightProgress } from "./flight-progress-store.js";
import { completionBased } from "./flight-progression.js";
import {
  cohortOf,
  initialDays,
  staffOnly,
  dayNumber,
  transitionDay,
  publishAgenda,
  releaseProjection,
  publishedGameRules,
} from "./week-one-rules.js";

// Shared lock: day transitions and learner writes serialize on this document.
export async function ensureWeekOne(cohortId) {
  await models.WeekOneRelease.updateOne(
    { _id: cohortId },
    { $setOnInsert: { revision: 0, days: initialDays() } },
    { upsert: true },
  );
}
export async function lockWeekOne(cohortId, session) {
  return models.WeekOneRelease.findOneAndUpdate(
    { _id: cohortId },
    { $inc: { revision: 1 } },
    { new: true, session },
  );
}
export async function weekOneSnapshot(user) {
  const [release, program] = await Promise.all([
    models.WeekOneRelease.findById(cohortOf(user)).lean(),
    models.WeekOneProgram.findById(cohortOf(user)).lean(),
  ]);
  const projection = releaseProjection(release, user.role);
  projection.progressionMode = program?.data.progressionMode || "SCHEDULED";
  const progress = await playerFlightProgress(user, release, program?.data);
  if (progress)
    projection.days = projection.days.map((d) => ({
      ...d,
      state: progress[d.day - 1].state,
    }));
  projection.rulesVersion = publishedGameRules(program?.data)?.version || null;
  if (user.role !== "GAMER")
    projection.events = await models.WeekOneEvent.find({
      cohortId: cohortOf(user),
      kind: { $in: ["PREPARE", "OPEN", "CLOSE", "PUBLISH-AGENDA"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  return projection;
}
export async function weekOneProtected(user, session) {
  const cohortId = cohortOf(user);
  const cohort = await models.Cohort.findById(cohortId)
    .session(session || null)
    .lean();
  if (cohort?.currentWeek != null) return cohort.currentWeek === 1;
  // Newly provisioned Week 1 cohorts may not yet have a legacy Cohort record.
  return Boolean(
    await models.WeekOneRelease.exists({ _id: cohortId }).session(
      session || null,
    ),
  );
}
export async function weekOneAction(user, action, body, now = new Date()) {
  staffOnly(user);
  if (!["open", "close", "publish-agenda"].includes(action))
    fail("Unknown Week 1 action.", 404);
  const number = dayNumber(body.day),
    cohortId = cohortOf(user);
  await ensureWeekOne(cohortId);
  return transaction(async (session) => {
    const release = await lockWeekOne(cohortId, session);
    if (body.revision !== release.revision - 1)
      fail("Day status changed. Refresh before continuing.", 409);
    const day = release.days[number - 1];
    const program = await models.WeekOneProgram.findById(cohortId)
      .session(session)
      .lean();
    if (completionBased(program?.data) && action !== "publish-agenda")
      fail(
        "Levels now unlock automatically for each player. Day release controls are no longer used.",
        409,
      );
    let details;
    if (action === "publish-agenda") {
      if (completionBased(program?.data)) {
        if (!day.content)
          fail("Prepare mission content before publishing its briefing.", 409);
        const writable = {
          ...day,
          state: "OPEN",
          officialStart: now.toISOString(),
        };
        publishAgenda(writable, body.text, user._id, now);
        day.agenda = writable.agenda;
      } else publishAgenda(day, body.text, user._id, now);
      details = {
        day: number,
        version: day.agenda.version,
        publishedAt: day.agenda.publishedAt,
      };
    } else {
      let rule;
      if (action === "open") {
        const program = await models.WeekOneProgram.findById(cohortId)
          .session(session)
          .lean();
        rule = publishedGameRules(program?.data);
        if (!rule)
          fail(
            "Centre Command must publish Game Rules before opening a day.",
            409,
          );
      }
      details = transitionDay(release, number, action, user._id, now);
      if (rule) {
        day.rulesVersion = rule.version;
        details.rulesVersion = rule.version;
      }
    }
    release.markModified("days");
    await release.save({ session });
    await models.WeekOneEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId,
          actorId: user._id,
          kind: action.toUpperCase(),
          createdAt: now,
          details,
        },
      ],
      { session },
    );
    return { success: true };
  });
}
