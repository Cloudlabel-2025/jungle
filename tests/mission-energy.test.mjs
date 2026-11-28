import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models, transaction } from "../lib/db.js";
import {
  missionStartBalance,
  recoverMissionEnergy,
  missionRecoverySnapshot,
} from "../lib/mission-energy.js";
import { dayOneAction } from "../lib/day-one.js";
import { programAction } from "../lib/week-one-program.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import {
  blankProgram,
  validateDayContent,
} from "../lib/week-one-program-rules.js";
import { newLevelOne } from "../lib/level-one-rules.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { conversation } from "./level-one-rules.test.mjs";
import { check } from "./first-discovery-check.test.mjs";

test(
  "normal mission starts and retries are free at every balance; legacy recovery stays scoped and idempotent",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    process.env.MONGODB_URI = new URL(
      `mission_energy_${Date.now()}`,
      process.env.TEST_MONGODB_URI,
    ).toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const config = { ...fixtureConfig(), version: 1 };
    const now = new Date(config.officialStart);
    const player = {
      _id: "energy-player",
      name: "Player",
      email: "energy@test.invalid",
      role: "GAMER",
      cohortId: "alpha",
      drops: 2,
      streak: 2,
    };
    const read = () => models.User.findById(player._id).lean();
    const start = () => dayOneAction(player, "start", {}, now);
    try {
      await models.User.create(player);
      await models.Cohort.create({
        _id: "alpha",
        name: "Energy QA",
        college: "QA",
        startDate: config.day,
        currentWeek: 1,
      });
      await models.DayOneSetup.create({
        _id: "alpha",
        released: config,
        draft: config,
      });
      const second = validateDayContent(
        2,
        starterFlightContent(2, config),
        config,
      );
      await models.WeekOneRelease.create({
        _id: "alpha",
        days: [1, 2, 3, 4, 5].map((day) => ({
          day,
          state: day <= 2 ? "PREPARED" : "DRAFT",
          ...(day <= 2
            ? {
                content: day === 1 ? config : second,
                officialStart: config.officialStart,
                scheduledEnd: config.closingCutoff,
              }
            : {}),
        })),
      });
      await models.WeekOneProgram.create({
        _id: "alpha",
        data: { ...blankProgram(), progressionMode: "COMPLETION" },
      });
      await models.DayOneRecord.create({
        _id: `alpha:${player._id}`,
        cohortId: "alpha",
        userId: player._id,
        version: 0,
        data: {
          config,
          availableAt: config.availableAt,
          genreId: config.genres[0].id,
          acknowledgedAt: now.toISOString(),
          submissions: [],
          ledger: [],
        },
      });
      await Promise.all([start(), start()]);
      assert.equal(
        (await models.DayOneRecord.findById(`alpha:${player._id}`).lean()).data
          .levelOne.claimCheckRequired,
        true,
        "older curriculum packs still get both missions",
      );
      assert.equal((await read()).energy, 3);
      assert.equal((await models.DayOneRecord.findById(`alpha:${player._id}`).lean()).data.missionEnergy.research.cost,0);
      assert.equal(
        await models.Energy.countDocuments({ userId: player._id }),
        0,
      );
      const reader = async (url) => ({
        ok: true,
        transcript: conversation(),
        evidence: {
          provider: "ChatGPT",
          canonicalUrl: url,
          userTurns: 3,
          assistantTurns: 3,
          sha256: "energy-evidence",
        },
      });
      await dayOneAction(
        player,
        "submit",
        { url: "https://chatgpt.com/share/energy-research" },
        now,
        { sharedChatReader: reader },
      );
      const record = await models.DayOneRecord.findById(
        `alpha:${player._id}`,
      ).lean();
      const body = {
        ownerId: player._id,
        researchRevisionId: record.data.submissions.at(-1).id,
        draftVersion: 0,
        answers: check,
      };
      // An in-progress attempt created before deployment follows the free policy too.
      await models.DayOneRecord.updateOne({_id:`alpha:${player._id}`},{$set:{"data.missionEnergy.policy":"mission-start-v1"}});
      await assert.rejects(
        dayOneAction(player, "claim-check-submit", body, now),
        /Start Mission 2/,
      );
      await Promise.all([
        dayOneAction(player, "claim-check-start", body, now),
        dayOneAction(player, "claim-check-start", body, now),
      ]);
      assert.equal((await read()).energy, 3);
      await dayOneAction(player, "claim-check-submit", body, now);
      const activity = second.activities[0];
      const launch = {
        day: 2,
        activityId: activity.id,
        variantId: activity.variants[0].id,
      };
      await assert.rejects(
        programAction(
          player,
          "attempt-start",
          { ...launch, variantId: "missing" },
          now,
        ),
      );
      assert.equal((await read()).energy, 3, "invalid launch is free");
      await Promise.all([
        programAction(player, "attempt-start", launch, now),
        programAction(player, "attempt-start", launch, now),
      ]);
      assert.equal((await read()).energy, 3);
      assert.equal(
        (await read()).hp,
        5,
        "starting three missions never costs a life",
      );
      assert.equal((await read()).drops, 2);
      assert.equal(
        (await read()).streak,
        2,
        "normal play does not change conduct",
      );
      assert.equal(
        await models.Energy.countDocuments({ userId: player._id }),
        0,
      );
      await assert.rejects(
        transaction(async (session) => {
          await missionStartBalance(player._id, session);
          throw Error("deliberate rollback");
        }),
        /deliberate rollback/,
      );
      assert.equal((await read()).energy, 3);
      assert.equal(
        await models.Energy.countDocuments({ eventKey: "mission:rollback" }),
        0,
      );
      await models.User.updateOne(
        { _id: player._id },
        { $set: { hp: 1, energy: 1 } },
      );
      await transaction((session) =>
        missionStartBalance(player._id, session),
      );
      assert.equal((await read()).hp, 1);
      assert.equal((await read()).energy, 1);
      assert.equal(
        await models.Rescue.countDocuments({
          userId: player._id,
          status: "OPEN",
        }),
        0,
      );
      // A balance exhausted under the previous policy must not block free play.
      await models.User.updateOne({_id:player._id},{$set:{hp:0,energy:0}});
      await programAction(player, "attempt-start", launch, now);
      assert.equal(
        await models.Energy.countDocuments({ userId: player._id }),
        0,
        "resuming a saved attempt at zero costs nothing",
      );
      await programAction(
          player,
          "attempt-start",
          {
            day: 2,
            activityId: second.activities[1].id,
            variantId: second.activities[1].variants[0].id,
          },
          now,
      );
      assert.equal(
        await models.WeekOneAttempt.countDocuments({ userId: player._id }),
        2,
      );
      assert.equal((await read()).hp,0);
      assert.equal((await read()).energy,0);
      // Retained historical charges still support their existing recovery drill.
      await models.Energy.create({_id:"old-mission-charge",userId:player._id,eventKey:"mission:legacy-last",resource:"ENERGY",change:-1,result:0,energyResult:0,day:config.day,reason:"Historical mission charge"});
      await models.Rescue.create({_id:"legacy-mission-case",userId:player._id,missionEventKey:"mission:legacy-last"});
      const recovery = (await missionRecoverySnapshot(player)).cases[0];
      assert.equal(recovery.selfService, true);
      await assert.rejects(
        recoverMissionEnergy(
          player,
          { rescueId: recovery.id, answers: [0, 0, 0] },
          now,
        ),
        /Review the recovery choices/,
      );
      assert.equal((await read()).energy, 0);
      const request = { rescueId: recovery.id, answers: [1, 0, 2] };
      await Promise.all([
        recoverMissionEnergy(player, request, now),
        recoverMissionEnergy(player, request, now),
      ]);
      assert.equal((await read()).hp, 1);
      assert.equal((await read()).energy, 3);
      assert.equal((await read()).drops, 2);
      assert.equal((await read()).streak, 2);
      assert.equal(
        await models.Energy.countDocuments({
          eventKey: `mission-recovery:${recovery.id}`,
        }),
        1,
      );
      await programAction(
        player,
        "attempt-start",
        {
          day: 2,
          activityId: second.activities[1].id,
          variantId: second.activities[1].variants[0].id,
        },
        now,
      );
      assert.equal(
        (await read()).energy,
        3,
        "a recovered player can start the next real mission",
      );
      await recoverMissionEnergy(player, request, now);
      assert.equal(
        (await read()).energy,
        3,
        "repeating a finished drill cannot refill energy",
      );
      await models.User.updateOne(
        { _id: player._id },
        { $set: { hp: 0, energy: 0 } },
      );
      const manual = await models.Rescue.create({
        _id: "manual-case",
        userId: player._id,
      });
      await assert.rejects(
        recoverMissionEnergy(player, { ...request, rescueId: manual._id }, now),
        /staff|MC or Centre/,
      );
      const cc = {
        _id: "recovery-cc",
        name: "Recovery CC",
        email: "recovery-cc@test.invalid",
        role: "CENTRE_COMMAND",
        cohortId: "alpha",
      };
      const outsider = {
        ...cc,
        _id: "recovery-outsider",
        email: "outsider@test.invalid",
        cohortId: "other",
      };
      await models.User.insertMany([cc, outsider]);
      const approval = {
        rescueId: manual._id,
        reason:
          "Reviewed the player recovery evidence and approved return to missions.",
      };
      await assert.rejects(
        recoverMissionEnergy(outsider, approval, now),
        /outside your scope/,
      );
      await assert.rejects(
        recoverMissionEnergy(cc, { ...approval, reason: "short" }, now),
      );
      await recoverMissionEnergy(cc, approval, now);
      assert.equal((await read()).hp, 1);
      assert.equal((await read()).energy, 3);
      assert.equal((await missionRecoverySnapshot(player)).cases.length, 0);
      await models.User.updateOne(
        { _id: player._id },
        { $set: { hp: 4, energy: 0 } },
      );
      const requested = await Promise.all([
        recoverMissionEnergy(player, { action: "request" }, now),
        recoverMissionEnergy(player, { action: "request" }, now),
      ]);
      assert.equal(
        requested[0].rescueId,
        requested[1].rescueId,
        "legacy zero-balance requests share one case",
      );
      assert.equal(
        await models.Rescue.countDocuments({
          userId: player._id,
          status: { $ne: "CLOSED" },
        }),
        1,
      );
      await recoverMissionEnergy(
        cc,
        { ...approval, rescueId: requested[0].rescueId },
        now,
      );
      assert.equal(
        (await read()).hp,
        4,
        "staff recovery preserves remaining lives",
      );
      assert.equal((await read()).energy, 3);
    } finally {
      await mongoose.disconnect();
    }
  },
);
