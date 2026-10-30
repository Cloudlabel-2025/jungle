import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  appPort,
  portInUse,
  existingWorkspaceMongo,
  claimLauncher,
  stopNext,
} from "./dev-runtime.mjs";
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const args = process.argv.slice(2);
const port = appPort(args, process.env.PORT || "3000");
const url = `http://127.0.0.1:${port}`;
const dataDirectory = fileURLToPath(new URL("../.data/", import.meta.url));
const dbPath = fileURLToPath(new URL("../.data/mongo", import.meta.url));
const lockPath = fileURLToPath(
  new URL("../.data/dev-launcher.lock", import.meta.url),
);
let repl, child, releaseLock;
let databaseWatch, databaseRecovery;
let localReplicaSetName = "testset";
let stopping = false;
async function startWorkspaceMongo() {
  if (repl) await repl.stop({ doCleanup: false });
  repl = new MongoMemoryReplSet({
    binary: { version: "7.0.24" },
    instanceOpts: [{ port: 27019, dbPath }],
    replSet: {
      name: localReplicaSetName,
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  await repl.start();
  return repl.getUri("codewild");
}
async function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(databaseWatch);
  try {
    await stopNext(child);
    if (databaseRecovery) await databaseRecovery;
    await mongoose.disconnect();
    if (repl) await repl.stop({ doCleanup: false });
  } catch (error) {
    console.error(`CODEWILD · Shutdown: ${error.message}`);
    exitCode = 1;
  } finally {
    if (releaseLock) await releaseLock();
  }
  process.exit(exitCode);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
async function main() {
  if (await portInUse(port)) {
    let codewild = false;
    try {
      const response = await fetch(`${url}/api/auth/me`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();
      codewild =
        response.ok &&
        typeof data.authenticated === "boolean" &&
        typeof data.serverTime === "string";
    } catch {}
    console.log(
      codewild
        ? `CODEWILD · Already running at ${url}.\nUse the existing preview, or press Ctrl+C in its terminal before starting again.`
        : `CODEWILD · Port ${port} is already in use. Stop that server or choose another port with npm run dev -- --port 3002.`,
    );
    return;
  }
  await mkdir(dataDirectory, { recursive: true });
  releaseLock = await claimLauncher(lockPath);
  await import("./prepare-lab.mjs");
  const manageLocalMongo = !process.env.MONGODB_URI;
  if (!process.env.MONGODB_URI) {
    await mkdir(dbPath, { recursive: true });
    if (await portInUse(27019)) {
      process.env.MONGODB_URI = await existingWorkspaceMongo(27019, dbPath);
      localReplicaSetName =
        new URL(process.env.MONGODB_URI).searchParams.get("replicaSet") ||
        "testset";
      console.log(
        "CODEWILD · Reusing the running MongoDB replica set for this workspace.",
      );
    } else {
      console.log(
        "CODEWILD · Starting a local, disk-backed MongoDB replica set…",
      );
      process.env.MONGODB_URI = await startWorkspaceMongo();
    }
  }
  process.env.SESSION_SECRET ||= randomBytes(48).toString("hex");
  process.env.DEMO_MODE ??= "true";
  const { seed } = await import("../lib/seed.js");
  await seed();
  await mongoose.disconnect();
  console.log(`CODEWILD · 29 personas ready. Local preview: ${url}`);
  child = spawn(
    process.execPath,
    [
      ...process.execArgv.filter((arg) => arg === "--use-system-ca"),
      "node_modules/next/dist/bin/next",
      "dev",
      ...(args.some((arg) =>
        ["--webpack", "--turbopack", "--turbo"].includes(arg),
      )
        ? []
        : ["--webpack"]),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
      ...args,
    ],
    { stdio: "inherit", env: process.env, windowsHide: true },
  );
  child.once("error", (error) => {
    console.error(`CODEWILD · ${error.message}`);
    void shutdown(1);
  });
  child.once("exit", (code) => void shutdown(code ?? 0));
  if (manageLocalMongo) {
    databaseWatch = setInterval(() => {
      if (stopping || databaseRecovery) return;
      databaseRecovery = (async () => {
        if (!(await portInUse(27019)) && !stopping) {
          console.log(
            "CODEWILD · Local MongoDB stopped. Recovering the workspace replica set…",
          );
          await startWorkspaceMongo();
          console.log(
            "CODEWILD · MongoDB recovered. Existing game records preserved.",
          );
        }
      })()
        .catch((error) =>
          console.error(
            `CODEWILD · MongoDB recovery will retry: ${error.message}`,
          ),
        )
        .finally(() => {
          databaseRecovery = null;
        });
    }, 5000);
  }
}
try {
  await main();
} catch (error) {
  console.error(`CODEWILD · ${error.message}`);
  await shutdown(1);
}
