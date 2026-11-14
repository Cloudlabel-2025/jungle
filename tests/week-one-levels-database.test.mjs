import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models, transaction } from "../lib/db.js";
import { programAction, programSnapshot } from "../lib/week-one-program.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { flightLevelId, reconcileFlightLevel } from "../lib/week-one-levels.js";
import {
  config,
  start,
  later,
  pack,
  evidenceFor,
} from "./week-one-levels.test.mjs";

test(
  "MongoDB level rewards: all levels, concurrency, overrides, replay, scoped teams, revocation and rollback",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/flight_stars_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    const p = {
      _id: "p",
      name: "Player",
      email: "p@test.invalid",
      role: "GAMER",
      cohortId: "alpha",
      teamId: "t",
      trophies: 15,
      xp: 75,
    };
    const q = {
      ...p,
      _id: "q",
      name: "Other player",
      email: "q@test.invalid",
      trophies: 0,
      xp: 0,
    };
    const outside = {
      ...q,
      _id: "outside",
      email: "outside@test.invalid",
      teamId: "other",
    };
    const cc = {
      _id: "cc",
      name: "CC",
      email: "cc@test.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const mc = {
      ...cc,
      _id: "mc",
      email: "mc@test.invalid",
      role: "MISSION_COMMANDER",
    };
    try {
      for (const m of Object.values(models)) await m.init();
      await models.User.insertMany([p, q, outside, cc, mc]);
      await models.Team.create({
        _id: "t",
        name: "Flight crew",
        code: "T",
        cohortId: "alpha",
        commanderId: mc._id,
      });
      await models.Team.create({
        _id: "other",
        name: "Other crew",
        code: "O",
        cohortId: "alpha",
        commanderId: "different-mc",
      });
      const data = blankProgram();
      data.progressionMode = "COMPLETION";
      await models.WeekOneProgram.create({ _id: "alpha", data });
      await models.WeekOneRelease.create({
        _id: "alpha",
        days: [
          { day: 1, state: "PREPARED", content: config },
          ...[2, 3, 4, 5].map((day) => ({
            day,
            state: "PREPARED",
            content: pack(day),
            contentVersion: 1,
          })),
        ],
      });
      await models.DayOneRecord.create({
        _id: "alpha:p",
        cohortId: "alpha",
        userId: "p",
        data: {
          levelOne: { automatic: { completed: true, stars: 1 } },
          config,
          genreId: config.genres[0].id,
          submissions: [{ url: "https://chatgpt.com/share/original-evidence" }],
        },
      });
      const row = (day, user = "p") =>
        models.WeekOneLevel.findById(flightLevelId("alpha", user, day)).lean();
      const balance = async () => {
        const u = await models.User.findById("p").lean();
        return [u.trophies, u.xp];
      };
      const staff = async (actor, day, operation, stars = 3, extra = {}) =>
        programAction(
          actor,
          "level-result",
          {
            day,
            operation,
            stars,
            reason: "Reviewed the saved mission evidence",
            userId: "p",
            members: ["p"],
            versions: { p: (await row(day))?.version || 0 },
            ...extra,
          },
          later(15),
        );
      const complete = async (day) => {
        for (const activity of pack(day).activities) {
          await programAction(
            p,
            "attempt-start",
            {
              day,
              activityId: activity.id,
              variantId: activity.variants?.[0]?.id,
            },
            start,
          );
          const id = `alpha:p:${activity.id}`,
            saved = await models.WeekOneAttempt.findById(id).lean();
          const body = {
            attemptId: id,
            attemptVersion: saved.version,
            answers: evidenceFor(activity, saved.data.variant),
          };
          const outcomes = await Promise.allSettled([
            programAction(p, "attempt-submit", body, later(10)),
            programAction(p, "attempt-submit", body, later(10)),
          ]);
          assert.equal(
            outcomes.filter((r) => r.status === "fulfilled").length,
            1,
            "stale concurrent submission is rejected",
          );
        }
      };
      for (const day of [2, 3, 4, 5]) {
        await complete(day);
        const r = await row(day);
        assert.equal(r.data.automatic.stars, 3);
        assert.equal(r.data.creditedTrophies, 30);
        assert.equal(r.data.creditedXp, 150);
      }
      assert.deepEqual(await balance(), [135, 675]);
      const rewardCount = await models.WeekOneEvent.countDocuments({
        kind: "FLIGHT_LEVEL_REWARD",
      });
      await transaction(async (session) => {
        const ctx = {
          cohortId: "alpha",
          session,
          user: cc,
          now: later(12),
          at: later(12).toISOString(),
        };
        for (const day of [2, 3, 4, 5])
          await reconcileFlightLevel(ctx, "p", day);
      });
      assert.deepEqual(
        await balance(),
        [135, 675],
        "backfill never credits an already-awarded level twice",
      );
      assert.equal(
        await models.WeekOneEvent.countDocuments({
          kind: "FLIGHT_LEVEL_REWARD",
        }),
        rewardCount,
      );
      const own = await programSnapshot(p, later(11));
      assert.equal(own.levelResults.length, 4);
      assert.ok(own.progression.levels.every((l) => l.completed));
      assert.ok(!JSON.stringify(own.levelResults).includes('"correct":'));
      assert.equal(
        (await programSnapshot(q, later(11))).levelResults.length,
        0,
      );
      await assert.rejects(staff(p, 2, "result"), (e) => e.status === 403);
      await assert.rejects(staff(cc, 2, "result", 3, { userId: { $ne: "nobody" } }), (e) => e.status === 400);
      await assert.rejects(
        staff(mc, 2, "result", 3, {
          userId: "outside",
          members: ["outside"],
          versions: { outside: 0 },
        }),
        (e) => e.status === 403,
      );
      await staff(mc, 2, "result", 1);
      assert.deepEqual(await balance(), [120, 600]);
      const v = (await row(2)).version;
      await assert.rejects(
        staff(cc, 2, "result", 3, { versions: { p: v - 1 } }),
        (e) => e.status === 409,
      );
      await staff(cc, 2, "replay");
      assert.deepEqual(await balance(), [120, 600]);
      assert.equal(
        await models.WeekOneAttempt.countDocuments({ userId: "p", day: 2 }),
        0,
      );
      assert.equal((await row(2)).data.history[0].attempts.length, 2);
      assert.equal(
        (await programSnapshot(p, later(15))).progression.levels[2].available,
        true,
      );
      await assert.rejects(staff(cc, 2, "replay"), (e) => e.status === 409);
      await complete(2);
      assert.deepEqual(await balance(), [135, 675]);
      assert.equal((await row(2)).data.creditedTrophies, 30);
      const replayed =
        await models.WeekOneAttempt.findById("alpha:p:D2-G01").lean();
      await assert.rejects(
        programAction(
          p,
          "attempt-save",
          {
            attemptId: replayed._id,
            attemptVersion: 0,
            answers: replayed.data.draft,
          },
          later(12),
        ),
        (e) => e.status === 409,
      );
      await staff(cc, 2, "replay");
      await complete(2);
      assert.deepEqual(
        await balance(),
        [135, 675],
        "another successful replay does not farm rewards",
      );
      await staff(cc, 2, "reopen");
      assert.deepEqual(await balance(), [105, 525]);
      assert.equal(
        (await programSnapshot(p, later(15))).progression.levels[2].available,
        false,
      );
      await staff(mc, 2, "result", 2);
      assert.deepEqual(await balance(), [130, 650]);
      await assert.rejects(
        staff(mc, 3, "result", 3, {
          userId: undefined,
          teamId: "t",
          members: ["p"],
          versions: { p: (await row(3)).version },
        }),
        (e) => e.status === 409,
      );
      await staff(mc, 3, "result", 2, {
        userId: undefined,
        teamId: "t",
        members: ["p", "q"],
        versions: { p: (await row(3)).version, q: 0 },
      });
      assert.equal((await row(3, "q")).data.creditedTrophies, 25);
      assert.equal((await models.User.findById("q").lean()).xp, 125);
      assert.ok(
        (await models.WeekOneEvent.countDocuments({
          kind: "FLIGHT_LEVEL_OVERRIDE",
        })) >= 6,
      );
      // A stale member aborts the entire team change, including all reward writes.
      const before = await balance();
      await assert.rejects(
        staff(mc, 3, "result", 3, {
          userId: undefined,
          teamId: "t",
          members: ["p", "q"],
          versions: { p: (await row(3)).version, q: 0 },
        }),
        (e) => e.status === 409,
      );
      assert.deepEqual(await balance(), before);
      await models.User.updateOne({ _id: mc._id }, { $set: { permissions: [] } });
      await assert.rejects(staff(mc, 3, "result", 3), (e) => e.status === 403);
      await models.User.updateOne({ _id: mc._id }, { $unset: { permissions: "" } });
      await models.WeekOneProgram.updateOne({ _id: "alpha" }, { $set: { "data.locked": true } });
      await assert.rejects(staff(cc, 3, "result", 3), (e) => e.status === 409);
      await models.WeekOneProgram.updateOne({ _id: "alpha" }, { $set: { "data.correction": { reason: "CC authorised a factual result correction" } } });
      await staff(cc, 3, "result", 3);
      assert.equal((await row(3)).data.creditedTrophies, 30);
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
