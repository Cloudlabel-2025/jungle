import { randomUUID } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { healthDrop, playerBalance, ist } from "./rules.js";
import { fail, requiredText } from "./day-one-rules.js";
import { scope, permitted, cohortOf } from "./access-scope.js";

// Call only inside the transaction that creates the mission attempt. Spending
// energy is normal play: it must not increment disciplinary drops or reset streaks.
export async function spendMissionEnergy(
  userId,
  eventKey,
  session,
  now = new Date(),
) {
  if (await models.Energy.exists({ eventKey }).session(session)) return;
  const player = await models.User.findById(userId).session(session);
  if (!player || player.active === false || player.role !== "GAMER")
    fail("An active player account is required.", 403);
  const balance = playerBalance(player);
  if (balance.hp === 0 || balance.energy === 0)
    fail(
      "You need energy to start a new mission. Open Help Desk and ask your MC for recovery. Your saved missions are still available.",
      409,
    );
  const next = healthDrop(balance.hp, player.drops || 0, balance.energy);
  player.hp = next.hp;
  player.energy = next.energy;
  await player.save({ session });
  await models.Energy.create(
    [
      {
        _id: randomUUID(),
        userId,
        resource: "ENERGY",
        change: -1,
        result: next.hp,
        energyResult: next.energy,
        lifeChange: next.lifeChange,
        reason: "Started a mission (1 energy)",
        eventKey,
        day: ist(now).day,
        createdAt: now,
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
    await models.Rescue.create(
      [
        {
          _id: randomUUID(),
          userId,
          teamId: player.teamId,
          missionEventKey: eventKey,
        },
      ],
      { session },
    );
  return { hp: next.hp, energy: next.energy };
}

export async function missionRecoverySnapshot(actor) {
  await connect();
  const access = await scope(actor);
  const player = access.user.role === "GAMER";
  if (
    !player &&
    (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(access.user.role) ||
      !permitted(access.user, "game:write"))
  )
    fail("Recovery support is outside your permissions.", 403);
  const cases = await models.Rescue.find({
    userId: player ? access.user._id : { $in: access.userIds },
    status: { $ne: "CLOSED" },
  }).lean();
  const people = player
    ? [access.user]
    : await models.User.find({
        _id: { $in: cases.map((row) => row.userId) },
        active: { $ne: false },
      })
        .select("_id name hp energy")
        .lean();
  return {
    needsRecovery:
      player &&
      (playerBalance(access.user).hp === 0 ||
        playerBalance(access.user).energy === 0),
    cases: cases.map((row) => {
      const person = people.find((p) => p._id === row.userId);
      return {
        id: row._id,
        name: person?.name || "Player",
        ...playerBalance(person || {}),
        selfService: Boolean(row.missionEventKey),
        plan: row.plan || "",
      };
    }),
  };
}

export async function recoverMissionEnergy(actor, body, now = new Date()) {
  if (body.action === "request")
    return transaction(async (session) => {
      const player = await models.User.findById(actor._id).session(session);
      if (!player || player.active === false || player.role !== "GAMER")
        fail("An active player account is required.", 403);
      const balance = playerBalance(player);
      if (balance.hp > 0 && balance.energy > 0)
        fail("You already have energy to continue.", 409);
      // Serialize requests on the account, including legacy balances without a case.
      player.recoveryRevision = (player.recoveryRevision || 0) + 1;
      await player.save({ session });
      let rescue = await models.Rescue.findOne({
        userId: player._id,
        status: { $ne: "CLOSED" },
      }).session(session);
      if (!rescue)
        [rescue] = await models.Rescue.create(
          [{ _id: randomUUID(), userId: player._id, teamId: player.teamId }],
          { session },
        );
      return { success: true, rescueId: rescue._id };
    });
  const rescueId = requiredText(body.rescueId, "Recovery case", 1, 100);
  return transaction(async (session) => {
    const access = await scope(actor, session);
    const gamer = access.user.role === "GAMER";
    const rescue = await models.Rescue.findById(rescueId).session(session);
    if (
      !rescue ||
      (gamer
        ? rescue.userId !== actor._id
        : !access.userIds.includes(rescue.userId))
    )
      fail("Recovery case is outside your scope.", 403);
    if (
      !gamer &&
      (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(access.user.role) ||
        !permitted(access.user, "game:write"))
    )
      fail("Recovery approval is outside your permissions.", 403);
    const key = `mission-recovery:${rescue._id}`;
    if (await models.Energy.exists({ eventKey: key }).session(session))
      return { success: true, alreadyRecovered: true };
    if (rescue.status === "CLOSED")
      fail("This recovery case is already closed.", 409);
    if (gamer) {
      if (!rescue.missionEventKey)
        fail(
          "Your MC or Centre Command needs to review this recovery case.",
          409,
        );
      const debit = await models.Energy.findOne({
        userId: actor._id,
        eventKey: rescue.missionEventKey,
        result: 0,
        energyResult: 0,
      }).session(session);
      if (!debit) fail("This case needs staff review.", 409);
      if (
        !Array.isArray(body.answers) ||
        body.answers.length !== 3 ||
        body.answers.some((v, i) => v !== [1, 0, 2][i])
      )
        fail(
          "Review the recovery choices: continue saved work, verify claims independently, and ask for help when blocked.",
          409,
        );
    }
    const reason = gamer
      ? "Completed the mission recovery drill."
      : requiredText(body.reason, "Recovery approval reason", 20, 2000);
    const player = await models.User.findById(rescue.userId).session(session);
    if (
      !player ||
      player.active === false ||
      player.role !== "GAMER" ||
      cohortOf(player) !== cohortOf(access.user)
    )
      fail("Active player not found in this cohort.", 403);
    const before = playerBalance(player);
    if (before.hp > 0 && before.energy > 0)
      fail("This player already has energy. Refresh the recovery queue.", 409);
    player.hp = Math.max(1, before.hp);
    player.energy = 3;
    await player.save({ session });
    rescue.status = "CLOSED";
    rescue.plan = reason;
    rescue.closedAt = now;
    await rescue.save({ session });
    await models.Energy.create(
      [
        {
          _id: randomUUID(),
          userId: player._id,
          eventKey: key,
          resource: "ENERGY",
          change: 3 - before.energy,
          result: player.hp,
          energyResult: 3,
          lifeChange: player.hp - before.hp,
          reason,
          day: ist(now).day,
          createdAt: now,
        },
      ],
      { session },
    );
    await models.WeekOneEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId: cohortOf(player),
          actorId: access.user._id,
          kind: "MISSION_ENERGY_RECOVERED",
          createdAt: now,
          details: {
            userId: player._id,
            rescueId,
            reason,
            method: gamer ? "RECOVERY_DRILL" : "STAFF_APPROVAL",
            before,
            after: playerBalance(player),
          },
        },
      ],
      { session },
    );
    return { success: true, balance: playerBalance(player) };
  });
}
