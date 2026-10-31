import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { deduct, reconcile } from "../lib/engine.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import {
  weekOneAction,
  weekOneSnapshot,
  weekOneProtected,
} from "../lib/week-one.js";
import { prepareDay } from "../lib/week-one-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

test(
  "Week 1 release transactions, pending marking, frozen attempts and energy protection",
  {
    skip: !process.env.TEST_MONGODB_URI,
  },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/week1_release_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const gamer = {
      _id: "g",
      name: "Gamer",
      email: "g@example.invalid",
      role: "GAMER",
      cohortId: "alpha",
    };
    const mc = {
      ...gamer,
      _id: "mc",
      email: "mc@example.invalid",
      role: "MISSION_COMMANDER",
    };
    const cc = {
      ...gamer,
      _id: "cc",
      email: "cc@example.invalid",
      role: "CENTRE_COMMAND",
    };
    const config = fixtureConfig();
    const now = new Date(config.officialStart);
    try {
      await models.User.insertMany([gamer, mc, cc]);
      await models.Cohort.create({
        _id: "alpha",
        name: "Week 1",
        college: "Test College",
        startDate: config.day,
        currentWeek: 1,
      });
      await dayOneAction(cc, "release", { config, revision: 0 }, now);
      assert.equal((await dayOneSnapshot(gamer)).records.length, 0);
      assert.ok(
        !JSON.stringify(await dayOneSnapshot(gamer)).includes(
          config.genres[0].question,
        ),
      );
      const revision = (await weekOneSnapshot(mc)).revision;
      const attempts = await Promise.allSettled(
        [mc, cc].map((actor) =>
          weekOneAction(actor, "open", { day: 1, revision }, now),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        attempts.find((r) => r.status === "rejected").reason.status,
        409,
      );
      await assert.rejects(
        weekOneAction(
          { ...mc, cohortId: "outside" },
          "close",
          { day: 1, revision: 0 },
          now,
        ),
      );
      await dayOneAction(gamer, "clock", {}, now);
      await dayOneAction(gamer, "genre", { genreId: "genre-1" }, now);
      await dayOneAction(gamer, "acknowledge", {}, now);
      await dayOneAction(gamer, "start", {}, now);
      const record = (await dayOneSnapshot(gamer)).records[0];
      await dayOneAction(
        gamer,
        "draft",
        { url: "https://chat.example/share/partial" },
        new Date(now.getTime() + 1000),
      );
      assert.equal(
        (await dayOneSnapshot(gamer)).records[0].version,
        record.version,
      );
      assert.equal(
        (await dayOneSnapshot(gamer)).records[0].draft.url,
        "https://chat.example/share/partial",
      );
      await dayOneAction(
        gamer,
        "submit",
        { url: "https://chat.example/share/current", version: record.version },
        new Date(now.getTime() + 60000),
      );
      // Prepare a subsequent day using the shared contract that future content
      // modules will use. Its question must remain private before opening.
      const release = await models.WeekOneRelease.findById("alpha");
      prepareDay(
        release,
        2,
        { ...config, version: 2 },
        cc._id,
        now.toISOString(),
      );
      release.markModified("days");
      await release.save();
      await assert.rejects(
        weekOneAction(
          mc,
          "open",
          { day: 2, revision: (await weekOneSnapshot(mc)).revision },
          now,
        ),
      );
      const end = new Date(config.closingCutoff);
      await weekOneAction(
        mc,
        "close",
        { day: 1, revision: (await weekOneSnapshot(mc)).revision },
        end,
      );
      assert.equal((await dayOneSnapshot(gamer)).state, "CLOSED");
      await assert.rejects(
        dayOneAction(gamer, "draft", { url: "changed" }, end),
        (e) => e.status === 409,
      );
      await weekOneAction(
        cc,
        "open",
        { day: 2, revision: (await weekOneSnapshot(cc)).revision },
        end,
      );
      const after = (await dayOneSnapshot(gamer)).records[0];
      assert.equal(after.verification.status, "PENDING");
      assert.equal(after.assessment, undefined);
      assert.equal(after.config.version, 1);
      assert.equal(
        after.deadline,
        new Date(now.getTime() + 90 * 60000).toISOString(),
      );
      assert.equal((await weekOneSnapshot(gamer)).days[1].state, "OPEN");
      assert.equal((await weekOneSnapshot(gamer)).days[2].state, "LOCKED");
      await transaction((session) =>
        deduct(
          gamer._id,
          "Legacy gameplay retains its own energy rules",
          10,
          "week1-test",
          session,
        ),
      );
      await reconcile([gamer._id]);
      assert.equal(await models.Energy.countDocuments(), 1);
      assert.equal(await weekOneProtected(gamer), true);
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $set: { currentWeek: 2 } },
      );
      assert.equal(await weekOneProtected(gamer), false);
      await transaction((session) =>
        deduct(
          gamer._id,
          "Week 2 policy still applies",
          10,
          "week2-test",
          session,
        ),
      );
      assert.equal(await models.Energy.countDocuments(), 2);
      const events = await models.WeekOneEvent.find({
        cohortId: "alpha",
      }).lean();
      assert.deepEqual(
        events.map((e) => e.kind),
        ["PREPARE", "OPEN", "CLOSE", "OPEN"],
      );
      assert.equal(events[0].details.contentVersion, 1);
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
