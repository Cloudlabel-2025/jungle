import { defaultAvatar } from "../lib/avatar.js";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import {
  playerStage,
  completeFlightIntro,
  guardFlightApi,
  publicPlayer,
  completeCrashArrival,
  flightIdentity,
} from "../lib/player-stage.js";
import { flightApiAllowed, flightScreens } from "../lib/flight-rules.js";
import { characterFor } from "../lib/characters.js";
import { chooseCharacter } from "../lib/character-actions.js";
import { projectAction } from "../lib/projects.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { authorisedFile, uploadIntent } from "../lib/pilot-storage.js";
import { snapshot } from "../lib/snapshot.js";
import { pilotFixture } from "./pilot-fixture.mjs";
import { rosterDigest } from "../lib/recovery.js";
import { experienceLevel } from "../lib/rewards.js";

test("unknown character masks identity only, preserving the player's profile and balances", () => {
  const user = {
    _id: "profile",
    name: "Explorer",
    xp: 125,
    trophies: 7,
    weekOneTrophies: 3,
    streak: 4,
    hp: 4,
    energy: 2,
    characterKey: "blaze",
    characterVariant: "male",
    avatar: defaultAvatar("male"),
    teamId: "future",
  };
  const profile = flightIdentity(user, { flight: true, stage: "FLIGHT" });
  for (const key of [
    "xp",
    "trophies",
    "weekOneTrophies",
    "streak",
    "hp",
    "energy",
  ])
    assert.equal(profile[key], user[key]);
  assert.equal(profile.level, 2);
  assert.equal(profile.characterHidden, true);
  assert.equal(profile.characterKey, null);
  assert.equal(profile.avatar, null);
  assert.equal(profile.teamId, null);
  const afterCrash = flightIdentity(user, {
    flight: false,
    stage: "EXPEDITION",
    characterSelectionRequired: true,
  });
  assert.equal(afterCrash.characterHidden, true);
  assert.equal(afterCrash.teamId, "future");
});

test("flight access vocabulary excludes project/character routes and requires welcome before learning writes", () => {
  for (const route of [
    "gamer/character",
    "gamer/modules",
    "gamer/task-status",
    "gamer/lab",
    "projects/start",
    "challenges",
    "map/layout",
    "support/export",
  ]) {
    assert.equal(flightApiAllowed(route, "POST", true), false, route);
  }
  assert.equal(flightApiAllowed("day1/genre", "POST", false), false);
  assert.equal(flightApiAllowed("day1/genre", "POST", true), true);
  assert.equal(flightApiAllowed("week1/program/ask", "POST", false), true);
  assert.equal(flightApiAllowed("story/flight-intro", "POST", false), true);
  assert.ok(!flightScreens.has("sprint-board"));
  assert.ok(!flightScreens.has("ide"));
  assert.equal(
    characterFor({ characterKey: "blaze", characterHidden: true }),
    null,
  );
});

