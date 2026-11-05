import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { models } from "../lib/db.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { criteria } from "../lib/week-one-catalog.js";
import { processPilot } from "../scripts/process-pilot.mjs";

test(
  "pilot review edits, appeal evidence, energy freeze and contributor independence",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 180000 },
  async (t) => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/pilot_edges_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    try {
      const f = await pilotFixture(),
        { cc, mc, gamers, teams } = f;
      let now = new Date("2026-11-07T07:00:00Z");
      const reason =
          "Actual synthetic verification for isolated regression testing.",
        call = (u, a, b = {}) =>
          pilotAction(u, a, { reason, requestId: randomUUID(), ...b }, now),
        snap = (u) => pilotSnapshot(u, now);
      await t.test(
        "a fresh programme returns empty collections before any sprint exists",
        async () => {
          for (const actor of [cc, mc, gamers[0]]) {
            const state = await snap(actor);
            assert.equal(state.sprint, null);
            for (const key of [
              "teams",
              "tasks",
              "reviews",
              "handovers",
              "clients",
              "daily",
              "notices",
              "ledgers",
              "recoveries",
              "policies",
              "meetings",
              "batches",
              "audit",
              "sparks",
            ])
              assert.deepEqual(state[key], [], `${actor.role}: ${key}`);
            if (actor.role !== "CENTRE_COMMAND")
              assert.equal(state.setup, null);
          }
        },
      );
      await call(cc, "draft", { config: sprintConfig(teams, mc) });
      await call(cc, "approve");
      await call(cc, "load");
      now = new Date("2026-11-09T07:00:00Z");
      for (const team of teams)
        await call(mc, "kickoff", { teamId: team.id, evidence: reason });
      const initial = await snap(cc),
        team = initial.teams[0],
        card = (code) =>
          initial.tasks.find(
            (c) => c.teamId === team.teamId && c.data.code === code,
          ),
        actor = (id) => [cc, mc, ...gamers].find((u) => u._id === id);
      await t.test(
        "request replay is bound to its original authenticated actor",
        async () => {
          const body = {
            requestId: randomUUID(),
            teamId: team.teamId,
            kind: "JOURNAL",
            note: reason,
          };
          await call(gamers[0], "daily", body);
          await assert.rejects(
            call(gamers[5], "daily", body),
            (e) => e.status === 403,
          );
        },
      );
      await t.test(
        "MC exceptions remain private while the TL team EOD is visible to the team",
        async () => {
          await call(mc, "daily-report", {
            teamId: team.teamId,
            kind: "MC_EXCEPTIONS",
            note: reason,
          });
          assert.equal(
            (await snap(gamers[0])).meetings.some(
              (r) => r.state === "MC_EXCEPTIONS",
            ),
            false,
          );
          assert.ok(
            (await snap(mc)).meetings.some((r) => r.state === "MC_EXCEPTIONS"),
          );
        },
      );
      await t.test(
        "editing a checkpoint supersedes pending reviews rather than blocking sprint closure",
        async () => {
          const c = card("FE-01"),
            g = actor(c.userId);
          await call(g, "task", { taskId: c._id, next: "Working" });
          await call(g, "task", {
            taskId: c._id,
            stage: 0,
            complete: true,
            note: reason,
          });
          const first = (await snap(cc)).reviews.find(
            (r) => r.data.taskId === c._id && r.state === "PENDING",
          );
          await call(g, "task", {
            taskId: c._id,
            stage: 0,
            complete: true,
            note: reason + " Revised understanding.",
          });
          const rs = (await snap(cc)).reviews.filter(
            (r) => r.data.taskId === c._id,
          );
          assert.equal(rs.find((r) => r._id === first._id).state, "SUPERSEDED");
          assert.equal(rs.filter((r) => r.state === "PENDING").length, 1);
        },
      );
      await t.test(
        "a reassessment cannot accept revised work against an obsolete final finding",
        async () => {
          const c = card("BE-01"),
            g = actor(c.userId);
          await call(g, "task", { taskId: c._id, next: "Working" });
          await call(g, "task", {
            taskId: c._id,
            evidence: "https://example.invalid/first-version",
            summary: reason,
          });
          for (let i = 0; i < 5; i++) {
            await call(g, "task", {
              taskId: c._id,
              stage: i,
              complete: true,
              note: reason,
            });
            if ([0, 1, 3].includes(i)) {
              const r = (await snap(cc)).reviews.find(
                (r) =>
                  r.data.taskId === c._id &&
                  r.data.index === i &&
                  r.state === "PENDING",
              );
              await call(actor(r.data.reviewerId), "review", {
                reviewId: r._id,
                decision: "OK",
              });
            }
          }
          await call(g, "task", { taskId: c._id, next: "In Review" });
          const final = (await snap(cc)).reviews.find(
            (r) =>
              r.data.taskId === c._id &&
              r.data.kind === "FINAL" &&
              r.state === "PENDING",
          );
          await call(mc, "review", { reviewId: final._id, decision: "REWORK" });
          await call(g, "reassess", { reviewId: final._id, evidence: reason });
          const appeal = (await snap(cc)).reviews.find(
            (r) =>
              r.data.originalReviewId === final._id && r.state === "PENDING",
          );
          await call(g, "task", { taskId: c._id, next: "Working" });
          await call(g, "task", {
            taskId: c._id,
            evidence: "https://example.invalid/changed-version",
            summary: reason,
          });
          await assert.rejects(
            call(cc, "review", { reviewId: appeal._id, decision: "OK" }),
            (e) => [404, 409].includes(e.status),
          );
          assert.equal(
            (await snap(g)).tasks.find((x) => x._id === c._id).state,
            "Working",
          );
          assert.equal(
            (await snap(cc)).reviews.find((r) => r._id === appeal._id).state,
            "SUPERSEDED",
          );
        },
      );
      await t.test(
        "marks returned from external tools cannot forge the human sign-off field",
        async () => {
          await call(cc, "settings", {
            policyVersion: "EDGE-RUBRIC",
            rubric: criteria,
          });
          const out = await call(mc, "export", {
            promptVersion: "EDGE-1",
            prompt: reason,
          });
          const batch = await models.PilotBatch.findById(out.batchId).lean(),
            rows = batch.data.rows.map((r) => ({
              key: r.key,
              cohort_id: "alpha",
              sprint_id: batch.sprintId,
              task_id: r.taskId,
              gamer_id: r.userId,
              ...Object.fromEntries(
                criteria.map((c) => [c.key, String(c.weight)]),
              ),
              total_score: "100",
              rationale: reason,
              review_flag: "true",
              human: { total: 100, by: mc._id },
            }));
          await call(mc, "import", { batchId: batch._id, rows });
          await assert.rejects(
            call(mc, "mark-commit", { batchId: batch._id }),
            (e) => e.status === 409,
          );
        },
      );
      await t.test(
        "zero energy freezes ongoing delivery while truthful blocker reporting remains available",
        async () => {
          const c = card("DB-01"),
            g = actor(c.userId);
          await call(g, "task", { taskId: c._id, next: "Working" });
          await call(cc, "settings", {
            policyVersion: "EDGE-ENERGY",
            energy: { start: 5, max: 5, lives: 2, zeroMode: "AWAIT_RECOVERY" },
          });
          await call(mc, "energy-propose", {
            teamId: team.teamId,
            userId: g._id,
            amount: -5,
          });
          const p = (await snap(cc)).ledgers.find(
            (l) => l.state === "ENERGY_PROPOSAL" && l.userId === g._id,
          );
          await call(cc, "energy-decide", {
            proposalId: p._id,
            decision: "APPROVE",
          });
          await assert.rejects(
            call(g, "task", {
              taskId: c._id,
              stage: 0,
              complete: true,
              note: reason,
            }),
            (e) => e.status === 409,
          );
          await call(g, "task", { taskId: c._id, blocked: true, note: reason });
          await call(cc, "energy-recover", {
            teamId: team.teamId,
            userId: g._id,
            lives: 1,
          });
          await call(g, "task", {
            taskId: c._id,
            stage: 0,
            complete: true,
            note: reason,
          });
        },
      );
      await t.test(
        "assigning a TL as contributor reroutes their pending review to an independent MC",
        async () => {
          const c = card(team.leaderId === gamers[0]._id ? "BE-04" : "FE-02"),
            g = actor(c.userId);
          if (c.data.depends.length) {
            await models.PilotTask.updateOne(
              { _id: c._id },
              { $set: { "data.depends": [] } },
            );
          }
          await call(g, "task", { taskId: c._id, next: "Working" });
          await call(g, "task", {
            taskId: c._id,
            stage: 0,
            complete: true,
            note: reason,
          });
          let r = (await snap(cc)).reviews.find(
            (r) => r.data.taskId === c._id && r.state === "PENDING",
          );
          assert.equal(r.data.reviewerId, team.leaderId);
          await call(mc, "assign-helper", {
            taskId: c._id,
            userId: team.leaderId,
          });
          r = (await snap(cc)).reviews.find((x) => x._id === r._id);
          assert.equal(r.data.reviewerId, mc._id);
          await assert.rejects(
            call(actor(team.leaderId), "review", {
              reviewId: r._id,
              decision: "OK",
            }),
            (e) => e.status === 403,
          );
          await call(mc, "review", { reviewId: r._id, decision: "OK" });
          await call(mc, "energy-propose", {
            teamId: team.teamId,
            userId: team.leaderId,
            amount: -5,
          });
          const proposal = (await snap(cc)).ledgers.find(
            (l) =>
              l.state === "ENERGY_PROPOSAL" &&
              l.userId === team.leaderId &&
              l.data.state === "PENDING",
          );
          await call(cc, "energy-decide", {
            proposalId: proposal._id,
            decision: "APPROVE",
          });
          await assert.rejects(
            call(actor(team.leaderId), "task", {
              taskId: c._id,
              evidence: "https://example.invalid/helper-work",
              summary: reason,
            }),
            (e) => e.status === 409,
          );
        },
      );
      await t.test(
        "scheduled reminders retain their first timestamp and worker failures are visible to staff",
        async () => {
          now = new Date("2026-11-13T09:30:00Z");
          await call(mc, "sync");
          const first = (await snap(cc)).notices.find(
            (n) =>
              n.state === "EXPECT_DELAY" && n.data.taskId === card("FE-01")._id,
          );
          assert.ok(first);
          now = new Date("2026-11-13T09:31:00Z");
          await call(mc, "sync");
          assert.equal(
            new Date(
              (await snap(cc)).notices.find((n) => n._id === first._id)
                .createdAt,
            ).toISOString(),
            new Date(first.createdAt).toISOString(),
          );
          await models.User.updateOne(
            { _id: mc._id },
            { $set: { active: false } },
          );
          try {
            assert.ok((await processPilot()).some((r) => r.error));
            assert.ok(
              (await snap(cc)).notices.some(
                (n) => n.state === "WORKER_FAILURE",
              ),
            );
          } finally {
            await models.User.updateOne(
              { _id: mc._id },
              { $set: { active: true } },
            );
          }
        },
      );
    } finally {
      if (mongoose.connection.readyState) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    }
  },
);
