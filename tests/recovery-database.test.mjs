import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { programAction, programSnapshot } from "../lib/week-one-program.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { recoveryProjection } from "../lib/recovery.js";
import { recoveryFixture } from "./recovery-fixture.mjs";
import { deliverCollegeNotices } from "../lib/week-one-notifications.js";

test(
  "Pack 3A full Friday-to-Saturday journey, privacy, exams, approvals, institution cases and team handoff",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/recovery_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    const gamers = Array.from({ length: 25 }, (_, i) => ({
      _id: `g${i}`,
      name: `Gamer ${i}`,
      email: `g${i}@example.invalid`,
      role: "GAMER",
      cohortId: "recovery",
    }));
    const cc = {
        _id: "cc",
        name: "CC",
        email: "cc@example.invalid",
        role: "CENTRE_COMMAND",
        cohortId: "recovery",
      },
      mc = { ...cc, _id: "mc", role: "MISSION_COMMANDER" };
    const start = Date.parse(recoveryFixture().start),
      time = (m) => new Date(start + m * 60000),
      why = {
        reason: "Verified fixture evidence and authorised test decision.",
      };
    const call = (user, action, body = {}, minute = -1000) =>
      programAction(user, action, { ...why, ...body }, time(minute));
    const data = async () =>
      (await models.WeekOneProgram.findById("recovery").lean()).data;
    const project = async (user, minute = 0) =>
      recoveryProjection(await data(), user, time(minute));
    try {
      await models.User.insertMany([
        ...gamers,
        cc,
        { ...mc, email: "mc@example.invalid" },
      ]);
      const p = blankProgram();
      p.settings.clearance = 70;
      p.locked = true;
      const rows = gamers.map((g, i) => ({
        userId: g._id,
        name: g.name,
        total: i === 22 ? 59.99 : i === 23 ? 58 : i === 24 ? 59 : 60 + i,
        status: i >= 22 ? "RESCUE_PENDING" : "CLEARED",
        configVersion: 1,
      }));
      const pub = {
        version: 1,
        results: rows,
        recognition: { awards: [], examples: [] },
        teams: [],
        rescue: [],
        at: time(-2000).toISOString(),
      };
      p.publications.push(pub);
      await models.WeekOneProgram.create({
        _id: "recovery",
        version: 0,
        data: p,
      });
      await assert.rejects(
        call(mc, "recovery-policy"),
        (e) => e.status === 403,
      );
      await call(cc, "recovery-policy");
      assert.equal((await data()).settings.clearance, 60);
      assert.ok((await data()).correction);
      assert.equal((await data()).publications[0].results[22].total, 59.99);
      await assert.rejects(
        call(cc, "recovery-invite"),
        (e) => e.status === 409,
      );
      // Friday signoff/publication is covered end-to-end by the Week 1 suite; seed its immutable revised output here.
      await models.WeekOneProgram.updateOne(
        { _id: "recovery" },
        {
          $set: { "data.correction": null },
          $push: {
            "data.publications": {
              ...pub,
              version: 2,
              results: rows.map((row) => ({
                ...row,
                configVersion: 2,
                status: row.total >= 60 ? "CLEARED" : "RESCUE_PENDING",
              })),
            },
          },
        },
      );
      const invalid = recoveryFixture();
      invalid.exams[0].variants[0].question = "";
      await call(mc, "recovery-save-config", { config: invalid });
      await assert.rejects(call(cc, "recovery-approve-config"));
      await call(mc, "recovery-save-config", { config: recoveryFixture() });
      await assert.rejects(
        call(mc, "recovery-approve-config"),
        (e) => e.status === 403,
      );
      await call(cc, "recovery-approve-config");
      await call(cc, "recovery-invite");
      await call(cc, "recovery-invite");
      assert.equal((await data()).recovery.participants.length, 3);
      await call(cc, "recovery-session-link", {
        meetingUrl: "https://example.invalid/corrected-session",
      });
      assert.equal(
        (await project(gamers[22])).config.meetingUrl,
        "https://example.invalid/corrected-session",
      );
      process.env.WEEK1_NOTIFICATION_WEBHOOK_URL =
        "https://example.invalid/mock-provider";
      process.env.WEEK1_COLLEGE_CONTACTS_JSON = JSON.stringify({
        recovery: [
          {
            name: "Authorised contact",
            email: "college@example.invalid",
            approval: "Institution-approved fixture recipient",
          },
        ],
      });
      const mockFetch = async (_url, options) => {
        const notice = JSON.parse(options.body);
        assert.equal(notice.type, "CODEWILD_SATURDAY_RECOVERY");
        assert.equal(
          Date.parse(notice.booking.end) - Date.parse(notice.booking.start),
          170 * 60000,
        );
        assert.equal(
          notice.booking.meetingUrl,
          "https://example.invalid/corrected-session",
        );
        assert.ok(!("fridayScore" in notice.learner));
        return { ok: true };
      };
      assert.equal(
        (
          await deliverCollegeNotices(cc, {
            fetchImpl: mockFetch,
            now: time(-900),
          })
        ).delivered,
        3,
      );
      assert.equal(
        (
          await deliverCollegeNotices(cc, {
            fetchImpl: mockFetch,
            now: time(-899),
          })
        ).delivered,
        0,
      );
      process.env.WEEK1_NOTIFICATION_WEBHOOK_URL = "";
      process.env.WEEK1_COLLEGE_CONTACTS_JSON = "{}";
      const safeSnapshot = await programSnapshot(gamers[22], time(-899));
      assert.ok(!JSON.stringify(safeSnapshot).includes("PRIVATE"));
      assert.deepEqual(safeSnapshot.publication.teams, []);
      assert.equal((await project(gamers[21])).participants.length, 0); // >=60 stays cleared
      assert.equal((await project(gamers[22])).participants.length, 1);
      assert.ok(!JSON.stringify(await project(gamers[22])).includes("PRIVATE"));
      await assert.rejects(
        call(
          { ...cc, cohortId: "other" },
          "recovery-attendance",
          { userId: "g22", status: "ATTENDED" },
          0,
        ),
      );
      await assert.rejects(
        call(
          gamers[22],
          "recovery-start",
          { type: "TECHNOLOGY", variantId: "TECHNOLOGY-0" },
          0,
        ),
      );
      await call(gamers[22], "recovery-choice", { choice: "CONTINUE" });
      await call(gamers[24], "recovery-choice", { choice: "LEAVE" });
      assert.equal(
        (await project(gamers[23], 0)).participants[0].state,
        "INSTITUTION_PENDING",
      );
      await call(
        cc,
        "recovery-institution",
        {
          userId: "g24",
          status: "WITHDRAWN",
          reference: "Institution approved withdrawal case 123",
        },
        0,
      );
      assert.equal((await models.User.findById("g24").lean()).active, false);
      assert.equal((await data()).publications[0].results[24].total, 59);
      await call(mc, "recovery-session", { state: "CLASS_STARTED" }, 0);
      await assert.rejects(
        call(mc, "recovery-session", { state: "CLASS_COMPLETED" }, 89),
      );
      await call(
        mc,
        "recovery-attendance",
        { userId: "g22", status: "ATTENDED" },
        1,
      );
      await call(mc, "recovery-session", { state: "CLASS_COMPLETED" }, 90);
      await assert.rejects(
        call(mc, "recovery-session", { state: "EXAMS_OPEN" }, 109),
      );
      await call(mc, "recovery-session", { state: "EXAMS_OPEN" }, 110);
      await call(
        gamers[22],
        "recovery-start",
        { type: "TECHNOLOGY", variantId: "TECHNOLOGY-0" },
        110,
      );
      const first = (await project(gamers[22], 112)).participants[0].attempts
        .TECHNOLOGY;
      const answers = {
        response:
          "Fixture investigation with reasoning and an honest failed check.",
        evidence:
          "https://example.invalid/ai-thread and independent verification notes.",
      };
      await call(
        gamers[22],
        "recovery-save",
        { type: "TECHNOLOGY", answers },
        112,
      );
      assert.equal(
        (await project(gamers[22], 120)).participants[0].attempts.TECHNOLOGY
          .deadline,
        first.deadline,
      );
      await assert.rejects(
        call(
          gamers[22],
          "recovery-start",
          { type: "FUN", variantId: "FUN-0" },
          115,
        ),
      );
      await call(
        gamers[22],
        "recovery-submit",
        { type: "TECHNOLOGY", answers },
        125,
      );
      await assert.rejects(
        call(mc, "recovery-signoff", { userId: "g22" }, 126),
      );
      await call(
        gamers[22],
        "recovery-start",
        { type: "FUN", variantId: "FUN-1" },
        126,
      );
      await call(gamers[22], "recovery-save", { type: "FUN", answers }, 127);
      assert.equal(
        (await project(gamers[22], 157)).participants[0].attempts.FUN.status,
        "EXPIRED",
      );
      for (const [type, score] of [
        ["TECHNOLOGY", 85],
        ["FUN", 58],
      ]) {
        const result = await call(mc, "recovery-export", { type }, 160),
          report = result.report;
        assert.equal(report.entries.length, 1);
        assert.equal(report.packs[0].exam.variants.length, 4);
        assert.ok(!JSON.stringify(report).includes("Gamer 22"));
        const rows = report.entries.map((e) => ({
          anonymousId: e.anonymousId,
          variantId: e.variantId,
          source: e.source,
          score,
          genuine: true,
          reliable: true,
          feedback: "Fixture evidence-based assessment feedback.",
        }));
        await assert.rejects(
          call(
            mc,
            "recovery-import",
            {
              report: {
                batchId: report.batchId,
                rows: [{ ...rows[0], variantId: "wrong" }],
              },
            },
            160,
          ),
        );
        await call(
          mc,
          "recovery-import",
          { report: { batchId: report.batchId, rows } },
          161,
        );
        await assert.rejects(
          call(
            mc,
            "recovery-import",
            { report: { batchId: report.batchId, rows } },
            162,
          ),
        );
      }
      await assert.rejects(
        call(mc, "recovery-signoff", { userId: "g22" }, 163),
      );
      assert.ok(
        !(await project(gamers[22], 163)).participants[0].attempts.TECHNOLOGY
          .assessment,
      );
      for (const [type, score] of [
        ["TECHNOLOGY", 74],
        ["FUN", 58],
      ])
        await call(
          mc,
          "recovery-review",
          { userId: "g22", type, score, genuine: true },
          164,
        );
      await call(mc, "recovery-signoff", { userId: "g22" }, 165);
      await assert.rejects(
        call(mc, "recovery-approve-result", { userId: "g22" }, 166),
        (e) => e.status === 403,
      );
      await call(cc, "recovery-approve-result", { userId: "g22" }, 166);
      assert.equal(
        (await project(gamers[22], 167)).participants[0].decision.total,
        66,
      );
      assert.ok(
        !JSON.stringify(await project(gamers[22], 167)).includes("PRIVATE"),
      );
      await assert.rejects(
        call(
          cc,
          "recovery-reward",
          { userId: "g22", ruleId: "unconfigured" },
          168,
        ),
      );
      await call(cc, "recovery-lock-eligible", {}, 168);
      assert.equal((await data()).recovery.eligible.rows.length, 23);
      await call(cc, "recovery-generate-teams", {}, 169);
      assert.deepEqual(
        (await data()).recovery.proposals[0].teams.map((t) => t.size),
        [5, 5, 5, 5, 3],
      );
      assert.equal((await project(gamers[22], 170)).team.length, 0);
      await assert.rejects(call(cc, "recovery-lock-teams", {}, 170));
      await call(mc, "recovery-team-review", {}, 170);
      await assert.rejects(
        call(mc, "recovery-publish-teams", {}, 170),
        (e) => e.status === 403,
      );
      await call(cc, "recovery-lock-teams", {}, 171);
      await call(cc, "recovery-publish-teams", {}, 172);
      const own = await project(gamers[22], 173);
      assert.equal(own.team.length, 1);
      assert.ok(!own.published.teams);
      assert.ok(!own.eligible);
      assert.equal((await project(gamers[24], 173)).team.length, 0);
      assert.equal(
        await models.WeekOneEvent.countDocuments({
          cohortId: "recovery",
          kind: "TEAM_ROSTER_PUBLISHED",
        }),
        1,
      );
      await assert.rejects(call(cc, "recovery-publish-teams", {}, 173));
      await call(cc, "recovery-amend-roster", {}, 174);
      assert.equal((await project(gamers[22], 175)).team.length, 0);
      assert.equal((await data()).recovery.publicationHistory.length, 1);
      await call(
        cc,
        "recovery-institution",
        {
          userId: "g23",
          status: "CONTINUE",
          reference: "Institution approved late participation case",
        },
        175,
      );
      assert.equal(
        (await project(gamers[23], 176)).participants[0].choice.value,
        "CONTINUE",
      );
      await call(cc, "recovery-lock-eligible", {}, 177);
      await call(cc, "recovery-generate-teams", {}, 178);
      const proposal = (await data()).recovery.proposals.at(-1);
      const teams = structuredClone(proposal.teams);
      [teams[0].members[0], teams[1].members[0]] = [
        teams[1].members[0],
        teams[0].members[0],
      ];
      await call(mc, "recovery-team-review", { teams }, 179);
      await assert.rejects(call(cc, "recovery-lock-teams", {}, 179));
      await call(cc, "recovery-team-override", { approve: true }, 180);
      await call(cc, "recovery-lock-teams", {}, 181);
      await call(
        cc,
        "recovery-reward-rules",
        {
          rules: [
            {
              id: "recovered",
              name: "Recovery recognition",
              amount: 5,
              minimum: 60,
              eligibility:
                "Genuine approved recovery and verified learning evidence",
            },
          ],
        },
        182,
      );
      await call(
        cc,
        "recovery-reward",
        { userId: "g22", ruleId: "recovered" },
        183,
      );
      await assert.rejects(
        call(
          cc,
          "recovery-reward",
          { userId: "g22", ruleId: "recovered" },
          184,
        ),
      );
      assert.equal((await data()).publications[0].results[22].total, 59.99);
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
