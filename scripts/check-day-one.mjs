import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
const testFiles = process.argv.includes("--pilot")
  ? readdirSync(new URL("../tests/", import.meta.url))
      .filter((n) => n.startsWith("pilot-") && n.endsWith(".test.mjs"))
      .map((n) => `tests/${n}`)
  : process.argv.includes("--recovery")
    ? ["tests/recovery-rules.test.mjs", "tests/recovery-database.test.mjs"]
    : process.argv.includes("--program")
      ? [
          "tests/week-one-program-database.test.mjs",
          "tests/week-one-program-rules.test.mjs",
        ]
      : process.argv.includes("--all")
        ? readdirSync(new URL("../tests/", import.meta.url))
            .filter((name) => name.endsWith(".test.mjs"))
            .map((name) => `tests/${name}`)
        : [
            "tests/day-one-rules.test.mjs",
            "tests/day-one-database.test.mjs",
            "tests/day-one-setup.test.mjs",
            "tests/attendance.test.mjs",
            "tests/work-history.test.mjs",
            "tests/research-database.test.mjs",
            "tests/research-engine.test.mjs",
            "tests/research-choice-engine.test.mjs",
            "tests/research-choice-database.test.mjs",
            "tests/flight-stage.test.mjs",
            "tests/sky-journey.test.mjs",
            "tests/sky-flight.test.mjs",
            "tests/week-one-rules.test.mjs",
            "tests/week-one-database.test.mjs",
          ];
const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
try {
  const concurrency = process.argv.find((a) =>
    /^--test-concurrency=[1-8]$/.test(a),
  );
  const requestedTest = process.argv.find(a => /^--test-file=[\w-]+\.test\.mjs$/.test(a));
  const child = spawn(
    process.execPath,
    ["--test", ...(concurrency ? [concurrency] : []), ...(requestedTest ? [`tests/${requestedTest.slice(12)}`] : testFiles)],
    {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        TEST_MONGODB_URI: replica.getUri("day1_tests"),
        WEEK1_NOTIFICATION_WEBHOOK_URL: "",
        WEEK1_NOTIFICATION_WEBHOOK_TOKEN: "",
        WEEK1_COLLEGE_CONTACTS_JSON: "{}",
      },
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await replica.stop();
}
