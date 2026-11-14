import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models } from "../lib/db.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { newLevelOne } from "../lib/level-one-rules.js";
import { enableCompletionProgression } from "../lib/flight-progression-admin.js";
import { programAction, programSnapshot } from "../lib/week-one-program.js";
import { dayOneAction } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { attendanceAction, attendanceSnapshot } from "../lib/attendance.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

test(
  "completion-based flight: personal unlocks, no release or calendar gate, complete evidence, protected content and saved progress",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `completion_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const p = {
      _id: "auto-p",
      name: "Player",
      email: "auto-p@example.invalid",
      role: "GAMER",
      cohortId: "alpha",
      trophies: 15,
      xp: 75,
    };
    const q = {
      ...p,
      _id: "auto-q",
      email: "auto-q@example.invalid",
      trophies: 0,
      xp: 0,
    };
    const r = { ...q, _id: "auto-r", email: "auto-r@example.invalid" };
    const cc = {
      _id: "auto-cc",
      name: "CC",
      email: "auto-cc@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const config = { ...fixtureConfig(), version: 1 };
    const now = new Date(config.officialStart);
    try {
      await models.User.insertMany([p, q, r, cc]);
      await models.Cohort.create({
        _id: "alpha",
        name: "Completion",
        college: "Test",
        startDate: config.day,
        currentWeek: 1,
      });
      await models.WeekOneProgram.create({
        _id: "alpha",
        version: 0,
        data: blankProgram(),
      });
      await models.WeekOneRelease.create({
        _id: "alpha",
        days: [1, 2, 3, 4, 5].map((day) => ({
          day,
          title: `Level ${day}`,
          state: day === 1 ? "PREPARED" : "DRAFT",
          ...(day === 1
            ? {
                content: config,
                officialStart: config.officialStart,
                scheduledEnd: config.closingCutoff,
              }
            : {}),
        })),
      });
      await models.DayOneSetup.create({
        _id: "alpha",
        released: config,
        draft: config,
      });
      await models.DayOneRecord.create({
        _id: `alpha:${p._id}`,
        cohortId: "alpha",
        userId: p._id,
        version: 0,
        data: {
          config,
          genreId: config.genres[0].id,
          clockAt: config.officialStart,
          submissions: [
            {
              id: "original",
              url: "https://example.org/original",
              at: config.officialStart,
            },
          ],
          ledger: [],
          levelOne: {
            ...newLevelOne(),
            creditedTrophies: 15,
            automatic: { completed: true, stars: 1 },
          },
        },
      });
      await enableCompletionProgression("alpha", now);
      let snapshot = await programSnapshot(p, now);
      assert.equal(snapshot.progression.levels[1].open, true);
      assert.equal(
        (await programSnapshot(q, now)).progression.levels[1].available,
        false,
      );
      assert.ok(!JSON.stringify(snapshot).includes('"correct":'));
      assert.ok(!JSON.stringify(snapshot).includes('"reference":'));
      assert.equal(
        snapshot.days.some((d) => d.day === 3),
        false,
      );
      await assert.rejects(
        weekOneAction(
          cc,
          "open",
          { day: 2, revision: (await weekOneSnapshot(cc)).revision },
          now,
        ),
        (e) => e.status === 409,
      );
      const start = (actor, day, a) =>
        programAction(
          actor,
          "attempt-start",
          { day, activityId: a.id, variantId: a.variants?.[0]?.id },
          now,
        );
      const record = (id) => models.WeekOneAttempt.findById(id).lean();
      const release = await models.WeekOneRelease.findById("alpha").lean();
      await assert.rejects(
        start(q, 2, release.days[1].content.activities[0]),
        (e) => e.status === 403,
      );
      await assert.rejects(
        start(p, 3, release.days[2].content.activities[0]),
        (e) => e.status === 403,
      );
      await programAction(cc, "complete-class", { day: 2, session: 1 }, now);
      await programAction(
        cc,
        "publish-recap",
        {
          day: 2,
          session: 1,
          text: "Investigate the supplied clues, compare alternatives and preserve evidence.",
        },
        now,
      );
      await weekOneAction(
        cc,
        "publish-agenda",
        {
          day: 2,
          revision: (await weekOneSnapshot(cc)).revision,
          text: "Complete both exploration missions and keep your research evidence.",
        },
        now,
      );
      assert.equal(
        (await models.WeekOneRelease.findById("alpha").lean()).days[1].recaps
          .length,
        1,
      );
      for (const day of [2, 3, 4, 5]) {
        for (const activity of release.days[day - 1].content.activities) {
          const started = await start(p, day, activity);
          let attempt = await record(started.attemptId);
          const answers =
            activity.kind === "QUIZ"
              ? Object.fromEntries(activity.questions.map((q) => [q.id, 0]))
              : Object.fromEntries(
                  activity.fields.map((key) => [
                    key,
                    key === "sequence"
                      ? attempt.data.variant.cards
                      : key === "url"
                        ? "https://example.org/fresh-research"
                        : "My investigation compares the supplied clues, checks alternative explanations and records uncertainty with evidence.",
                  ]),
                );
          await programAction(
            p,
            "attempt-save",
            {
              attemptId: attempt._id,
              attemptVersion: attempt.version,
              answers,
            },
            now,
          );
          assert.equal(
            (await programSnapshot(p, now)).progression.levels[day - 1]
              .completed,
            false,
          );
          attempt = await record(attempt._id);
          if (day === 2 && activity.id === "D2-G02") {
            const incomplete = { ...answers, cause: "" };
            await programAction(
              p,
              "attempt-submit",
              {
                attemptId: attempt._id,
                attemptVersion: attempt.version,
                answers: incomplete,
              },
              now,
            );
            assert.equal(
              (await programSnapshot(p, now)).progression.levels[2].available,
              false,
            );
            attempt = await record(attempt._id);
          }
          await programAction(
            p,
            "attempt-submit",
            {
              attemptId: attempt._id,
              attemptVersion: attempt.version,
              answers,
            },
            now,
          );
        }
        snapshot = await programSnapshot(p, now);
        assert.equal(snapshot.progression.levels[day - 1].completed, true);
        if (day < 5) assert.equal(snapshot.progression.levels[day].open, true);
      }
      assert.equal(
        (await models.WeekOneRelease.findById("alpha").lean()).days[1].state,
        "PREPARED",
        "one player's progress does not open or close the cohort's level",
      );
      assert.equal(
        (await programSnapshot(q, now)).progression.levels[1].available,
        false,
      );
      await assert.rejects(
        programAction(
          cc,
          "prepare-day",
          { day: 2, content: release.days[1].content },
          now,
        ),
        (e) => e.status === 409,
      );
      const later = new Date(now.getTime() + 3 * 86400000);
      assert.equal((await attendanceSnapshot(r, later)).available, true);
      await attendanceAction(r, "clock-in", {}, later);
      assert.equal(
        (await models.DayOneRecord.findOne({ userId: r._id }).lean()).data
          .clockAt,
        later.toISOString(),
      );
      assert.equal(
        await models.Attendance.countDocuments({ userId: r._id }),
        1,
      );
      const first = await models.DayOneRecord.findOne({ userId: p._id }).lean();
      await dayOneAction(
        cc,
        "level-result",
        {
          userId: p._id,
          members: [p._id],
          versions: { [p._id]: first.version },
          operation: "reopen",
          reason: "Review found an incomplete original research submission",
        },
        now,
      );
      assert.equal(
        (await programSnapshot(p, now)).progression.levels[1].available,
        false,
      );
      await assert.rejects(
        programAction(
          p,
          "attempt-submit",
          { attemptId: `alpha:${p._id}:D2-G01`, answers: {} },
          now,
        ),
        (e) => e.status === 403,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
