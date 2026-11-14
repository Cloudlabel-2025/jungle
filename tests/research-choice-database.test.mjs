import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { programAction } from "../lib/week-one-program.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import {
  programFixture,
  settingsFixture,
  publishFixtureRules,
} from "./week-one-program-fixture.mjs";
import { bank } from "../lib/research-bank.js";
test(
  "MongoDB choice game: 25 learners, reserved genres, chosen question locks, privacy, retries and exact Friday reuse",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `research_choice_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const players = Array.from({ length: 25 }, (_, i) => ({
      _id: `choice-${i}`,
      name: `Choice learner ${i}`,
      email: `choice-${i}@example.invalid`,
      role: "GAMER",
      cohortId: "alpha",
    }));
    const cc = {
      _id: "choice-cc",
      name: "Choice CC",
      email: "choice-cc@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const now = new Date("2026-11-02T03:35:00Z");
    const call = (u, action, body = {}, at = now) =>
      dayOneAction(u, action, body, at, {
        sharedChatReader: async () => ({
          ok: false,
          code: "READ_TIMEOUT",
          message:
            "Synthetic provider unavailable; retry without losing your submission.",
        }),
      });
    const control = async (action, day, at) =>
      weekOneAction(
        cc,
        action,
        { day, revision: (await weekOneSnapshot(cc)).revision },
        at,
      );
    try {
      await models.User.insertMany([...players, cc]);
      const config = {
        ...fixtureConfig(),
        selectionMode: "research-2026-11-12",
        bankApproval:
          "Fixture approval of all 51 bank prompts including draft genres.",
        researchGroups: Array.from({ length: 5 }, (_, i) => ({
          members: players.slice(i * 5, i * 5 + 5).map((p) => p._id),
        })),
      };
      await call(cc, "release", { config, revision: 0 });
      await publishFixtureRules(cc, now);
      await programAction(
        cc,
        "operations",
        {
          compassQuestions: settingsFixture().compassQuestions,
          reason:
            "Approved fixture operational inputs for Friday reference validation.",
        },
        now,
      );
      await control("open", 1, now);
      for (const player of players) await call(player, "clock");
      const initialLevel = await models.DayOneRecord.findOne({
        userId: players[0]._id,
      }).lean();
      assert.equal(initialLevel.data.levelOne.rulesVersion, "level-one-v1");
      assert.equal(initialLevel.data.levelOne.creditedTrophies, 0);
      const first = await call(players[0], "genre-offer");
      assert.equal(first.genres.length, 7);
      const hidden = bank.find((g) => !first.genres.some((o) => o.id === g.id));
      await assert.rejects(
        call(players[0], "question", { questionId: hidden.questions[0].id }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        call(players[0], "genre", { genreId: hidden.id }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        call(players[0], "genre", {
          genreId: first.genres[0].id,
          userId: players[1]._id,
        }),
        (e) => e.status === 400,
      );
      await call(players[1], "genre-offer");
      const group = await models.ResearchSelection.findOne({
        teamId: "research-1",
      }).lean();
      const overlapping = group.offers.map((o) =>
        o.playerId === players[1]._id
          ? { ...o, genreIds: first.genres.map((g) => g.id) }
          : o,
      );
      await models.ResearchSelection.updateOne(
        { _id: group._id },
        { $set: { offers: overlapping } },
      );
      const collision = await Promise.allSettled([
        call(players[0], "genre", { genreId: first.genres[0].id }),
        call(players[1], "genre", { genreId: first.genres[0].id }),
      ]);
      assert.equal(collision.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        collision.find((r) => r.status === "rejected").reason.status,
        409,
      );
      const winner =
        collision[0].status === "fulfilled" ? players[0] : players[1];
      const held = await call(winner, "genre-offer");
      assert.equal(held.selection.questions.length, 3);
      assert.equal(held.assignment, null);
      const pending = (await dayOneSnapshot(winner)).records[0];
      assert.equal(pending.genreId, undefined);
      assert.equal(pending.startedAt, undefined);
      assert.equal(pending.researchSelection.genreId, held.selection.genreId);
      for (const q of bank.flatMap((g) => g.questions))
        assert.ok(!JSON.stringify(pending).includes(q.prompt));
      await assert.rejects(
        call(winner, "acknowledge"),
        (e) => e.status === 400,
      );
      await assert.rejects(call(winner, "start"), (e) => e.status === 400);
      await assert.rejects(
        call(winner, "genre", { genreId: hidden.id }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        call(winner, "question", { questionId: hidden.questions[0].id }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        call(winner, "question", {
          questionId: held.selection.questions[0].id,
          roundId: "forged",
        }),
        (e) => e.status === 400,
      );
      const competing = await Promise.allSettled(
        held.selection.questions
          .slice(0, 2)
          .map((q) =>
            call(winner, "question", { questionId: q.id, version: -1 }),
          ),
      );
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        competing.find((r) => r.status === "rejected").reason.status,
        409,
      );
      const selected = (await dayOneSnapshot(winner)).records[0];
      const question = selected.researchAssignment.question;
      assert.equal(selected.genreId, question.id);
      assert.equal(selected.config.genres.length, 1);
      const eventsBefore = await models.DayOneEvent.countDocuments({
        userId: winner._id,
      });
      await call(winner, "question", { questionId: question.id, version: -10 });
      assert.equal(
        await models.DayOneEvent.countDocuments({ userId: winner._id }),
        eventsBefore,
      );
      const wrong = held.selection.questions.find((q) => q.id !== question.id);
      await assert.rejects(
        call(winner, "question", { questionId: wrong.id }),
        (e) => e.status === 409,
      );
      for (const q of bank
        .flatMap((g) => g.questions)
        .filter((q) => q.id !== question.id))
        assert.ok(!JSON.stringify(selected).includes(q.prompt));
      const current = await call(winner, "genre-offer");
      assert.equal(current.selection, undefined);
      assert.equal(current.assignment.questionId, question.id);
      for (const player of players) {
        const offer = await call(player, "genre-offer");
        if (offer.assignment) continue;
        const claim = offer.selection
          ? offer
          : await call(player, "genre", { genreId: offer.genres[0].id });
        await call(player, "question", {
          questionId: claim.selection.questions[2].id,
        });
      }
      for (const row of await models.ResearchSelection.find().lean()) {
        assert.equal(row.questionSelection, "PLAYER_CHOICE");
        assert.equal(row.assignments.length, 5);
        assert.equal(new Set(row.assignments.map((a) => a.genreId)).size, 5);
        assert.ok(row.assignments.every((a) => a.questionId));
      }
      await call(winner, "acknowledge");
      await call(winner, "start");
      await call(winner, "submit", {
        url: "https://chat.example/share/chosen-research",
      });
      const evidence = await models.DayOneRecord.findOne({
        userId: winner._id,
      }).lean();
      await call(cc, "verify", {
        userId: winner._id,
        revisionId: evidence.data.submissions[0].id,
        status: "VERIFIED",
        reason: "Reviewed access and genuine evidence for the chosen question.",
      });
      await control("close", 1, new Date(config.closingCutoff));
      await assert.rejects(
        call(winner, "question", { questionId: question.id }),
        (e) => e.status === 409,
      );
      const original = (await models.DayOneSetup.findById("alpha")).released;
      for (const day of [2, 3, 4, 5]) {
        const pack = programFixture(day);
        if (day === 5)
          pack.activities[0].variants = original.genres.map((g) => ({
            id: g.id,
            name: g.name,
            brief: g.question,
            reference:
              "Fixture reviewed reference with evidence and defensible alternatives.",
          }));
        await programAction(cc, "prepare-day", { day, content: pack }, now);
        await control("open", day, new Date(pack.officialStart));
        if (day < 5) await control("close", day, new Date(pack.closingCutoff));
      }
      const friday = new Date("2026-11-06T03:35:00Z");
      await programAction(
        winner,
        "attempt-start",
        { day: 5, activityId: "D5-F01" },
        friday,
      );
      await programAction(cc, "prepare-comparison", {}, friday);
      for (const id of ["D5-F01", "D1-C01"]) {
        const attempt = await models.WeekOneAttempt.findById(
          `alpha:${winner._id}:${id}`,
        ).lean();
        assert.equal(attempt.data.variant.id, question.id);
        assert.equal(attempt.data.variant.brief, question.prompt);
      }
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
