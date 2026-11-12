import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { models } from "../lib/db.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { hash } from "../lib/pilot-rules.js";
import { finalReportHtml } from "../lib/part-b-report-html.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import partB from "../lib/pilot-part-b.json" with { type: "json" };

test("Part B final controls: five-team permissions, 25 bookings, evidence, question versions and report drafts",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 180000 }, async t => {
    const uri = new URL(process.env.TEST_MONGODB_URI); uri.pathname = "/part_b_final_controls";
    process.env.MONGODB_URI = uri.toString();
    t.after(() => mongoose.disconnect());
    const { cc, cc2, mc, otherMC, gamers, teams, cohortId } = await pilotFixture(5);
    let now = new Date("2026-12-11T08:00:00Z");
    const reason = "Fictional disposable guard regression; not independent student UAT.";
    const evidence = "https://example.invalid/verified";
    const final = partB.sprints.find(row => row.number === 5);
    const programme = await models.WeekOneProgram.findById(cohortId).lean();
    const config = { ...sprintConfig(teams, mc, 2), number: 5, template: final,
      kickoffStart: "2026-12-07T04:30:00Z", kickoffEnd: "2026-12-07T06:30:00Z", dueAt: "2026-12-11T11:30:00Z",
      teams: teams.map(team => ({ teamId: team.id, members: team.members, commanderId: mc._id, leaderId: team.members[0],
        kickoff: { by: mc._id, at: "2026-12-07T06:30:00Z" },
        owners: Object.fromEntries(final.tasks.map(row => [row.id, team.members["ABCDE".indexOf(row.owner)]])) })),
      gates: [], acceptances: [], rosterDigest: hash(programme.data.recovery.published) };
    // Seed prior accepted outcomes to test Part B controls; this is not a full programme rehearsal.
    for (const number of [1,2,3,4]) await models.PilotSprint.create({ _id: `prior-${number}`, cohortId, state: "CLOSED", version: 1,
      createdAt: new Date(`2026-11-${String(number).padStart(2,"0")}T00:00:00Z`),
      data: { ...config, number, acceptances: teams.map(team => ({ teamId: team.id, decision: "ACCEPTED", key: `Key ${number}` })),
        gates: teams.flatMap(team => Array.from({length:7}, (_,i) => ({ teamId: team.id, code: `AC-${i+1}`, decision: "PASS", evidence }))) } });
    await models.PilotSprint.create({ _id: "final-controls", cohortId, state: "ACTIVE", version: 1,
      createdAt: now, data: config });
    await models.PilotTask.insertMany(config.teams.flatMap(team => final.tasks.map(row => ({
      _id: `${team.teamId}:${row.id}`, cohortId, sprintId: "final-controls", teamId: team.teamId,
      userId: team.owners[row.id], state: "Accepted", version: 1, createdAt: now,
      data: { ...row, code: row.id, basic: {}, stages: [], evidence: [{ id: "proof", by: team.owners[row.id], url: evidence }], dueAt: config.dueAt },
    }))));
    const act = (actor, action, body = {}) => pilotAction(actor, action, { requestId: randomUUID(), reason, ...body }, now);
    const teamId = teams[0].id;
    const teamAct = (actor, action, body = {}) => act(actor, action, { teamId, ...body });
    const exportBody = { commit: "b".repeat(40), sanitised: true, sourceArtifactLink: evidence, deployedTestUrl: evidence };
    const exportTeam = async () => (await teamAct(mc, "final-friday-export", exportBody)).export;
    const questions = aliases => aliases.map(gamer_id => ({ gamer_id, team_id: "T01",
      questions: structuredClone(partB.finalFriday.advisoryOutput.gamer_question_sets[0].questions) }));
    const payloadFor = exported => ({ schema_version: "PARTB_FINAL_FRIDAY_AI_V1",
      run_metadata: { export_id: exported.export_id, source_snapshots: [{ team_id: "T01", commit_sha: exportBody.commit }] },
      gamer_question_sets: questions(exported.team_code_review_manifest.gamer_ids), team_reviews: [] });

    await t.test("PB-QA-092/093: missing source stays unassessable, unsafe URLs and Gamer exports rejected", async () => {
      await assert.rejects(teamAct(gamers[0], "final-friday-export", exportBody), { status: 403 });
      await assert.rejects(teamAct(otherMC, "final-friday-export", exportBody), { status: 403 });
      await assert.rejects(teamAct(mc, "final-friday-export", { ...exportBody, sanitised: false }), /sanitised/);
      await assert.rejects(teamAct(mc, "final-friday-export", { ...exportBody, sourceArtifactLink: evidence+"?token=secret" }), /query/);
      const missing = (await teamAct(mc, "final-friday-export", { ...exportBody, sourceArtifactLink: null })).export;
      assert.equal(missing.team_code_review_manifest.source_status, "NOT_ASSESSABLE");
      assert.equal(missing.individual_gamer_dossiers[0].approved_core_assessment.criterion_scores.length, 13);
      assert.ok(missing.individual_gamer_dossiers[0].approved_core_assessment.criterion_scores.every(row => row.assessment_state === "NOT_ASSESSED"));
      const bad = payloadFor(missing); bad.team_reviews = [{ team_id: "T01", findings: [{ id: "made-up" }] }];
      await assert.rejects(teamAct(mc, "final-friday-import", { payload: bad }), /NOT_ASSESSABLE/);
      assert.ok(missing.flags.some(flag => flag.includes("untrusted")));
    });

    let imported, sets;
    await t.test("PB-QA-095: three question purposes, MC edits, CC version approval and stale-witness invalidation", async () => {
      const exported = await exportTeam(), payload = payloadFor(exported); sets = payload.gamer_question_sets;
      const invalid = structuredClone(payload); invalid.gamer_question_sets[0].questions.pop();
      await assert.rejects(teamAct(mc, "final-friday-import", { payload: invalid }), /exactly Q1/);
      imported = await teamAct(mc, "final-friday-import", { payload });
      await assert.rejects(teamAct(cc, "final-question-approve", { advisoryId: imported.advisoryId, questionVersion: 1 }), /MC must review/);
      await assert.rejects(teamAct(gamers[0], "final-question-review", { advisoryId: imported.advisoryId, questionVersion: 1, questionSets: sets }), { status: 403 });
      await teamAct(mc, "final-question-review", { advisoryId: imported.advisoryId, questionVersion: 1, questionSets: sets });
      await assert.rejects(teamAct(cc, "final-question-approve", { advisoryId: imported.advisoryId, questionVersion: 1 }), /version changed/);
      await teamAct(cc, "final-question-approve", { advisoryId: imported.advisoryId, questionVersion: 2 });
      const witness = { taskId: `${teamId}:DEMO-01`, decision: "PASS", defenceMinutes: 5, evidence,
        advisoryId: imported.advisoryId, questionVersion: 2 };
      await teamAct(mc, "final-demo-witness", witness);
      await teamAct(mc, "final-question-review", { advisoryId: imported.advisoryId, questionVersion: 2, questionSets: sets });
      const stale = await models.PilotDaily.findById(`${witness.taskId}:final-witness`).lean();
      assert.equal(stale.data.decision, "BLOCKED");
      await assert.rejects(teamAct(mc, "final-demo-witness", witness), /CC must approve/);
      await teamAct(cc, "final-question-approve", { advisoryId: imported.advisoryId, questionVersion: 3 });
      await teamAct(mc, "final-demo-witness", { ...witness, questionVersion: 3 });
      const gamer = await pilotSnapshot(gamers[0], now);
      assert.equal(gamer.sprint.data.approvedQuestions, undefined);
      assert.ok(!gamer.daily.some(row => row.state === "FINAL_PROFILE" || row.state === "FINAL_DEMO_WITNESS"));
      assert.deepEqual(gamer.audit, []);
    });

    await t.test("PB-QA-099: 25 voluntary ten-minute bookings fit; collisions, nonstaff and pre-arena slots rejected", async () => {
      const fifth = { ...mc, _id: "fifth-assessor", email: "fifth@pilot.invalid" }; await models.User.create(fifth);
      await act(cc, "final-friday-plan", { startAt: "2026-12-11T03:45:00Z", assessorIds: [cc._id, cc2._id, mc._id, otherMC._id, fifth._id], policyVersion: "capacity-v1" });
      const book = { userId: gamers[0]._id, voluntary: true, assessorId: cc._id, startAt: "2026-12-11T05:20:00Z" };
      await assert.rejects(teamAct(mc, "final-admin-booking", book), { status: 403 });
      await assert.rejects(teamAct(cc, "final-admin-booking", { ...book, startAt: "2026-12-11T04:00:00Z" }), /after the mandatory/);
      await assert.rejects(teamAct(cc, "final-admin-booking", { ...book, assessorId: gamers[1]._id }), /human reviewer/);
      for (const [index, gamer] of gamers.entries()) await act(cc, "final-admin-booking", {
        teamId: gamer.teamId, userId: gamer._id, voluntary: true, assessorId: index % 2 ? cc2._id : cc._id,
        startAt: new Date(Date.parse("2026-12-11T05:20:00Z") + Math.floor(index/2)*600000).toISOString(),
      });
      await assert.rejects(teamAct(cc, "final-admin-booking", { ...book, userId: gamers[2]._id }), /overlapping/);
      const bookings = await models.PilotDaily.find({ state: "ADMIN_CHAIR_BOOKING" }).lean();
      assert.equal(bookings.length, 25);
      assert.equal(bookings.reduce((n,row) => n+(Date.parse(row.data.endAt)-Date.parse(row.data.startAt))/60000,0),250);
      const examiner = await pilotSnapshot(otherMC, now, "final-controls");
      assert.equal(examiner.finalArena.arena,4);
      assert.equal(examiner.finalArena.candidates.length,5);
      assert.ok(examiner.finalArena.candidates.every(row => row.taskId.endsWith("DEMO-04")));
      assert.equal(examiner.tasks.length,0);
      assert.equal(examiner.ledgers.length,0);
      await assert.rejects(teamAct(otherMC, "final-demo-witness", { taskId: `${teamId}:DEMO-01`, decision: "PASS", defenceMinutes: 5, evidence,
        advisoryId: imported.advisoryId, questionVersion: 3 }), /outside your assigned/);
      await teamAct(otherMC, "final-demo-witness", { taskId: `${teamId}:DEMO-04`, decision: "PASS", defenceMinutes: 5, evidence,
        advisoryId: imported.advisoryId, questionVersion: 3 });
    });

    await t.test("FF-ADV-03/04/05/08/11/12: mandatory witness, isolation, five-point evidence and duplicate guards", async () => {
      const bonus = { userId: gamers[0]._id, voluntary: true, assessorId: cc._id, bonus: 3, durationMinutes: 10,
        environment: "ISOLATED_BRANCH", target: evidence, baseline: evidence, rollback: evidence,
        sharedReleaseUnchanged: true, evidence,
        criteria: Object.fromEntries([..."ABCDE"].map((key,index) => [key, { earned: index < 3, evidence }])) };
      await assert.rejects(teamAct(cc, "final-admin-chair", { ...bonus, userId: gamers[1]._id }), /mandatory persona/);
      await assert.rejects(teamAct(cc, "final-admin-chair", { ...bonus, environment: "PRODUCTION" }), /isolated/);
      await assert.rejects(teamAct(cc, "final-admin-chair", { ...bonus, durationMinutes: 11 }), /between 1 and 10/);
      await assert.rejects(teamAct(cc, "final-admin-chair", { ...bonus, bonus: 5 }), /five evidenced/);
      const missing = structuredClone(bonus); delete missing.criteria.B.evidence;
      await assert.rejects(teamAct(cc, "final-admin-chair", missing), /reference/);
      await teamAct(cc, "final-admin-chair", bonus);
      await assert.rejects(teamAct(cc, "final-admin-chair", bonus), /already recorded/);
      const ledger = await models.PilotLedger.find({ userId: gamers[0]._id, state: "ADMIN_CHAIR" }).lean();
      assert.equal(ledger.length,1); assert.equal(ledger[0].data.bonus,3);
      assert.equal(await models.PilotLedger.countDocuments({ state: "CORE" }),0);
      assert.equal(await models.PilotLedger.countDocuments({ state: "TROPHY" }),0);
    });

    await t.test("PB-QA-105/107/109: approved criterion evidence, real maxima, special calculations and overrides preserve marks", async () => {
      const profile = index => ({ userId: gamers[index]._id, rubricVersion: "frozen-13-v1",
        criteria: partB.finalFriday.passport.page1.criterion_scores.map(row => ({ criterion_id: row.criterion_id,
          approved_score: row.max_score * (100-index)/100, evidence_refs: [evidence] })),
        strengths: [{ criterion_id: "system_comprehension", observation: "Traced a verified request through the system.", evidence_ref: evidence }],
        gaps: [{ criterion_id: "testing_recovery", recommended_exercise: "Add a negative persistence check and review the saved result.", evidence_ref: evidence }] });
      await assert.rejects(teamAct(mc, "final-profile", profile(0)), { status: 403 });
      const missing = profile(0); missing.criteria[0].evidence_refs = [];
      await assert.rejects(teamAct(cc, "final-profile", missing), /require evidence/);
      for (const [index,gamer] of gamers.entries()) await act(cc, "final-profile", { ...profile(index), teamId: gamer.teamId });
      const exported = await exportTeam();
      assert.equal(exported.individual_gamer_dossiers[0].approved_core_assessment.criterion_scores[0].approved_score,10);
      assert.equal(exported.individual_gamer_dossiers[0].task_evidence[0].commit_or_test_ref[0],evidence);
      assert.equal(exported.individual_gamer_dossiers[0].strengths.length,1);
      assert.ok(!JSON.stringify(exported).includes(gamers[0]._id));
      const award = { category: "Corporate Communication Excellence", userId: gamers[1]._id, decision: "APPROVE", evidence };
      await assert.rejects(teamAct(cc, "final-award", award), /numerical highest/);
      await teamAct(cc, "final-award", { ...award, userId: gamers[0]._id });
      let saved = await models.PilotDaily.findOne({ state: "FINAL_AWARD" }).lean();
      assert.equal(saved.data.calculation.maximum,17); assert.equal(saved.data.override,false);
      await teamAct(cc, "final-award", { ...award, override: true });
      saved = await models.PilotDaily.findById(saved._id).lean();
      assert.equal(saved.data.override,true); assert.doesNotMatch(saved.data.announcement,/highest/i);
      assert.equal(await models.PilotLedger.countDocuments({ state: "CORE" }),0);
    });

    await t.test("PB-QA-091/107/110: showcase does not score; private printable report drafts escape source text", async () => {
      await teamAct(cc, "final-showcase", { userId: gamers[0]._id, evidence });
      assert.equal(await models.PilotLedger.countDocuments({ state: "CORE" }),0);
      const body = { ...exportBody, userId: gamers[0]._id, course: "MERN programme", projectId: "TEST-APP" };
      await assert.rejects(teamAct(gamers[1], "final-report-data", body), { status: 403 });
      const { report } = await teamAct(mc, "final-report-data", body);
      report.identity.name = '<script>alert("injection")</script>';
      const passport = finalReportHtml(report), certificate = finalReportHtml(report,"CERTIFICATE");
      assert.equal((passport.match(/<section class="page"/g)||[]).length,2);
      assert.ok(!passport.includes('<script>'));
      assert.ok(certificate.includes(partB.finalFriday.certificate.exact_body));
      assert.ok(!certificate.includes('Approved CORE total'));
      assert.ok(passport.includes('DRAFT') || passport.includes('Draft'));
      assert.equal(report.dossier.approved_core_assessment.criterion_scores.length,13);
      assert.equal(report.certificate.certificate_id.length,19);
    });
  });
