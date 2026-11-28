import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models, transaction } from "../lib/db.js";
import { programAction, programSnapshot } from "../lib/week-one-program.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { flightLevelId, reconcileFlightLevel, reconcileFlightReward } from "../lib/week-one-levels.js";
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
          if (day === 3) assert.equal(saved.data.labState, undefined, "a new or staff-replayed lab never inherits old experiment state");
          const body = {
            attemptId: id,
            attemptVersion: saved.version,
            answers: evidenceFor(activity, saved.data.variant),
          };
          if (activity.id === "D3-G01") {
            await assert.rejects(programAction(p,"attempt-save",{...body,labState:{circuit:["claim","claim"]}},later(4)),/each reasoning module once/);
            const labState={circuit:["evidence","claim"],fault:"none",prediction:"uncertain"};
            await programAction(p,"attempt-save",{...body,labState},later(5));
            const restored=(await programSnapshot(p,later(6))).attempts.find(a=>a._id===id);
            assert.deepEqual(restored.data.labState,labState,"reasoning circuits restore from the player's account");
            assert.equal(restored.data.startedAt,saved.data.startedAt);
            assert.equal(restored.data.deadline,saved.data.deadline);
            body.attemptVersion=restored.version;
          }
          if (activity.id === "D3-G02") {
            const draft = { ...body.answers, sequence: saved.data.variant.cards.slice(0, 2) };
            const labState={circuit:[],fault:"database",prediction:"no-response"};
            await programAction(p, "attempt-save", { ...body, answers: draft, labState }, later(5));
            const restored = (await programSnapshot(p, later(6))).attempts.find((a) => a._id === id);
            assert.deepEqual(restored.data.draft, draft, "Level 3 restores typed STORY notes and the partial component board");
            assert.deepEqual(restored.data.labState,labState,"faults and predictions restore alongside the saved route");
            assert.equal(restored.data.deadline, saved.data.deadline, "reading/reloading does not restart the saved timer");
            assert.equal(restored.data.startedAt, saved.data.startedAt);
            assert.equal(restored.data.variant.brief, saved.data.variant.brief, "the comic cannot replace the player's pinned scenario");
            assert.deepEqual(restored.data.variant.cards, saved.data.variant.cards);
            assert.equal(restored.data.variant.reference, undefined, "the player snapshot must keep the assessor's reference private");
            assert.deepEqual((await models.WeekOneAttempt.findById(id).lean()).data.variant, saved.data.variant);
            body.attemptVersion = restored.version;
          }
          if ([4,5].includes(day)) {
            const gameState = activity.id === "D4-G01" ? {plan:"fair",runs:1,mode:"report",cursor:2} : activity.id === "D4-G02" ? {actor:"other",policy:"owner",runs:1,mode:"report"} : {cursor:2};
            await programAction(p,"attempt-save",{...body,gameState},later(5));
            const restored=(await programSnapshot(p,later(6))).attempts.find(a=>a._id===id);
            assert.deepEqual(restored.data.gameState,gameState,"flight board restores from the account");
            assert.equal(restored.data.deadline,saved.data.deadline);
            assert.equal(restored.data.startedAt,saved.data.startedAt);
            assert.deepEqual(restored.data.draft,body.answers);
            assert.equal(restored.data.variant?.reference,undefined,"assessor notes remain private");
            await assert.rejects(programAction(q,"attempt-save",{...body,attemptVersion:restored.version,gameState},later(6)));
            await assert.rejects(programAction(p,"attempt-save",{...body,attemptVersion:restored.version,gameState:{cursor:99999}},later(6)));
            body.attemptVersion=restored.version;
          }
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
        assert.equal(r.data.creditedXp, 150 * day);
      }
      assert.deepEqual(await balance(), [135, 2175]);
      const evidenceVersions = Object.fromEntries((await models.WeekOneAttempt.find({userId:"p", day:2}).lean()).map((a) => [a._id,a.version]));
      await assert.rejects(staff(mc,2,"validate"), /Review the saved evidence/);
      await assert.rejects(staff(mc,2,"validate",3,{reviewedEvidence:true,evidenceVersions:{}}), /evidence changed/);
      await staff(mc,2,"validate",3,{reviewedEvidence:true,evidenceVersions});
      assert.equal((await models.PlayerResultNotice.findOne({userId:"p",day:2}).lean()).actorId,mc._id);
      assert.deepEqual(await balance(), [135,2175], "validation preserves rewards");
      assert.equal((await row(2)).data.validation.actorId,mc._id);
      assert.equal((await models.WeekOneEvent.findOne({kind:"FLIGHT_LEVEL_VALIDATED"}).lean()).details.review.role,"MISSION_COMMANDER");
      await staff(cc,2,"validate",3,{reviewedEvidence:true,evidenceVersions});
      assert.equal(await models.PlayerResultNotice.countDocuments({userId:"p",day:2,operation:"revalidate"}),1);
      assert.equal((await row(2)).data.validation.actorId,cc._id);
      await assert.rejects(staff(mc,2,"validate",3,{reviewedEvidence:true,evidenceVersions, userId:"outside",members:["outside"],versions:{outside:0}}), (e) => e.status === 403);
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
        [135, 2175],
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
      assert.deepEqual(await balance(), [120, 2025]);
      const v = (await row(2)).version;
      await assert.rejects(
        staff(cc, 2, "result", 3, { versions: { p: v - 1 } }),
        (e) => e.status === 409,
      );
      await staff(cc, 2, "replay");
      assert.deepEqual(await balance(), [120, 2025]);
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
      assert.deepEqual(await balance(), [135, 2175]);
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
        [135, 2175],
        "another successful replay does not farm rewards",
      );
      await staff(cc, 2, "reopen");
      assert.deepEqual(await balance(), [105, 1875]);
      assert.equal(
        (await programSnapshot(p, later(15))).progression.levels[2].available,
        false,
      );
      await staff(mc, 2, "result", 2);
      assert.deepEqual(await balance(), [130, 2125]);
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
      assert.equal((await models.User.findById("q").lean()).xp, 375);
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
      // A legacy completion keeps its trophies; upgrading adds only missing XP once.
      await models.WeekOneLevel.create({
        _id: flightLevelId("alpha", "q", 4), cohortId: "alpha", userId: "q", day: 4,
        data: { creditedTrophies: 15, creditedXp: 75, awards: [], automatic: { completed: true, stars: 1 } },
      });
      await models.User.updateOne({ _id: "q" }, { $inc: { trophies: 15, xp: 75 } });
      const reconcileLegacy = () => transaction(async (session) => {
        const record = await models.WeekOneLevel.findById(flightLevelId("alpha", "q", 4)).session(session);
        await reconcileFlightReward({ session, user: cc, now: later(16), at: later(16).toISOString() }, record);
        record.markModified("data"); await record.save({ session });
      });
      await reconcileLegacy();
      await reconcileLegacy();
      const legacy = await row(4, "q");
      assert.equal(legacy.data.creditedXp, 300);
      assert.equal(legacy.data.awards.length, 1);
      assert.equal(legacy.data.awards[0].trophies, 0);
      assert.equal(legacy.data.awards[0].xp, 225);
      assert.equal((await models.User.findById("q").lean()).xp, 675);
      await models.WeekOneProgram.updateOne({_id:"alpha"},{$set:{"data.locked":false}});
      const beforeLabReplay = await balance();
      await staff(cc,3,"replay");
      assert.equal(await models.WeekOneAttempt.countDocuments({userId:"p",day:3}),0);
      const archivedLab=(await row(3)).data.history.at(-1).attempts;
      assert.ok(archivedLab.every(a=>a.data.labState),"staff replay archives both saved experiments");
      await complete(3);
      assert.deepEqual(await balance(),beforeLabReplay,"replaying the lab does not farm trophies or XP");
      assert.equal((await models.User.findById("q").lean()).xp,675,"another member's results remain unchanged");
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
