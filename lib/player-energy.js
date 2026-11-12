import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { cohortOf, demand } from "./access-scope.js";
import { playerBalance, ist } from "./rules.js";

// User is the only current balance. Programme ledgers are immutable history.
export async function sharedEnergy(ctx, userId) {
  const player = await models.User.findById(userId).session(ctx.session);
  demand(
    player && player.role === "GAMER" && cohortOf(player) === ctx.cohortId,
    "Player balance is outside this cohort.",
    403,
  );
  const balance = playerBalance(player);
  const rescue =
    balance.hp === 0 ||
    balance.energy === 0 ||
    Boolean(
      await models.Rescue.exists({ userId, status: { $ne: "CLOSED" } }).session(
        ctx.session,
      ),
    );
  return { player, ...balance, lives: balance.hp, rescue };
}

export async function saveSharedEnergy(ctx, current, value, key, reason) {
  const { player } = current;
  const eventKey = `programme:${ctx.cohortId}:${key}`;
  player.hp = value.lives;
  player.energy = value.lives === 0 ? 0 : value.energy;
  if (value.amount < 0) {
    player.drops += 1;
    player.streak = 0;
  }
  await player.save({ session: ctx.session });
  await models.Energy.create(
    [
      {
        _id: randomUUID(),
        userId: player._id,
        resource: "ENERGY",
        change:
          value.amount < 0
            ? -1
            : (value.amount ?? player.energy - current.energy),
        result: player.hp,
        energyResult: player.energy,
        lifeChange: player.hp - current.hp,
        reason,
        eventKey,
        day: ist(ctx.now).day,
        createdAt: ctx.now,
      },
    ],
    { session: ctx.session },
  );
  if (value.rescue) {
    if (
      !(await models.Rescue.exists({
        userId: player._id,
        status: { $ne: "CLOSED" },
      }).session(ctx.session))
    )
      await models.Rescue.create(
        [
          {
            _id: randomUUID(),
            userId: player._id,
            teamId: player.teamId,
            openedAt: ctx.now,
          },
        ],
        { session: ctx.session },
      );
  } else {
    await models.Rescue.updateMany(
      { userId: player._id, status: { $ne: "CLOSED" } },
      { $set: { status: "CLOSED", closedAt: ctx.now } },
      { session: ctx.session },
    );
  }
}
