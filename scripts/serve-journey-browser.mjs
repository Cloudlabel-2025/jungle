// Fictional local QA only: no .env.local, saved cohort, or real delivery account.
process.env.TENANCY_ENABLED = "false";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { fixtureConfig } from "../tests/day-one-fixture.mjs";
import {
  blankProgram,
  validateDayContent,
} from "../lib/week-one-program-rules.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { hashPassword } from "../lib/password.js";
import { spendMissionEnergy } from "../lib/mission-energy.js";

const dir = resolve("artifacts/journey-browser");
await mkdir(dir, { recursive: true });
const clock = resolve(".data/journey-browser-clock.txt");
await writeFile(clock, "2026-11-02T03:30:00Z");
const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  instanceOpts: [{ launchTimeout: 60000 }],
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri("journey_browser_disposable");
await connect();
for (const model of Object.values(models)) await model.init();
const password = "Fictional-QA-2026!";
const actors = [
  {
    _id: "journey-player",
    name: "Journey Explorer",
    email: "explorer@journey.invalid",
    role: "GAMER",
  },
  {
    _id: "journey-recovery",
    name: "Recovery Explorer",
    email: "recovery@journey.invalid",
    role: "GAMER",
  },
  {
    _id: "journey-legacy-recovery",
    name: "Legacy Recovery Explorer",
    email: "legacy@journey.invalid",
    role: "GAMER",
    hp: 4,
    energy: 0,
  },
  {
    _id: "journey-cc",
    name: "Journey Centre",
    email: "centre@journey.invalid",
    role: "CENTRE_COMMAND",
  },
  {
    _id: "usr_mc01",
    name: "Journey Guide",
    email: "guide@journey.invalid",
    role: "MISSION_COMMANDER",
  },
].map((actor) => ({ ...actor, cohortId: "alpha", rewardVersion: 2 }));
await models.User.insertMany(actors);
for (const actor of actors)
  await models.Credential.create({
    _id: actor._id,
    passwordHash: await hashPassword(password),
  });
const config = { ...fixtureConfig(), version: 1 };
config.genres = config.genres.map((genre) => ({
  ...genre,
  question:
    "Investigate Automobiles research. Compare alternatives, show sources and verify your reasoning.",
}));
await models.Cohort.create({
  _id: "alpha",
  name: "Fictional browser expedition",
  college: "Disposable QA",
  startDate: config.day,
  currentWeek: 1,
});
await models.DayOneSetup.create({
  _id: "alpha",
  revision: 0,
  released: config,
  draft: config,
});
const days = [1, 2, 3, 4, 5].map((day) => ({
  day,
  state: "PREPARED",
  content:
    day === 1
      ? config
      : validateDayContent(day, starterFlightContent(day, config), config),
  officialStart: config.officialStart,
  scheduledEnd: config.closingCutoff,
  contentVersion: 1,
}));
await models.WeekOneRelease.create({ _id: "alpha", revision: 0, days });
await models.WeekOneProgram.create({
  _id: "alpha",
  version: 0,
  data: {
    ...blankProgram(),
    progressionMode: "COMPLETION",
    rules: [
      {
        version: 1,
        text: "Each new mission costs one energy. Continue saved missions without paying again.\n\nVerify an AI claim with an independent source and explain what remains uncertain.\n\nUse Recovery camp when mission energy runs out. Ask your guide for help when blocked.",
        at: config.officialStart,
      },
    ],
    settings: {
      ...blankProgram().settings,
      compassQuestions: [
        "What changed?",
        "What evidence mattered?",
        "What will you check next?",
      ],
    },
  },
});
await models.WeekOneProgram.updateOne(
  { _id: "alpha" },
  {
    $set: {
      "data.rules.0.publishedAt": config.officialStart,
      "data.rules.0.publishedBy": "journey-cc",
    },
  },
);
await models.FlightOpening.create({
  _id: JSON.stringify(["alpha", "journey-recovery"]),
  userId: "journey-recovery",
  cohortId: "alpha",
  completedAt: new Date(config.officialStart),
});
for (let n = 0; n < 15; n++)
  await transaction((session) =>
    spendMissionEnergy(
      "journey-recovery",
      `mission:qa-exhaustion:${n}`,
      session,
      new Date(config.officialStart),
    ),
  );
