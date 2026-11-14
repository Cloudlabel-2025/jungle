import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { fail, requiredText } from "./day-one-rules.js";
import { scope, permitted } from "./access-scope.js";
import {
  scoreFlightLevel,
  effectiveFlightLevel,
  levelReward,
  newFlightLevel,
} from "./week-one-level-rules.js";

export const flightLevelId = (cohort, user, day) =>
  JSON.stringify([cohort, user, day]);
export async function reconcileFlightReward(ctx, record) {
  const level = record.data,
    result = effectiveFlightLevel(level);
  const desired = level.practice
    ? Math.max(
        level.creditedTrophies || 0,
        result?.completed ? levelReward(result.stars).trophies : 0,
      )
    : result?.completed
      ? levelReward(result.stars).trophies
      : 0;
  const delta = desired - (level.creditedTrophies || 0);
  if (delta) {
    const player = await models.User.findById(record.userId).session(
      ctx.session,
    );
    if (
      !player ||
      (player.trophies || 0) + delta < 0 ||
      (player.xp || 0) + delta * 5 < 0
    )
      fail("Reward balance needs CC reconciliation.", 409);
    player.trophies = (player.trophies || 0) + delta;
    player.xp = (player.xp || 0) + delta * 5;
    await player.save({ session: ctx.session });
    const award = {
      id: randomUUID(),
      day: record.day,
      trophies: delta,
      xp: delta * 5,
      actorId: ctx.user._id,
      at: ctx.at,
      reason: result?.reason,
    };
    level.awards.push(award);
    await models.WeekOneEvent.create(
      [
        {
          _id: award.id,
          cohortId: record.cohortId,
          actorId: ctx.user._id,
          kind: "FLIGHT_LEVEL_REWARD",
          createdAt: ctx.now,
          details: { ...award, userId: record.userId },
        },
      ],
      { session: ctx.session },
    );
  }
  level.creditedTrophies = desired;
  level.creditedXp = desired * 5;
}
export async function reconcileFlightLevel(
  ctx,
  userId,
  day,
  { submission = false } = {},
) {
  if (day < 2 || day > 5) return;
  const attempts = await models.WeekOneAttempt.find({
    cohortId: ctx.cohortId,
    userId,
    day,
  })
    .session(ctx.session)
    .lean();
  if (!attempts.length) return;
  let record = await models.WeekOneLevel.findById(
    flightLevelId(ctx.cohortId, userId, day),
  ).session(ctx.session);
  record ||= new models.WeekOneLevel({
    _id: flightLevelId(ctx.cohortId, userId, day),
    cohortId: ctx.cohortId,
    userId,
    day,
    version: 0,
    data: newFlightLevel(),
  });
  const before = JSON.stringify(record.data);
  record.data.automatic = scoreFlightLevel(day, attempts);
  if (submission && record.data.override && !record.data.override.completed) {
    (record.data.overrideHistory ||= []).push(record.data.override);
    record.data.override = null;
  }
  if (submission) record.data.replayPending = false;
  await reconcileFlightReward(ctx, record);
  if (before !== JSON.stringify(record.data)) {
    record.version++;
    record.markModified("data");
    await record.save({ session: ctx.session });
  }
  return record;
}