test(
  "MongoDB flight stage: authoritative gates, persistent intro, unknown identity, scoped snapshot, direct service denials and staff continuity",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `flight_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    try {
      const fixture = await pilotFixture();
      const { cc, mc, gamers } = fixture;
      const player = gamers[0];
      assert.equal(
        (await playerStage(player)).flight,
        false,
        "existing approved post-foundation fixture retains access",
      );
      const program = await models.WeekOneProgram.findById("alpha").lean();
      const published = structuredClone(program.data);
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { "data.locked": false } },
      );
      await models.User.updateOne(
        { _id: player._id },
        { $set: { characterKey: "blaze", characterVariant: "male" } },
      );
      assert.equal((await playerStage(player)).flight, true);
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $set: { currentWeek: 2 } },
      );
      assert.equal(
        (await playerStage(player)).flight,
        true,
        "changing the displayed week cannot bypass unapproved results",
      );
      const identity = await publicPlayer(
        await models.User.findById(player._id).lean(),
      );
      assert.equal(identity.characterHidden, true);
      assert.equal(identity.characterKey, null);
      assert.equal(identity.teamId, null);
      assert.equal(characterFor(identity), null);
      assert.equal(identity.level, experienceLevel(identity.xp));
      await assert.rejects(
        completeCrashArrival(player, {}),
        (e) => e.status === 403,
      );
      await assert.rejects(
        completeCrashArrival(cc, {}),
        (e) => e.status === 403,
      );
      await assert.rejects(
        completeCrashArrival(player, { userId: gamers[1]._id }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        guardFlightApi(player, "day1/clock", "POST"),
        (e) => e.status === 403,
      );
      await assert.rejects(
        completeFlightIntro(player, { userId: gamers[1]._id }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        completeFlightIntro(cc, {}),
        (e) => e.status === 403,
      );
      await Promise.all(
        Array.from({ length: 4 }, () => completeFlightIntro(player, {})),
      );
      const first = (await playerStage(player)).introCompletedAt;
      await completeFlightIntro(player, {});
      assert.equal(await models.FlightOpening.countDocuments(), 1);
      assert.deepEqual((await playerStage(player)).introCompletedAt, first);
      assert.equal((await playerStage(gamers[1])).introComplete, false);
      await guardFlightApi(player, "day1/clock", "POST");
      await guardFlightApi(player, "week1/program/ask", "POST");
      for (const route of [
        "gamer/character",
        "projects/start",
        "gamer/lab",
        "challenges",
        "map/layout",
      ])
        await assert.rejects(
          guardFlightApi(player, route, "POST"),
          (e) => e.status === 403,
        );
      await assert.rejects(
        chooseCharacter(player, { characterKey: "blaze", variant: "male" }),
        (e) => e.status === 403,
      );
      await assert.rejects(
        projectAction(player, "start", { levelId: "project_1" }),
        (e) => e.status === 403,
      );
      await assert.rejects(
        pilotAction(player, "kickoff", { requestId: "blocked-flight-kickoff" }),
        (e) => e.status === 403,
      );
      await assert.rejects(pilotSnapshot(player), (e) => e.status === 403);
      await assert.rejects(
        authorisedFile(player, "missing-file"),
        (e) => e.status === 403,
      );
      await assert.rejects(uploadIntent(player, {}), (e) => e.status === 403);
      const view = await snapshot(player);
      assert.equal(view.story.flight, true);
      assert.equal(view.user.characterHidden, true);
      assert.equal(view.alumniMap, null);
      for (const key of [
        "tasks",
        "projectLevels",
        "projectAttempts",
        "teams",
        "modules",
        "perks",
        "roster",
        "messages",
      ])
        assert.deepEqual(view[key], [], key);
      assert.ok(view.dayOne && view.weekOne && view.weekOneProgram);
      assert.equal((await playerStage(mc)).flight, false);
      assert.equal((await playerStage(cc)).flight, false);
      await pilotSnapshot(mc);
      // Restore genuine fixture publication: stale/missing rosters and corrections must fail closed.
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { data: published } },
      );
      assert.equal((await playerStage(player)).stage, "CRASH");
      assert.equal((await playerStage(player)).flight, true);
      // Clearance alone cannot open the portal project before crash arrival.
      await assert.rejects(
        guardFlightApi(player, "projects/start", "POST"),
        (e) => e.status === 403,
      );
      await assert.rejects(
        projectAction(player, "start", { levelId: "project_1" }),
        (e) => e.status === 403,
      );
      assert.equal((await publicPlayer(player)).characterHidden, true);
      await assert.rejects(
        chooseCharacter(player, { avatar: defaultAvatar("female"), version: 0 }),
        (e) => e.status === 403,
      );
      await Promise.all(
        Array.from({ length: 3 }, () => completeCrashArrival(player, {})),
      );
      assert.equal(await models.CrashArrival.countDocuments(), 1);
      const crashStamp = (await models.CrashArrival.findOne().lean())
        .completedAt;
      await completeCrashArrival(player, {});
      assert.deepEqual(
        (await models.CrashArrival.findOne().lean()).completedAt,
        crashStamp,
      );
      assert.equal((await playerStage(player)).flight, false);
      await guardFlightApi(player, "projects/start", "POST");
      assert.equal(
        (await playerStage(player)).characterSelectionRequired,
        true,
      );
      assert.equal((await publicPlayer(player)).characterHidden, true);
      await chooseCharacter(player, {
        avatar: defaultAvatar("female"), version: 0,
      });
      assert.equal(
        (await playerStage(player)).characterSelectionRequired,
        false,
      );
      assert.equal((await publicPlayer(player)).characterHidden, false);
      assert.ok(
        (await models.CrashArrival.findOne().lean()).characterSelectedAt,
      );
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { "data.correction": { reason: "Assessment review" } } },
      );
      assert.equal((await playerStage(player)).flight, true);
      await assert.rejects(
        completeCrashArrival(player, {}),
        (e) => e.status === 403,
      );
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { data: published } },
      );
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { "data.recovery.published.eligibleDigest": "stale" } },
      );
      assert.equal((await playerStage(player)).flight, true);
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { data: published } },
      );
      assert.equal((await playerStage(player)).stage, "EXPEDITION");
      // A newly provisioned cohort with no release yet is still a flight account.
      await models.Cohort.create({
        _id: "new",
        name: "New cohort",
        college: "QA",
        startDate: "2026-11-12",
        currentWeek: 1,
      });
      assert.equal(
        (await playerStage({ ...player, cohortId: "new" })).flight,
        true,
      );
      assert.equal(
        published.recovery.published.eligibleDigest,
        rosterDigest(published.recovery, published.publications.at(-1)),
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
