// Explicit operator reset. Accounts/content stay; all learner progress is backed up.
import mongoose from "mongoose";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { models, transaction } from "../lib/db.js";
import { existingWorkspaceMongo } from "./dev-runtime.mjs";
import { initialDays } from "../lib/week-one-rules.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { MAX_LIVES, MAX_ENERGY } from "../lib/rules.js";
import { localParts, validateSetup } from "../lib/day-one-rules.js";
import { scheduleInstant } from "../lib/day-one-setup.js";
import { publishedGameRules, publishAgenda } from "../lib/week-one-rules.js";

const replay = process.argv.includes("--replay");
let replayConfig;
let replayDays;

const progress = [
  "LevelOneReward",
  "FlightOpening",
  "CrashArrival",
  "NotificationReceipt",
  "WeekOneDelivery",
  "WeekOneLearner",
  "WeekOneAttempt",
  "WeekOneLevel",
  "WeekOneTicket",
  "WeekOneBatch",
  "WeekOneEvent",
  "DayOneRecord",
  "DayOneEvent",
  "PrivateReportFile",
  "Task",
  "TaskEvent",
  "ProjectAttempt",
  "ProjectEvent",
  "Attendance",
  "Trophy",
  "Experience",
  "RewardMigration",
  "Energy",
  "Rescue",
  "Progress",
  "Journal",
  "Message",
  "Proposal",
  "ClientEvent",
  "Coaching",
  "Clearance",
  "Lab",
  "LabCheckpoint",
  "HelpTicket",
  "SupportEvent",
  "SupportIntervention",
  "SupportAttempt",
  "TechnicalIssue",
  "DiscoveryBaseline",
  "EffortSession",
  "EffortWrite",
  "VerifiedComparison",
  "GrowthReport",
];

