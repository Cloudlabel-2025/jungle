// Disposable replica set only. This runner never reads .env.local or touches
// the developer's persistent game database.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
await mkdir(".data", { recursive: true });
const log = createWriteStream(".data/v3-verification.log");
const repl = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  instanceOpts: [{ port: 27023, args: ["--wiredTigerCacheSizeGB", "0.25"] }],
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const env = { ...process.env, TEST_MONGODB_URI: repl.getUri("v3_disposable") };
async function run(args) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    log.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    log.write(chunk);
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0)
    throw new Error(`Verification failed (${code}): ${args.join(" ")}`);
}
try {
  await run(["--test", "--test-concurrency=1", "tests/*.test.mjs"]);
  await run(["scripts/acceptance.mjs"]);
} finally {
  await repl.stop();
  log.end();
}
