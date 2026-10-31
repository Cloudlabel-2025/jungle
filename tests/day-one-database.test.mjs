import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { deduct, reconcile } from "../lib/engine.js";
import { localParts } from "../lib/day-one-rules.js";
import { dayOneAction, dayOneSnapshot, dayOneSignIn } from "../lib/day-one.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";

test(
  "Day 1 MongoDB acceptance: 25 users, evidence, concurrency, privacy, revisions, CC marking and gated tied prize",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/day1_acceptance_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const m of Object.values(models)) await m.init();
    try {
      const gamers = Array.from({ length: 25 }, (_, i) => ({
        _id: `g${i + 1}`,
        name: `Gamer ${String(i + 1).padStart(2, "0")}`,
        email: `g${i + 1}@example.invalid`,
        role: "GAMER",
        cohortId: "alpha",
      }));
      const cc = {
          _id: "cc",
          name: "Centre Lead",
          email: "cc@example.invalid",
          role: "CENTRE_COMMAND",
          cohortId: "alpha",
        },
        mc = {
          _id: "mc",
          name: "Mission Lead",
          email: "mc@example.invalid",
          role: "MISSION_COMMANDER",
          cohortId: "alpha",
        };
      await models.User.insertMany([
        ...gamers,
        cc,
        mc,
        {
          _id: "outside",
          name: "Other cohort",
          email: "other@example.invalid",
          role: "GAMER",
          cohortId: "other",
        },
      ]);
      const config = fixtureConfig(),
        call = (u, a, b = {}, time = "2026-11-02T03:00:00Z") =>
          dayOneAction(u, a, b, new Date(time));
      await assert.rejects(
        call(gamers[0], "release", { config, revision: 0 }),
        (e) => e.status === 403,
      );
      await call(cc, "release", { config, revision: 0 });
      assert.equal((await dayOneSnapshot(gamers[0])).config, null);
      assert.equal((await weekOneSnapshot(gamers[0])).days[0].state, "LOCKED");
      await assert.rejects(call(gamers[0], "clock"), (e) => e.status === 409);
      const control = async (u, action, day, time, values = {}) =>
        weekOneAction(
          u,
          action,
          {
            ...values,
            day,
            revision: (await weekOneSnapshot(u)).revision,
          },
          new Date(time),
        );
      await assert.rejects(
        control(gamers[0], "open", 1, "2026-11-02T03:00:00Z"),
        (e) => e.status === 403,
      );
      await control(mc, "open", 1, "2026-11-02T03:00:00Z");
      await control(mc, "publish-agenda", 1, config.officialStart, {
        text: "Independent research, classroom orientation, Showcase and reflection.",
      });
      await dayOneSignIn(gamers[0]);
      assert.equal((await dayOneSnapshot(mc)).roster.length, 25);
      await assert.rejects(
        call(mc, "verify", { userId: "outside" }),
        (e) => e.status === 403,
      );
      for (const g of gamers.slice(0, 3)) {
        await Promise.all(
          Array.from({ length: 4 }, () =>
            call(g, "clock", {}, "2026-11-02T03:29:00Z"),
          ),
        );
        await call(
          g,
          "sod",
          {
            text: "I will investigate my research question and verify sources.",
          },
          "2026-11-02T03:31:00Z",
        );
        await assert.rejects(call(g, "agenda-ack", {}, "2026-11-02T03:31:00Z"));
        await call(g, "agenda-view", {}, "2026-11-02T03:31:00Z");
        await call(g, "agenda-ack", {}, "2026-11-02T03:31:30Z");
        await call(g, "genre", { genreId: "genre-1" }, "2026-11-02T03:32:00Z");
        await call(g, "acknowledge", {}, "2026-11-02T03:33:00Z");
        await call(g, "start", {}, "2026-11-02T03:34:00Z");
        await call(
          g,
          "submit",
          { url: `https://chat.example/share/${g._id}` },
          g._id === "g3" ? "2026-11-02T06:00:00Z" : "2026-11-02T04:34:00Z",
        );
        await call(
          g,
          "eod",
          {
            text: "I learned to compare sources and verify AI claims.",
            mode: "VOICE",
          },
          "2026-11-02T11:29:00Z",
        );
      }
      assert.equal(await models.DayOneRecord.countDocuments(), 3);
      let p = (await dayOneSnapshot(gamers[0])).records[0];
      assert.equal(p.trophies, 14);
      assert.equal(p.badge, false);
      assert.equal(p.energy, 5);
      assert.equal(p.eod.mode, "VOICE");
      assert.equal(p.startedAt, "2026-11-02T03:34:00.000Z");
      assert.equal((await dayOneSnapshot(gamers[0])).records.length, 1);
      await assert.rejects(
        call(cc, "release", { config, revision: 1 }),
        (e) => e.status === 409,
      );
      const startVersion = p.version;
      await assert.rejects(
        call(mc, "markers", {
          userId: "outside",
          marker: "sod",
          value: true,
          reason: "Observed the original plan.",
        }),
        (e) => e.status === 404,
      );
      await assert.rejects(
        call(mc, "markers", {
          userId: "g1",
          marker: "sod",
          value: false,
          reason: "short",
        }),
      );
      await call(mc, "markers", {
        userId: "g1",
        version: p.version,
        marker: "sod",
        value: false,
        reason: "The plan was present but did not reflect the agreed focus.",
      });
      assert.equal((await dayOneSnapshot(gamers[0])).records[0].trophies, 14);
      await assert.rejects(
        call(gamers[0], "submit", {
          version: startVersion,
          url: "https://chat.example/share/stale",
          reason: "Trying a stale record revision.",
        }),
        (e) => e.status === 409,
      );
      for (const g of gamers.slice(0, 3)) {
        p = (await dayOneSnapshot(cc)).records.find((r) => r.userId === g._id);
        await call(
          cc,
          "verify",
          {
            userId: g._id,
            version: p.version,
            revisionId: p.submissions.at(-1).id,
            status: "VERIFIED",
            reason:
              "Opened shared thread manually and confirmed all evidence is accessible.",
          },
          "2026-11-03T05:00:00Z",
        );
        await Promise.all(
          Array.from({ length: 3 }, () =>
            call(
              cc,
              "verify",
              {
                userId: g._id,
                revisionId: p.submissions.at(-1).id,
                status: "VERIFIED",
                reason: "Repeated access check with no new eligibility event.",
              },
              "2026-11-03T05:01:00Z",
            ),
          ),
        );
        await call(cc, "assessment", {
          userId: g._id,
          ai: Array(5).fill(g._id === "g3" ? 2 : 4),
          human: Array(5).fill(g._id === "g3" ? 2 : 4),
          notes:
            "The shared evidence supports each criterion rating independently.",
        });
        await call(cc, "approve", { userId: g._id });
      }
      p = (await dayOneSnapshot(gamers[0])).records[0];
      assert.equal(p.trophies, 20);
      assert.equal(p.ledger.length, 5);
      assert.equal(p.badge, true);
      const late = (await dayOneSnapshot(gamers[2])).records[0];
      assert.equal(late.trophies, 14);
      assert.equal(late.badge, true);
      const mcState = await dayOneSnapshot(mc);
      assert.ok(!JSON.stringify(mcState).includes("PRIVATE_PRIZE"));
      assert.ok(!JSON.stringify(mcState).includes('"total":34'));
      assert.equal(mcState.records[0].assessment, undefined);
      assert.ok(
        !JSON.stringify(await dayOneSnapshot(gamers[0])).includes(
          "PRIVATE_PRIZE",
        ),
      );
      const ccState = await dayOneSnapshot(cc);
      assert.deepEqual(ccState.candidates.sort(), ["g1", "g2"]);
      assert.equal(
        ccState.records.find((r) => r.userId === "g1").assessment.max,
        33,
      );
      await control(mc, "close", 1, config.closingCutoff);
      await assert.rejects(
        call(gamers[0], "sod", { text: "Cannot amend a closed day." }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        call(
          cc,
          "select-champion",
          { userId: "g1", reason: "short" },
          "2026-11-03T05:00:00Z",
        ),
      );
      await call(
        cc,
        "select-champion",
        {
          userId: "g1",
          reason:
            "Documented tie review: stronger independent primary-source verification.",
        },
        "2026-11-03T05:00:00Z",
      );
      await assert.rejects(
        call(
          cc,
          "reveal-champion",
          { reason: "Week 1 winner announcement has been made." },
          "2026-11-07T11:30:00Z",
        ),
        (e) => e.status === 409,
      );
      assert.ok(
        !JSON.stringify(await dayOneSnapshot(mc)).includes("PRIVATE_PRIZE"),
      );
      // Later-day assessments are a separate slice. Simulate its completed
      // release state to exercise the existing Champion publication boundary.
      await models.WeekOneRelease.updateOne(
        { _id: "alpha" },
        { $set: { "days.4.state": "CLOSED" } },
      );
      await models.WeekOneProgram.create({
        _id: "alpha",
        version: 1,
        data: { locked: true, publications: [{ version: 1 }] },
      });
      await call(
        cc,
        "reveal-champion",
        { reason: "Week 1 winner announcement has been made." },
        "2026-11-08T11:30:00Z",
      );
      assert.match(
        (await dayOneSnapshot(gamers[0])).records[0].champion.prompt,
        /PRIVATE_PRIZE/,
      );
      assert.equal(
        (await dayOneSnapshot(gamers[1])).records[0].champion,
        undefined,
      );
      assert.ok(
        !JSON.stringify(await dayOneSnapshot(mc)).includes("PRIVATE_PRIZE"),
      );
      await assert.rejects(
        call(gamers[0], "submit", {
          url: "https://chat.example/share/after",
          reason: "Attempted change after the announcement.",
        }),
        (e) => e.status === 409,
      );
      // A separate cohort exercises corrections without touching the locked cohort.
      const other = {
          _id: "other-g",
          name: "Correction Gamer",
          email: "correction@example.invalid",
          role: "GAMER",
          cohortId: "corrections",
        },
        otherCC = {
          ...cc,
          _id: "other-cc",
          email: "othercc@example.invalid",
          cohortId: "corrections",
        };
      await models.User.insertMany([other, otherCC]);
      await call(otherCC, "release", { config, revision: 0 });
      await control(otherCC, "open", 1, "2026-11-02T03:00:00Z");
      await call(other, "clock", {}, "2026-11-02T03:29:00Z");
      await call(
        other,
        "genre",
        { genreId: "genre-1" },
        "2026-11-02T03:30:00Z",
      );
      await call(other, "acknowledge", {}, "2026-11-02T03:30:00Z");
      await call(other, "start", {}, "2026-11-02T03:31:00Z");
      await call(
        other,
        "submit",
        { url: "https://chat.example/share/original" },
        "2026-11-02T03:40:00Z",
      );
      p = (await dayOneSnapshot(other)).records[0];
      await call(otherCC, "verify", {
        userId: other._id,
        revisionId: p.submissions[0].id,
        status: "VERIFIED",
        reason: "Original thread access is confirmed manually.",
      });
      await call(
        other,
        "submit",
        {
          url: "https://chat.example/share/corrected",
          reason: "Correcting the shared thread to include missing context.",
        },
        "2026-11-02T06:40:00Z",
      );
      p = (await dayOneSnapshot(other)).records[0];
      assert.equal(p.submissions.length, 2);
      assert.equal(p.badge, false);
      assert.equal(p.trophies, 6);
      assert.equal(
        p.ledger
          .filter((l) => l.rule === "submission")
          .reduce((n, l) => n + l.amount, 0),
        0,
      );
      await call(otherCC, "verify", {
        userId: other._id,
        revisionId: p.submissions[1].id,
        status: "VERIFIED",
        reason: "Revised thread access is confirmed manually.",
      });
      p = (await dayOneSnapshot(other)).records[0];
      assert.equal(p.trophies, 12);
      assert.equal(p.firstQualifyingSubmissionAt, "2026-11-02T03:40:00.000Z");
      assert.equal(p.badge, true);
      assert.equal(await models.Trophy.countDocuments(), 0);
      assert.equal(await models.Energy.countDocuments(), 0);
      // Week 1 records keep their independent 5/5 energy while legacy gameplay continues.
      await control(otherCC, "close", 1, config.closingCutoff);
      await models.DayOneSetup.updateOne(
        { _id: "corrections" },
        {
          $set: { "released.day": localParts(new Date(), "Asia/Kolkata").day },
        },
      );
      await transaction((session) =>
        deduct(
          other._id,
          "Legacy gameplay retains energy deductions independently of Week 1",
          10,
          "day1-protected",
          session,
        ),
      );
      await models.Task.create({
        _id: "day1-old-task",
        teamId: "old-team",
        assigneeId: other._id,
        title: "Earlier team task",
        status: "Backlog",
        dueAt: new Date(Date.now() - 60000),
      });
      await reconcile([other._id]);
      assert.equal((await models.User.findById(other._id)).hp, 5);
      assert.equal(await models.Energy.countDocuments(), 2);
      assert.equal(
        (await models.Task.findById("day1-old-task")).deadlineChecked,
        true,
      );
      await transaction((session) =>
        deduct(
          "outside",
          "Original system still applies outside Day 1",
          10,
          "original-system",
          session,
        ),
      );
      assert.equal(await models.Energy.countDocuments(), 3);
      assert.equal(
        await models.DayOneRecord.countDocuments({ energy: { $ne: 5 } }),
        0,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
