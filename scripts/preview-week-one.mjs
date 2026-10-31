// Disposable Week 1 UI/API fixture. Does not connect to the workspace database.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { personas } from "../lib/catalog.js";
import { seed } from "../lib/seed.js";
import { dayOneAction } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { programAction } from "../lib/week-one-program.js";
import { fixtureConfig } from "../tests/day-one-fixture.mjs";
import {
  programFixture,
  settingsFixture,
} from "../tests/week-one-program-fixture.mjs";
import { localParts } from "../lib/day-one-rules.js";
import { recoveryFixture } from "../tests/recovery-fixture.mjs";

const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri("week1_ui_preview");
process.env.WEEK1_NOTIFICATION_WEBHOOK_URL = "";
process.env.WEEK1_NOTIFICATION_WEBHOOK_TOKEN = "";
process.env.WEEK1_COLLEGE_CONTACTS_JSON = "{}";
let server;
async function close() {
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
  await connect();
  for (const model of Object.values(models)) await model.init();
  await seed();
  const cc = personas.find((p) => p.role === "CENTRE_COMMAND"),
    mc = personas.find((p) => p.role === "MISSION_COMMANDER"),
    gamers = personas.filter((p) => p.role === "GAMER");
  const now = new Date(),
    time = (hours) => new Date(now.getTime() + hours * 3600000),
    config = fixtureConfig();
  config.officialStart = time(-28).toISOString();
  config.day = localParts(time(-28), config.timeZone).day;
  config.availableAt = config.officialStart;
  config.clockCutoff = config.officialStart;
  config.closingCutoff = time(-20).toISOString();
  config.revealAfter = time(7 * 24).toISOString();
  config.weekdays = [0, 1, 2, 3, 4, 5, 6];
  await programAction(
    cc,
    "settings",
    { settings: settingsFixture() },
    time(-29),
  );
  await dayOneAction(cc, "release", { config, revision: 0 }, time(-29));
  const control = async (action, day, when, extra = {}) =>
    weekOneAction(
      mc,
      action,
      { day, revision: (await weekOneSnapshot(mc)).revision, ...extra },
      when,
    );
  await control("open", 1, time(-28));
  for (const g of gamers) await dayOneAction(g, "clock", {}, time(-27.9));
  await control("close", 1, time(-20));
  const content = programFixture(2);
  content.officialStart = time(-4).toISOString();
  content.closingCutoff = time(4).toISOString();
  content.nudgeAt = time(-0.1).toISOString();
  await programAction(cc, "prepare-day", { day: 2, content }, time(-5));
  await control("open", 2, time(-4));
  await control("publish-agenda", 2, time(-4), {
    text: "Preview fixture · Explore Full Stack, investigate conflicting instructions and Alumni records, review two class recaps, and retain research evidence.",
  });
  await programAction(
    cc,
    "publish-rules",
    {
      text: "Preview Game Rules · Check your agenda independently, investigate using evidence, keep research sources, respect secret ballots, and ask MC when an obligation is unclear. Week 1 energy remains 5/5.",
      reason:
        "Disposable UI fixture; replace with institution-approved Game Rules for real cohorts.",
    },
    time(-4),
  );
  await programAction(
    mc,
    "showcase-groups",
    {
      groups: Array.from({ length: 5 }, (_, i) => ({
        members: gamers.slice(i * 5, i * 5 + 5).map((g) => g._id),
      })),
    },
    time(-3.5),
  );
  await programAction(
    mc,
    "complete-class",
    { day: 2, session: 1 },
    new Date(now.getTime() - 26 * 60000),
  );
  await programAction(
    mc,
    "complete-class",
    { day: 2, session: 2 },
    new Date(now.getTime() - 6 * 60000),
  );
  await programAction(
    mc,
    "publish-recap",
    {
      day: 2,
      session: 1,
      text: "Preview recap · Frontend, API, backend and database form a connected request-response journey. Verify evidence before choosing a cause.",
    },
    new Date(now.getTime() - 25 * 60000),
  );
  await programAction(
    mc,
    "publish-recap",
    {
      day: 2,
      session: 2,
      text: "Preview recap · Follow the Alumni record across layers. Compare expected and displayed results, propose two safe checks and explain your uncertainty.",
    },
    new Date(now.getTime() - 5 * 60000),
  );
  const gamer = gamers[0];
  await programAction(gamer, "clock", { day: 2 }, time(-3.9));
  await programAction(
    gamer,
    "attempt-start",
    { day: 2, activityId: "D2-G01", variantId: "variant-1" },
    new Date(now.getTime() - 25 * 60000),
  );
  const record = await models.WeekOneAttempt.findOne({
    userId: gamer._id,
    activityId: "D2-G01",
  }).lean();
  await programAction(
    gamer,
    "attempt-save",
    {
      attemptId: record._id,
      answers: {
        finding1:
          "Preview draft · The notices disagree about the event deadline. I will compare the source timestamps before deciding.",
      },
    },
    new Date(now.getTime() - 24 * 60000),
  );
  if (process.argv.includes("--recovery")) {
    const reason =
      "Synthetic disposable Pack 3A browser fixture; no production cohort is changed.";
    await programAction(cc, "recovery-policy", { reason }, time(-5));
    const program = await models.WeekOneProgram.findById("alpha");
    const results = gamers.map((g, i) => {
      const total = i < 3 ? 58 + i * 0.5 : 60 + i;
      return {
        userId: g._id,
        name: g.name,
        total,
        status: total >= 60 ? "CLEARED" : "RESCUE_PENDING",
        configVersion: program.data.settings.version,
        parts: Object.fromEntries(
          Object.keys(program.data.settings.weights).map((k) => [k, total]),
        ),
        comparison: { status: "PENDING" },
        professional: { ledger: [] },
        capabilities: [],
        assessments: [],
      };
    });
    program.data.publications = [
      {
        version: 1,
        at: time(-5).toISOString(),
        by: cc._id,
        results,
        recognition: { awards: [], examples: [] },
        rescue: [],
        teams: [],
        reason,
      },
    ];
    program.data.locked = true;
    program.markModified("data");
    await program.save();
    const release = await models.WeekOneRelease.findById("alpha");
    for (const day of release.days) {
      day.state = "CLOSED";
      if(day.day>2){day.content=programFixture(day.day);day.contentVersion=1;day.officialStart=day.content.officialStart;day.scheduledEnd=day.content.closingCutoff;}
    }
    release.markModified("days");
    await release.save();
    const c = recoveryFixture();
    let saturday = time(-2.2);
    while (
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        timeZone: c.timeZone,
      }).format(saturday) !== "Saturday"
    )
      saturday = new Date(saturday.getTime() - 86400000);
    c.start = saturday.toISOString();
    c.choiceDeadline = new Date(saturday.getTime() - 3600000).toISOString();
    c.examClose = time(3).toISOString();
    await programAction(mc, "recovery-save-config", { config: c }, time(-5));
    await programAction(cc, "recovery-approve-config", { reason }, time(-5));
    await programAction(cc, "recovery-invite", {}, time(-5));
    await programAction(
      gamer,
      "recovery-choice",
      { choice: "CONTINUE" },
      new Date(saturday.getTime() - 7200000),
    );
    await programAction(
      mc,
      "recovery-session",
      { state: "CLASS_STARTED" },
      saturday,
    );
    await programAction(
      mc,
      "recovery-attendance",
      { userId: gamer._id, status: "ATTENDED", reason },
      new Date(saturday.getTime() + 60000),
    );
    await programAction(
      mc,
      "recovery-session",
      { state: "CLASS_COMPLETED" },
      new Date(saturday.getTime() + 90 * 60000),
    );
    await programAction(
      mc,
      "recovery-session",
      { state: "EXAMS_OPEN" },
      new Date(saturday.getTime() + 110 * 60000),
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
      "3103",
    ],
    {
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        DEMO_MODE: "true",
        DEMO_ACCESS_CODE: "",
        SESSION_SECRET: randomBytes(48).toString("hex"),
      },
    },
  );
  server.once("exit", async (code) => {
    await close();
    process.exit(code || 0);
  });
  console.log(
    "Disposable Week 1 preview: http://127.0.0.1:3103/gamer/dashboard",
  );
} catch (error) {
  console.error(error);
  await close();
  process.exitCode = 1;
}
