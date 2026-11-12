import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { models } from "../lib/db.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { supportAction } from "../lib/support.js";
import manifests from "../lib/pilot-manifests.json" with { type: "json" };
import partB from "../lib/pilot-part-b.json" with { type: "json" };
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";

test(
  "Sprint 4 Help Passes: sponsorship settlement, verified AI credit and carry-forward",
  {
    skip: !process.env.TEST_MONGODB_URI,
    timeout: 120000,
  },
  async (t) => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = "/pilot_sprint4_help";
    process.env.MONGODB_URI = uri.toString();
    t.after(() => mongoose.disconnect());
    const { cc, mc, gamers, teams, cohortId } = await pilotFixture(2);
    const [requester, donor, discovery, quest, noCredit, outsider] = gamers;
    const teamId = teams[0].id;
    let now = new Date("2025-11-24T07:00:00Z");
    const reason =
      "Verified synthetic evidence for an isolated Help Pass workflow.";
    const call = (actor, action, body = {}) =>
      pilotAction(
        actor,
        action,
        { requestId: randomUUID(), reason, ...body },
        now,
      );
    const act = (actor, action, body = {}) =>
      call(actor, action, { teamId, ...body });
    const snap = (actor) => pilotSnapshot(actor, now);
    const category = "COGNITION";
    const help = (actor, kind, body = {}) =>
      act(actor, "help", { category, package: kind, ...body });
    const grant = (actor, amount = 3) =>
      act(cc, "help-grant", { userId: actor._id, amount });
    const exhaust = async (actor) => {
      await grant(actor);
      for (let pass = 0; pass < 3; pass++) await help(actor, "MC_ONE_TO_ONE");
    };
    const own = async (actor, state) =>
      (await snap(actor)).ledgers.filter(
        (row) => row.state === state && row.userId === actor._id,
      );
    const balance = async (actor, sprintId) =>
      (await own(actor, "HELP_PASS"))
        .filter((row) => row.sprintId === sprintId)
        .reduce((total, row) => total + row.data.amount, 0);

    const prompt = "https://example.invalid/approved-qa-prompt";
    const startSprint = async (number, start, friday) => {
      const config = {
        ...sprintConfig(teams, mc, 2),
        number,
        kickoffStart: start + "T04:30:00Z",
        kickoffEnd: start + "T06:30:00Z",
        dueAt: friday + "T11:30:00Z",
        contentApproval: reason,
        template: number === 5 ? partB.sprints[2] : { ...manifests.sprints[1], number },
      };
      if (number === 5) {
        config.resources = Object.fromEntries(
          config.template.tasks.map(({ id }) => [
            id,
            { author: "CURRICULUM", approval: reason, url: prompt, version: "QA" },
          ]),
        );
        for (const team of config.teams)
          team.owners = Object.fromEntries(
            config.template.tasks.map(({ id, owner }) => [
              id,
              team.members["ABCDE".indexOf(owner)],
            ]),
          );
      }
      for (const task of config.template.tasks) {
        if (
          task ===
          config.template.tasks.find((item) => item.owner === task.owner)
        ) {
          const basic = config.resources[task.id];
          basic.AI_PROMPT = { ...basic, url: prompt };
        }
      }
      await call(cc, "draft", { config });
      await call(cc, "approve");
      await call(cc, "load");
      await act(mc, "kickoff", { evidence: reason });
      await call(cc, "settings", {
        policyVersion: "QA-help-prices",
        assistance: { GUIDE: 1, AI_PROMPT: 1, MC_ONE_TO_ONE: 1 },
      });
      await call(cc, "challenge-publish", {
        policyVersion: "QA-challenge-prompt",
        quests: Array.from({ length: 5 }, (_, i) => ({
          id: "quest-" + i,
          role: i < 3 ? "PRIMARY" : "SECONDARY",
          title: "QA quest " + i,
          instructions: reason,
        })),
        discovery: reason,
        goat: reason,
      });
      return (await snap(cc)).sprint._id;
    };
    const taskFor = async (actor, index = 0) =>
      (await snap(actor)).tasks
        .filter((task) => task.userId === actor._id)
        .sort(
          (a, b) =>
            manifests.sprints[1].tasks.findIndex(
              (item) => item.id === a.data.code,
            ) -
            manifests.sprints[1].tasks.findIndex(
              (item) => item.id === b.data.code,
            ),
        )[index]._id;
    const challenge = async (
      actor,
      kind,
      decision = "PASS",
      code = "quest-0",
    ) => {
      await act(actor, "challenge-start", { kind, code });
      const attemptId = (await snap(actor)).daily.find(
        (row) =>
          row.state === "CHALLENGE" &&
          row.data.kind === kind &&
          row.data.status === "WORKING",
      )._id;
      await act(actor, "challenge-submit", {
        attemptId,
        evidence: "https://example.invalid/evidence",
      });
      if (decision) await act(mc, "challenge-review", { attemptId, decision });
      return attemptId;
    };

    for (const number of [1, 2, 3]) await models.PilotSprint.create({
      _id: `fixture-only-sprint-${number}`,
      cohortId,
      state: "CLOSED",
      version: 1,
      createdAt: new Date(Date.UTC(2025, 10, 18 + number)),
      data: { number, teams: [], acceptances: teams.map(team => ({ teamId: team.id, decision: "ACCEPTED", key: `Key ${number}` })), gates: [] },
    });
    const sprint4 = await startSprint(4, "2025-11-24", "2025-11-28");

    await t.test(
      "PB-QA-050/051/055: consent, free support, reservation, completed MC session and one lifetime charge",
      async () => {
        const sponsor = (actor, selected = donor) =>
          act(actor, "help-sponsor-request", {
            category,
            donorId: selected._id,
          });
        const respond = (actor, sponsorshipId, decision, body = {}) =>
          act(actor, "help-sponsor-response", {
            sponsorshipId,
            decision,
            ...body,
          });
        await assert.rejects(sponsor(requester), /Exhaust your three/);
        await exhaust(requester);
        await exhaust(noCredit);
        assert.ok((await help(requester, "ESSENTIAL")).ticketId);
        assert.equal(await balance(requester, sprint4), 0);
        await assert.rejects(sponsor(requester, outsider), /active teammate/);
        await assert.rejects(
          sponsor(requester, requester),
          /other than yourself/,
        );
        await assert.rejects(sponsor(requester), /unused personal/);
        await grant(donor, 1);

        const first = await sponsor(requester);
        await assert.rejects(sponsor(requester), /pending sponsorship/);
        assert.equal(
          (await snap(donor)).ledgers.filter(
            (row) => row._id === first.sponsorshipId,
          ).length,
          1,
        );
        assert.equal(
          (await snap(discovery)).ledgers.some(
            (row) => row._id === first.sponsorshipId,
          ),
          false,
        );
        await assert.rejects(
          respond(discovery, first.sponsorshipId, "APPROVE"),
          { status: 403 },
        );
        await respond(donor, first.sponsorshipId, "DECLINE");
        const cancelled = await sponsor(requester);
        await respond(requester, cancelled.sponsorshipId, "CANCEL");
        assert.equal(await balance(donor, sprint4), 1);

        const { sponsorshipId } = await sponsor(requester);
        const competing = await sponsor(noCredit);
        const replay = { requestId: randomUUID() };
        const approved = await respond(donor, sponsorshipId, "APPROVE", replay);
        assert.deepEqual(
          await respond(donor, sponsorshipId, "APPROVE", replay),
          approved,
        );
        const { ticketId } = approved;
        const ticket = await models.HelpTicket.findById(ticketId).lean();
        assert.equal(ticket.assignedTo, mc._id);
        assert.equal(ticket.createdBy, requester._id);
        assert.equal(await balance(donor, sprint4), 1);
        await assert.rejects(help(donor, "MC_ONE_TO_ONE"), /Insufficient/);
        await assert.rejects(
          respond(donor, competing.sponsorshipId, "APPROVE"),
          /awaiting completion/,
        );
        await supportAction(mc, "ticket-response", {
          ticketId,
          guidance: reason,
        });
        await supportAction(requester, "attempt", {
          ticketId,
          approach: reason,
          rationale: reason,
          result: "SUCCESSFUL",
          artifact: reason,
        });
        const attempt = await models.SupportAttempt.findOne({
          ticketId,
        }).lean();
        await supportAction(mc, "attempt-verify", {
          ticketId,
          attemptId: attempt._id,
          reason,
        });
        const resolve = () =>
          supportAction(mc, "ticket-state", {
            ticketId,
            state: "RESOLVED",
            reason,
          });
        await assert.rejects(resolve(), /completed MC 1:1/);
        const intervention = {
          ticketId,
          kind: "INT01",
          performerId: mc._id,
          guidance: reason,
          outcome: reason,
          artifact: reason,
        };
        await supportAction(mc, "intervention", {
          ...intervention,
          plannedAt: new Date().toISOString(),
        });
        await assert.rejects(resolve(), /completed MC 1:1/);
        assert.equal(await balance(donor, sprint4), 1);
        await supportAction(mc, "intervention", {
          ...intervention,
          actualAt: new Date().toISOString(),
        });
        await resolve();
        assert.equal(
          (await models.HelpTicket.findById(ticketId).lean()).state,
          "RESOLVED",
        );
        assert.equal(await balance(donor, sprint4), 0);
        assert.equal(await balance(requester, sprint4), 0);
        await assert.rejects(
          respond(donor, competing.sponsorshipId, "APPROVE"),
          /already sponsored/,
        );
        await supportAction(requester, "ticket-state", {
          ticketId,
          state: "IN_PROGRESS",
          reason,
        });
        await supportAction(mc, "ticket-response", {
          ticketId,
          guidance: reason,
        });
        await resolve();
        assert.equal(await balance(donor, sprint4), 0);
        assert.equal(
          await models.PilotLedger.countDocuments({
            state: { $in: ["ASSESSMENT", "CORE", "BONUS", "TROPHY"] },
          }),
          0,
        );
      },
    );

    await t.test(
      "PB-QA-052/053: verified challenges, task scope, one award per week and one use per credit",
      async () => {
        const taskId = await taskFor(discovery);
        const earned = (body = {}) =>
          help(discovery, "EARNED_AI_PROMPT", { taskId, ...body });
        await exhaust(discovery);
        await assert.rejects(earned(), /No earned guided AI Help/);
        await challenge(discovery, "DISCOVERY");
        await challenge(quest, "QUEST");
        assert.equal(
          (await own(quest, "EARNED_AI_HELP"))[0].data.source,
          "WEEKLY_QUEST",
        );
        await grant(quest);
        await assert.rejects(
          help(quest, "EARNED_AI_PROMPT", { taskId: await taskFor(quest) }),
          /Exhaust your three/,
        );
        now = new Date("2025-11-25T07:00:00Z");
        await challenge(discovery, "DISCOVERY");
        now = new Date("2025-11-26T07:00:00Z");
        const attemptId = await challenge(discovery, "DISCOVERY", "REWORK");
        assert.equal((await own(discovery, "EARNED_AI_HELP")).length, 0);
        await act(discovery, "challenge-submit", {
          attemptId,
          evidence: "https://example.invalid/reworked",
        });
        assert.equal((await own(discovery, "EARNED_AI_HELP")).length, 0);
        await act(mc, "challenge-review", { attemptId, decision: "PASS" });
        await challenge(discovery, "QUEST");
        const [credit, extra] = await own(discovery, "EARNED_AI_HELP");
        assert.equal(extra, undefined);
        assert.equal(credit.data.source, "DAILY_DISCOVERIES");
        assert.equal(credit.data.evidenceIds.length, 3);
        await assert.rejects(
          earned({ taskId: await taskFor(quest) }),
          /assigned contribution/,
        );
        await assert.rejects(
          earned({ taskId: await taskFor(discovery, 1) }),
          /resource is unavailable/,
        );
        assert.equal(
          (await own(discovery, "EARNED_AI_HELP"))[0].data.spentAt,
          undefined,
        );
        const requestId = randomUUID();
        assert.equal((await earned({ requestId })).resource, prompt);
        assert.equal((await earned({ requestId })).resource, prompt);
        await assert.rejects(earned(), /No earned guided AI Help/);
        assert.equal(await balance(discovery, sprint4), 0);
      },
    );

    await t.test(
      "PB-QA-054: one carry-forward plus the new week's earned credit, with approvals pending",
      async () => {
        assert.deepEqual((await snap(cc)).sprint.data.acceptances, []);
        // Supply synthetic prerequisite records solely to load the next QA week.
        await models.PilotSprint.updateOne(
          { _id: sprint4 },
          { $set: { state: "CLOSED" } },
        );
        for (const sprint of await models.PilotSprint.find({ state: "CLOSED" }).lean())
          await models.PilotSprint.updateOne(
            { _id: sprint._id },
            { $set: { "data.acceptances": teams.map(({ id }) => ({
              teamId: id, decision: "ACCEPTED", key: `Key ${sprint.data.number}`,
            })) } },
          );
        now = new Date("2025-12-01T07:00:00Z");
        const sprint5 = await startSprint(5, "2025-12-01", "2025-12-05");
        await models.PilotSprint.updateMany(
          { state: "CLOSED" },
          { $set: { "data.acceptances": [] } },
        );
        await exhaust(quest);
        await grant(donor);
        await assert.rejects(
          act(quest, "help-sponsor-request", { donorId: donor._id, category }),
          /already sponsored/,
        );
        await challenge(quest, "QUEST");
        const taskId = await taskFor(quest);
        const claim = () => help(quest, "EARNED_AI_PROMPT", { taskId });
        assert.equal((await claim()).resource, prompt);
        const credits = await own(quest, "EARNED_AI_HELP");
        assert.equal(credits.length, 2);
        assert.equal(
          credits.find((row) => row.sprintId === sprint4).data.spentInSprintId,
          sprint5,
        );
        assert.equal(
          credits.find((row) => row.sprintId === sprint5).data.spentAt,
          undefined,
        );
        assert.equal((await claim()).resource, prompt);
        await assert.rejects(claim(), /No earned guided AI Help/);
        assert.equal(
          await models.PilotLedger.countDocuments({
            state: { $in: ["ASSESSMENT", "CORE", "BONUS"] },
          }),
          0,
        );
        for (const sprint of await models.PilotSprint.find().lean())
          assert.deepEqual(sprint.data.acceptances, []);
      },
    );
  },
);
