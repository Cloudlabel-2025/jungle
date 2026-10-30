import { randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import { ist, boundedAward, healthDrop, deadlineInfraction } from "./rules.js";
import { rewardAmounts, DAILY_XP_CAP, DAILY_TROPHY_CAP } from "./rewards.js";
export const id = () => randomUUID();
export async function award(
  userId,
  amount,
  reason,
  eventKey,
  session,
  experienceOnly = false,
) {
  if (await models.Experience.exists({ eventKey }).session(session)) return;
  const user = await models.User.findById(userId).session(session);
  if (!user) throw new Error("Explorer not found.");
  const day = ist().day;
  const today = user.xpDay === day ? user.dailyXp : 0;
  const trophyToday = user.trophyDay === day ? user.dailyTrophies : 0;
  const rewards = rewardAmounts(amount);
  const xpGrant = boundedAward(
    experienceOnly ? amount : rewards.xp,
    today,
    DAILY_XP_CAP,
  );
  const trophyGrant = experienceOnly
    ? 0
    : boundedAward(rewards.trophies, trophyToday, DAILY_TROPHY_CAP);
  await models.Experience.create(
    [
      {
        _id: id(),
        userId,
        amount: xpGrant,
        reason: xpGrant ? reason : `Daily XP cap reached: ${reason}`,
        eventKey,
        day,
      },
    ],
    { session },
  );
  if (!experienceOnly)
    await models.Trophy.create(
      [
        {
          _id: id(),
          userId,
          amount: trophyGrant,
          reason: trophyGrant ? reason : `Daily trophy cap reached: ${reason}`,
          eventKey,
          day,
        },
      ],
      { session },
    );
  user.xp += xpGrant;
  user.trophies += trophyGrant;
  user.xpDay = day;
  user.dailyXp = today + xpGrant;
  user.trophyDay = day;
  user.dailyTrophies = trophyToday + trophyGrant;
  await user.save({ session });
}
export async function deduct(
  userId,
  reason,
  ruleId,
  eventKey,
  session,
  eventDay = ist().day,
) {
  if (await models.Energy.exists({ eventKey }).session(session)) return;
  const user = await models.User.findById(userId).session(session);
  if (!user) throw new Error("Operative not found.");
  const before = user.hp;
  const next = healthDrop(user.hp, user.drops, user.energy);
  user.hp = next.hp;
  user.energy = next.energy;
  user.drops = next.drops;
  user.streak = 0;
  await user.save({ session });
  await models.Energy.create(
    [
      {
        _id: id(),
        userId,
        change: before > 0 ? -1 : 0,
        result: user.hp,
        resource: "ENERGY",
        energyResult: user.energy,
        lifeChange: next.lifeChange,
        reason,
        ruleId,
        eventKey,
        day: eventDay,
      },
    ],
    { session },
  );
  if (
    next.rescue &&
    !(await models.Rescue.exists({ userId, status: { $ne: "CLOSED" } }).session(
      session,
    ))
  )
    await models.Rescue.create([{ _id: id(), userId, teamId: user.teamId }], {
      session,
    });
}
export async function reconcile(userIds) {
  await transaction(async (session) => {
    const expired = await models.Task.find({
      assigneeId: { $in: userIds },
      dueAt: { $lte: new Date() },
      deadlineChecked: false,
    }).session(session);
    for (const task of expired) {
      if (deadlineInfraction(task))
        await deduct(
          task.assigneeId,
          `Rule #10: no pre-deadline report for ${task.title}`,
          10,
          `deadline:${task._id}`,
          session,
          ist(task.dueAt).day,
        );
      task.deadlineChecked = true;
      await task.save({ session });
    }
    const users = await models.User.find({
      _id: { $in: userIds },
      role: "GAMER",
    }).session(session);
    const today = ist().day;
    const pendingJournals = users.length
      ? await models.Journal.find({
          $or: users.map((user) => ({
            userId: user._id,
            day: {
              $lt: today,
              ...(user.lastSettledDay ? { $gt: user.lastSettledDay } : {}),
            },
          })),
        })
          .sort({ day: 1 })
          .session(session)
      : [];
    const journalsByUser = new Map();
    for (const journal of pendingJournals) {
      const entries = journalsByUser.get(journal.userId) || [];
      entries.push(journal);
      journalsByUser.set(journal.userId, entries);
    }
    for (const user of users) {
      const uid = user._id;
      const journals = journalsByUser.get(uid) || [];
      for (const journal of journals) {
        const attendance = await models.Attendance.findOne({
          userId: uid,
          day: journal.day,
          onTime: true,
        }).session(session);
        const infraction = await models.Energy.exists({
          userId: uid,
          day: journal.day,
          change: -1,
        }).session(session);
        const last = user.lastSettledDay
          ? new Date(`${user.lastSettledDay}T00:00:00Z`)
          : null;
        const consecutive =
          last && new Date(`${journal.day}T00:00:00Z`) - last === 86400000;
        user.streak =
          attendance && !infraction ? (consecutive ? user.streak + 1 : 1) : 0;
        if (user.streak > 0) {
          user.drops = 0;
          const openRescue = await models.Rescue.findOne({
            userId: uid,
            status: { $ne: "CLOSED" },
          }).session(session);
          if (
            user.streak % 3 === 0 &&
            (!openRescue || openRescue.plan?.trim())
          ) {
            if (user.hp < 5) {
              user.hp++;
              user.energy = 3;
              await models.Energy.create(
                [
                  {
                    _id: id(),
                    userId: uid,
                    change: 1,
                    result: user.hp,
                    resource: "LIFE",
                    energyResult: user.energy,
                    lifeChange: 1,
                    reason: "Three qualifying clean days",
                    eventKey: `recovery:${uid}:${journal.day}`,
                    day: today,
                  },
                ],
                { session },
              );
            }
            await models.Rescue.updateMany(
              {
                userId: uid,
                status: { $ne: "CLOSED" },
                plan: { $type: "string", $ne: "" },
              },
              { $set: { status: "CLOSED", closedAt: new Date() } },
              { session },
            );
          }
        }
        user.lastSettledDay = journal.day;
      }
      const yesterday = ist(new Date(Date.now() - 86400000)).day;
      let stale = false;
      if (!user.lastSettledDay || user.lastSettledDay < yesterday) {
        user.streak = 0;
        user.lastSettledDay = yesterday;
        stale = true;
      }
      if (journals.length || stale) await user.save({ session });
    }
  });
}
