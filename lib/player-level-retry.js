import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { fail } from "./day-one-rules.js";
import { playerBalance, ist } from "./rules.js";
import { effectiveLevelOne, newLevelOne } from "./level-one-rules.js";
import { effectiveFlightLevel, newFlightLevel } from "./week-one-level-rules.js";
import { flightLevelId } from "./week-one-levels.js";
import { beginRetryRewards } from "./retry-rewards.js";

export async function playerLevelRetry(ctx) {
  const { body, session, now, cohortId } = ctx;
  const day = body.day;
  if (!Number.isInteger(day) || day < 1 || day > 5 || !Number.isInteger(body.attempt)) fail("Choose a level and refresh its attempt.");
  const player = await models.User.findById(ctx.user._id).session(session);
  if (!player || player.active === false || player.role !== "GAMER" || (player.cohortId || "alpha") !== cohortId) fail("An active player account is required.", 403);
  if (ctx.p.locked || !ctx.release.days[day - 1]?.content) fail("This level is locked for final results or is not prepared.", 409);
  if (!ctx.playerLevels && (ctx.release.days[day - 1].state !== "OPEN" || now >= new Date(ctx.release.days[day - 1].scheduledEnd))) fail("The scheduled play window has closed. Ask CC to reopen it before retrying.", 409);
  const record = day === 1
    ? await models.DayOneRecord.findOne({ cohortId, userId: player._id }).session(session)
    : await models.WeekOneLevel.findById(flightLevelId(cohortId, player._id, day)).session(session);
  const attempts = day === 1 ? [] : await models.WeekOneAttempt.find({ cohortId, userId: player._id, day }).session(session).lean();
  if (day === 1 && !record) fail("Start this level before retrying.", 409);
  const target = record || new models.WeekOneLevel({ _id: flightLevelId(cohortId, player._id, day), cohortId, userId: player._id, day, version: 0, data: newFlightLevel() });
  const level = day === 1 ? (target.data.levelOne ||= newLevelOne()) : target.data;
  const key = `retry:${JSON.stringify([cohortId, player._id, day, body.attempt])}`;
  if (await models.Energy.exists({ eventKey: key }).session(session)) return { alreadyRetried: true };
  const started = day === 1 ? Boolean(target.data.startedAt) : attempts.some(row=>row.data.startedAt);
  if ((level.attempt || 1) !== body.attempt || (level.replayPending && !started)) fail("This attempt changed. Reopen the level before retrying.", 409);
  const result = day === 1 ? effectiveLevelOne(level) : effectiveFlightLevel(level);
  const expired = day === 1 ? target.data.startedAt && Number.isFinite(Date.parse(target.data.deadline)) && now >= new Date(target.data.deadline)
    : attempts.some(row => row.data.startedAt && Number.isFinite(Date.parse(row.data.deadline)) && now >= new Date(row.data.deadline));
  if (!expired && !result?.completed) fail("Finish this attempt or wait until its timer ends before retrying.", 409);
  if (ctx.playerLevels && !ctx.playerLevels[day - 1]?.available) fail("Complete the previous level first.", 403);
  const balance = playerBalance(player);
  if (balance.energy < 1) fail("Retry needs 1 energy. Open Help Desk for energy recovery; your saved work is safe.", 409);
  player.energy = balance.energy - 1;
  await player.save({ session });
  await models.Energy.create([{ _id: randomUUID(), userId: player._id, resource: "ENERGY", change: -1, result: balance.hp, energyResult: player.energy, lifeChange: 0, reason: `Retry Level ${day}`, eventKey: key, day: ist(now).day, createdAt: now }], { session });
  if (player.energy === 0 && !(await models.Rescue.exists({ userId: player._id, status: { $ne: "CLOSED" } }).session(session))) await models.Rescue.create([{ _id: randomUUID(), userId: player._id, teamId: player.teamId, missionEventKey: key }], { session });
  beginRetryRewards(level, result, day === 1 ? level.creditedXp ?? (level.creditedTrophies || 0) * 5 : level.creditedXp ?? (level.creditedTrophies || 0) * 5 * day);
  const archive = { attempt: level.attempt, result, actorId: player._id, reason: "Player requested a new timed attempt", at: now.toISOString() };
  if (day === 1) {
    const d = target.data;
    level.history.push({ ...archive, startedAt: d.startedAt, deadline: d.deadline, submissions: JSON.parse(JSON.stringify(d.submissions || [])), claimCheck: d.claimCheck, claimCheckDraft: d.claimCheckDraft, missionEnergy: d.missionEnergy, verification: d.verification });
    d.submissions = []; d.draft = null; d.verification = null; d.assessment = null;
    for (const field of ["claimCheck", "claimCheckDraft", "missionEnergy", "acknowledgedAt", "startedAt", "deadline", "firstQualifyingSubmissionAt"]) delete d[field];
    d.extensions = []; level.claimCheckRequired = true;
  } else {
    level.history.push({ ...archive, attempts });
    level.nextVersions = Object.fromEntries(attempts.map(row => [row.activityId, row.version + 1]));
    await models.WeekOneAttempt.deleteMany({ cohortId, userId: player._id, day }).session(session);
  }
  level.attempt = (level.attempt || 1) + 1; level.practice = true; level.replayPending = true;
  level.automatic = null; level.override = null; level.validation = null;
  target.version++; target.markModified("data"); await target.save({ session });
  await models.WeekOneEvent.create([{ _id: randomUUID(), cohortId, actorId: player._id, kind: "PLAYER_LEVEL_RETRY", createdAt: now, details: { userId: player._id, day, attempt: level.attempt, cost: 1 } }], { session });
  ctx.changedResults = true;
  return { day, attempt: level.attempt, cost: 1 };
}
