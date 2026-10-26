import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { playerRole } from "../lib/team-roles.js";
try {
  await connect();
  for (const model of Object.values(models)) await model.init();
  await transaction(async (session) => {
    await models.Cohort.updateOne(
      { _id: "alpha" },
      { $inc: { rosterVersion: 1 } },
      { session },
    );
    const users = await models.User.find({
      role: "GAMER",
      teamRoleCode: null,
    }).session(session);
    for (const user of users) {
      const code = playerRole(user);
      if (!code)
        throw new Error(
          `Unknown team role on ${user._id}; resolve its assignment before migration.`,
        );
      user.teamRoleCode = code;
      await user.save({ session });
    }
    await models.Migration.updateOne(
      { _id: "2026-10-role-challenges" },
      {
        $setOnInsert: {
          description:
            "Stable player role codes, challenge publication, independent task assignments and submission/review audit indexes.",
          appliedAt: new Date(),
        },
      },
      { upsert: true, session },
    );
  });
  console.log(
    "Challenge migration complete; player accounts and existing tasks preserved.",
  );
} finally {
  await mongoose.disconnect();
}
