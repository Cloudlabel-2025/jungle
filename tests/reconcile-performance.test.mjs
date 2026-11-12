import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { reconcile } from "../lib/engine.js";
import { ist } from "../lib/rules.js";

test(
  "idle reconciliation avoids transactions while due deadlines and closed days still settle",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/reconcile_performance_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    const original = mongoose.startSession;
    let transactions = 0;
    mongoose.startSession = function (...args) {
      transactions++;
      return original.apply(this, args);
    };
    try {
      for (const model of Object.values(models)) await model.init();
      const user = await models.User.create({
        _id: "idle-player",
        name: "QA Player",
        email: "idle@qa.invalid",
        role: "GAMER",
        teamId: "qa-team",
      });
      await reconcile([user._id]);
      assert.equal(transactions, 1);
      await reconcile([user._id]);
      await reconcile([user._id]);
      await reconcile([]);
      assert.equal(
        transactions,
        1,
        "idle polling must not open write transactions",
      );
      await models.Task.create({
        _id: "due-task",
        teamId: "qa-team",
        assigneeId: user._id,
        title: "Due objective",
        status: "Backlog",
        dueAt: new Date(Date.now() - 60000),
      });
      await reconcile([user._id]);
      assert.equal(transactions, 2);
      assert.equal((await models.User.findById(user._id)).energy, 2);
      assert.equal(await models.Energy.countDocuments({ userId: user._id }), 1);
      await reconcile([user._id]);
      assert.equal(
        transactions,
        2,
        "a settled deadline must not run or deduct again",
      );
      const yesterday = ist(new Date(Date.now() - 86400000)).day;
      const before = ist(new Date(Date.now() - 2 * 86400000)).day;
      await models.User.updateOne(
        { _id: user._id },
        { $set: { lastSettledDay: before } },
      );
      await models.Attendance.create({
        _id: "attendance",
        userId: user._id,
        day: yesterday,
        onTime: true,
        clockAt: new Date(`${yesterday}T03:30:00Z`),
      });
      await models.Journal.create({
        _id: "journal",
        userId: user._id,
        teamId: "qa-team",
        day: yesterday,
        workDone: "Completed work",
        learnings: "Verified work",
        tomorrowPlan: "Continue",
      });
      await reconcile([user._id]);
      assert.equal(transactions, 3);
      assert.equal((await models.User.findById(user._id)).streak, 1);
    } finally {
      mongoose.startSession = original;
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
