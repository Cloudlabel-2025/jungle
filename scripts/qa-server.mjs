// Private browser QA: separate database and localhost cookie origin.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { seed } from "../lib/seed.js";
import { stopNext } from "./dev-runtime.mjs";
let repl;
let source = process.env.TEST_MONGODB_URI;
if (!source) {
  repl = await MongoMemoryReplSet.create({
    binary: { version: "7.0.24" },
    instanceOpts: [{ port: 27021 }],
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  source = repl.getUri("codewild");
}
const uri = new URL(source);
uri.pathname = `/codewild_browserqa_${Date.now()}`;
process.env.MONGODB_URI = uri.toString();
process.env.SESSION_SECRET = randomBytes(48).toString("hex");
process.env.DEMO_MODE = "true";
process.env.DEMO_ACCESS_CODE = "";
process.env.APP_ORIGIN = "http://localhost:3002";
await seed();
let child,
  stopping = false;
function start() {
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3002",
    ],
    {
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    },
  );
}
async function stop() {
  if (stopping) return;
  stopping = true;
  await stopNext(child);
  if (!/^codewild_browserqa_\d+$/.test(mongoose.connection.name))
    throw Error("Unexpected QA database.");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (repl) await repl.stop();
  console.log("QA database removed; user arena untouched.");
  process.exit(0);
}
start();
console.log(
  `Browser QA: http://localhost:3002 · database ${mongoose.connection.name}`,
);
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (command) => {
  if (command.trim() === "stop") await stop();
  else if (command.trim() === "restart") {
    await stopNext(child);
    start();
  }
});
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
