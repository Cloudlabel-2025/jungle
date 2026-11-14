// Disposable browser/API QA fixture. Never connects to the workspace database.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { models } from "../lib/db.js";
import { personas } from "../lib/catalog.js";
import { dayOneAction } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { fixtureConfig } from "../tests/day-one-fixture.mjs";
import { localParts } from "../lib/day-one-rules.js";
import { seed } from "../lib/seed.js";
import { publishFixtureRules } from "../tests/week-one-program-fixture.mjs";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { emptyRecovery } from "../lib/recovery-rules.js";
import { rosterDigest } from "../lib/recovery.js";
import { syncAttendance } from "../lib/attendance.js";

const fresh = process.argv.includes("--qa-fresh");
const research = process.argv.includes("--research");
const attendanceQA = process.argv.includes("--attendance");
const attendanceEod = process.argv.includes("--attendance-eod");

const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri("day1_browser_preview");
let server, attendanceTimer;
async function close() {
  clearInterval(attendanceTimer);
  if (server) server.kill();
  await mongoose.disconnect();
  await replica.stop();
}
process.once("SIGINT", async () => {
  await close();
  process.exit(0);
});
process.once("SIGTERM", async () => {
  await close();
  process.exit(0);
});
try {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const m of Object.values(models)) await m.init();
  await seed();
  const cc = personas.find((p) => p.role === "CENTRE_COMMAND"),
    gamers = personas.filter((p) => p.role === "GAMER"),
    config = fixtureConfig();
  const now = new Date(),
    day = localParts(now, "Asia/Kolkata").day;
  config.day = day;
  config.availableAt = new Date(now.getTime() - 4 * 3600000).toISOString();
  config.officialStart = new Date(now.getTime() - 4 * 3600000).toISOString();
  config.clockCutoff = new Date(now.getTime() + 3600000).toISOString();
  config.closingCutoff = new Date(now.getTime() + 8 * 3600000).toISOString();
  config.revealAfter = new Date(now.getTime() + 8 * 86400000).toISOString();
  config.weekdays = [0, 1, 2, 3, 4, 5, 6];
  config.startTime = "00:00";
  config.endTime = "23:59";
  if (attendanceEod) {
    config.clockCutoff = new Date(now.getTime() - 2 * 3600000).toISOString();
    config.closingCutoff = new Date(now.getTime() - 60000).toISOString();
  }
  if (research) {
    config.selectionMode = "research-2026-11-12";
    if (process.argv.includes("--research-random"))
      config.questionSelection = "RANDOM";
    config.bankApproval =
      "Synthetic UI review approval of the 51 supplied questions; not an institutional content approval.";
    config.researchGroups = Array.from({ length: 5 }, (_, i) => ({
      members: gamers.slice(i * 5, i * 5 + 5).map((g) => g._id),
    }));
  }
  const call = (u, a, b = {}, t = now) => dayOneAction(u, a, b, t);
  await call(
    cc,
    "release",
    { revision: 0, config },
    new Date(now.getTime() - 4 * 3600000),
  );
  await publishFixtureRules(cc, new Date(config.officialStart));
  if (!fresh) {
    for (const [action, extra] of [
      ["open", {}],
      [
        "publish-agenda",
        {
          text: "Independent research, class orientation, Research Showcase and end-of-day reflection.",
        },
      ],
    ]) {
      await weekOneAction(
        cc,
        action,
        { day: 1, revision: (await weekOneSnapshot(cc)).revision, ...extra },
        new Date(config.officialStart),
      );
    }
    for (let i = 0; i < gamers.length; i++) {
      if (attendanceQA || (attendanceEod && i > 1)) continue;
      const g = gamers[i],
        early = new Date(now.getTime() - 3 * 3600000),
        started = new Date(now.getTime() - 45 * 60000);
      await call(g, "clock", {}, early);
      if (research) continue; // Leave all 25 real selection controls available for browser/HTTP QA.
      await call(g, "agenda-view", {}, early);
      await call(g, "agenda-ack", {}, early);
      if (i % 7 === 0) continue;
      await call(
        g,
        "sod",
        {
          text: "I will investigate the question, compare reliable sources and verify AI claims.",
        },
        early,
      );
      await call(g, "genre", { genreId: config.genres[i % 4].id }, early);
      await call(g, "acknowledge", {}, early);
      await call(g, "start", {}, started);
      if (i % 6 === 0) continue;
      await call(
        g,
        "submit",
        { url: `https://chatgpt.com/share/preview-evidence-${i + 1}` },
        new Date(now.getTime() - 5 * 60000),
      );
      const r = await models.DayOneRecord.findOne({ userId: g._id });
      if (i % 5 === 0) {
        await call(cc, "verify", {
          userId: g._id,
          revisionId: r.data.submissions[0].id,
          status: "INACCESSIBLE",
          reason: "Demo verification: sharing permissions require correction.",
        });
        continue;
      }
      if (i % 4 !== 0) {
        await call(cc, "verify", {
          userId: g._id,
          revisionId: r.data.submissions[0].id,
          status: "VERIFIED",
          reason: "Demo verification: shared conversation opened successfully.",
        });
        if (i % 3 !== 0) {
          await call(cc, "assessment", {
            userId: g._id,
            ai: [3, 3, 2, 3, 4],
            human: [3, 4, 3, 3, 4],
            notes:
              "Demo assessment evidence supports a clear investigation with verifiable sources.",
          });
          await call(cc, "approve", { userId: g._id });
        }
      }
      if (i % 3 !== 0)
        await call(g, "eod", {
          text: "I explored multiple sources and learned how to challenge and verify AI answers.",
          mode: "TEXT",
        });
      await call(g, "class");
    }
    // Ensure the first demo Gamer is useful for checking the full My Day layout.
    if (!research) {
      const g = gamers[0];
      await call(g, "sod", {
        text: "Explore how discoveries about exoplanets are verified using independent observations.",
      });
      await call(g, "genre", { genreId: "genre-1" });
      await call(g, "acknowledge");
      await call(g, "start");
    }
  }
  if (attendanceEod) {
    const priorDeadline = new Date(now.getTime() - 3 * 60000);
    await models.Attendance.updateOne(
      { userId: gamers[1]._id },
      {
        $set: {
          cohortId: "alpha",
          sessionState: "ACTIVE",
          cutoffAt: priorDeadline,
          checkDueAt: priorDeadline,
        },
      },
    );
    await syncAttendance(now);
    console.log(
      "Synthetic EOD QA: Aarav has a pending check; Priya timed out while offline.",
    );
  }
  if (process.argv.includes("--crash")) {
    // Synthetic approved state, exclusively inside this disposable database.
    const program = blankProgram();
    program.locked = true;
    program.publications = [
      {
        version: 1,
        results: gamers.map((g) => ({
          userId: g._id,
          name: g.name,
          total: 80,
          status: "CLEARED",
        })),
        recognition: { awards: [], examples: [] },
        teams: [],
        rescue: [],
      },
    ];
    const recovery = emptyRecovery();
    recovery.fridayVersion = 1;
    recovery.published = {
      version: 1,
      teams: [...new Set(gamers.map((g) => g.teamId))].map((id) => ({
        id,
        members: gamers.filter((g) => g.teamId === id).map((g) => g._id),
      })),
      by: cc._id,
      at: now.toISOString(),
      eligibleDigest: rosterDigest(recovery, program.publications[0]),
    };
    program.recovery = recovery;
    await models.WeekOneProgram.updateOne(
      { _id: "alpha" },
      { $set: { data: program } },
    );
    await models.FlightOpening.create({
      _id: JSON.stringify(["alpha", gamers[0]._id]),
      userId: gamers[0]._id,
      cohortId: "alpha",
      completedAt: now,
    });
    console.log(
      "Synthetic post-clearance crash QA enabled for the first demo Player only.",
    );
  }
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    {
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        DEMO_MODE: "true",
        DEMO_ACCESS_CODE: "",
        SESSION_SECRET: randomBytes(48).toString("hex"),
        WEEK1_NOTIFICATION_WEBHOOK_URL: "",
        WEEK1_NOTIFICATION_WEBHOOK_TOKEN: "",
        WEEK1_COLLEGE_CONTACTS_JSON: "{}",
        APP_ORIGIN: "http://127.0.0.1:3101",
      },
    },
  );
  server.once("exit", async (code) => {
    await close();
    process.exit(code || 0);
  });
  console.log(
    "Disposable Day 1 preview: http://127.0.0.1:3101/gamer/dashboard",
  );
  attendanceTimer = setInterval(() => syncAttendance().catch(() => {}), 15000);
  if (fresh)
    console.log(
      "Fresh QA state: Day 1 PREPARED, rules published, no learner attempts. Open Day 1 as CC through the browser. Production data is not connected.",
    );
} catch (e) {
  console.error(e);
  await close();
  process.exitCode = 1;
}
