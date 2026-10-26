import { models, connect, transaction } from "./db.js";
import { XP_MULTIPLIER, TROPHY_MULTIPLIER } from "./rewards.js";

// One atomic conversion per user. The version marker prevents repeated scaling.
export async function migrateRewards() {
  await connect();
  await models.Experience.init();
  await models.RewardMigration.init();
  const pending = await models.User.find({ rewardVersion: { $ne: 2 } })
    .select("_id")
    .lean();
  for (const { _id } of pending)
    await transaction(async (session) => {
      const lock = await models.User.updateOne(
        { _id, rewardVersion: { $ne: 2 } },
        { $set: { rewardVersion: 2 } },
        { session },
      );
      if (!lock.modifiedCount) return;
      const user = await models.User.findById(_id).session(session);
      const oldXp = user.xp || 0;
      await models.RewardMigration.create(
        [
          {
            _id: `rewards_v2_${_id}`,
            userId: _id,
            legacyXp: oldXp,
            legacyDailyXp: user.dailyXp || 0,
            legacyXpDay: user.xpDay,
            xp: oldXp * XP_MULTIPLIER,
            trophies: oldXp * TROPHY_MULTIPLIER,
          },
        ],
        { session },
      );
      const events = await models.Trophy.find({ userId: _id })
        .session(session)
        .lean();
      const ledgerTotal = events.reduce((sum, event) => sum + event.amount, 0);
      if (ledgerTotal > oldXp)
        throw new Error(
          `Reward migration needs balance reconciliation for ${_id}. No values were changed.`,
        );
      for (const event of events) {
        await models.Experience.create(
          [
            {
              _id: `legacy_xp_${event._id}`,
              userId: _id,
              amount: event.amount * XP_MULTIPLIER,
              reason: event.reason,
              eventKey: event.eventKey,
              day: event.day,
              createdAt: event.createdAt,
            },
          ],
          { session },
        );
        await models.Trophy.updateOne(
          { _id: event._id },
          {
            $set: {
              legacyAmount: event.amount,
              amount: event.amount * TROPHY_MULTIPLIER,
              rewardVersion: 2,
            },
          },
          { session },
        );
      }
      const gap = oldXp - ledgerTotal;
      if (gap > 0) {
        const eventKey = `migration:balance:${_id}`,
          day = user.xpDay || new Date().toISOString().slice(0, 10),
          reason = "Opening balance converted from legacy XP";
        await models.Experience.create(
          [
            {
              _id: `legacy_open_xp_${_id}`,
              userId: _id,
              amount: gap * XP_MULTIPLIER,
              eventKey,
              day,
              reason,
            },
          ],
          { session },
        );
        await models.Trophy.create(
          [
            {
              _id: `legacy_open_trophy_${_id}`,
              userId: _id,
              amount: gap * TROPHY_MULTIPLIER,
              legacyAmount: gap,
              eventKey,
              day,
              reason,
              rewardVersion: 2,
            },
          ],
          { session },
        );
      }
      user.xp = oldXp * XP_MULTIPLIER;
      user.trophies = oldXp * TROPHY_MULTIPLIER;
      user.dailyTrophies = (user.dailyXp || 0) * TROPHY_MULTIPLIER;
      user.dailyXp = (user.dailyXp || 0) * XP_MULTIPLIER;
      user.trophyDay = user.xpDay;
      user.rewardVersion = 2;
      await user.save({ session });
      const proposals = await models.Proposal.find({
        recipientId: _id,
        kind: "XP_OVERRIDE",
        status: "PENDING_APPROVAL",
      }).session(session);
      for (const proposal of proposals) {
        proposal.amount *= XP_MULTIPLIER;
        await proposal.save({ session });
      }
    });
}
