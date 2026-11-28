import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import { newLevelOne } from "../lib/level-one-rules.js";
import { skyLevels } from "../lib/sky-journey.js";
import { upgradeLevelOneRewards } from "../lib/level-one.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

const answer =
  "Automobiles research needs careful reasoning and sources. Compare alternatives using the same travel distance and total running costs. Check equipment, safety, maintenance and environmental assumptions. Explain which choice fits the budget and why another choice might be better in a different situation. A published source can help us check an estimate, but its date and method also matter. Avoid treating a claim as true simply because it sounds confident. State uncertainties and describe how to test them.";
const chat = `User: Investigate Automobiles research.\nAssistant: ${answer}\nUser: Compare alternatives.\nAssistant: ${answer}\nUser: Check sources and reasoning.\nAssistant: https://example.org/research ${answer}`;
test(
  "MongoDB Level 1: automatic stars, atomic 5x rewards, overrides, scoped teams and replay",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `level_one_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const at = (minute) =>
      new Date(`2026-11-02T03:${String(minute).padStart(2, "0")}:00Z`);
    const cc = {
      _id: "cc-level",
      name: "CC",
      email: "cc-level@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const mc = {
      _id: "mc-level",
      name: "MC",
      email: "mc-level@example.invalid",
      role: "MISSION_COMMANDER",
      cohortId: "alpha",
    };
    const players = [1, 2, 3].map((n) => ({
      _id: `level-g${n}`,
      name: `Player ${n}`,
      email: `level-g${n}@example.invalid`,
      role: "GAMER",
      cohortId: "alpha",
      teamId: n < 3 ? "team-level" : "other-team",
    }));
    const config = { ...fixtureConfig(), version: 1 };
    const sharedChatReader = async (url) => ({
      ok: true,
      transcript: chat,
      evidence: {
        canonicalUrl: url,
        provider: "ChatGPT",
        readerVersion: "synthetic-reader",
        sha256: "synthetic-chat-digest",
        userTurns: 3,
        assistantTurns: 3,
        fetchedAt: at(40).toISOString(),
      },
    });
    try {
      await models.User.insertMany([
        cc,
        mc,
        ...players,
        {
          ...players[0],
          _id: "foreign-g",
          cohortId: "foreign",
          email: "foreign-g@example.invalid",
        },
      ]);
      await models.Cohort.create({
        _id: "alpha",
        name: "Level QA",
        college: "Synthetic",
        startDate: config.day,
        currentWeek: 1,
      });
      await models.Team.insertMany([
        {
          _id: "team-level",
          name: "Test team",
          code: "LT",
          cohortId: "alpha",
          commanderId: mc._id,
        },
        {
          _id: "other-team",
          name: "Other team",
          code: "OT",
          cohortId: "alpha",
          commanderId: "other-mc",
        },
      ]);
      await models.DayOneSetup.create({
        _id: "alpha",
        revision: 0,
        draft: config,
        released: config,
      });
      await models.WeekOneRelease.create({
        _id: "alpha",
        revision: 0,
        days: [1, 2, 3, 4, 5].map((day) => ({
          day,
          title: `Day ${day}`,
          state: day === 1 ? "OPEN" : "DRAFT",
          ...(day === 1
            ? {
                content: config,
                officialStart: config.officialStart,
                scheduledEnd: config.closingCutoff,
                openedAt: config.availableAt,
              }
            : {}),
        })),
      });
      for (const p of players)
        await models.DayOneRecord.create({
          _id: `alpha:${p._id}`,
          userId: p._id,
          cohortId: "alpha",
          version: 0,
          data: {
            config,
            availableAt: config.availableAt,
            clockAt: config.availableAt,
            genreId: config.genres[0].id,
            acknowledgedAt: config.availableAt,
            startedAt: config.availableAt,
            deadline: "2026-11-02T05:00:00Z",
            submissions: [],
            ledger: [],
            levelOne: newLevelOne(),
          },
        });
      const read = (p) => models.DayOneRecord.findById(`alpha:${p._id}`).lean();
      const balance = (p) => models.User.findById(p._id).lean();
      const submit = async (p, extra = {}) =>
        dayOneAction(
          p,
          "submit",
          {
            version: (await read(p)).version,
            url: "https://example.org/shared-chat",
            transcript: chat,
            ...extra,
          },
          at(40),
          { sharedChatReader },
        );
      const override = async (
        actor,
        selected,
        operation,
        stars,
        extra = {},
      ) => {
        const versions = {};
        for (const p of selected) versions[p._id] = (await read(p)).version;
        return dayOneAction(
          actor,
          "level-result",
          {
            ...(selected.length > 1
              ? { teamId: "team-level" }
              : { userId: selected[0]._id }),
            operation,
            stars,
            reason: "Documented testing decision for this result",
            members: selected.map((p) => p._id),
            versions,
            ...extra,
          },
          at(45),
        );
      };
      const concurrent = await Promise.allSettled([
        submit(players[0]),
        submit(players[0]),
      ]);
      assert.ok(concurrent.some((r) => r.status === "fulfilled"));
      assert.equal((await balance(players[0])).xp, 150);
      assert.equal((await balance(players[0])).trophies, 30);
      assert.equal(
        await models.LevelOneReward.countDocuments({ userId: players[0]._id }),
        1,
      );
      await submit(players[0]);
      assert.equal(
        (await balance(players[0])).xp,
        150,
        "retry cannot mint rewards",
      );
      const automatic = (await read(players[0])).data.levelOne.automatic;
      assert.equal(automatic.stars, 3);
      assert.equal(automatic.source, "SYSTEM");
      await assert.rejects(override(mc,[players[0]],"validate",3), /Review the saved evidence/);
      const beforeValidation = await balance(players[0]);
      await override(mc,[players[0]],"validate",3,{reviewedEvidence:true});
      const firstNotice=await models.PlayerResultNotice.findOne({userId:players[0]._id,day:1}).lean();
      assert.equal(firstNotice.actorId,mc._id);assert.equal(firstNotice.actorRole,"MISSION_COMMANDER");assert.equal(firstNotice.operation,"validate");assert.equal(firstNotice.after.stars,3);
      assert.deepEqual(await balance(players[0]),beforeValidation,"human validation does not mint rewards");
      assert.equal((await read(players[0])).data.levelOne.validation.actorId, mc._id);
      await override(cc,[players[0]],"validate",3,{reviewedEvidence:true});
      assert.equal(await models.PlayerResultNotice.countDocuments({userId:players[0]._id,day:1,operation:"revalidate"}),1);
      assert.equal((await dayOneSnapshot(cc,at(46))).records.find((r) => r.userId === players[0]._id).levelOne.validation.actorId,cc._id);
      assert.equal(await models.DayOneEvent.countDocuments({kind:"LEVEL_ONE_VALIDATED"}),2);
      assert.equal(
        (await read(players[0])).data.verification.status,
        "VERIFIED",
        "the tested reader confirmed public shared-link access",
      );
      await assert.rejects(
        override(players[1], [players[0]], "result", 3),
        (e) => e.status === 403,
      );
      await assert.rejects(
        override(mc, [players[2]], "result", 3),
        (e) => e.status === 403,
      );
      await assert.rejects(
        dayOneAction(
          cc,
          "level-result",
          {
            userId: "foreign-g",
            members: ["foreign-g"],
            versions: { "foreign-g": 0 },
            operation: "result",
            stars: 3,
            reason: "An invalid cross-cohort result change",
          },
          at(45),
        ),
        (e) => e.status === 403,
      );
      await assert.rejects(
        override(cc, [players[0]], "result", 4),
        (e) => e.status === 400,
      );
      await assert.rejects(
        override(cc, [players[0]], "result", 3, { members: ["foreign-g"] }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        override(cc, [players[0]], "result", 3, {
          versions: { [players[0]._id]: -1 },
        }),
        (e) => e.status === 409,
      );
      await override(mc, [players[0]], "result", 1);
      const reviewedView=(await dayOneSnapshot(mc,at(46))).records.find(record=>record.userId===players[0]._id).levelOne;
      assert.equal(reviewedView.automatic.stars,3);assert.equal(reviewedView.result.stars,1);
      assert.equal(reviewedView.overrideHistory.at(-1).result.stars,3,"staff can inspect the previous automatic result alongside its correction");
      assert.equal((await balance(players[0])).xp, 75);
      assert.equal((await balance(players[0])).trophies, 15);
      assert.equal(
        (await read(players[0])).data.levelOne.automatic.stars,
        3,
        "staff decision preserves original scoring",
      );
      await submit(players[0], {
        url: "https://example.org/revised",
        reason: "A revised link for the same evidence",
      });
      assert.equal(
        (await balance(players[0])).xp,
        75,
        "a new URL cannot bypass a staff override",
      );
      const team = await override(mc, players.slice(0, 2), "result", 2);
      assert.equal(team.affected, 2);
      for (const p of players.slice(0, 2)) {
        assert.equal((await balance(p)).trophies, 25);
        assert.equal((await balance(p)).xp, 125);
      }
      const staleVersions = {
        [players[0]._id]: (await read(players[0])).version,
        [players[1]._id]: -1,
      };
      await assert.rejects(
        override(mc, players.slice(0, 2), "result", 3, {
          versions: staleVersions,
        }),
        (e) => e.status === 409,
      );
      assert.equal(
        (await balance(players[0])).xp,
        125,
        "team action is all-or-nothing",
      );
      await override(mc, [players[0]], "replay");
      let replay = await read(players[0]);
      assert.equal(replay.data.levelOne.history.length, 1);
      assert.equal(replay.data.submissions.length, 0);
      assert.equal(replay.data.genreId, config.genres[0].id);
      assert.equal((await balance(players[0])).xp, 125);
      const snapshot = await dayOneSnapshot(players[0], at(46));
      assert.equal(
        snapshot.records[0].levelOne.bestResult.stars,
        2,
        "replay retains earned completion",
      );
      await dayOneAction(
        players[0],
        "acknowledge",
        { version: replay.version },
        at(46),
      );
      replay = await read(players[0]);
      await dayOneAction(
        players[0],
        "start",
        { version: replay.version },
        at(47),
      );
      await submit(players[0], {
        transcript: chat,
        url: "https://example.org/replay",
      });
      // The synthetic submit above occurs before the replay start, so it must not earn an on-time star.
      assert.equal((await balance(players[0])).xp, 125);
      replay = await read(players[0]);
      await dayOneAction(
        players[0],
        "submit",
        {
          version: replay.version,
          transcript: chat,
          url: "https://example.org/replay-improved",
          reason: "New replay evidence after research began",
        },
        at(50),
        { sharedChatReader },
      );
      replay = await read(players[0]);
      assert.equal((await balance(players[0])).xp,125,"Mission 1 alone cannot improve replay rewards");
      await dayOneAction(players[0], "claim-check-start", {
        ownerId: players[0]._id, researchRevisionId: replay.data.submissions.at(-1).id,
      }, at(51));
      await dayOneAction(players[0],"claim-check-submit",{
        ownerId:players[0]._id,researchRevisionId:replay.data.submissions.at(-1).id,draftVersion:0,
        answers:{claim:"The AI claims that electric vehicles always cost less to operate.",source:"https://example.org/independent-study",verdict:"UNCERTAIN",finding:"I compared the source with the AI claim and found the costs depend on local electricity prices, driving distance and maintenance. I would check those assumptions before trusting this conclusion."}
      },at(51));
      assert.equal(
        (await balance(players[0])).xp,
        150,
        "improved replay awards only the extra 25 XP",
      );
      const ledgerCount = await models.LevelOneReward.countDocuments();
      const reviewNoticeCount=await models.PlayerResultNotice.countDocuments();
      await models.User.updateOne({ _id: players[1]._id }, { $set: { xp: 0 } });
      await assert.rejects(
        override(mc, players.slice(0, 2), "reopen"),
        (e) => e.status === 409,
      );
      assert.equal(
        (await balance(players[0])).xp,
        150,
        "a later member failure rolls back earlier team adjustments",
      );
      assert.equal(await models.LevelOneReward.countDocuments(), ledgerCount);
      assert.equal(await models.PlayerResultNotice.countDocuments(),reviewNoticeCount,"a rolled-back team decision cannot notify any player");
      await models.User.updateOne(
        { _id: players[1]._id },
        { $set: { xp: 125 } },
      );
      await override(cc, [players[0]], "reopen");
      assert.equal((await balance(players[0])).xp, 0);
      assert.equal((await balance(players[0])).trophies, 0);
      assert.equal((await read(players[0])).data.levelOne.override.stars, 0);
      assert.equal(
        (await balance(players[1])).xp,
        125,
        "member changes do not affect their teammates",
      );
      const gamerView = await dayOneSnapshot(players[0], at(51));
      assert.equal(gamerView.levelOneTargets, undefined);
      assert.equal(
        gamerView.records[0].levelOne.history[0].assessment,
        undefined,
      );
      const mcView = await dayOneSnapshot(mc, at(51));
      assert.ok(
        !mcView.levelOneTargets.members.some((p) => p._id === players[2]._id),
      );
      assert.equal(
        skyLevels({
          user: players[0],
          dayOne: gamerView,
          weekOneProgram: { days: [{ day: 2, state: "DRAFT" }] },
        })[1].available,
        false,
      );
      assert.ok(
        (await models.DayOneEvent.countDocuments({
          kind: "LEVEL_ONE_OVERRIDE",
        })) >= 5,
      );
      const rewards = await models.LevelOneReward.find().lean();
      assert.ok(rewards.every((r) => r.xp === r.trophies * 5));
      await models.WeekOneRelease.updateOne(
        { _id: "alpha" },
        { $set: { "days.0.state": "CLOSED" } },
      );
      await assert.rejects(
        override(mc, [players[1]], "replay"),
        (e) => e.status === 409,
      );
      // Upgrade already-earned rewards without replaying or duplicating a grant.
      await models.User.updateOne(
        { _id: players[2]._id },
        { $set: { trophies: 10, xp: 50 } },
      );
      await models.DayOneRecord.updateOne(
        { _id: `alpha:${players[2]._id}` },
        {
          $set: {
            "data.levelOne": {
              ...newLevelOne(),
              rewardVersion: "old",
              creditedTrophies: 10,
              automatic: {
                completed: true,
                stars: 1,
                reason: "Saved original work",
                at: "2026-11-02T04:00:00Z",
              },
            },
          },
        },
      );
      const upgraded = await upgradeLevelOneRewards(`alpha:${players[2]._id}`);
      assert.equal(upgraded.delta, 5);
      assert.equal((await balance(players[2])).xp, 75);
      assert.equal((await balance(players[2])).trophies, 15);
      assert.equal((await read(players[2])).data.levelOne.automatic.xp, 75);
      assert.equal(
        (await read(players[2])).data.levelOne.automatic.at,
        "2026-11-02T04:00:00Z",
      );
      const count = await models.LevelOneReward.countDocuments();
      assert.equal(
        (await upgradeLevelOneRewards(`alpha:${players[2]._id}`)).changed,
        false,
      );
      assert.equal(await models.LevelOneReward.countDocuments(), count);
      // An in-progress replay retains and reprices its previously earned best.
      await models.User.updateOne(
        { _id: players[2]._id },
        { $set: { trophies: 15, xp: 75 } },
      );
      await models.DayOneRecord.updateOne(
        { _id: `alpha:${players[2]._id}` },
        {
          $set: {
            "data.levelOne": {
              ...newLevelOne(),
              practice: true,
              rewardVersion: "old",
              creditedTrophies: 15,
              automatic: null,
              history: [{ attempt: 1, result: { completed: true, stars: 2 } }],
            },
          },
        },
      );
      assert.equal(
        (await upgradeLevelOneRewards(`alpha:${players[2]._id}`)).delta,
        10,
      );
      assert.equal((await balance(players[2])).xp, 125);
      // A current award must not regain a higher result revoked in old history.
      await models.User.updateOne(
        { _id: players[2]._id },
        { $set: { trophies: 15, xp: 75 } },
      );
      await models.DayOneRecord.updateOne(
        { _id: `alpha:${players[2]._id}` },
        {
          $set: {
            "data.levelOne": {
              ...newLevelOne(),
              practice: true,
              creditedTrophies: 15,
              automatic: null,
              history: [{ attempt: 1, result: { completed: true, stars: 3 } }],
            },
          },
        },
      );
      assert.equal(
        (await upgradeLevelOneRewards(`alpha:${players[2]._id}`)).changed,
        false,
      );
      assert.equal((await balance(players[2])).xp, 75);
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
