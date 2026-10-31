import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { programAction, programSnapshot } from "../lib/week-one-program.js";
import { programAudit } from "../lib/week-one-program.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import {
  programFixture,
  settingsFixture,
} from "./week-one-program-fixture.mjs";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { checkPassword } from "../lib/password.js";

test(
  "complete 25-Gamer Week 1: releases, privacy, Rules, queries, games, AI batches, Showcase, readiness, publication and rescue",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 240000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/week1_program_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const gamers = Array.from({ length: 25 }, (_, i) => ({
      _id: `g${String(i).padStart(2, "0")}`,
      cohortId: "alpha",
      name: `Learner ${i + 1}`,
      email: `g${i}@example.invalid`,
      role: "GAMER",
    }));
    const cc = {
        _id: "cc",
        cohortId: "alpha",
        name: "Centre Lead",
        email: "cc@example.invalid",
        role: "CENTRE_COMMAND",
      },
      mc = {
        ...cc,
        _id: "mc",
        name: "Mission Lead",
        email: "mc@example.invalid",
        role: "MISSION_COMMANDER",
      };
    const base = Date.parse(fixtureConfig().officialStart),
      at = (day, minutes = 0) =>
        new Date(base + (day - 1) * 86400000 + minutes * 60000);
    const call = (user, action, body = {}, day = 1, minutes = 0) =>
      programAction(user, action, body, at(day, minutes));
    const d1 = (user, action, body = {}, minutes = 0) =>
      dayOneAction(user, action, body, at(1, minutes));
    const control = async (action, day, minutes, body = {}) =>
      weekOneAction(
        mc,
        action,
        { day, revision: (await weekOneSnapshot(mc)).revision, ...body },
        at(day, minutes),
      );
    try {
      await models.User.insertMany([
        ...gamers,
        cc,
        mc,
        {
          ...gamers[0],
          _id: "outside",
          cohortId: "other",
          email: "outside@example.invalid",
        },
      ]);
      await models.Cohort.create({
        _id: "alpha",
        name: "Week 1 test cohort",
        college: "Test college",
        startDate: "2026-11-02",
        currentWeek: 1,
      });
      await assert.rejects(
        call(gamers[0], "settings", { settings: settingsFixture() }),
        (e) => e.status === 403,
      );
      await call(
        cc,
        "settings",
        { settings: settingsFixture(), version: 0 },
        1,
        -60,
      );
      const accounts = gamers.map((g) => ({
        name: g.name,
        email: g.email,
        username: `week1-${g._id}`,
        password: "FixturePassword1!",
      }));
      const commander = {
        name: mc.name,
        email: mc.email,
        username: "week1-mc",
        password: "FixturePassword1!",
      };
      await call(cc, "provision", { accounts, commander }, 1, -59);
      const credential = await models.Credential.findById(gamers[0]._id).lean();
      assert.equal(
        await checkPassword("FixturePassword1!", credential.passwordHash),
        true,
      );
      assert.ok(!credential.passwordHash.includes("FixturePassword"));
      await assert.rejects(
        call(cc, "provision", { accounts, commander }, 1, -58),
        (e) => e.status === 409,
      );
      await d1(cc, "release", { config: fixtureConfig(), revision: 0 }, -30);
      await call(
        cc,
        "prepare-day",
        { day: 2, content: programFixture(2) },
        1,
        -20,
      );
      const locked = await programSnapshot(gamers[0], at(1, -10));
      assert.equal(locked.days.length, 0);
      assert.ok(!JSON.stringify(locked).includes("Fixture-only official"));
      await control("open", 1, -15);
      await assert.rejects(
        call(cc, "settings", { settings: settingsFixture() }),
        (e) => e.status === 409,
      );
      await call(cc, "publish-rules", {
        text: "Approved fixture Rules: preserve evidence, respect peers, and ask MC for clarification when needed.",
        reason: "Initial institution-approved Rules version for the cohort.",
      });
      await call(mc, "showcase-groups", {
        groups: Array.from({ length: 5 }, (_, i) => ({
          members: gamers.slice(i * 5, i * 5 + 5).map((g) => g._id),
        })),
      });
      await control("publish-agenda", 1, 0, {
        text: "Research independently, attend orientation, take part in Showcase and reflect.",
      });
      for (let i = 0; i < gamers.length; i++) {
        const g = gamers[i];
        await d1(g, "clock", {}, -1);
        await d1(g, "agenda-view", {}, 1);
        await d1(g, "agenda-ack", {}, 2);
        await d1(
          g,
          "sod",
          { text: "I will investigate and verify independent sources." },
          3,
        );
        await d1(g, "genre", { genreId: `genre-${(i % 4) + 1}` }, 4);
        await d1(g, "acknowledge", {}, 5);
        await d1(g, "start", {}, 6);
        await d1(
          g,
          "submit",
          { url: `https://chat.example/share/original-${g._id}` },
          60,
        );
        const r = await models.DayOneRecord.findOne({ userId: g._id }).lean();
        await d1(
          cc,
          "verify",
          {
            userId: g._id,
            revisionId: r.data.submissions[0].id,
            status: "VERIFIED",
            reason:
              "Fixture reviewer opened and verified accessible original evidence.",
          },
          70,
        );
        await d1(
          cc,
          "assessment",
          {
            userId: g._id,
            ai: Array(5).fill(4),
            human: Array(5).fill(4),
            notes:
              "Fixture independent AI and human evidence review supports all ratings.",
          },
          71,
        );
        await d1(cc, "approve", { userId: g._id }, 72);
        await call(g, "rules-ack", { ruleVersion: 1, understood: true }, 1, 73);
        await d1(
          g,
          "eod",
          {
            text: "I investigated, compared sources, verified claims, and planned a different next investigation.",
          },
          450,
        );
      }
      await call(
        gamers[0],
        "ask",
        { category: "CLASS", text: "How do we compare conflicting sources?" },
        1,
        100,
      );
      await call(
        gamers[0],
        "ask",
        { category: "CLASS", text: "How can I verify the explanation?" },
        1,
        101,
      );
      await assert.rejects(
        call(
          gamers[0],
          "ask",
          { category: "CLASS", text: "This exceeds the daily regular quota." },
          1,
          102,
        ),
        (e) => e.status === 409,
      );
      await call(
        gamers[0],
        "ask",
        {
          category: "RULES",
          text: "Please clarify the evidence sharing rule.",
        },
        1,
        103,
      );
      const ruleTicket = await models.WeekOneTicket.findOne({
        category: "RULES",
      }).lean();
      await call(
        mc,
        "escalate",
        {
          ticketId: ruleTicket._id,
          reason:
            "Centre Command should clarify this material rule obligation.",
        },
        1,
        104,
      );
      await call(
        cc,
        "reply",
        {
          ticketId: ruleTicket._id,
          text: "Use the approved sharing policy and an anonymous safe summary.",
          resolve: true,
        },
        1,
        105,
      );
      assert.equal(
        (await programSnapshot(gamers[1], at(1, 106))).tickets.length,
        0,
      );
      await call(
        cc,
        "publish-challenge",
        {
          kind: "WEEKLY",
          title: "Fixture weekly discovery",
          brief:
            "Test-only optional adventure research, available until Week 6 with genuine evidence.",
          reward: "Institution-approved fixture research recognition.",
        },
        1,
        110,
      );
      await assert.rejects(
        call(
          cc,
          "publish-challenge",
          { kind: "WEEKLY", title: "Duplicate weekly challenge" },
          1,
          111,
        ),
        (e) => e.status === 409,
      );

      async function show(day) {
        for (let i = 0; i < 5; i++) {
          const groupId = `presentation-${i + 1}`,
            presenter = gamers[i * 5 + day - 1],
            alternate = day < 5 ? gamers[i * 5 + day] : null;
          const source =
            day === 1
              ? "D1-R01"
              : day === 5
                ? i < 3
                  ? "D4-G02"
                  : "D5-F01"
                : `D${day}-G0${i < 3 ? 2 : 1}`;
          for (const g of [presenter, alternate].filter(Boolean)) {
            await call(
              g,
              "share-consent",
              { activityId: source, allowed: true },
              day,
              380,
            );
            await call(
              mc,
              "share-work",
              {
                day,
                groupId,
                userId: g._id,
                activityId: source,
                summary:
                  "Approved anonymous fixture research: evidence was compared, alternatives were tested, and limitations were explained.",
              },
              day,
              381,
            );
          }
          let round = (
            await models.WeekOneProgram.findById("alpha").lean()
          ).data.rounds.find((r) => r.day === day && r.groupId === groupId);
          await call(
            mc,
            "open-vote",
            { day, groupId, voteEndsAt: at(day, 390).toISOString() },
            day,
            382,
          );
          if (day === 1 && i === 0) {
            await call(mc, "close-vote", { day, groupId }, day, 391);
            assert.equal(
              (
                await models.WeekOneProgram.findById("alpha").lean()
              ).data.rounds.find((r) => r.id === round.id).state,
              "REVOTE_REQUIRED",
            );
            await call(
              mc,
              "open-vote",
              { day, groupId, voteEndsAt: at(day, 400).toISOString() },
              day,
              392,
            );
          }
          const voter = gamers[i * 5 + ((day === 5 ? 0 : day + 1) % 5)];
          const voteOffset = day === 1 && i === 0 ? 12 : 0;
          await assert.rejects(
            call(
              presenter,
              "vote",
              { day, groupId, candidateId: round.candidates[0].id },
              day,
              383 + voteOffset,
            ),
          );
          for (const c of round.candidates)
            await call(
              voter,
              "showcase-read",
              { day, groupId, candidateId: c.id },
              day,
              384 + voteOffset,
            );
          await call(
            voter,
            "vote",
            { day, groupId, candidateId: round.candidates[0].id },
            day,
            385 + voteOffset,
          );
          await assert.rejects(
            call(
              voter,
              "vote",
              { day, groupId, candidateId: round.candidates[0].id },
              day,
              386 + voteOffset,
            ),
            (e) => e.status === 409,
          );
          const publicRound = (
            await programSnapshot(voter, at(day, 386 + voteOffset))
          ).rounds.find((r) => r.id === round.id);
          assert.equal(publicRound.ballots, undefined);
          assert.equal(publicRound.participation, undefined);
          assert.equal(publicRound.candidates[0].userId, undefined);
          await call(
            mc,
            "close-vote",
            { day, groupId },
            day,
            day === 1 && i === 0 ? 401 : 391,
          );
          await call(
            voter,
            "showcase-question",
            {
              day,
              groupId,
              text: "Which independent check most changed your conclusion?",
            },
            day,
            392 + voteOffset,
          );
          round = (
            await models.WeekOneProgram.findById("alpha").lean()
          ).data.rounds.find((r) => r.id === round.id);
          await call(
            mc,
            "approve-question",
            {
              day,
              groupId,
              questionId: round.questions[0].id,
              safeText: "Which check most changed your conclusion?",
              askedBy: "MC",
            },
            day,
            393 + voteOffset,
          );
          await call(
            mc,
            "score-showcase",
            {
              day,
              groupId,
              understanding: 4,
              reasoning: 4,
              clarity: 2,
              reason:
                "Fixture presenter defended their own research and answered verified questions clearly.",
            },
            day,
            394 + voteOffset,
          );
        }
      }
      await show(1);
      await control("close", 1, 480);
      await d1(
        cc,
        "select-champion",
        {
          userId: gamers[0]._id,
          reason:
            "All original baselines tied; documented independent verification evidence supports this selection.",
        },
        481,
      );
      await assert.rejects(
        d1(
          cc,
          "reveal-champion",
          { reason: "Attempt to reveal before final signoff and approval." },
          482,
        ),
        (e) => e.status === 409,
      );

      let exampleSelections = [];
      async function mark(activityId, day) {
        if (activityId === "D1-C01")
          await call(mc, "prepare-comparison", {}, day, 310);
        const attempts = await models.WeekOneAttempt.find({
          activityId,
          cohortId: "alpha",
        }).lean();
        assert.equal(attempts.length, 25);
        for (const a of attempts)
          await call(
            mc,
            "approve-export",
            {
              attemptId: a._id,
              evidence:
                "Fixture complete de-identified response covering every requested field, including evidence, verification, alternatives and limits.",
              reason:
                "A human checked source completeness, access and removal of personal identifiers.",
            },
            day,
            311,
          );
        const { report } = await call(
          mc,
          "export-assessment",
          { activityId },
          day,
          312,
        );
        assert.equal(report.submissions.length, 25);
        assert.equal(report.references.length, 4);
        assert.ok(!JSON.stringify(report).includes("Learner 1"));
        assert.ok(!JSON.stringify(report).includes("@example.invalid"));
        const mappings = (
          await models.WeekOneBatch.findById(report.batchId).lean()
        ).data.mappings;
        const imported = {
          batchId: report.batchId,
          fingerprint: report.fingerprint,
          rubricVersion: report.rubricVersion,
          results: mappings.map((m) => ({
            anonymousId: m.anonymousId,
            ratings: Object.fromEntries(
              report.criteria.map((c) => [
                c.key,
                m.userId === gamers[0]._id
                  ? 4
                  : activityId === "D5-F01" && m.userId === gamers[24]._id
                    ? 0
                    : 3,
              ]),
            ),
            unreliable: false,
          })),
        };
        if (activityId === "D2-G01") {
          await assert.rejects(
            call(
              mc,
              "import-assessment",
              { result: { ...imported, results: imported.results.slice(1) } },
              day,
              313,
            ),
          );
          await assert.rejects(
            call(
              mc,
              "import-assessment",
              {
                result: {
                  ...imported,
                  results: [...imported.results.slice(1), imported.results[1]],
                },
              },
              day,
              313,
            ),
          );
          const bad = structuredClone(imported);
          bad.results[0].ratings.framing = 5;
          await assert.rejects(
            call(mc, "import-assessment", { result: bad }, day, 313),
          );
          imported.learningExamples = imported.results.slice(0, 3).map((r) => ({
            anonymousId: r.anonymousId,
            rationale:
              "Fixture external-AI selected this verified reasoning example.",
          }));
          exampleSelections = imported.learningExamples.map((e) => ({
            batchId: report.batchId,
            anonymousId: e.anonymousId,
            reason:
              "CC-approved anonymous example of evidence-based investigation and a defensible alternative.",
          }));
        }
        await call(mc, "import-assessment", { result: imported }, day, 314);
        for (const a of await models.WeekOneAttempt.find({
          activityId,
          "data.result.status": "HUMAN_REVIEW",
        }).lean())
          await call(
            mc,
            "review-assessment",
            {
              attemptId: a._id,
              ratings: a.data.result.ratings,
              reason:
                "Human independently verified the boundary AI score against the complete evidence and reference.",
            },
            day,
            315,
          );
        await assert.rejects(
          call(mc, "import-assessment", { result: imported }, day, 316),
          (e) => e.status === 409,
        );
        const personal = await programSnapshot(gamers[0], at(day, 317));
        assert.equal(personal.results.length, 0);
        assert.equal(personal.learners[0].data.showcase, undefined);
        assert.ok(
          personal.attempts.every((a) => a.data.result?.percent === undefined),
        );
      }
      for (const day of [2, 3, 4, 5]) {
        if (day > 2)
          await call(
            cc,
            "prepare-day",
            { day, content: programFixture(day) },
            day,
            -25,
          );
        await control("open", day, -15);
        await control("publish-agenda", day, 0, {
          text: "Two classes, two individual assessments, Research Showcase, Discovery and EOD reflection.",
        });
        for (const session of [1, 2]) {
          await call(
            mc,
            "complete-class",
            { day, session },
            day,
            session === 1 ? 29 : 149,
          );
          await call(
            mc,
            "publish-recap",
            {
              day,
              session,
              text: `Fixture class ${session} recap covering Full Stack concepts and today's investigation method.`,
            },
            day,
            session === 1 ? 30 : 150,
          );
        }
        const pack = programFixture(day);
        for (const g of gamers) {
          await call(g, "clock", { day }, day, -1);
          await call(g, "agenda-view", { day }, day, 1);
          await call(g, "agenda-ack", { day }, day, 2);
          for (const session of [1, 2]) {
            await call(
              g,
              "recap-view",
              { day, session },
              day,
              session === 1 ? 30 : 150,
            );
            await call(
              g,
              "recap-ack",
              { day, session },
              day,
              session === 1 ? 31 : 151,
            );
          }
          for (let index = 0; index < 2; index++) {
            const a = pack.activities[index],
              start = index === 0 ? 60 : 180;
            await call(
              g,
              "attempt-start",
              { day, activityId: a.id, variantId: a.variants?.[0]?.id },
              day,
              start,
            );
            let record = await models.WeekOneAttempt.findOne({
              userId: g._id,
              activityId: a.id,
            }).lean();
            let answers =
              a.id === "D5-Q01"
                ? Object.fromEntries(a.questions.map((q) => [q.id, 0]))
                : Object.fromEntries(
                    record.data.activity.fields.map((key) => [
                      key,
                      key === "sequence"
                        ? [...record.data.variant.cards]
                        : key === "url"
                          ? `https://chat.example/share/fresh-${g._id}`
                          : `Fixture ${key}: evidence supports this interpretation with an explicit limitation.`,
                    ]),
                  );
            if (a.id === "D5-F01")
              await assert.rejects(
                call(
                  g,
                  "attempt-submit",
                  {
                    attemptId: record._id,
                    answers: {
                      ...answers,
                      url: `https://chat.example/share/original-${g._id}`,
                    },
                  },
                  day,
                  start + 5,
                ),
              );
            await call(
              g,
              "attempt-save",
              { attemptId: record._id, answers },
              day,
              start + 10,
            );
            if (day === 2 && index === 0 && g._id === gamers[1]._id) {
              const deadline = record.data.deadline;
              await call(
                g,
                "attempt-start",
                { day, activityId: a.id, variantId: a.variants[0].id },
                day,
                start + 15,
              );
              assert.equal(
                (await models.WeekOneAttempt.findById(record._id).lean()).data
                  .deadline,
                deadline,
              );
              await assert.rejects(
                call(
                  g,
                  "attempt-save",
                  { attemptId: record._id, answers },
                  day,
                  start + 61,
                ),
                (e) => e.status === 409,
              );
              await call(
                mc,
                "extend-attempt",
                {
                  attemptId: record._id,
                  deadline: at(day, start + 100).toISOString(),
                  reason:
                    "Authorised fixture extension preserves the original attempt and its saved evidence.",
                },
                day,
                start + 62,
              );
            }
            if (a.id === "D5-Q01" && g._id === gamers[24]._id) {
              await programSnapshot(g, at(day, start + 31));
              const sealed = await models.WeekOneAttempt.findById(
                record._id,
              ).lean();
              assert.equal(sealed.data.result.percent, 100);
              assert.equal(sealed.data.submissions[0].expired, true);
              await assert.rejects(
                call(
                  g,
                  "attempt-submit",
                  { attemptId: record._id, answers: {} },
                  day,
                  start + 32,
                ),
                (e) => e.status === 409,
              );
              continue;
            }
            await call(
              g,
              "attempt-submit",
              { attemptId: record._id, answers },
              day,
              start +
                (day === 2 && index === 0 && g._id === gamers[1]._id ? 63 : 20),
            );
            if (a.id === "D5-Q01")
              await assert.rejects(
                call(
                  g,
                  "attempt-submit",
                  { attemptId: record._id, answers },
                  day,
                  start + 21,
                ),
                (e) => e.status === 409,
              );
          }
          if (day < 5) {
            const challengeId = `D${day}-DISCOVERY`;
            await call(g, "start-challenge", { challengeId }, day, 240);
            const record = await models.WeekOneAttempt.findOne({
              userId: g._id,
              activityId: challengeId,
            }).lean();
            await call(
              g,
              "attempt-submit",
              {
                attemptId: record._id,
                answers: {
                  evidence:
                    "Fixture independent source checks and a genuine failed experiment are retained.",
                  outcome:
                    "The experiment failed; I documented why and what I would check next.",
                },
              },
              day,
              260,
            );
            await call(
              mc,
              "review-challenge",
              {
                attemptId: record._id,
                genuine: true,
                reason:
                  "Verified genuine research and recovery reasoning despite the honest experimental failure.",
              },
              day,
              270,
            );
          } else
            await call(
              g,
              "compass",
              {
                day: 5,
                answers: [
                  "Fixture progress",
                  "Fixture evidence",
                  "Fixture next steps",
                ],
              },
              day,
              450,
            );
          await call(
            g,
            "eod",
            {
              day,
              answers: Array(day === 5 ? 3 : 5).fill(
                "Fixture reflection explains my evidence and next investigation.",
              ),
            },
            day,
            450,
          );
        }
        for (const activity of pack.activities.filter((a) => a.id !== "D5-Q01"))
          await mark(activity.id, day);
        if (day === 5) await mark("D1-C01", day);
        await show(day);
        await control("close", day, 480);
      }
      await assert.rejects(
        call(
          cc,
          "signoff",
          { reason: "CC cannot impersonate the MC signoff role." },
          5,
          485,
        ),
        (e) => e.status === 403,
      );
      await assert.rejects(
        call(
          cc,
          "publish-results",
          { reason: "Publication without an MC signoff must be denied." },
          5,
          486,
        ),
        (e) => e.status === 409,
      );
      await call(
        mc,
        "propose-recognition",
        {
          awards: settingsFixture().awardDefinitions.map((a, i) => ({
            awardId: a.id,
            userId: gamers[i]._id,
            reason:
              "Fixture award nomination is supported by reviewed research and presentation evidence.",
          })),
          examples: exampleSelections,
          weekChampionId: gamers[0]._id,
          reason:
            "Highest verified readiness; original Champion tie was separately reviewed.",
        },
        5,
        487,
      );
      const before = await programSnapshot(mc, at(5, 488));
      assert.equal(before.results.length, 25);
      assert.equal(
        before.results.filter((r) => r.status === "RESCUE_PENDING").length,
        1,
      );
      assert.equal(
        before.results.find((r) => r.userId === gamers[0]._id).distinction,
        true,
      );
      await call(
        mc,
        "signoff",
        {
          reason:
            "Reviewed all components, boundary scores, professional deductions, Compass checks and 25 unique presentations.",
        },
        5,
        489,
      );
      await call(
        cc,
        "publish-results",
        {
          reason:
            "CC approves the MC signoff, locked results, 13 distinct awards, examples and provisional allocation.",
        },
        5,
        490,
      );
      const personal = await programSnapshot(gamers[0], at(5, 491)),
        rescue = await programSnapshot(gamers[24], at(5, 491));
      assert.equal(personal.results.length, 1);
      assert.equal(personal.results[0].userId, gamers[0]._id);
      assert.equal(personal.results[0].baseline.maximum, 33);
      assert.equal(personal.results[0].comparison.status, "READY");
      assert.equal(personal.publication.recognition.awards.length, 13);
      assert.equal(personal.publication.recognition.examples.length, 3);
      assert.equal(rescue.publication.rescue[0].status, "BOOKED");
      assert.equal(rescue.publication.teams.length, 0);
      assert.equal(personal.publication.rescue.length, 0);
      assert.equal(
        (await models.DayOneRecord.findOne({ userId: gamers[0]._id }).lean())
          .data.assessment.max,
        33,
      );
      const published = (await models.WeekOneProgram.findById("alpha").lean())
        .data.publications[0];
      assert.equal(published.teams.flatMap((t) => t.members).length, 24);
      assert.ok(
        published.teams.every((t) => !t.members.includes(gamers[24]._id)),
      );
      const boundary = await models.WeekOneAttempt.findOne({
        userId: gamers[0]._id,
        activityId: "D5-F01",
      }).lean();
      await assert.rejects(
        call(
          mc,
          "review-assessment",
          {
            attemptId: boundary._id,
            ratings: boundary.data.result.ratings,
            reason: "Locked marks must require a CC correction revision.",
          },
          5,
          492,
        ),
        (e) => e.status === 409,
      );
      await call(
        cc,
        "begin-correction",
        { reason: "Authorised fixture correction after an evidence review." },
        5,
        493,
      );
      await call(
        mc,
        "review-assessment",
        {
          attemptId: boundary._id,
          ratings: boundary.data.result.ratings,
          reason:
            "Reviewed the same source again; preserve the original publication and audit both decisions.",
        },
        5,
        494,
      );
      assert.equal(
        (await programSnapshot(gamers[0], at(5, 495))).results[0].total,
        personal.results[0].total,
      );
      assert.equal(
        (await models.WeekOneProgram.findById("alpha").lean()).data.publications
          .length,
        1,
      );
      await assert.rejects(programAudit(gamers[0]), (e) => e.status === 403);
      const firstAudit = await programAudit(cc);
      assert.equal(firstAudit.events.length, 50);
      assert.ok(firstAudit.nextCursor);
      const nextAudit = await programAudit(cc, {
        cursor: firstAudit.nextCursor,
      });
      assert.ok(
        nextAudit.events.every(
          (e) => !firstAudit.events.some((v) => v._id === e._id),
        ),
      );
      assert.equal(
        (await programAudit(cc, { kind: "CC_RESULTS_LOCKED_AND_PUBLISHED" }))
          .events.length,
        1,
      );
      assert.ok(
        !JSON.stringify(
          (await programAudit(cc, { kind: "COHORT_ACCOUNTS_PROVISIONED" }))
            .events,
        ).includes("FixturePassword"),
      );
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $set: { currentWeek: 2 } },
      );
      await call(
        gamers[24],
        "start-challenge",
        { challengeId: "W1-WEEKLY" },
        8,
        0,
      );
      const optional = await models.WeekOneAttempt.findOne({
        userId: gamers[24]._id,
        activityId: "W1-WEEKLY",
      }).lean();
      await call(
        gamers[24],
        "attempt-submit",
        {
          attemptId: optional._id,
          answers: {
            evidence:
              "Verified optional research continued after Friday, with independent supporting sources.",
            outcome:
              "A genuine optional challenge investigation with a documented result.",
          },
        },
        8,
        30,
      );
      await call(
        mc,
        "review-challenge",
        {
          attemptId: optional._id,
          genuine: true,
          reason:
            "Verified the optional research without changing locked Week 1 readiness.",
        },
        8,
        40,
      );
      assert.equal(
        (await programSnapshot(gamers[0], at(8, 45))).results[0].total,
        personal.results[0].total,
      );
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $set: { currentWeek: 7 } },
      );
      await assert.rejects(
        call(
          gamers[24],
          "start-challenge",
          { challengeId: "W1-WEEKLY" },
          43,
          0,
        ),
        (e) => e.status === 409,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
