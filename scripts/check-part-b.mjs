// Disposable database only; never load .env.local or the persistent game database.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

const all = process.argv.includes("--all");
const controls = process.argv.includes("--controls");
const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" }, replSet: { count: 1, storageEngine: "wiredTiger" },
});
const log = createWriteStream(`artifacts/part-b-${all ? "full" : controls ? "controls" : "focused"}-regression.txt`);
try {
  const env = { ...process.env, TEST_MONGODB_URI: replica.getUri("part_b_disposable"),
    MONGODB_URI: replica.getUri("part_b_disposable"), BLOB_READ_WRITE_TOKEN: "" };
  const child = spawn(process.execPath, ["--test", "--test-concurrency=1", all ? "tests/*.test.mjs" : controls ? "tests/pilot-part-b*.test.mjs" : "tests/pilot-*.test.mjs"], {
    env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { log.write(chunk); process.stdout.write(chunk); });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  process.exitCode = code ?? 1;
} finally { await replica.stop(); await new Promise(resolve => log.end(resolve)); }
