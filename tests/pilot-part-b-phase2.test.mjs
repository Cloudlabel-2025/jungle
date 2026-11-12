import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { models } from "../lib/db.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { workingAt } from "../lib/pilot-calendar.js";
import { hash } from "../lib/pilot-rules.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import partB from "../lib/pilot-part-b.json" with { type: "json" };

test("Part B Phase 2: all sixty cards progress through submission, rework and independent review",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 180000 }, async t => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = "/part_b_phase2_journey";
    process.env.MONGODB_URI = uri.toString();
    t.after(() => mongoose.disconnect());
    const { cc, mc, gamers, teams, cohortId } = await pilotFixture(5);
    const reason = "Fictional workflow rehearsal only; no student integration or human assessment is certified.";
    const evidence = "https://example.invalid/phase2-fictional-evidence";
    const programme = await models.WeekOneProgram.findById(cohortId).lean();
    const config = { ...sprintConfig(teams, mc, 2), number: 5,
      rosterDigest: hash(programme.data.recovery.published),
      gates: [],
      template: partB.sprints.find(row => row.number === 5),
      acceptances: teams.map(team => ({ teamId: team.id, decision: "ACCEPTED", key: "Key 5" })),
    };
    // Only prior eligibility is seeded. No Phase 2 cards or completed levels are seeded.
    await models.PilotSprint.create({ _id: "phase2-journey", cohortId, state: "ACTIVE", version: 1,
      createdAt: new Date("2026-12-11T08:00:00Z"), data: config });
    let now = new Date("2026-12-14T04:30:00Z");
    const act = (actor, action, body = {}) => pilotAction(actor, action,
      { requestId: randomUUID(), reason, ...body }, now);
    const record = levelId => models.PilotDaily.findById(`phase2-journey:phase2:${levelId}`).lean();
    let submitted = 0, accepted = 0;
    for (const level of partB.phase2.levels) {
      const owners = Object.fromEntries(level.cards.map((card, index) => [card.id, gamers[(index + level.level * 5) % gamers.length]._id]));
      await act(mc, "phase2-plan", { levelId: level.id, owners, branch: evidence });
      await assert.rejects(act(gamers[0], "phase2-approve", { levelId: level.id }), { status: 403 });
      await act(cc, "phase2-approve", { levelId: level.id });
      const pending = new Map(level.cards.map(card => [card.id, card]));
      const done = new Set();
      let reworked = false;
      while (pending.size) {
        const card = [...pending.values()].find(row => row.depends_on.every(id => done.has(id)));
        assert.ok(card, `${level.id} has an executable dependency graph`);
        const owner = gamers.find(gamer => gamer._id === owners[card.id]);
        // Advance the programme's actual working calendar, including lunch/weekend boundaries.
        now = new Date(workingAt(now, config.calendar, 60));
        const body = { levelId: level.id, cardId: card.id, evidence };
        await assert.rejects(act(cc, "phase2-review", { ...body, decision: "ACCEPTED" }), /submitted card/);
        const other = gamers.find(gamer => gamer._id !== owner._id);
        await assert.rejects(act(other, "phase2-submit", body), { status: 403 });
        await act(owner, "phase2-submit", body);
        submitted++;
        await assert.rejects(act(owner, "phase2-review", { ...body, decision: "ACCEPTED" }), { status: 403 });
        if (!reworked) {
          await act(cc, "phase2-review", { ...body, decision: "REWORK" });
          assert.equal((await record(level.id)).data.cards.find(row => row.id === card.id).status, "REWORK");
          await act(owner, "phase2-submit", body);
          reworked = true;
        }
        await act(cc, "phase2-review", { ...body, decision: "ACCEPTED" });
        accepted++;
        done.add(card.id);
        pending.delete(card.id);
        const current = await record(level.id);
        assert.equal(current.state, pending.size ? "PHASE2_ACTIVE" : "PHASE2_COMPLETE");
      }
      const completed = await record(level.id);
      assert.equal(completed.data.cards.length, 20);
      assert.ok(completed.data.cards.every(card => card.status === "ACCEPTED" && card.submission && card.review));
      for (const gamer of gamers) {
        const visible = (await pilotSnapshot(gamer, now)).phase2.find(row => row.levelId === level.id);
        const assigned = level.cards.filter(card => owners[card.id] === gamer._id).map(card => card.id);
        assert.deepEqual(visible?.cards.map(card => card.id) || [], assigned);
      }
      await assert.rejects(act(gamers.find(gamer => gamer._id === owners[level.cards[0].id]), "phase2-submit",
        { levelId: level.id, cardId: level.cards[0].id, evidence }), /active workgroup/);
      t.diagnostic(`${level.id}: all 20 cards accepted through normal actions; one rework/resubmission; owner-only visibility checked for 25 Gamers.`);
    }
    assert.equal(submitted, 60);
    assert.equal(accepted, 60);
    assert.equal(await models.PilotLedger.countDocuments({ cohortId }), 0, "Completion alone grants no core marks or bonuses");
    t.diagnostic("Prior Key 5 eligibility was synthetic. Actual APIs, sandbox payments, webhooks, concurrency and student code remain external verification.");
  });
