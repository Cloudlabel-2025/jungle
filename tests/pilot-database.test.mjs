import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { models } from "../lib/db.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { scope, guardTargets } from "../lib/access-scope.js";
import { hash, day } from "../lib/pilot-rules.js";
import { criteria } from "../lib/week-one-catalog.js";
test(
  "pilot: five-team lifecycle, independent reviews, handovers, Spark, marking and 27 simultaneous actor writes",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 180000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/pilot_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    try {
      const f = await pilotFixture(),
        { cc, cc2, mc, otherMC, gamers, teams } = f;
      let now = new Date("2026-11-07T07:00:00Z");
      const reason =
          "Synthetic independently verified disposable test evidence.",
        call = (u, a, b = {}) =>
          pilotAction(u, a, { requestId: randomUUID(), reason, ...b }, now),
        snap = (u) => pilotSnapshot(u, now);
      assert.equal((await scope(mc)).teamIds.length, 5);
      assert.equal((await scope(otherMC)).teamIds.length, 0);
      await assert.rejects(
        guardTargets(gamers[0], { userId: { $ne: null } }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        guardTargets(gamers[0], { teamId: teams[1].id }),
        (e) => e.status === 403,
      );
      await assert.rejects(
        call(gamers[0], "draft", { config: sprintConfig(teams, mc) }),
        (e) => e.status === 403,
      );
      await call(cc, "draft", { config: sprintConfig(teams, mc) });
      await assert.rejects(call(cc, "load"), (e) => e.status === 409);
      await call(cc, "approve");
      await call(cc, "load");
      let s = await snap(cc);
      assert.equal(s.tasks.length, 100);
      assert.equal((await snap(gamers[0])).tasks.length, 20);
      assert.equal((await snap(otherMC)).tasks.length, 0);
      assert.equal((await snap(gamers[0])).setup, null);
      const c0 = s.tasks.find(
        (c) => c.teamId === teams[0].id && c.data.code === "FE-01",
      );
      await assert.rejects(
        call(gamers[0], "task", { taskId: c0._id, next: "Working" }),
        (e) => e.status === 409,
      );
      now = new Date("2026-11-09T07:00:00Z");
      for (const t of teams)
        await call(mc, "kickoff", { teamId: t.id, evidence: reason });
      s = await snap(cc);
      assert.ok(s.teams.every((t) => t.members.includes(t.leaderId)));
      await call(gamers[0], "task", { taskId: c0._id, next: "Working" });
      await call(gamers[0], "task", {
        taskId: c0._id,
        evidence: "https://example.invalid/repo/commit",
        summary: reason,
      });
      for (let i = 0; i < 5; i++) {
        await call(gamers[0], "task", {
          taskId: c0._id,
          stage: i,
          complete: true,
          note: reason,
        });
        if ([0, 1, 3].includes(i)) {
          const r = (await snap(cc)).reviews.find(
            (r) =>
              r.data.taskId === c0._id &&
              r.data.index === i &&
              r.state === "PENDING",
          );
          const reviewer = [mc, ...gamers].find(
            (u) => u._id === r.data.reviewerId,
          );
          await assert.rejects(
            call(gamers[0], "review", { reviewId: r._id, decision: "OK" }),
          );
          await call(reviewer, "review", { reviewId: r._id, decision: "OK" });
        }
      }
      await call(gamers[0], "task", { taskId: c0._id, next: "In Review" });
      let r = (await snap(cc)).reviews.find(
        (r) =>
          r.data.taskId === c0._id &&
          r.data.kind === "FINAL" &&
          r.state === "PENDING",
      );
      await call(mc, "review", { reviewId: r._id, decision: "OK" });
      assert.equal(
        (await snap(gamers[0])).tasks.find((c) => c._id === c0._id).state,
        "Accepted",
      );
      const finalReviewId = r._id;
      for (let i = 0; i < 3; i++) {
        await call(gamers[0], "reassess", {
          reviewId: finalReviewId,
          evidence: reason,
        });
        const appeal = (await snap(cc)).reviews.find(
          (v) => v.data.kind === "APPEAL" && v.state === "PENDING",
        );
        await call(cc, "review", { reviewId: appeal._id, decision: "OK" });
      }
      await assert.rejects(
        call(gamers[0], "reassess", {
          reviewId: finalReviewId,
          evidence: reason,
        }),
        (e) => e.status === 409,
      );
      await call(cc, "audit-review", {
        reviewId: finalReviewId,
        evidence: reason,
      });
      const auditReview = (await snap(cc2)).reviews.find(
        (v) => v.data.kind === "APPEAL" && v.state === "PENDING",
      );
      await call(cc2, "review", { reviewId: auditReview._id, decision: "OK" });

      const fe4 = s.tasks.find(
          (c) => c.teamId === teams[0].id && c.data.code === "FE-04",
        ),
        fe2 = s.tasks.find(
          (c) => c.teamId === teams[0].id && c.data.code === "FE-02",
        );
      await models.PilotTask.updateOne(
        { _id: fe2._id },
        { $set: { state: "Accepted", "data.acceptedAt": now.toISOString() } },
      );
      await call(mc, "handover", {
        fromId: c0._id,
        toId: fe4._id,
        evidence: reason,
      });
      await call(mc, "handover", {
        fromId: fe2._id,
        toId: fe4._id,
        evidence: reason,
      });
      let hs = (await snap(cc)).handovers;
      await assert.rejects(
        call(gamers[4], "receive", { handoverId: hs[0]._id }),
        (e) => e.status === 409,
      );
      now = new Date("2026-11-09T09:00:00Z");
      for (const h of hs)
        await call(gamers[4], "receive", { handoverId: h._id });
      await call(gamers[4], "task", { taskId: fe4._id, next: "Working" });
      const st = await snap(gamers[0]),
        list = st.tasks
          .filter((c) => teams[0].members.includes(c.userId))
          .sort((a, b) => a._id.localeCompare(b._id)),
        answer =
          list[
            parseInt(
              hash(day(now, st.sprint.data.calendar) + teams[0].id).slice(0, 6),
              16,
            ) % list.length
          ].userId;
      const requestId = randomUUID();
      await Promise.all([
        pilotAction(
          gamers[0],
          "spark",
          { teamId: teams[0].id, answer, requestId },
          now,
        ),
        pilotAction(
          gamers[0],
          "spark",
          { teamId: teams[0].id, answer, requestId },
          now,
        ),
      ]);
      assert.equal(
        (await snap(gamers[0])).ledgers.filter((x) => x.state === "SPARK")
          .length,
        1,
      );
      await call(cc, "settings", { policyVersion: "QA-1", rubric: criteria });
      const exported = await call(mc, "export", {
        promptVersion: "QA-1",
        prompt:
          "Grade only supplied attributable evidence and preserve unobserved criteria.",
      });
      const batch = await models.PilotBatch.findById(exported.batchId).lean(),
        rows = batch.data.rows.map((r) =>
          Object.fromEntries([
            ["key", r.key],
            ["cohort_id", "alpha"],
            ["sprint_id", s.sprint._id],
            ["task_id", r.taskId],
            ["gamer_id", r.userId],
            ...criteria.map((c) => [c.key, String(c.weight * 0.7)]),
            ["total_score", "70"],
            ["rationale", reason],
            ["review_flag", "true"],
          ]),
        );
      await call(mc, "import", { batchId: batch._id, rows });
      await assert.rejects(
        call(mc, "mark-commit", { batchId: batch._id }),
        (e) => e.status === 409,
      );
      for (const row of rows)
        await call(mc, "mark-review", {
          batchId: batch._id,
          key: row.key,
          ratings: Object.fromEntries(criteria.map((c) => [c.key, 4])),
        });
      await call(mc, "mark-commit", { batchId: batch._id });
      assert.ok(
        (await snap(gamers[0])).ledgers.some(
          (x) => x.state === "ASSESSMENT" && x.data.human.total === 100,
        ),
      );
      for (const t of teams) {
        for (let i = 1; i <= 7; i++)
          await call(cc, "gate", {
            teamId: t.id,
            index: i,
            decision: "PASS",
            evidence: "https://example.invalid/executed-tests",
          });
        await call(cc, "accept", { teamId: t.id, decision: "ACCEPTED" });
        await call(cc, "core-results", {
          teamId: t.id,
          results: t.members.map((userId) => ({
            userId,
            score: 82.2,
            evidence: "https://example.invalid/verified-core",
          })),
        });
      }
      await call(cc, "close");
      await call(cc, "draft", { config: sprintConfig(teams, mc, 2) });
      await call(cc, "approve");
      await call(cc, "load");
      now = new Date("2026-11-16T07:00:00Z");
      for (const t of teams)
        await call(mc, "kickoff", { teamId: t.id, evidence: reason });
      s = await snap(cc);
      assert.ok(s.teams.every((t) => t.clCap === 5));
      const bank = Array.from({ length: 35 }, (_, i) => ({
        id: `CL-${i}`,
        kind: i < 20 ? "CL1" : "CL2",
        title: `Synthetic client task ${i}`,
        instructions: reason,
        acceptance: reason,
        minutes: 60,
      }));
      await call(cc, "bank", { policyVersion: "BANK-1", items: bank });
      await call(cc, "bank", { policyVersion: "BANK-2", items: bank });
      await assert.rejects(
        call(cc, "bank", {
          policyVersion: "BANK-1",
          items: bank.map((x, i) =>
            i ? x : { ...x, title: "Changed historical content" },
          ),
        }),
        (e) => e.status === 409,
      );
      for (const t of teams)
        await call(mc, "cl-propose", {
          teamId: t.id,
          itemCode: "CL-0",
          userId: t.members[0],
        });
      const work = gamers.map((g) => ({
        g,
        card: s.tasks.find((c) => c.userId === g._id),
      }));
      await Promise.all([
        ...work.map(({ g, card }) =>
          call(g, "task", {
            taskId: card._id,
            blocked: false,
            note: `No blocker reported by ${g._id}.`,
          }),
        ),
        call(mc, "sync"),
        call(cc, "cl-release", {
          itemCode: "CL-0",
          eventKey: "common-event-qa",
        }),
      ]);
      s = await snap(cc);
      const ds = s.clients.filter((c) => c.state === "ASSIGNED");
      assert.equal(ds.length, 5);
      assert.equal(
        new Set(ds.map((d) => new Date(d.data.releaseAt).toISOString())).size,
        1,
      );
      for (const { g, card } of work)
        assert.equal(
          (await snap(g)).tasks.find((c) => c._id === card._id).data.blocker.by,
          g._id,
        );
      await call(cc, "cl-release", {
        itemCode: "CL-0",
        eventKey: "common-event-qa",
      });
      assert.equal(
        (await snap(cc)).clients.filter((c) => c.state === "ASSIGNED").length,
        5,
      );
      assert.equal(
        (await snap(gamers[0])).policies.some((p) => p.state === "BANK"),
        false,
      );
      await call(cc, "settings", {
        policyVersion: "CLIENT-ENERGY-QA",
        energy: { start: 5, max: 5, lives: 2, zeroMode: "AWAIT_RECOVERY" },
      });
      const cl = ds.find((c) => c.teamId === teams[0].id);
      await call(gamers[0], "cl-work", { clientId: cl._id, next: "WORKING" });
      await call(mc, "energy-propose", {
        teamId: teams[0].id,
        userId: gamers[0]._id,
        amount: -5,
      });
      const ep = (await snap(cc)).ledgers.find(
        (l) => l.state === "ENERGY_PROPOSAL",
      );
      await call(cc, "energy-decide", {
        proposalId: ep._id,
        decision: "APPROVE",
      });
      await assert.rejects(
        call(gamers[0], "cl-work", {
          clientId: cl._id,
          next: "IN_REVIEW",
          evidence: "https://example.invalid/client-test",
        }),
        (e) => e.status === 409,
      );
      await call(cc, "energy-recover", {
        teamId: teams[0].id,
        userId: gamers[0]._id,
        lives: 1,
      });
      await call(gamers[0], "cl-work", {
        clientId: cl._id,
        next: "IN_REVIEW",
        evidence: "https://example.invalid/client-test",
      });
      const assignments = teams.map((t) => ({
        teamId: t.id,
        userId: t.members[0],
        reason,
      }));
      for (const key of ["second-event-qa", "third-event-qa"])
        await call(cc, "cl-release", {
          itemCode: "CL-1",
          eventKey: key,
          assignments,
        });
      const deliveries = (await snap(cc)).clients;
      for (const t of teams)
        assert.equal(
          deliveries.filter(
            (c) =>
              c.teamId === t.id &&
              ["ASSIGNED", "WORKING", "REWORK"].includes(c.state),
          ).length,
          2,
        );
      assert.equal(
        deliveries.filter((c) => c.state === "INELIGIBLE").length,
        4,
      );
      await call(mc, "cl-work", { clientId: cl._id, next: "ACCEPTED" });
      await call(cc, "access", { userId: cc2._id, permissions: [] });
      await assert.rejects(
        call(cc2, "settings", { policyVersion: "unauthorised" }),
        (e) => e.status === 403,
      );
      assert.equal(await snap(cc2), null);
    } finally {
      if (mongoose.connection.readyState) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    }
  },
);