export async function flightLevelStaffAction(ctx) {
  const { body, session } = ctx,
    day = body.day;
  if (!Number.isInteger(day) || day < 2 || day > 5)
    fail("Choose Level 2–5. Level 1 has its existing controls.");
  if (ctx.p.locked && !ctx.p.correction)
    fail("Finalised Week 1 results cannot be changed here.", 409);
  if (!ctx.release.days[day - 1]?.content)
    fail("Prepare this level's missions first.", 409);
  const access = await scope(ctx.user, session);
  if (
    !["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(access.user.role) ||
    !permitted(access.user, "game:write")
  )
    fail("You cannot change level results.", 403);
  const reason = requiredText(body.reason, "Result change reason", 10, 2000);
  if (!["result", "reopen", "replay"].includes(body.operation))
    fail("Choose result, reopen or replay.");
  if (
    body.operation === "result" &&
    (!Number.isInteger(body.stars) || body.stars < 1 || body.stars > 3)
  )
    fail("A completed level needs 1–3 stars.");
  if (Boolean(body.userId) === Boolean(body.teamId))
    fail("Choose one member or team.");
  for (const key of ["userId", "teamId"])
    if (body[key] && (typeof body[key] !== "string" || body[key].length > 100))
      fail("Use a valid member or team ID.");
  if (body.teamId && !access.teamIds.includes(body.teamId))
    fail("Team outside your authorised scope.", 403);
  const players = await models.User.find({
    $and: [
      { _id: { $in: access.userIds }, active: { $ne: false } },
      body.teamId ? { teamId: body.teamId } : { _id: body.userId },
    ],
  })
    .session(session)
    .lean();
  const ids = players.map((p) => p._id);
  if (!ids.length) fail("No authorised members selected.", 403);
  if (
    !Array.isArray(body.members) ||
    body.members.some((id) => typeof id !== "string") ||
    new Set(body.members).size !== body.members.length ||
    [...body.members].sort().join() !== [...ids].sort().join()
  )
    fail("Membership changed. Refresh the affected members.", 409);
  const records = [];
  for (const userId of ids) {
    let record = await models.WeekOneLevel.findById(
      flightLevelId(ctx.cohortId, userId, day),
    ).session(session);
    if (!body.versions || body.versions[userId] !== (record?.version || 0))
      fail("A level result changed. Refresh before confirming.", 409);
    record ||= new models.WeekOneLevel({
      _id: flightLevelId(ctx.cohortId, userId, day),
      cohortId: ctx.cohortId,
      userId,
      day,
      version: 0,
      data: newFlightLevel(),
    });
    if (body.operation === "replay" && record.data.replayPending)
      fail("A selected member already has an unused replay.", 409);
    records.push(record);
  }
  for (const record of records) {
    const level = record.data,
      before = effectiveFlightLevel(level);
    if (body.operation === "replay") {
      const attempts = await models.WeekOneAttempt.find({
        cohortId: ctx.cohortId,
        userId: record.userId,
        day,
      })
        .session(session)
        .lean();
      level.history.push({
        attempt: level.attempt,
        result: before,
        attempts,
        actorId: ctx.user._id,
        reason,
        at: ctx.at,
      });
      level.nextVersions = Object.fromEntries(
        attempts.map((a) => [a.activityId, a.version + 1]),
      );
      await models.WeekOneAttempt.deleteMany({
        cohortId: ctx.cohortId,
        userId: record.userId,
        day,
      }).session(session);
      level.attempt++;
      level.practice = true;
      level.replayPending = true;
      level.automatic = null;
      level.override = null;
    } else {
      (level.overrideHistory ||= []).push({
        result: before,
        actorId: ctx.user._id,
        at: ctx.at,
        reason,
      });
      level.practice = false;
      level.override = {
        source: access.user.role,
        actorId: ctx.user._id,
        at: ctx.at,
        completed: body.operation === "result",
        stars: body.operation === "result" ? body.stars : 0,
        reason,
      };
    }
    await reconcileFlightReward(ctx, record);
    record.version++;
    record.markModified("data");
    await record.save({ session });
    await models.WeekOneEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId: ctx.cohortId,
          actorId: ctx.user._id,
          kind: "FLIGHT_LEVEL_OVERRIDE",
          createdAt: ctx.now,
          details: {
            userId: record.userId,
            day,
            operation: body.operation,
            reason,
            teamId: body.teamId,
            before,
            after: effectiveFlightLevel(level),
            attempt: level.attempt,
          },
        },
      ],
      { session },
    );
  }
  ctx.changedResults = true;
  return { affected: ids.length };
}
