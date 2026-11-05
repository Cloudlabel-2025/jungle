import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { models } from "../lib/db.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";

test(
  "pilot: independent energy decisions, paid help, optional work, roster holds and real Phase 2 cards",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/pilot_recovery_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    try {
      const { cc, cc2, mc, gamers, teams } = await pilotFixture(),
        g = gamers[0],
        t = teams[0];
      let now = new Date("2026-11-07T07:00:00Z");
      const reason =
          "Verified synthetic evidence for disposable database tests only.",
        call = (u, a, b = {}) =>
          pilotAction(u, a, { reason, requestId: randomUUID(), ...b }, now),
        snap = (u) => pilotSnapshot(u, now);
      await call(cc, "draft", { config: sprintConfig(teams, mc) });
      await call(cc, "approve");
      await call(cc, "load");
      now = new Date("2026-11-09T07:00:00Z");
      for (const team of teams)
        await call(mc, "kickoff", { teamId: team.id, evidence: reason });
      await call(cc, "settings", {
        policyVersion: "QA-ENERGY",
        energy: { start: 5, max: 5, lives: 2, zeroMode: "AWAIT_RECOVERY" },
        assistance: { GUIDE: 1, AI_PROMPT: 2, MC_ONE_TO_ONE: 2 },
        bonusCap: 5,
      });
      await call(mc, "energy-propose", {
        teamId: t.id,
        userId: g._id,
        amount: -5,
      });
      let p = (await snap(cc)).ledgers.find(
        (l) => l.state === "ENERGY_PROPOSAL",
      );
      await assert.rejects(
        call(mc, "energy-decide", { proposalId: p._id, decision: "APPROVE" }),
        (e) => e.status === 403,
      );
      await call(cc2, "energy-decide", {
        proposalId: p._id,
        decision: "APPROVE",
      });
      let card = (await snap(g)).tasks.find((c) => c.userId === g._id);
      await assert.rejects(
        call(g, "task", { taskId: card._id, next: "Working" }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        call(cc, "energy-recover", { teamId: t.id, userId: g._id, lives: 1.5 }),
        (e) => e.status === 400,
      );
      await call(cc, "energy-recover", {
        teamId: t.id,
        userId: g._id,
        lives: 1,
      });
      await call(g, "task", { taskId: card._id, next: "Working" });
      await call(cc, "help-grant", { teamId: t.id, userId: g._id, amount: 2 });
      await assert.rejects(
        call(g, "help", { teamId: t.id, taskId: card._id, package: "GUIDE" }),
        (e) => e.status === 409,
      );
      assert.equal(
        (await snap(g)).ledgers
          .filter((l) => l.state === "HELP_PASS")
          .reduce((n, l) => n + l.data.amount, 0),
        2,
      );
      await call(g, "help", {
        teamId: t.id,
        package: "ESSENTIAL",
        category: "COGNITION",
      });
      assert.ok(await models.HelpTicket.exists({ createdBy: g._id }));
      await call(cc, "challenge-publish", {
        policyVersion: "QA-OPTIONAL",
        quests: Array.from({ length: 5 }, (_, i) => ({
          id: `Q${i}`,
          title: `Synthetic quest ${i}`,
          instructions: reason,
          role: i < 3 ? "PRIMARY" : "SECONDARY",
        })),
        discovery: reason,
        goat: reason,
      });
      await call(g, "challenge-start", { teamId: t.id, kind: "DISCOVERY" });
      let attempt = (await snap(g)).daily.find((d) => d.state === "CHALLENGE");
      await call(g, "challenge-submit", {
        teamId: t.id,
        attemptId: attempt._id,
        evidence: "https://example.invalid/actual-work",
      });
      await assert.rejects(
        call(g, "challenge-review", {
          teamId: t.id,
          attemptId: attempt._id,
          decision: "PASS",
        }),
        (e) => e.status === 403,
      );
      await call(mc, "challenge-review", {
        teamId: t.id,
        attemptId: attempt._id,
        decision: "PASS",
      });
      assert.equal(
        (await snap(g)).ledgers.filter((l) => l.state === "TROPHY").length,
        1,
      );
      const template = {
        tasks: [
          {
            id: "EX-01",
            title: "Approved synthetic extension",
            instructions: reason,
            tt: "TT1",
            owner: "A",
            depends: [],
            hours: 2,
          },
        ],
        resources: {
          "EX-01": {
            author: "CURRICULUM",
            url: "https://example.invalid/extension",
            version: "QA-1",
            approval: reason,
          },
        },
      };
      await call(cc, "extension-publish", {
        policyVersion: "QA-EXTENSION",
        template,
      });
      const extensionId = (await snap(cc)).sprint.data.extensionIds[0];
      await assert.rejects(
        call(g, "extension-start", { teamId: t.id, extensionId }),
        (e) => e.status === 409,
      );
      for (let i = 1; i <= 7; i++)
        await call(cc, "gate", {
          teamId: t.id,
          index: i,
          decision: "PASS",
          evidence: "https://example.invalid/verified-tests",
        });
      await call(cc, "accept", { teamId: t.id, decision: "ACCEPTED" });
      await call(g, "extension-start", { teamId: t.id, extensionId });
      const ex = (await snap(g)).tasks.find(
        (c) => c.data.extensionId === extensionId,
      );
      assert.equal(ex.state, "Ready");
      await call(g, "task", { taskId: ex._id, next: "Working" });
      await assert.rejects(
        call(mc, "extension-verify", {
          teamId: t.id,
          extensionId,
          results: [
            {
              userId: g._id,
              bonus: 5,
              evidence: "https://example.invalid/test",
            },
          ],
        }),
        (e) => e.status === 409,
      );
      const leader = (await snap(cc)).teams.find(
        (x) => x.teamId === t.id,
      ).leaderId;
      await call(
        gamers.find((x) => x._id === leader),
        "daily-report",
        { teamId: t.id, kind: "TEAM_EOD", note: reason },
      );
      assert.ok((await snap(g)).meetings.some((x) => x.state === "TEAM_EOD"));
      await call(cc, "settings", {
        policyVersion: "QA-MIDPOINT",
        midpoint: { at: now.toISOString(), threshold: 60 },
      });
      for (const userId of t.members)
        await call(mc, "midpoint-open", {
          teamId: t.id,
          userId,
          score: 30,
          evidence: reason,
        });
      assert.ok(
        (await snap(g)).notices.some((x) => x.state === "TEAM_INTERVENTION"),
      );
      for (let i = 0; i < 2; i++) {
        await call(g, "midpoint-submit", {
          teamId: t.id,
          userId: g._id,
          evidence: "https://example.invalid/individual-attempt",
        });
        await call(mc, "midpoint-review", {
          teamId: t.id,
          userId: g._id,
          decision: "FAIL",
        });
      }
      await assert.rejects(
        call(g, "midpoint-submit", {
          teamId: t.id,
          userId: g._id,
          evidence: "https://example.invalid/third-attempt",
        }),
      );
      await call(cc, "midpoint-dispose", {
        teamId: t.id,
        userId: g._id,
        decision: "Continue with individually supervised coaching",
      });
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        { $set: { "data.recovery.published.at": "2026-11-09T07:01:00Z" } },
      );
      await assert.rejects(
        call(g, "daily", { teamId: t.id, kind: "JOURNAL", note: reason }),
        (e) => e.status === 409,
      );
      await call(cc, "reconcile-roster");
      await call(g, "daily", { teamId: t.id, kind: "JOURNAL", note: reason });
      assert.equal(
        (await snap(gamers[1])).daily.some((d) => d.userId === g._id),
        false,
      );
    } finally {
      if (mongoose.connection.readyState) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    }
  },
);
