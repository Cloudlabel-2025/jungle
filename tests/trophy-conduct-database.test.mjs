import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { connect, models } from "../lib/db.js";
import {
  trophyConductAction,
  trophyConductSnapshot,
} from "../lib/trophy-conduct.js";
import { TROPHY_CONDUCT_RULES } from "../lib/trophy-conduct-rules.js";

test(
  "conduct penalties removed: stale writes rejected, historical audit scoped, CC restoration once including older ID formats",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `retired_conduct_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    try {
      for (const model of Object.values(models)) await model.init();
      const cc = {
        _id: "cc",
        name: "Council",
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
      const p = {
        _id: "p",
        name: "Player",
        email: "p@test.invalid",
        role: "GAMER",
        cohortId: "alpha",
        teamId: "t",
        trophies: 295,
        xp: 2250,
        hp: 2,
        energy: 2,
      };
      const q = { ...p, _id: "q", email: "q@test.invalid", trophies: 2 };
      const outside = {
        ...p,
        _id: "outside",
        email: "outside@test.invalid",
        teamId: "other",
      };
      const foreign = {
        ...p,
        _id: "foreign",
        email: "foreign@test.invalid",
        cohortId: "beta",
      };
      await models.User.insertMany([cc, mc, p, q, outside, foreign]);
      await models.Team.create({
        _id: "t",
        name: "Crew",
        code: "QA",
        commanderId: "mc",
        cohortId: "alpha",
      });
      const historical = (id, userId, amount) => ({
        _id: id,
        userId,
        cohortId: "alpha",
        actorId: "mc",
        actorRole: "MISSION_COMMANDER",
        action: "DEDUCT",
        incidentRef: id,
        reason: "Historical decision retained for audit",
        evidence: "Recorded evidence from the now retired policy.",
        fingerprint: "legacy",
        eventKey: id,
        requestedAmount: 25,
        amount,
        before: 300,
        after: 300 + amount,
      });
      await models.TrophyConduct.create([
        historical("old-five", "p", -5),
        historical("old-two", "q", -2),
      ]);
      assert.equal(TROPHY_CONDUCT_RULES.length, 0);
      for (const actor of [cc, mc, p])
        for (const action of ["WARNING", "DEDUCT"])
          await assert.rejects(
            trophyConductAction(actor, { action }),
            (error) => error.status === 410,
          );
      assert.equal((await models.User.findById("p").lean()).trophies, 295);
      const request = async (userId, originalId, extra = {}) => {
        const player = await models.User.findById(userId).lean();
        return {
          action: "RESTORE",
          userId,
          originalId,
          eventKey: randomUUID(),
          reason:
            "Remove an outstanding deduction from the retired conduct policy.",
          evidence:
            "The original receipt confirms the actual debit; restore only that amount and retain the audit.",
          balanceBefore: player.trophies,
          balanceVersion: player.trophyConductRevision || 0,
          ...extra,
        };
      };
      const body = await request("p", "old-five");
      await assert.rejects(
        trophyConductAction(mc, body),
        (error) => error.status === 403,
      );
      await assert.rejects(
        trophyConductAction(p, body),
        (error) => error.status === 403,
      );
      await assert.rejects(
        trophyConductAction(cc, await request("foreign", "old-five")),
        (error) => error.status === 403,
      );
      await assert.rejects(
        trophyConductAction(cc, { ...body, balanceBefore: 294 }),
        (error) => error.status === 409,
      );
      const duplicate = await Promise.all([
        trophyConductAction(cc, body),
        trophyConductAction(cc, body),
      ]);
      assert.equal(duplicate[0].decision._id, duplicate[1].decision._id);
      assert.equal(duplicate[0].decision.amount, 5);
      const restored = await models.User.findById("p").lean();
      assert.deepEqual(
        [restored.trophies, restored.xp, restored.hp, restored.energy],
        [300, 2250, 2, 2],
      );
      await assert.rejects(
        trophyConductAction(cc, await request("p", "old-five")),
        /already been reversed/,
      );
      // A reversal produced by the former release must also prevent another credit.
      await models.TrophyConduct.create({
        ...historical("old-format-reversal", "q", 2),
        action: "RESTORE",
        originalId: "old-two",
      });
      await assert.rejects(
        trophyConductAction(cc, await request("q", "old-two")),
        /already been reversed/,
      );
      const own = await trophyConductSnapshot(p);
      assert.ok(own.decisions.every((row) => row.userId === "p"));
      assert.equal(own.disabled, true);
      await assert.rejects(
        trophyConductSnapshot(p, "q"),
        (error) => error.status === 403,
      );
      assert.ok(
        !(await trophyConductSnapshot(mc)).players.some(
          (row) => row._id === "outside",
        ),
      );
      assert.ok(
        !(await trophyConductSnapshot(cc)).players.some(
          (row) => row._id === "foreign",
        ),
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
