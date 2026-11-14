// A disposable replica set; deliberately does not load the live game's .env.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
const repl = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
try {
  const files = process.argv.slice(2);
  const child = spawn(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      ...(files.length
        ? files
        : [
            "tests/flight-investigation.test.mjs",
            "tests/flight-progression-database.test.mjs",
            "tests/flight-stage.test.mjs",
            "tests/level-two-ui.test.mjs",
            "tests/week-one-levels.test.mjs",
            "tests/week-one-levels-database.test.mjs",
            "tests/week-one-star-ui.test.mjs",
          ]),
    ],
    {
      env: { ...process.env, TEST_MONGODB_URI: repl.getUri("flight_test") },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
} finally {
  await repl.stop();
}
