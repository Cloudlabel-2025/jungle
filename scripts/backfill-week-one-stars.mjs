import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import { connect, models, transaction } from "../lib/db.js";
import { lockWeekOne } from "../lib/week-one.js";
import { reconcileFlightLevel } from "../lib/week-one-levels.js";
import { activities } from "../lib/week-one-catalog.js";
try {
  await connect();
  const cohortId =
    process.argv.find((a) => a.startsWith("--cohort="))?.slice(9) || "alpha";
  const attempts = await models.WeekOneAttempt.find({
    cohortId,
    activityId: { $in: activities.filter((a) => a.day > 1).map((a) => a.id) },
  }).lean();
  const pairs = [
    ...new Map(
      attempts.map((a) => [
        JSON.stringify([a.userId, a.day]),
        { userId: a.userId, day: a.day },
      ]),
    ).values(),
  ];
  if (!process.argv.includes("--apply"))
    console.log(JSON.stringify({ cohortId, mode: "preview", levels: pairs }));
  else {
    const before = {
      levels: await models.WeekOneLevel.find({ cohortId }).lean(),
      users: await models.User.find({
        _id: { $in: pairs.map((a) => a.userId) },
      })
        .select("_id trophies xp")
        .lean(),
    };
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/week-one-stars-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify(before, null, 2), { flag: "wx" });
    await transaction(async (session) => {
      const release = await lockWeekOne(cohortId, session);
      if (!release) throw Error("Week 1 release not found.");
      const now = new Date();
      const ctx = {
        cohortId,
        session,
        user: { _id: "system:week-one-stars-backfill" },
        now,
        at: now.toISOString(),
      };
      for (const pair of pairs)
        await reconcileFlightLevel(ctx, pair.userId, pair.day);
    });
    console.log(JSON.stringify({ cohortId, levels: pairs.length, backup }));
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
