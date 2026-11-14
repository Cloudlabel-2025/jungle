import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { programAction, programSnapshot } from "../lib/week-one-program.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import {
  programFixture,
  settingsFixture,
  publishFixtureRules,
} from "./week-one-program-fixture.mjs";
import { bank, version } from "../lib/research-bank.js";
import { validateDayContent } from "../lib/week-one-program-rules.js";

test("research bank has 17 genres and 51 unique versioned questions", () => {
  assert.equal(bank.length, 17);
  assert.equal(new Set(bank.map((g) => g.id)).size, 17);
  assert.equal(
    new Set(
      bank.flatMap((g) => {
        assert.equal(g.questions.length, 3);
        return g.questions.map((q) => q.id);
      }),
    ).size,
    51,
  );
  assert.equal(version, "2026-11-12-v1");
});

test(
  "MongoDB research journey: separate groups, atomic collisions, retries, privacy, pinned Friday and historical mode",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/research_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const time = new Date("2026-11-02T03:35:00Z");
    const gamers = Array.from({ length: 25 }, (_, i) => ({
      _id: `r${i + 1}`,
      name: `Research ${i + 1}`,
      email: `r${i + 1}@example.invalid`,
      role: "GAMER",
      cohortId: "alpha",
      teamId: "unrelated-final-team",
    }));
    const cc = {
      _id: "rcc",
      name: "Research CC",
      email: "rcc@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const mc = {
      _id: "rmc",
      name: "Research MC",
      email: "rmc@example.invalid",
      role: "MISSION_COMMANDER",
      cohortId: "alpha",
    };
    const call = (u, a, b = {}, at = time) => dayOneAction(u, a, b, at);
    const control = async (action, day, at) =>
      weekOneAction(
        cc,
        action,
        { day, revision: (await weekOneSnapshot(cc)).revision },
        at,
      );
    try {
      await models.User.insertMany([...gamers, cc, mc]);
      const config = {
        ...fixtureConfig(),
        selectionMode: "research-2026-11-12",
        questionSelection: "RANDOM", // Historical five-card / random-question release remains supported.
        bankApproval:
          "Curriculum fixture approval of all 51 supplied questions including the three draft genres.",
        researchGroups: Array.from({ length: 5 }, (_, i) => ({
          members: gamers.slice(i * 5, i * 5 + 5).map((u) => u._id),
        })),
      };
      await assert.rejects(
        call(gamers[0], "research-bank"),
        (e) => e.status === 403,
      );
      assert.equal((await call(cc, "research-bank")).genres.length, 51);
      await assert.rejects(
        call(cc, "release", {
          config: { ...config, bankApproval: "" },
          revision: 0,
        }),
      );
      await assert.rejects(
        call(cc, "release", {
          config: {
            ...config,
            researchGroups: [{ members: gamers.slice(0, 4).map((u) => u._id) }],
          },
          revision: 0,
        }),
      );
      const duplicate = structuredClone(config);
      duplicate.researchGroups[1].members[0] = "r1";
      await assert.rejects(
        call(cc, "release", { config: duplicate, revision: 0 }),
      );
      await call(cc, "release", { config, revision: 0 });
      assert.equal(await models.ResearchSelection.countDocuments(), 5);
      await publishFixtureRules(cc, time);
      await programAction(
        cc,
        "operations",
        {
          compassQuestions: settingsFixture().compassQuestions,
          reason:
            "Fixture-approved operational prompts for Friday research tests.",
        },
        time,
      );
      await control("open", 1, time);
      for (const gamer of gamers) await call(gamer, "clock");
      const first = await call(gamers[0], "genre-offer");
      assert.equal(first.genres.length, 5);
      assert.deepEqual(Object.keys(first.genres[0]).sort(), ["id", "name"]);
      assert.deepEqual(await call(gamers[0], "genre-offer"), first);
      const before = await dayOneSnapshot(gamers[0]);
      for (const q of bank.flatMap((g) => g.questions))
        assert.ok(!JSON.stringify(before).includes(q.prompt));
      const hidden = bank.find(
        (g) => !first.genres.some((o) => o.id === g.id),
      ).id;
      await assert.rejects(
        call(gamers[0], "genre", { genreId: hidden }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        call(gamers[0], "genre", {
          genreId: first.genres[0].id,
          playerId: "r2",
        }),
      );
      const shared = first.genres[0].id;
      // Pin overlapping valid offers to make the live MongoDB collision deterministic.
      const group = await models.ResearchSelection.findOne({
        teamId: "research-1",
      }).lean();
      await models.ResearchSelection.updateOne(
        { _id: group._id },
        {
          $push: {
            offers: { playerId: "r2", genreIds: first.genres.map((g) => g.id) },
          },
        },
      );
      const results = await Promise.allSettled([
        call(gamers[0], "genre", { genreId: shared }),
        call(gamers[1], "genre", { genreId: shared }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.find((r) => r.status === "rejected").reason.status,
        409,
      );
      const loser = results[0].status === "rejected" ? gamers[0] : gamers[1];
      const replacement = await call(loser, "genre-offer");
      assert.equal(replacement.genres.length, 5);
      assert.ok(!replacement.genres.some((g) => g.id === shared));
      const retained = first.genres
        .filter((g) => g.id !== shared)
        .map((g) => g.id);
      assert.deepEqual(
        replacement.genres.slice(0, 4).map((g) => g.id),
        retained,
      );
      await Promise.all([
        call(loser, "genre", {
          genreId: replacement.genres[0].id,
          version: -1,
        }),
        call(loser, "genre", {
          genreId: replacement.genres[1].id,
          version: -1,
        }),
      ]);
      const saved = (await dayOneSnapshot(loser)).records[0];
      await call(loser, "genre", { genreId: "anything", version: -10 });
      assert.deepEqual(
        (await dayOneSnapshot(loser)).records[0].researchAssignment,
        saved.researchAssignment,
      );
      const secondGroup = await models.ResearchSelection.findOne({
        teamId: "research-2",
      }).lean();
      await models.ResearchSelection.updateOne(
        { _id: secondGroup._id },
        {
          $push: {
            offers: { playerId: "r6", genreIds: first.genres.map((g) => g.id) },
          },
        },
      );
      await call(gamers[5], "genre", { genreId: shared });
      for (const gamer of gamers.slice(2)) {
        const offer = await call(gamer, "genre-offer");
        if (!offer.assignment)
          await call(gamer, "genre", { genreId: offer.genres[0].id });
      }
      const allGroups = await models.ResearchSelection.find().lean();
      for (const row of allGroups) {
        assert.equal(row.assignments.length, 5);
        assert.equal(new Set(row.assignments.map((a) => a.genreId)).size, 5);
      }
      // An additional round/group can reuse the same genre without affecting the first group.
      const other = allGroups.find((g) => g.teamId === "research-2");
      assert.equal(
        other.assignments.find((a) => a.playerId === "r6").genreId,
        shared,
      );
      const own = await dayOneSnapshot(gamers[0]);
      const record = own.records[0];
      assert.equal(record.config.genres.length, 1);
      assert.equal(own.config.genres.length, 0);
      assert.equal(record.researchAssignment.questionId, record.genreId);
      assert.ok(!JSON.stringify(own).includes('"researchGroups"'));
      for (const q of bank
        .flatMap((g) => g.questions)
        .filter((q) => q.id !== record.genreId))
        assert.ok(!JSON.stringify(own).includes(q.prompt));
      assert.equal((await dayOneSnapshot(mc)).records.length, 25);
      assert.equal(
        (await models.User.findById("r1")).teamId,
        "unrelated-final-team",
      );
      await models.User.updateOne({ _id: "r1" }, { $set: { active: false } });
      await assert.rejects(
        call(gamers[0], "genre-offer"),
        (e) => e.status === 404,
      );
      await models.User.updateOne({ _id: "r1" }, { $set: { active: true } });
      await call(gamers[0], "acknowledge");
      await call(gamers[0], "start");
      await call(gamers[0], "submit", {
        url: "https://chat.example/share/research-one",
      });
      const submitted = await models.DayOneRecord.findById("alpha:r1").lean();
      await call(cc, "verify", {
        userId: "r1",
        revisionId: submitted.data.submissions[0].id,
        status: "VERIFIED",
        reason:
          "Reviewed the complete accessible research thread and evidence.",
      });
      await assert.rejects(
        call(cc, "release", { config, revision: 1 }),
        (e) => e.status === 409,
      );
      await control("close", 1, new Date(config.closingCutoff));
      const original = (await models.DayOneSetup.findById("alpha")).released;
      for (const day of [2, 3, 4, 5]) {
        const pack = programFixture(day);
        if (day === 5)
          pack.activities[0].variants = original.genres.map((g) => ({
            id: g.id,
            name: g.name,
            brief: g.question,
            reference:
              "Fixture reference requiring independent sources and valid alternative conclusions.",
          }));
        assert.equal(
          validateDayContent(day, pack, original).activities.length,
          2,
        );
        await programAction(cc, "prepare-day", { day, content: pack }, time);
        await control("open", day, new Date(pack.officialStart));
        if (day < 5) await control("close", day, new Date(pack.closingCutoff));
      }
      const friday = new Date("2026-11-06T03:35:00Z");
      await programAction(
        gamers[0],
        "attempt-start",
        { day: 5, activityId: "D5-F01" },
        friday,
      );
      await programAction(cc, "prepare-comparison", {}, friday);
      for (const id of ["D5-F01", "D1-C01"]) {
        const attempt = await models.WeekOneAttempt.findById(
          `alpha:r1:${id}`,
        ).lean();
        assert.equal(attempt.data.variant.id, record.genreId);
        assert.equal(
          attempt.data.variant.brief,
          record.researchAssignment.question.prompt,
        );
      }
      const fridayView = JSON.stringify(
        await programSnapshot(gamers[0], friday),
      );
      for (const q of bank
        .flatMap((g) => g.questions)
        .filter((q) => q.id !== record.genreId))
        assert.ok(!fridayView.includes(q.prompt));
      await assert.rejects(
        call(gamers[0], "genre-offer", {}, friday),
        (e) => e.status === 409,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
