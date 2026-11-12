import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { models } from "../lib/db.js";
import { pilotAction, pilotSnapshot, storageProof } from "../lib/pilot-engine.js";
import { authorisedFile } from "../lib/pilot-storage.js";
import { graph } from "../lib/pilot-calendar.js";
import partB from "../lib/pilot-part-b.json" with { type: "json" };
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";

test(
  "Frozen final sprint loads only after prior acceptance and requires private witnessed demos",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async (t) => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = "/pilot_final_delivery";
    process.env.MONGODB_URI = uri.toString();
    t.after(() => mongoose.disconnect());
    const { cc, cc2, mc, otherMC, gamers, teams, cohortId } = await pilotFixture(1);
    const teamId = teams[0].id;
    const reason = "Synthetic isolated acceptance guard test.";
    const evidence = "https://example.invalid/sprint5/qa";
    let now = new Date("2026-12-07T07:00:00Z");
    const act = (actor, action, body = {}) =>
      pilotAction(actor, action, { requestId: randomUUID(), reason, ...body }, now);
    const teamAct = (actor, action, body = {}) =>
      act(actor, action, { teamId, ...(action === "final-friday-export" ? { sanitised: true, sourceArtifactLink: evidence, deployedTestUrl: evidence } : {}), ...body });
    const snapshot = (actor) => pilotSnapshot(actor, now);
    const final = partB.sprints.find((sprint) => sprint.number === 5);
    for (const number of [1, 2, 3, 4])
      await models.PilotSprint.create({
        _id: `closed-${number}`,
        cohortId,
        state: "CLOSED",
        version: 1,
        createdAt: new Date(Date.UTC(2026, 10, number)),
        data: {
          number,
          teams: [],
          acceptances: number < 4
            ? [{ teamId, decision: "ACCEPTED", key: `Key ${number}` }]
            : [],
        },
      });
    const config = {
      ...sprintConfig(teams, mc, 2),
      number: 5,
      contentApproval: reason,
      kickoffStart: "2026-12-07T04:30:00Z",
      kickoffEnd: "2026-12-07T06:30:00Z",
      dueAt: "2026-12-11T11:30:00Z",
      resources: Object.fromEntries(
        final.tasks.map(({ id }) => [
          id,
          { author: "CURRICULUM", url: evidence, approval: reason, version: "QA" },
        ]),
      ),
    };
    config.teams[0].owners = Object.fromEntries(
      final.tasks.map(({ id, owner }) => [id, gamers["ABCDE".indexOf(owner)]._id]),
    );
    const modified = structuredClone(final);
    modified.tasks[0].title = "Changed frozen title";
    await assert.rejects(
      act(cc, "draft", { config: { ...config, template: modified } }),
      /Frozen task content/,
    );
    await act(cc, "draft", { config });
    await act(cc, "approve");
    await assert.rejects(act(cc, "load"), /accepted Sprints 1–4/);
    await models.PilotSprint.updateOne(
      { _id: "closed-4" },
      { $set: { "data.acceptances": [{ teamId, decision: "ACCEPTED", key: "Key 4" }] } },
    );
    await act(cc, "load");
    await teamAct(mc, "kickoff", { evidence: reason });
    const loaded = await snapshot(cc);
    assert.deepEqual(loaded.sprint.data.template, final);
    assert.equal(loaded.tasks.length, 20);
    assert.equal(loaded.tasks.filter((task) => task.data.tt === "TT1").length, 10);
    assert.equal(loaded.tasks.filter((task) => task.data.tt === "TT2").length, 10);
    assert.equal(loaded.tasks.filter((task) => task.data.code.startsWith("DEMO-")).length, 5);
    for (const gamer of gamers)
      assert.equal(loaded.tasks.filter((task) => task.userId === gamer._id).length, 4);
    t.diagnostic("PB-QA-077: verified loaded task split, five demos and four cards per Gamer");
    assert.equal(loaded.setup.manifests.sprints.length, 5);
    assert.equal(loaded.setup.partB.phase2.levels.length, 3);
    const fifthAssessor = { ...mc, _id: "pilot-final-assessor", email: "assessor@pilot.invalid" };
    await models.User.create(fifthAssessor);
    const assessorIds = [cc._id, cc2._id, mc._id, otherMC._id, fifthAssessor._id];
    const plan = {
      startAt: "2026-12-11T03:45:00Z",
      assessorIds,
      policyVersion: "final-plan-qa",
    };
    await assert.rejects(act(mc, "final-friday-plan", plan), { status: 403 });
    await assert.rejects(
      act(cc, "final-friday-plan", { ...plan, assessorIds: [cc._id, cc2._id, fifthAssessor._id] }),
      /five distinct/,
    );
    assert.equal((await snapshot(cc)).sprint.data.finalFridayPlanId, undefined);
    t.diagnostic("PB-QA-098: three CC assessors rejected; no arena plan recorded");
    await assert.rejects(
      act(cc, "final-friday-plan", { ...plan, assessorIds: Array(5).fill(mc._id) }),
      /five distinct/,
    );
    await act(cc, "final-friday-plan", plan);
    const planned = await snapshot(cc);
    const arenaPlan = planned.policies.find((policy) => policy._id === planned.sprint.data.finalFridayPlanId);
    assert.deepEqual(arenaPlan.data.value.arenas.map((arena) => arena.assessor), assessorIds);
    assert.equal(arenaPlan.data.value.endAt, "2026-12-11T05:15:00.000Z");
    const preFriday = (await teamAct(mc, "final-friday-export", { commit: "b".repeat(40) })).export;
    const earlyMarks = {
      schema_version: "PARTB_FINAL_FRIDAY_AI_V1",
      run_metadata: { export_id: preFriday.export_id, source_snapshots: [{ team_id: "T01", commit_sha: "b".repeat(40) }] },
      gamer_question_sets: preFriday.individual_gamer_dossiers.map(({ gamer_id }) => ({
        gamer_id, team_id: "T01", questions: structuredClone(partB.finalFriday.advisoryOutput.gamer_question_sets[0].questions),
      })),
      provisional_assessments: [{ gamer_id: "T01-G01", criterion_id: "system_comprehension", rating: "NOT_ASSESSED", reason }],
      final_marks: [{ gamer_id: "T01-G01", score: 100, verdict: "PASS" }],
    };
    await assert.rejects(teamAct(mc, "final-friday-import", {
      payload: { ...earlyMarks, run_metadata: { ...earlyMarks.run_metadata, source_snapshots: [] } },
    }), /must match the exported commit/);
    const earlyImport = await teamAct(mc, "final-friday-import", { payload: earlyMarks });
    const beforeDefence = await snapshot(mc);
    const preReview = beforeDefence.audit.find((row) => row.state === "FINAL_FRIDAY_ADVISORY_IMPORTED" && row.data.exportId === preFriday.export_id);
    assert.equal(preReview.data.status, "AWAITING_HUMAN_REVIEW");
    assert.equal(preReview.data.provisionalAssessments[0].rating, "NOT_ASSESSED");
    assert.ok(!Object.hasOwn(preReview.data, "final_marks"));
    assert.ok(!beforeDefence.daily.some((row) => ["FINAL_DEMO_WITNESS", "FINAL_AWARD"].includes(row.state)));
    assert.equal(await models.PilotLedger.countDocuments({ cohortId, state: { $in: ["CORE", "ASSESSMENT"] } }), 0);
    t.diagnostic("PB-QA-096: proposed final marks did not create any assessment, award, or witnessed pass");
    const beforePhase2 = await snapshot(gamers[0]);
    for (const level of partB.phase2.levels) {
      assert.equal(level.cards.length, 20);
      assert.equal(level.cards.filter((card) => card.type === "TT1").length, 6);
      assert.equal(level.cards.filter((card) => card.type === "TT2").length, 14);
      assert.ok(level.cards.every((card) => !card.owner && !card.gamer));
      graph(level.cards.map((card) => ({ id: card.id, tt: card.type, depends: card.depends_on })));
      const plan = {
        levelId: level.id,
        owners: Object.fromEntries(level.cards.map((card) => [card.id, gamers[0]._id])),
        branch: evidence,
      };
      await assert.rejects(act(mc, "phase2-plan", plan), /team has Key 5/);
      const afterAttempt = await snapshot(gamers[0]);
      assert.deepEqual(afterAttempt.phase2, []);
      assert.deepEqual(afterAttempt.sprint, beforePhase2.sprint);
      assert.deepEqual(afterAttempt.ledgers, beforePhase2.ledgers);
      t.diagnostic(`${level.id}: verified catalogue shape and denied assignment before Key 5`);
    }
    const advisory = { commit: "a".repeat(40), codeManifest: evidence, individualDossiers: evidence, reviewedQuestions: evidence };
    await teamAct(mc, "final-friday-advisory", advisory);
    assert.ok((await snapshot(mc)).audit.some((row) => row.state === "FINAL_FRIDAY_ADVISORY"));
    const bonus = { userId: gamers[0]._id, voluntary: true, bonus: 5, evidence, assessorId: cc._id,
      environment: "ISOLATED_BRANCH", durationMinutes: 10, sharedReleaseUnchanged: true,
      target: evidence, baseline: evidence, rollback: evidence,
      criteria: Object.fromEntries([..."ABCDE"].map(key => [key, { earned: true, evidence }])) };
    await assert.rejects(teamAct(cc, "final-admin-chair", bonus), /mandatory persona/);
    const award = { userId: gamers[0]._id, category: "Systems Thinker", evidence };
    await teamAct(mc, "final-award", { ...award, decision: "RECOMMEND" });
    await assert.rejects(teamAct(mc, "final-award", { ...award, decision: "APPROVE" }), { status: 403 });
    await teamAct(cc, "final-award", { ...award, decision: "APPROVE" });
    await assert.rejects(
      teamAct(cc, "final-award", { ...award, decision: "APPROVE", category: "Architecture Navigator" }),
      /one criterion honour/,
    );
    const privateView = await snapshot(gamers[0]);
    assert.ok(!privateView.daily.some((row) => row.state === "FINAL_AWARD"));
    assert.ok(!privateView.policies.some((row) => row.state === "FINAL_FRIDAY_PLAN"));
    const demos = loaded.tasks.filter((task) => /^DEMO-/.test(task.data.code));
    const witness = (actor, demo, defenceMinutes) =>
      teamAct(actor, "final-demo-witness", {
        taskId: demo._id, defenceMinutes, evidence, decision: "PASS",
        advisoryId: earlyImport.advisoryId, questionVersion: 2,
      });
    await act(gamers[0], "task", { taskId: demos[0]._id, next: "Working" });
    assert.equal((await snapshot(gamers[0])).tasks.find(row => row._id === demos[0]._id).state, "Working");
    await assert.rejects(witness(cc, demos[0], 5), /final release/);
    t.diagnostic("PB-QA-076: Gamer could prepare before release; live witness recording required the accepted release");
    await assert.rejects(witness(gamers[0], demos[0], 5), { status: 403 });
    await assert.rejects(witness(otherMC, demos[0], 5), { status: 403 });
    // Seed prior task-review outcomes to exercise the separate client acceptance guard.
    await models.PilotTask.updateMany(
      {
        sprintId: loaded.sprint._id,
        "data.code": { $in: ["QA-18", "OP-18", ...demos.map((task) => task.data.code)] },
      },
      { $set: { state: "Accepted" } },
    );
    now = new Date("2026-12-11T06:00:00Z");
    await assert.rejects(witness(cc, demos[0], 5), /CC must approve/);
    await assert.rejects(teamAct(cc, "final-question-approve", { advisoryId: earlyImport.advisoryId, questionVersion: 1 }), /MC must review/);
    await teamAct(mc, "final-question-review", { advisoryId: earlyImport.advisoryId, questionVersion: 1, questionSets: earlyMarks.gamer_question_sets });
    await assert.rejects(teamAct(cc, "final-question-approve", { advisoryId: earlyImport.advisoryId, questionVersion: 1 }), /version changed/);
    await teamAct(cc, "final-question-approve", { advisoryId: earlyImport.advisoryId, questionVersion: 2 });
    const gate = (index) => teamAct(cc, "gate", { index, evidence, decision: "PASS" });
    const accept = () => teamAct(cc, "accept", { decision: "ACCEPTED" });
    for (const index of [1, 2, 3, 4, 5, 6, 7]) await gate(index);
    await assert.rejects(accept(), /five passing witnessed demos/);
    await assert.rejects(witness(cc, demos[0], 4), /five-minute private defence/);
    for (const demo of demos) await witness([cc, cc2, mc, otherMC, fifthAssessor][Number(demo.data.code.at(-1)) - 1], demo, 5);
    assert.equal((await snapshot(mc)).daily.filter((row) => row.state === "FINAL_DEMO_WITNESS").length, 5);
    const gamer = await snapshot(gamers[0]);
    assert.equal(gamer.setup, null);
    assert.ok(!gamer.daily.some((row) => row.state === "FINAL_DEMO_WITNESS"));
    await assert.rejects(accept(), /All seven latest client gates/);
    for (const index of [5, 6, 7]) await gate(index);
    await teamAct(cc, "final-admin-booking", { userId: gamers[0]._id, voluntary: true, assessorId: cc._id, startAt: "2026-12-11T05:20:00Z" });
    await assert.rejects(teamAct(cc, "final-admin-chair", { ...bonus, environment: "PRODUCTION" }), /isolated/);
    await assert.rejects(teamAct(cc, "final-admin-chair", { ...bonus, bonus: 6 }), /five evidenced/);
    await assert.rejects(teamAct(mc, "final-admin-chair", bonus), { status: 403 });
    await teamAct(cc, "final-admin-chair", bonus);
    await assert.rejects(teamAct(cc, "final-admin-chair", bonus), /already recorded/);
    const chairBonuses = (await snapshot(gamers[0])).ledgers.filter(row => row.state === "ADMIN_CHAIR");
    assert.equal(chairBonuses.length, 1);
    assert.equal(chairBonuses[0].data.bonus, 5);
    await accept();
    assert.equal((await snapshot(cc)).sprint.data.acceptances[0].key, "Key 5");
    await assert.rejects(witness(cc, demos[0], 5), /Reopen client review/);
    const reportUserId = gamers[0]._id;
    const upload = async (reportKind) => {
      const intent = await teamAct(mc, "upload-intent", {
        reportUserId, reportKind, filename: `${reportKind}.pdf`,
      });
      // Exercise metadata and access rules with a simulated verified object.
      await act(mc, "upload-complete", {
        evidenceId: intent.evidenceId, path: intent.path, size: 256,
        contentType: "application/pdf", _proof: storageProof,
      });
      return intent.evidenceId;
    };
    const passportId = await upload("PASSPORT");
    const certificateId = await upload("CERTIFICATE");
    await assert.rejects(authorisedFile(gamers[0], passportId), { status: 403 });
    await assert.rejects(authorisedFile(otherMC, passportId), { status: 403 });
    await teamAct(mc, "final-report-review", { userId: reportUserId, passportId, certificateId, passportPages: 2, certificateWordingVerified: true, evidenceVerified: true });
    assert.ok(!(await snapshot(gamers[0])).daily.some((row) => row.state.startsWith("FINAL_REPORT")));
    await assert.rejects(teamAct(cc, "final-report-issue", { userId: reportUserId }), /Approved core results/);
    const approvedCore = gamers.map((gamer, index) => ({ userId: gamer._id, score: 95 - index * 5, evidence }));
    await assert.rejects(teamAct(cc, "core-results", {
      results: approvedCore.map((row, index) => index === 4 ? { ...row, score: 105 } : row),
    }), /Number must be between 0 and 100/);
    assert.equal(await models.PilotLedger.countDocuments({ cohortId, state: "CORE" }), 0);
    await teamAct(cc, "core-results", { results: approvedCore });
    const scores = () => models.PilotLedger.find({ cohortId, state: "CORE" }).sort({ _id: 1 }).lean();
    const originalScores = await scores();
    assert.equal(originalScores.length, 5);
    assert.equal(await models.PilotLedger.countDocuments({ cohortId, userId: gamers[1]._id, state: "ADMIN_CHAIR" }), 0);
    assert.ok((await snapshot(mc)).daily.some((row) => row.userId === gamers[1]._id && row.state === "FINAL_DEMO_WITNESS" && row.data.decision === "PASS"));
    t.diagnostic("PB-QA-102: optional opt-out left the mandatory demo and core result intact");
    const secondHonour = { ...award, category: "Architecture Navigator", decision: "APPROVE" };
    await assert.rejects(teamAct(cc, "final-award", secondHonour), /one criterion honour/);
    await teamAct(cc, "final-award", { ...secondHonour, userId: gamers[1]._id });
    assert.ok((await snapshot(mc)).daily.some((row) => row.state === "FINAL_AWARD" &&
      row.data.category === secondHonour.category && row.data.recipient === gamers[1]._id));
    assert.deepEqual(await scores(), originalScores);
    t.diagnostic("PB-QA-103: top repeat recipient rejected; next eligible recipient recorded without changing scores");
    await teamAct(cc, "final-report-issue", { userId: reportUserId });
    assert.equal((await authorisedFile(gamers[0], passportId))._id, passportId);
    assert.equal((await authorisedFile(gamers[0], certificateId))._id, certificateId);
    await assert.rejects(authorisedFile(gamers[1], passportId), { status: 403 });
    const issued = (await snapshot(gamers[0])).daily.find((row) => row.state === "FINAL_REPORT_ISSUED");
    assert.deepEqual(issued.data, { passportId, certificateId });
    await assert.rejects(teamAct(mc, "final-report-reopen", { userId: reportUserId }), { status: 403 });
    await teamAct(cc, "final-report-reopen", { userId: reportUserId });
    await assert.rejects(authorisedFile(gamers[0], passportId), { status: 403 });
    await assert.rejects(teamAct(mc, "final-report-review", { userId: reportUserId, passportId, certificateId }), /two-page Passport/);
    await teamAct(mc, "final-report-review", { userId: reportUserId, passportId, certificateId,
      passportPages: 2, certificateWordingVerified: true, evidenceVerified: true });
    await teamAct(cc, "final-report-issue", { userId: reportUserId });
    const exported = (await teamAct(mc, "final-friday-export", { commit: "a".repeat(40) })).export;
    assert.equal(exported.individual_gamer_dossiers.length, 5);
    assert.ok(!JSON.stringify(exported).includes(gamers[0]._id));
    const advisoryReturn = {
      schema_version: "PARTB_FINAL_FRIDAY_AI_V1",
      run_metadata: { export_id: exported.export_id, source_snapshots: [{ team_id: "T01", commit_sha: "a".repeat(40) }] },
      gamer_question_sets: exported.individual_gamer_dossiers.map(({ gamer_id }) => ({
        gamer_id, team_id: "T01", questions: structuredClone(partB.finalFriday.advisoryOutput.gamer_question_sets[0].questions),
      })),
      team_reviews: [{ team_id: "T01", findings: [{ id: "F1", category: "Validation", summary: "Check the required field." }] }],
      provisional_assessments: [{ gamer_id: "T01-G01", criterion_id: "system_comprehension", rating: "NOT_ASSESSED", reason: "Awaiting observation." }],
    };
    await assert.rejects(teamAct(gamers[0], "final-friday-import", { payload: advisoryReturn }), { status: 403 });
    await teamAct(mc, "final-friday-import", { payload: advisoryReturn });
    const imported = (await snapshot(mc)).audit.find((row) => row.state === "FINAL_FRIDAY_ADVISORY_IMPORTED" && row.data.exportId === exported.export_id);
    assert.equal(imported.data.findings[0].id, "F1");
    assert.equal(imported.data.provisionalAssessments[0].rating, "NOT_ASSESSED");
    assert.ok(!(await snapshot(gamers[0])).audit.length);

    const outside = { ...gamers[0], _id: "pilot-phase2-volunteer", email: "volunteer@pilot.invalid", teamId: "pilot-phase2-other" };
    await models.User.create(outside);
    await models.PilotSprint.updateOne({ _id: loaded.sprint._id }, {
      $push: {
        "data.teams": { teamId: outside.teamId, commanderId: otherMC._id, members: [outside._id] },
        "data.acceptances": { teamId: outside.teamId, decision: "ACCEPTED", key: "Key 5" },
      },
    });
    const level = partB.phase2.levels[0];
    const dependent = level.cards.find((card) => card.depends_on.length === 1);
    const prerequisite = dependent.depends_on[0];
    const owners = Object.fromEntries(level.cards.map((card) => [
      card.id, card.id === dependent.id ? outside._id : gamers[0]._id,
    ]));
    await act(mc, "phase2-plan", { levelId: level.id, owners, branch: evidence });
    assert.deepEqual((await snapshot(outside)).phase2, []);
    await act(cc, "phase2-approve", { levelId: level.id });
    assert.deepEqual((await snapshot(outside)).phase2[0].cards.map((card) => card.id), [dependent.id]);
    assert.ok(!(await snapshot(outside)).tasks.some((task) => task.teamId === teamId));
    await assert.rejects(act(outside, "phase2-submit", { levelId: level.id, cardId: prerequisite, evidence }), { status: 403 });
    await act(gamers[0], "phase2-submit", { levelId: level.id, cardId: prerequisite, evidence });
    await act(cc, "phase2-review", { levelId: level.id, cardId: prerequisite, decision: "ACCEPTED" });
    await assert.rejects(act(outside, "phase2-submit", { levelId: level.id, cardId: dependent.id, evidence }), /one working hour/);
    await pilotAction(outside, "phase2-submit", {
      requestId: randomUUID(), reason, levelId: level.id, cardId: dependent.id, evidence,
    }, new Date(+now + 7200000));
    assert.equal((await snapshot(outside)).phase2[0].cards[0].status, "SUBMITTED");
    const awardBonus = { levelId: level.id, userId: outside._id, bonus: 4, evidence };
    await assert.rejects(act(cc, "phase2-bonus", awardBonus), /Complete the level/);
    const level2 = partB.phase2.levels[1];
    await act(mc, "phase2-plan", {
      levelId: level2.id,
      owners: Object.fromEntries(level2.cards.map((card) => [card.id, gamers[0]._id])),
      branch: evidence,
    });
    await assert.rejects(act(cc, "phase2-approve", { levelId: level2.id }), /preceding Phase 2 level/i);
    await act(cc, "settings", { policyVersion: "phase2-cap-qa", bonusCap: 5 });
    await models.PilotDaily.updateOne(
      { _id: `${loaded.sprint._id}:phase2:${level.id}` },
      { $set: { state: "PHASE2_COMPLETE", "data.cards.$[].status": "ACCEPTED" } },
    );
    await assert.rejects(act(mc, "phase2-bonus", awardBonus), { status: 403 });
    await act(cc, "phase2-bonus", awardBonus);
    await act(cc, "phase2-bonus", awardBonus);
    await assert.rejects(act(cc, "phase2-bonus", { ...awardBonus, bonus: 5 }), /already been recorded/);
    const bonuses = (await snapshot(outside)).ledgers.filter((row) => row.state === "EXTENSION");
    assert.equal(bonuses.length, 1);
    assert.equal(bonuses[0].data.bonus, 4);
    await act(cc, "phase2-bonus", { ...awardBonus, userId: gamers[0]._id });
    const separateScores = (await snapshot(gamers[0])).ledgers;
    assert.equal(separateScores.find(row => row.state === "CORE").data.score, 95);
    assert.equal(separateScores.find(row => row.state === "ADMIN_CHAIR").data.bonus, 5);
    assert.equal(separateScores.find(row => row.state === "EXTENSION").data.bonus, 4);
    assert.deepEqual(await scores(), originalScores);
    t.diagnostic("PB-QA-108: 105 core rejected atomically; core, Admin Chair and Phase 2 awards remained separate");
    for (const catalogue of partB.phase2.levels) {
      const allocation = Object.fromEntries(catalogue.cards.map((card, index) => [
        card.id, gamers[index % gamers.length]._id,
      ]));
      const plan = { levelId: catalogue.id, owners: allocation, branch: evidence };
      if (catalogue.id !== level.id) {
        await assert.rejects(act(gamers[0], "phase2-plan", plan), { status: 403 });
        await act(mc, "phase2-plan", plan);
        if (catalogue.level === 3) {
          await assert.rejects(act(cc, "phase2-approve", { levelId: catalogue.id }), /preceding Phase 2 level/i);
          // Supply a completed Level 2 fixture to exercise approval and visibility for Level 3.
          await models.PilotDaily.updateOne(
            { _id: `${loaded.sprint._id}:phase2:${partB.phase2.levels[1].id}` },
            { $set: { state: "PHASE2_COMPLETE", "data.cards.$[].status": "ACCEPTED" } },
          );
        }
        await act(cc, "phase2-approve", { levelId: catalogue.id });
        for (const gamer of gamers) {
          const group = (await snapshot(gamer)).phase2.find((row) => row.levelId === catalogue.id);
          assert.ok(group);
          assert.deepEqual(group.cards.map((card) => card.id),
            catalogue.cards.filter((card) => allocation[card.id] === gamer._id).map((card) => card.id));
        }
      }
      const record = await models.PilotDaily.findById(`${loaded.sprint._id}:phase2:${catalogue.id}`).lean();
      assert.deepEqual(Object.fromEntries(record.data.cards.map((card) => [card.id, card.owner])),
        catalogue.id === level.id ? owners : allocation);
      t.diagnostic(`${catalogue.id}: verified complete MC allocation after Key 5`);
    }
    await teamAct(cc, "gate", { index: 7, evidence, decision: "BLOCKED" });
    await assert.rejects(authorisedFile(gamers[0], passportId), { status: 403 });
    assert.ok(!(await snapshot(gamers[0])).daily.some((row) => row.state === "FINAL_REPORT_ISSUED"));
  },
);
