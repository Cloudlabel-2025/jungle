import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { claimLauncher, portInUse, stopNext } from "./dev-runtime.mjs";
import { models } from "../lib/db.js";
import { seed } from "../lib/seed.js";
import { hashPassword } from "../lib/password.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { emptyRecovery } from "../lib/recovery-rules.js";
import { rosterDigest } from "../lib/recovery.js";
import { pilotAction } from "../lib/pilot-engine.js";
import { processPilot } from "./process-pilot.mjs";
import manifests from "../lib/pilot-manifests.json" with { type: "json" };

// Isolated local staging: never reads .env.local or the existing application database.
const directory = resolve(".data/pilot-staging"),
  port = 3105;
let replica,
  child,
  releaseLock,
  timer,
  stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await stopNext(child);
  await mongoose.disconnect();
  if (replica) await replica.stop({ doCleanup: false });
  if (releaseLock) await releaseLock();
  process.exit(code);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
try {
  if ((await portInUse(port)) || (await portInUse(27026)))
    throw Error(
      "The isolated staging ports are already in use. Reuse the existing staging server or stop its launcher first.",
    );
  await mkdir(resolve(directory, "mongo"), { recursive: true });
  releaseLock = await claimLauncher(resolve(directory, "launcher.lock"));
  const credentialsPath = resolve(directory, "accounts.json");
  let config;
  try {
    config = JSON.parse(await readFile(credentialsPath, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    config = { sessionSecret: randomBytes(48).toString("hex"), accounts: [] };
  }
  replica = new MongoMemoryReplSet({
    binary: { version: "7.0.24" },
    instanceOpts: [{ port: 27026, dbPath: resolve(directory, "mongo") }],
    replSet: { name: "pilotstaging", count: 1, storageEngine: "wiredTiger" },
  });
  await replica.start();
  process.env.MONGODB_URI = replica.getUri("codewild_pilot_staging");
  process.env.SESSION_SECRET = config.sessionSecret;
  config.cronSecret ||= randomBytes(32).toString("hex");
  process.env.CRON_SECRET = config.cronSecret;
  process.env.DEMO_MODE = "false";
  process.env.BLOB_READ_WRITE_TOKEN = "";
  await seed();
  if (!(await models.PilotSprint.exists({ cohortId: "alpha" }))) {
    const users = await models.User.find({ cohortId: "alpha" }).lean(),
      mc = users.find((u) => u.role === "MISSION_COMMANDER"),
      cc = users.find((u) => u.role === "CENTRE_COMMAND"),
      gamers = users.filter((u) => u.role === "GAMER"),
      teams = (await models.Team.find({ cohortId: "alpha" }).lean()).map(
        (t) => ({
          id: t._id,
          members: gamers.filter((g) => g.teamId === t._id).map((g) => g._id),
        }),
      );
    await models.Team.updateMany(
      { cohortId: "alpha" },
      { $set: { commanderId: mc._id } },
    );
    const p = blankProgram();
    p.locked = true;
    p.publications = [
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
    const r = emptyRecovery();
    r.fridayVersion = 1;
    r.published = {
      version: 1,
      teams,
      by: cc._id,
      at: new Date().toISOString(),
      synthetic: true,
      eligibleDigest: rosterDigest(r, p.publications[0]),
    };
    p.recovery = r;
    await models.WeekOneProgram.create({ _id: "alpha", version: 1, data: p });
    const monday = new Date();
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const time = (days, hours) =>
        new Date(+monday + days * 86400000 + hours * 3600000).toISOString(),
      reason =
        "SYNTHETIC local review fixture; not Curriculum or production approval.";
    const command = (u, action, b = {}) =>
      pilotAction(u, action, { requestId: randomUUID(), reason, ...b });
    await command(cc, "draft", {
      config: {
        number: 1,
        calendar: {
          timeZone: "Asia/Kolkata",
          intervals: [
            { startMinute: 600, endMinute: 780 },
            { startMinute: 840, endMinute: 1020 },
          ],
          weekdays: [1, 2, 3, 4, 5],
          holidays: [],
        },
        kickoffStart: time(0, 4.5),
        kickoffEnd: time(0, 6.5),
        dueAt: time(4, 11.5),
        teams: teams.map((t) => ({
          ...t,
          teamId: t.id,
          commanderId: mc._id,
          owners: Object.fromEntries(
            manifests.sprints[0].tasks.map((c) => [
              c.id,
              t.members["ABCDE".indexOf(c.owner)],
            ]),
          ),
          rationale: reason,
        })),
        resources: Object.fromEntries(
          manifests.sprints[0].tasks.map((c) => [
            c.id,
            {
              author: "CURRICULUM",
              url: "https://example.invalid/synthetic-resource",
              version: "SYNTHETIC-REVIEW",
              approval: reason,
            },
          ]),
        ),
      },
    });
    await command(cc, "approve");
    await command(cc, "load");
    if (new Date() >= new Date(time(0, 6.5)))
      for (const t of teams)
        await command(mc, "kickoff", { teamId: t.id, evidence: reason });
  }
  for (const u of await models.User.find({ cohortId: "alpha" }).lean()) {
    let a = config.accounts.find((a) => a.id === u._id);
    if (!a) {
      a = {
        id: u._id,
        name: u.name,
        role: u.role,
        username: `review-${u._id}`,
        password: randomBytes(18).toString("base64url"),
      };
      config.accounts.push(a);
    }
    await models.User.updateOne(
      { _id: u._id },
      { $set: { username: a.username } },
    );
    await models.Credential.updateOne(
      { _id: u._id },
      { $set: { passwordHash: await hashPassword(a.password) } },
      { upsert: true },
    );
  }
  await writeFile(credentialsPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
  let processing = false;
  timer = setInterval(async () => {
    if (processing) return;
    processing = true;
    try {
      await processPilot();
    } catch (e) {
      console.error("Staging scheduler:", e.message);
    } finally {
      processing = false;
    }
  }, 60000);
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      windowsHide: true,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    },
  );
  child.once("exit", (code) => void shutdown(code || 0));
  console.log(
    `SYNTHETIC isolated review: http://127.0.0.1:${port}. Private Gamer/TL/MC/CC credentials: ${credentialsPath}. No production data loaded.`,
  );
} catch (e) {
  console.error(e.message);
  await shutdown(1);
}
