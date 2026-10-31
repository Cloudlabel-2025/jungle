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

const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = replica.getUri("day1_browser_preview");
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
  const call = (u, a, b = {}, t = now) => dayOneAction(u, a, b, t);
  await call(
    cc,
    "release",
    { revision: 0, config },
    new Date(now.getTime() - 4 * 3600000),
  );
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
    const g = gamers[i],
      early = new Date(now.getTime() - 3 * 3600000),
      started = new Date(now.getTime() - 45 * 60000);
    await call(g, "clock", {}, early);
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
  const g = gamers[0];
  await call(g, "sod", {
    text: "Explore how discoveries about exoplanets are verified using independent observations.",
  });
  await call(g, "genre", { genreId: "genre-1" });
  await call(g, "acknowledge");
  await call(g, "start");
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
} catch (e) {
  console.error(e);
  await close();
  process.exitCode = 1;
}