try {
  process.env.MONGODB_URI ||= await existingWorkspaceMongo(
    27019,
    fileURLToPath(new URL("../.data/mongo", import.meta.url)),
  );
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  assert.equal(
    db.databaseName,
    "codewild",
    "Reset is scoped to the configured codewild game.",
  );
  const players = await models.User.find({ role: "GAMER" }).lean();
  assert.equal(players.length, 25, "Expected this game's 25-player roster.");
  assert.ok(
    players.every((p) => (p.cohortId || "alpha") === "alpha"),
    "Unexpected cohort: reset aborted.",
  );
  const accounts = await models.User.countDocuments();
  const credentials = await models.Credential.countDocuments();
  if (replay) {
    const release = await models.WeekOneRelease.findById("alpha").lean();
    const setup = await models.DayOneSetup.findById("alpha").lean();
    const program = await models.WeekOneProgram.findById("alpha").lean();
    assert.ok(publishedGameRules(program?.data), "Published game rules must remain available.");
    const previous = release?.days?.find(d => d.day === 1)?.content || setup?.released;
    assert.ok(previous, "Prepared Day 1 content is required for replay.");
    const now = new Date(), zone = previous.timeZone;
    const local = localParts(now, zone);
    const start = new Date(now.getTime() - 60000);
    start.setUTCSeconds(0, 0);
    const end = scheduleInstant(local.day, "23:59", zone);
    assert.ok(Date.parse(end) - start.getTime() >= 90 * 60000, "Not enough time remains today for a full research mission.");
    replayConfig = structuredClone(previous);
    Object.assign(replayConfig, {
      version: Math.max(previous.version || 0, setup?.released?.version || 0) + 1,
      day: local.day, startTime: localParts(start, zone).time, endTime: "23:59",
      availableAt: start.toISOString(), officialStart: start.toISOString(),
      clockCutoff: new Date(start.getTime() + 30 * 60000).toISOString(),
      closingCutoff: end, revealAfter: new Date(Date.parse(end) + 7 * 86400000).toISOString(),
      weekdays: [...new Set([...(previous.weekdays || []), local.weekday])],
      holidays: (previous.holidays || []).filter(day => day !== local.day), releasedAt: now.toISOString(),
    });
    validateSetup(replayConfig);
    replayDays = initialDays().map(day => {
      const old = release.days.find(d => d.day === day.day);
      return { ...old, ...day, openedAt: undefined, openedBy: undefined, closedAt: undefined, closedBy: undefined, agenda: undefined };
    });
    Object.assign(replayDays[0], { state: "OPEN", content: replayConfig, contentVersion: replayConfig.version, officialStart: replayConfig.officialStart, scheduledEnd: end, openedAt: now.toISOString(), openedBy: "operator:user-request" });
    publishAgenda(replayDays[0], release.days[0]?.agenda?.text || "Clock in, board your flight, choose a world and question, investigate with AI, then transmit your shared research chat.", "operator:user-request", now);
  }
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify({
        mode: "read-only",
        database: db.databaseName,
        players: players.length,
        accountsPreserved: accounts,
        credentialsPreserved: credentials,
        aarav: players
          .filter((p) => p.name === "Aarav Patel")
          .map((p) => ({ hp: p.hp, xp: p.xp })),
        action: replay
          ? "Back up every collection, reset all player progress, preserve content and groups, and open Day 1 for today. Use --apply to execute."
          : "Back up every collection, reset all player progress and return all days to DRAFT. Use --apply to execute.",
        ...(replay ? { dayOne: { date: replayConfig.day, start: replayConfig.startTime, end: replayConfig.endTime, state: "OPEN" }, researchGroups: replayConfig.researchGroups?.length } : {}),
      }),
    );
  } else {
    const backup = new URL(
      `../.data/backups/game-reset-${Date.now()}/`,
      import.meta.url,
    );
    await mkdir(backup, { recursive: true });
    const manifest = [];
    for (const { name } of await db.listCollections().toArray()) {
      assert.match(name, /^[\w-]+$/);
      const documents = await db.collection(name).find({}).toArray();
      const bytes = mongoose.mongo.BSON.EJSON.stringify(documents, {
        relaxed: false,
      });
      await writeFile(new URL(`${name}.ejson`, backup), bytes, { flag: "wx" });
      manifest.push({
        collection: name,
        count: documents.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    await writeFile(
      new URL("manifest.json", backup),
      JSON.stringify(
        {
          database: db.databaseName,
          createdAt: new Date(),
          collections: manifest,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    await transaction(async (session) => {
      // Serialize with learner writes before removing their old records.
      for (const release of await models.WeekOneRelease.find()
        .session(session)
        .lean())
        await models.WeekOneRelease.updateOne(
          { _id: release._id },
          {
            $set: { days: replay ? replayDays : initialDays() },
            $inc: { revision: 1 },
          },
          { session },
        );
      for (const name of progress)
        await models[name].deleteMany({}, { session });
      await models.ResearchSelection.updateMany(
        {},
        {
          $set: { offers: [], assignments: [] },
          $inc: { revision: 1 },
        },
        { session },
      );
      await models.DayOneSetup.updateMany(
        {},
        {
          $unset: replay ? { champion: "" } : { released: "", champion: "" },
          $set: replay ? { released: replayConfig, draft: replayConfig } : { versions: [] },
          ...(replay ? { $push: { versions: replayConfig } } : {}),
          $inc: { revision: 1, editVersion: 1 },
        },
        { session },
      );
      for (const program of await models.WeekOneProgram.find()
        .session(session)
        .lean()) {
        const next = blankProgram();
        for (const key of ["settings", "rules", "faq", "progressionMode", ...(replay ? ["groups"] : [])])
          if (program.data?.[key]) next[key] = program.data[key];
        await models.WeekOneProgram.updateOne(
          { _id: program._id },
          {
            $set: { data: next },
            $inc: { version: 1 },
          },
          { session },
        );
      }
      await models.Cohort.updateMany(
        {},
        { $set: { currentWeek: 1 }, $inc: { rosterVersion: 1 } },
        { session },
      );
      await models.User.updateMany(
        { role: "GAMER" },
        {
          $set: {
            hp: MAX_LIVES,
            energy: MAX_ENERGY,
            xp: 0,
            trophies: 0,
            streak: 0,
            drops: 0,
            dailyXp: 0,
            dailyTrophies: 0,
            rewardVersion: 2,
            effortLock: 0,
          },
          $unset: {
            characterKey: "",
            characterVariant: "",
            lastSettledDay: "",
            xpDay: "",
            trophyDay: "",
          },
        },
        { session },
      );
    });
    assert.equal(await models.User.countDocuments(), accounts);
    assert.equal(await models.Credential.countDocuments(), credentials);
    const reset = await models.User.find({ role: "GAMER" }).lean();
    assert.equal(reset.length, 25);
    for (const p of reset) {
      assert.equal(p.hp, MAX_LIVES);
      assert.equal(p.energy, MAX_ENERGY);
      assert.equal(p.xp, 0);
      assert.equal(p.trophies, 0);
      assert.equal(p.streak, 0);
      assert.ok(!p.characterKey);
    }
    for (const name of progress)
      assert.equal(await models[name].countDocuments(), 0, name);
    for (const r of await models.WeekOneRelease.find().lean()) {
      assert.equal(r.days[0].state, replay ? "OPEN" : "DRAFT");
      assert.ok(r.days.slice(1).every((d) => d.state === "DRAFT"));
    }
    assert.equal(await models.ResearchSelection.countDocuments({ "assignments.0": { $exists: true } }), 0);
    console.log(
      JSON.stringify({
        resetPlayers: reset.length,
        hp: MAX_LIVES,
        energy: MAX_ENERGY,
        xp: 0,
        trophies: 0,
        characters: "unknown",
        days: replay ? "Day 1 OPEN today; later days DRAFT" : "DRAFT",
        ...(replay ? { date: replayConfig.day, endTime: replayConfig.endTime, researchGroups: replayConfig.researchGroups?.length } : {}),
        accountsPreserved: accounts,
        credentialsPreserved: credentials,
        backup: backup.pathname,
      }),
    );
  }
} finally {
  await mongoose.disconnect();
}