await writeFile(
  resolve(dir, "fixture-disclosure.json"),
  JSON.stringify(
    {
      base: "http://localhost:3190",
      accounts: actors.map(({ _id, email, role }) => ({
        id: _id,
        email,
        role,
      })),
      seeded:
        "Only accounts, curriculum and a separate exhausted recovery scenario. Main Journey Explorer has no mission completions or results. Two fixed shared-chat provider URLs are mocked in the server preload; no external AI provider is contacted for those fictional URLs.",
      sharedChatUrls: [
        "https://chatgpt.com/share/11111111-1111-1111-1111-111111111111",
        "https://chatgpt.com/share/11111111-1111-1111-1111-111111111112",
      ],
    },
    null,
    2,
  ),
);
const production = process.argv.includes("--production");
if (process.argv.includes("--staff-rehearsal")) {
  const checkpoint = JSON.parse(await readFile(resolve("artifacts/local-readiness/week-one-review.json"), "utf8"));
  for (const model of Object.values(models)) await model.deleteMany({});
  for (const [name, rows] of Object.entries(checkpoint.collections)) if (rows.length) await models[name].insertMany(rows);
  for (const actor of await models.User.find({active:{$ne:false}}).lean()) await models.Credential.create({_id:actor._id,passwordHash:await hashPassword(password)});
  await writeFile(clock, new Date(checkpoint.now).toISOString());
  await writeFile(resolve("artifacts/local-readiness/staff-browser-disclosure.json"), JSON.stringify({base:"http://localhost:3190",source:"week-one-review.json",seeded:checkpoint.disclosure,pending:"Actual browser MC signoff and CC publication",accounts:["mc@example.invalid","cc@example.invalid","g0@example.invalid"]},null,2));
  console.log("Separate 25-player fictional staff rehearsal. Seeded integration-test assessments, journals and presentations; MC signoff and CC publication remain pending. Accounts mc@example.invalid / cc@example.invalid / g0@example.invalid.");
}
if (process.argv.includes("--restore")) {
  const observed = JSON.parse(
    await readFile(resolve(dir, "observed-state.json"), "utf8"),
  );
  for (const [name, rows] of Object.entries(observed)) {
    await models[name].deleteMany({}); // This process owns only its disposable in-memory database.
    if (rows.length) await models[name].insertMany(rows);
  }
  const recordedTimes = [
    Date.parse(config.officialStart),
    ...(observed.WeekOneEvent || []).map((row) => Date.parse(row.createdAt)),
    ...(observed.TrophyConduct || []).map((row) => Date.parse(row.createdAt)),
    ...(observed.DayOneRecord || []).flatMap((row) => [
      Date.parse(row.data.startedAt),
      ...row.data.submissions.map((submission) => Date.parse(submission.at)),
    ]),
  ].filter(Number.isFinite);
  await writeFile(
    clock,
    new Date(Math.max(...recordedTimes) + 60000).toISOString(),
  );
  if (!(await models.User.exists({ _id: "journey-legacy-recovery" })))
    await models.User.create(
      actors.find((actor) => actor._id === "journey-legacy-recovery"),
    );
  console.log("Restored only the previously observed browser actions.");
}
// Optional fictional roster assignment for scoped MC review tests. This is not
// a final-results team publication and never creates mission results.
if (process.argv.includes("--review-crew")) {
  await models.Team.updateOne(
    { _id: "journey-review-crew" },
    {
      $set: {
        name: "Fictional review crew",
        code: "QA",
        cohortId: "alpha",
        commanderId: "usr_mc01",
      },
    },
    { upsert: true },
  );
  await models.User.updateMany(
    {
      _id: { $in: actors.filter((a) => a.role === "GAMER").map((a) => a._id) },
    },
    { $set: { teamId: "journey-review-crew" } },
  );
}
// Dedicated starting-balance scenario; never changes the played campaign account.
if (process.argv.includes("--trophy-policy")) {
  if (!(await models.User.exists({ _id: "journey-trophy-policy" })))
    await models.User.create({
      _id: "journey-trophy-policy",
      name: "Trophy Policy Explorer",
      email: "league@journey.invalid",
      role: "GAMER",
      cohortId: "alpha",
      teamId: "journey-review-crew",
      trophies: 305,
      xp: 2250,
      rewardVersion: 2,
    });
  await models.Credential.updateOne(
    { _id: "journey-trophy-policy" },
    { $setOnInsert: { passwordHash: await hashPassword(password) } },
    { upsert: true },
  );
}
if(process.argv.includes("--league-divisions")) {
  if(!await models.User.exists({_id:"journey-division-check"})) {
    await models.User.create({_id:"journey-division-check",name:"Division Explorer",email:"divisions@journey.invalid",role:"GAMER",cohortId:"alpha",teamId:"journey-review-crew",trophies:449,xp:2250,rewardVersion:2});
    await models.TrophyConduct.create({_id:"historical-division-debit",userId:"journey-division-check",cohortId:"alpha",actorId:"journey-cc",actorRole:"CENTRE_COMMAND",action:"DEDUCT",incidentRef:"Historical QA deduction",reason:"Seeded historical record for reversal compatibility testing",evidence:"Fictional starting balance 449, after an earlier actual debit of one trophy.",fingerprint:"legacy-fixture",eventKey:"historical-division-debit",requestedAmount:5,amount:-1,before:450,after:449});
  }
  await models.Credential.updateOne({_id:"journey-division-check"},{$setOnInsert:{passwordHash:await hashPassword(password)}},{upsert:true});
}
const child = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(resolve("scripts/journey-browser-preload.mjs")).href,
    resolve("node_modules/next/dist/bin/next"),
    ...(production ? ["start"] : ["dev", "--webpack"]),
    "--hostname",
    "127.0.0.1",
    "--port",
    "3190",
  ],
  {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CODEWILD_BUILD_CHECK: production ? "0" : "1",
      TENANCY_ENABLED: "false",
      MONGODB_URI: process.env.MONGODB_URI,
      JOURNEY_BROWSER_FIXTURE: "fictional-disposable-only",
      SESSION_SECRET: randomBytes(48).toString("hex"),
      DEMO_MODE: "false",
      APP_ORIGIN: "http://localhost:3190",
      BLOB_READ_WRITE_TOKEN: "",
      CRON_SECRET: randomBytes(32).toString("hex"),
      WEEK1_NOTIFICATION_WEBHOOK_URL: "",
      WEEK1_NOTIFICATION_WEBHOOK_TOKEN: "",
      WEEK1_COLLEGE_CONTACTS_JSON: "{}",
      PART_B_BROWSER_CLOCK_FILE: clock,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
child.stdout.on("data", (chunk) => process.stdout.write(chunk));
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  child.kill();
  await mongoose.disconnect();
  await replica.stop();
  process.exit(0);
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
createInterface({ input: process.stdin }).on("line", async (line) => {
  try {
    const command = JSON.parse(line);
    if (command.clock) await writeFile(clock, command.clock);
    if (command.snapshot) {
      const snapshot = {};
      for (const name of Object.keys(models).filter(name => !["Credential", "TeamLabLocalGrant"].includes(name)))
        snapshot[name] = await models[name].find({}).lean();
      await writeFile(
        resolve(dir, "observed-state.json"),
        JSON.stringify(snapshot, null, 2),
      );
      console.log("Observed browser state exported.");
    }
  } catch (error) {
    console.error(error.message);
  }
});
console.log("Fictional journey fixture: http://localhost:3190/gamer/dashboard");
