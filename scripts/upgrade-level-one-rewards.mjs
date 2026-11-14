// Preview by default. --apply writes only reward differences, with a backup.
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import { connect, models } from "../lib/db.js";
import { upgradeLevelOneRewards } from "../lib/level-one.js";
import { LEVEL_ONE_REWARDS } from "../lib/level-one-rules.js";
try {
  await connect();
  const records = await models.DayOneRecord.find({
    "data.levelOne": { $exists: true },
  }).lean();
  const ids = records.map((r) => r.userId);
  const players = await models.User.find({ _id: { $in: ids } })
    .select("_id name trophies xp")
    .lean();
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          rewardVersion: LEVEL_ONE_REWARDS,
          records: records.length,
          players: players.map((p) => ({
            ...p,
            stars:
              records.find((r) => r.userId === p._id)?.data.levelOne?.override
                ?.stars ??
              records.find((r) => r.userId === p._id)?.data.levelOne?.automatic
                ?.stars ??
              0,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/level-one-rewards-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify({ records, players }, null, 2), {
      flag: "wx",
    });
    const updates = [];
    for (const r of records) updates.push(await upgradeLevelOneRewards(r._id));
    const balances = await models.User.find({ _id: { $in: ids } })
      .select("_id name trophies xp")
      .lean();
    console.log(
      JSON.stringify(
        {
          mode: "applied",
          rewardVersion: LEVEL_ONE_REWARDS,
          backup,
          updates: updates.filter((r) => r.changed),
          balances,
        },
        null,
        2,
      ),
    );
  }
} catch (e) {
  console.error(e.name + ": " + e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
