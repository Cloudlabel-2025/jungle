import { randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import {
  effectiveLevelOne,
  levelOneReward,
  newLevelOne,
  LEVEL_ONE_REWARDS,
} from "./level-one-rules.js";
import { requiredText, fail } from "./day-one-rules.js";
import { scope as accessScope, permitted } from "./access-scope.js";
import {notifyLevelReview} from "./level-review-notices.js";
import { retryRewardTotals } from "./retry-rewards.js";

export async function reconcileLevelOne(record, actor, session, now) {
  const level = record.data.levelOne;
  if (!level) return;
  const previousRewardVersion = level.rewardVersion;
  const previousCredit = level.creditedTrophies || 0;
  const preservedCredit =
    previousRewardVersion === LEVEL_ONE_REWARDS
      ? previousCredit
      : levelOneReward([0, 10, 15, 20].indexOf(previousCredit)).trophies;
  level.rewardVersion = LEVEL_ONE_REWARDS;
  for (const savedResult of [level.automatic, level.override])
    if (savedResult) {
      Object.assign(
        savedResult,
        levelOneReward(savedResult.completed ? savedResult.stars : 0),
        { rewardVersion: LEVEL_ONE_REWARDS },
      );
    }
  const result = effectiveLevelOne(level);
  const retry = level.practice && level.retryRewards ? retryRewardTotals(level, result, levelOneReward(result?.completed ? result.stars : 0)) : null;
  const desired = retry ? retry.trophies : level.practice
    ? Math.max(
        level.creditedTrophies || 0,
        preservedCredit,
        result?.completed ? levelOneReward(result.stars).trophies : 0,
      )
    : result?.completed
      ? levelOneReward(result.stars).trophies
      : 0;
  const delta = desired - (level.creditedTrophies || 0);
  const xpDelta = retry ? retry.xp - (level.creditedXp ?? previousCredit * 5) : delta * 5;
  if (!delta && !xpDelta) return;
  const player = await models.User.findById(record.userId).session(session);
  // Serialize with all existing reward writers. Changes apply only this level's delta.
  if (player.trophies + delta < 0 || player.xp + xpDelta < 0)
    fail(
      "Reward balance needs CC reconciliation before this result can change.",
      409,
    );
  const key = randomUUID();
  await models.LevelOneReward.create(
    [
      {
        _id: key,
        userId: record.userId,
        cohortId: record.cohortId,
        trophies: delta,
        xp: xpDelta,
        attempt: level.attempt,
        reason: result?.reason || "Level 1 reward reconciliation",
        actorId: actor._id,
        createdAt: now,
      },
    ],
    { session },
  );
  player.trophies += delta;
  player.xp += xpDelta;
  await player.save({ session });
  level.creditedTrophies = desired;
  level.creditedXp = (level.creditedXp ?? previousCredit * 5) + xpDelta;
  level.awards.push({
    id: key,
    trophies: delta,
    xp: xpDelta,
    at: now.toISOString(),
  });
}

export async function upgradeLevelOneRewards(id, now = new Date()) {
  return transaction(async (session) => {
    const record = await models.DayOneRecord.findById(id).session(session);
    if (!record?.data.levelOne) return { id, changed: false };
    const before = JSON.stringify(record.data.levelOne);
    const previousTrophies = record.data.levelOne.creditedTrophies || 0;
    const actor = { _id: `system:${LEVEL_ONE_REWARDS}` };
    await reconcileLevelOne(record, actor, session, now);
    if (before === JSON.stringify(record.data.levelOne))
      return { id, changed: false };
    record.version++;
    record.markModified("data");
    await record.save({ session });
    const trophies = record.data.levelOne.creditedTrophies || 0;
    await models.DayOneEvent.create(
      [
        {
          _id: randomUUID(),
          userId: record.userId,
          cohortId: record.cohortId,
          actorId: actor._id,
          kind: "LEVEL_ONE_REWARDS_UPDATED",
          createdAt: now,
          details: {
            rewardVersion: LEVEL_ONE_REWARDS,
            previousTrophies,
            trophies,
            xp: trophies * 5,
            delta: trophies - previousTrophies,
          },
        },
      ],
      { session },
    );
    return {
      id,
      userId: record.userId,
      changed: true,
      trophies,
      xp: trophies * 5,
      delta: trophies - previousTrophies,
    };
  });
}

export async function levelOneStaffAction(
  actor,
  body,
  session,
  now,
  day,
  setup,
) {
  const access = await accessScope(actor, session);
  if (
    !["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(access.user.role) ||
    !permitted(access.user, "game:write")
  )
    fail("You cannot change level results.", 403);
  const reason = requiredText(body.reason, "Result change reason", 10, 2000);
  if (!["result", "reopen", "replay", "validate"].includes(body.operation))
    fail("Choose result, reopen, replay or validate.");
  if (body.operation === "validate" && body.reviewedEvidence !== true)
    fail("Review the saved evidence before validating this result.");
  if (
    body.operation === "result" &&
    (!Number.isInteger(body.stars) || body.stars < 1 || body.stars > 3)
  )
    fail("Completed levels need 1–3 stars. Use reopen to set zero stars.");
  if (Boolean(body.userId) === Boolean(body.teamId))
    fail("Select exactly one member or team.");
  if (
    (body.userId &&
      (typeof body.userId !== "string" || body.userId.length > 100)) ||
    (body.teamId &&
      (typeof body.teamId !== "string" || body.teamId.length > 100))
  )
    fail("Use a valid member or team ID.");
  const gamers = await models.User.find({
    _id: { $in: access.userIds },
    active: { $ne: false },
    ...(body.teamId ? { teamId: body.teamId } : { _id: body.userId }),
  })
    .session(session)
    .lean();
  const ids = gamers
    .filter((p) => access.userIds.includes(p._id))
    .map((p) => p._id);
  if (body.teamId && !access.teamIds.includes(body.teamId))
    fail("Team outside your authorised scope.", 403);
  if (!ids.length) fail("No authorised members selected.", 403);
  if (
    !Array.isArray(body.members) ||
    body.members.some((id) => typeof id !== "string") ||
    new Set(body.members).size !== body.members.length ||
    [...body.members].sort().join() !== [...ids].sort().join()
  )
    fail(
      "The selected membership changed. Review the affected members before confirming.",
      409,
    );
  if (!body.versions || typeof body.versions !== "object")
    fail("Refresh the result versions before confirming.", 409);
  if (body.operation === "replay" && day.state !== "OPEN")
    fail("Replay requires Day 1 to be open.", 409);
  if (body.operation === "replay" && now >= new Date(day.scheduledEnd))
    fail(
      "The released research day has ended. Command must open a valid activity window before replay.",
      409,
    );
  const records = [];
  for (const id of ids) {
    const record = await models.DayOneRecord.findById(
      `${actor.cohortId || "alpha"}:${id}`,
    ).session(session);
    if (!record || body.versions[id] !== record.version)
      fail(
        "A member's result changed or they have not clocked in. Refresh before applying.",
        409,
      );
    if (body.reviewedEvidence === true && (ids.length !== 1 || !record.data.submissions?.length))
      fail("Review one player's submitted evidence before saving.", 409);
    if (body.operation === "validate" && !effectiveLevelOne(record.data.levelOne)?.completed)
      fail("An incomplete level cannot be validated. Review evidence and set a result first.", 409);
    records.push(record);
  }
  for (const record of records) {
    const d = record.data;
    const level = (d.levelOne ||= newLevelOne());
    const before = JSON.parse(JSON.stringify(level));
    if (body.operation === "validate") {
      // Preserve the scored result; only the human validation is added.
    } else if (body.operation === "replay") {
      if (level.replayPending)
        fail("This member already has an unused replay.", 409);
      level.history.push({
        attempt: level.attempt,
        result: effectiveLevelOne(level),
        startedAt: d.startedAt,
        deadline: d.deadline,
        submissions: JSON.parse(JSON.stringify(d.submissions)),
        claimCheck: d.claimCheck,
        claimCheckDraft: d.claimCheckDraft,
        missionEnergy: d.missionEnergy,
        assessment: d.assessment,
        verification: d.verification,
        at: now.toISOString(),
        actorId: actor._id,
        reason,
      });
      level.attempt++;
      delete level.retryRewards;
      level.practice = true;
      level.replayPending = true;
      level.automatic = null;
      level.override = null;
      d.submissions = [];
      d.draft = null;
      delete d.claimCheck;
      delete d.claimCheckDraft;
      delete d.missionEnergy;
      level.claimCheckRequired = true;
      d.assessment = null;
      d.verification = null;
      delete d.acknowledgedAt;
      delete d.startedAt;
      delete d.deadline;
      delete d.firstQualifyingSubmissionAt;
      d.extensions = [];
      // Keep the locked genre/question and attendance; replay is a new attempt.
    } else {
      level.practice = false;
      (level.overrideHistory ||= []).push({result:effectiveLevelOne(before),actorId:actor._id,at:now.toISOString(),reason});
      level.override = {
        source: actor.role,
        actorId: actor._id,
        at: now.toISOString(),
        completed: body.operation === "result",
        status: body.operation === "result" ? "COMPLETED" : "REOPENED",
        stars: body.operation === "result" ? body.stars : 0,
        reason,
      };
    }
    level.validation = body.reviewedEvidence === true ? {
      actorId: actor._id, actorName:access.user.name, role: access.user.role, at: now.toISOString(), reason,
      operation: body.operation, result: effectiveLevelOne(level),
      evidenceVersion: record.version,
    } : null;
    await reconcileLevelOne(record, actor, session, now);
    record.version++;
    record.markModified("data");
    await record.save({ session });
    await notifyLevelReview({cohortId:record.cohortId,userId:record.userId,day:1,version:record.version,actor:access.user,operation:body.operation,before:effectiveLevelOne(before),after:effectiveLevelOne(level),reason,now,revalidated:Boolean(before.validation)},session);
    await models.DayOneEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId: actor.cohortId || "alpha",
          userId: record.userId,
          actorId: actor._id,
          kind: body.operation === "validate" ? "LEVEL_ONE_VALIDATED" : "LEVEL_ONE_OVERRIDE",
          createdAt: now,
          details: {
            operation: body.operation,
            reason,
            teamId: body.teamId,
            beforeResult: effectiveLevelOne(before),
            afterResult: effectiveLevelOne(level),
            previousAttempt: before.attempt,
            attempt: level.attempt,
            creditedTrophies: level.creditedTrophies,
            review: level.validation,
          },
        },
      ],
      { session },
    );
  }
  // A changed result invalidates an unreleased champion decision, never its audit.
  if (setup.champion && !setup.champion.releasedAt) {
    setup.champion = null;
    setup.markModified("champion");
    await setup.save({ session });
  }
  return { success: true, affected: ids.length };
}
