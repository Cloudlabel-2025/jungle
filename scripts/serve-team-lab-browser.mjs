// Fictional approved teams, disposable replica, no production database or email.
process.env.TENANCY_ENABLED = "false";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { pilotFixture, sprintConfig } from "../tests/pilot-fixture.mjs";
import { pilotAction } from "../lib/pilot-engine.js";
import { models } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  instanceOpts: [{ launchTimeout: 60000 }],
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri("team_lab_browser_disposable");
const fixture = await pilotFixture(process.argv.includes("--class-size") ? 5 : 2);
const missionClock = resolve(".data/team-lab-browser/mission-clock.txt");
if (process.argv.includes("--missions")) {
  const call = (actor, action, body, date) => pilotAction(actor, action, { requestId: randomBytes(16).toString("hex"), reason: "Fictional localhost mission rehearsal setup.", ...body }, new Date(date));
  await call(fixture.cc, "draft", { config: sprintConfig(fixture.teams, fixture.mc) }, "2026-11-07T07:00:00Z");
  await call(fixture.cc, "approve", {}, "2026-11-07T07:00:00Z");
  await call(fixture.cc, "load", {}, "2026-11-07T07:00:00Z");
  for (const team of fixture.teams) await call(fixture.mc, "kickoff", { teamId: team.id, evidence: "Synthetic kickoff for browser checkpoint usability verification." }, "2026-11-09T07:00:00Z");
  await mkdir(resolve(".data/team-lab-browser"), { recursive: true });
  await writeFile(missionClock, "2026-11-09T07:05:00Z");
  console.log("Synthetic approved Week 1 foundation; Sprint 1 released through real CC/MC actions. No task completions seeded.");
}
if (process.argv.includes("--restore-avatar")) {
  // Restore only a receipt from an observed browser save, never a synthetic scan.
  const saved = JSON.parse(await readFile(resolve(".data/avatar-qa/observed-avatar.json"), "utf8"));
  await models.User.updateOne({ _id: fixture.gamers[0]._id }, { $set: { avatar: saved.avatar, avatarVersion: saved.avatarVersion } });
}
for (const user of [...fixture.gamers, fixture.cc, fixture.mc])
  await models.Credential.create({
    _id: user._id,
    passwordHash: await hashPassword("Fictional-QA-2026!"),
  });
await models.User.updateMany(
  {},
  { $set: { rewardVersion: 2, hp: 5, energy: 3 } },
);
if (
  process.argv.includes("--restore") ||
  process.argv.includes("--restore-flow")
) {
  const saved = JSON.parse(
    await readFile(
      resolve(
        process.argv.includes("--restore-flow")
          ? ".data/team-lab-browser/extension-state.json"
          : ".data/team-lab-browser/observed-project.json",
      ),
      "utf8",
    ),
  );
  const p = saved.project,
    fileRows = (files) =>
      Object.entries(files).map(([path, content]) => ({ path, content }));
  await models.TeamLab.create({
    _id: p.projectId,
    teamId: fixture.teams[0].id,
    cohortId: fixture.cohortId,
    version: p.version,
    files: fileRows(p.files),
    updatedAt: p.updatedAt,
    reviewRevision: Math.max(
      0,
      ...(p.reviews || []).map((r) => r.sequence || 0),
    ),
  });
  for (const r of saved.revisions) {
    const meta = p.history.find((row) => row.version === r.version);
    await models.TeamLabRevision.create({
      _id: JSON.stringify([p.projectId, r.version]),
      projectId: p.projectId,
      version: r.version,
      author: r.author,
      userId: fixture.gamers.find((g) => g.name === r.author)?._id,
      files: fileRows(r.files),
      paths: meta?.paths || [],
      createdAt: meta?.createdAt,
    });
  }
  for (const review of p.reviews || [])
    await models.TeamLabReview.create({
      ...review,
      projectId: p.projectId,
      userId: [...fixture.gamers, fixture.mc, fixture.cc].find(
        (u) => u.name === review.author,
      )?._id,
    });
  console.log(
    "Restored observed browser code edits and history; no mission completion was seeded.",
  );
}
const child = spawn(
  process.execPath,
  [
    ...(process.argv.includes("--missions") ? ["--import", pathToFileURL(resolve("scripts/part-b-browser-clock.mjs")).href] : []),
    resolve("node_modules/next/dist/bin/next"),
    ...(process.argv.includes("--dev") ? ["dev", "--webpack"] : ["start"]),
    "--hostname",
    "127.0.0.1",
    "--port",
    "3191",
  ],
  {
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      MONGODB_URI: process.env.MONGODB_URI,
      SESSION_SECRET: randomBytes(48).toString("hex"),
      TENANCY_ENABLED: "false",
      ...(process.argv.includes("--verification-build") ? { CODEWILD_BUILD_CHECK: "1" } : {}),
      APP_ORIGIN: "http://127.0.0.1:3191",
      DEMO_MODE: "false",
      BLOB_READ_WRITE_TOKEN: "",
      WEEK1_NOTIFICATION_WEBHOOK_URL: "",
      WEEK1_NOTIFICATION_WEBHOOK_TOKEN: "",
      WEEK1_COLLEGE_CONTACTS_JSON: "{}",
      NEXT_TELEMETRY_DISABLED: "1",
      ...(process.argv.includes("--missions") ? { PART_B_BROWSER_CLOCK_FILE: missionClock } : {}),
    },
  },
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  await mongoose.disconnect();
  try {
    await replica.stop();
  } catch {}
  process.exit(0);
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
console.log(
  "TEAM LAB QA http://127.0.0.1:3191 — g0@pilot.invalid / g1@pilot.invalid same team; g5@pilot.invalid other team. Password Fictional-QA-2026! Only approved-team fixture setup is synthetic; observed edits are browser QA.",
);
