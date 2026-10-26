import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { award, deduct, reconcile } from "../lib/engine.js";
import { migrateRewards } from "../lib/reward-migration.js";
import { ist } from "../lib/rules.js";
// Always use an isolated database. Never delete or reset a user's arena.
test(
  "MongoDB: transactional XP, concurrency, rescue, deadline audit and recovery",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const databaseName = `codewild_test_${Date.now()}`;
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/${databaseName}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    try {
      await models.User.create({
        _id: "test_gamer",
        name: "Test Operative",
        email: "test@example.invalid",
        role: "GAMER",
        teamId: "test_team",
      });
      await transaction((s) =>
        award("test_gamer", 49, "Initial award", "event_a", s),
      );
      await Promise.all(
        Array.from({ length: 4 }, () =>
          transaction((s) =>
            award("test_gamer", 10, "Concurrent duplicate", "event_b", s),
          ),
        ),
      );
      let user = await models.User.findById("test_gamer");
      assert.equal(user.xp, 150);
      assert.equal(user.trophies, 50);
      assert.equal(await models.Trophy.countDocuments(), 2);
      assert.equal(await models.Experience.countDocuments(), 2);
      await models.User.create({
        _id: "xp_only",
        name: "XP Only",
        email: "xp-only@example.invalid",
        role: "GAMER",
        teamId: "test_team",
      });
      await transaction((s) =>
        award(
          "xp_only",
          150,
          "Experience-only override",
          "xp_override",
          s,
          true,
        ),
      );
      await transaction((s) =>
        award("xp_only", 5, "Normal module", "normal_module", s),
      );
      const independent = await models.User.findById("xp_only");
      assert.equal(independent.xp, 150);
      assert.equal(independent.trophies, 10);
      assert.equal(
        await models.Trophy.countDocuments({ eventKey: "xp_override" }),
        0,
      );
      await models.User.collection.insertOne({
        _id: "legacy",
        name: "Legacy Explorer",
        email: "legacy@example.invalid",
        role: "GAMER",
        teamId: "test_team",
        xp: 5,
        dailyXp: 5,
        xpDay: ist().day,
        hp: 5,
      });
      await models.Trophy.collection.insertOne({
        _id: "legacy_reward",
        userId: "legacy",
        amount: 5,
        reason: "Legacy module",
        eventKey: "legacy_module",
        day: ist().day,
        createdAt: new Date(),
      });
      await Promise.all([migrateRewards(), migrateRewards()]);
      await migrateRewards();
      const migrated = await models.User.findById("legacy");
      assert.equal(migrated.xp, 15);
      assert.equal(migrated.trophies, 10);
      assert.equal(migrated.dailyXp, 15);
      assert.equal(migrated.dailyTrophies, 10);
      assert.equal(
        await models.Experience.countDocuments({ eventKey: "legacy_module" }),
        1,
      );
      assert.equal(
        (await models.Trophy.findById("legacy_reward")).legacyAmount,
        5,
      );
      assert.equal(
        await models.RewardMigration.countDocuments({ userId: "legacy" }),
        1,
      );
      assert.equal(
        (await models.RewardMigration.findOne({ userId: "legacy" })).legacyXp,
        5,
      );
      for (let i = 0; i < 5; i++)
        await transaction((s) =>
          deduct("test_gamer", `Infraction ${i}`, 10, `hp_${i}`, s),
        );
      user = await models.User.findById("test_gamer");
      assert.equal(user.hp, 0);
      assert.equal(user.drops, 5);
      assert.equal(await models.Rescue.countDocuments({ status: "OPEN" }), 1);
      await transaction((s) =>
        deduct("test_gamer", "Repeated event", 10, "hp_4", s),
      );
      assert.equal(await models.Energy.countDocuments(), 5);
      await models.Task.create({
        _id: "late_quest",
        teamId: "test_team",
        assigneeId: user._id,
        title: "Unreported finished work",
        status: "Done",
        dueAt: new Date(Date.now() - 10000),
      });
      await reconcile([user._id]);
      await reconcile([user._id]);
      assert.equal(
        await models.Energy.countDocuments({ eventKey: "deadline:late_quest" }),
        1,
      );
      // Establish historical fixtures before the first daily settlement.
      await models.User.updateOne(
        { _id: user._id },
        { $unset: { lastSettledDay: 1 } },
      );
      const days = [3, 2, 1].map(
        (n) => ist(new Date(Date.now() - n * 86400000)).day,
      );
      for (const day of days) {
        await models.Attendance.create({
          _id: `attendance_${day}`,
          userId: user._id,
          day,
          clockAt: new Date(`${day}T03:30:00Z`),
          onTime: true,
        });
        await models.Journal.create({
          _id: `journal_${day}`,
          userId: user._id,
          teamId: "test_team",
          day,
          workDone: "Completed test work",
          learnings: "A new testing technique",
          tomorrowPlan: "Continue the mission",
        });
      }
      await models.Rescue.updateOne(
        { userId: user._id },
        {
          $set: {
            plan: "Pair with a mentor and report before every deadline.",
            status: "RECOVERING",
          },
        },
      );
      await reconcile([user._id]);
      user = await models.User.findById(user._id);
      assert.equal(user.hp, 1);
      assert.equal(user.streak, 3);
      assert.equal(await models.Rescue.countDocuments({ status: "CLOSED" }), 1);
      await reconcile([user._id]);
      assert.equal((await models.User.findById(user._id)).hp, 1);
      // A full emergency restoration must not leave a rescue case stuck forever.
      const restored = "restored_gamer";
      await models.User.create({
        _id: restored,
        name: "Restored Operative",
        email: "restored@example.invalid",
        role: "GAMER",
        teamId: "test_team",
        hp: 5,
      });
      await models.Rescue.create({
        _id: "restored_case",
        userId: restored,
        teamId: "test_team",
        status: "RECOVERING",
        plan: "Report daily and complete the recovery agreement.",
      });
      for (const day of days) {
        await models.Attendance.create({
          _id: `restored_att_${day}`,
          userId: restored,
          day,
          clockAt: new Date(`${day}T03:30:00Z`),
          onTime: true,
        });
        await models.Journal.create({
          _id: `restored_log_${day}`,
          userId: restored,
          teamId: "test_team",
          day,
          workDone: "Completed assigned deliverables",
          learnings: "Practiced reliable communication",
          tomorrowPlan: "Continue the recovery agreement",
        });
      }
      await reconcile([restored]);
      assert.equal((await models.User.findById(restored)).hp, 5);
      assert.equal(
        (await models.Rescue.findById("restored_case")).status,
        "CLOSED",
      );
      assert.equal(await models.Energy.countDocuments({ userId: restored }), 0);
    } finally {
      assert.match(mongoose.connection.name, /^codewild_test_\d+$/);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      globalThis.__codewildMongo = null;
    }
  },
);
