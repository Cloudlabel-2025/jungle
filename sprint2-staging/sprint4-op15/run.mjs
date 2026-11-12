import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { arch, availableParallelism, platform, release } from "node:os";
import { fields } from "../fields.mjs";
import { start } from "../staging.mjs";

const read = (name) => readFile(new URL(name, import.meta.url));
const approved = JSON.parse(await read("../key-2-isolated-record.json"));
const friday = JSON.parse(await read("../sprint4-uat05/workflow.json"));
const hash = createHash("sha256");
for (const file of [
  "fields.mjs",
  "staging.mjs",
  "ui.jsx",
  "verify.mjs",
  "../package-lock.json",
]) {
  hash
    .update(file)
    .update("\0")
    .update(await read("../" + file))
    .update("\0");
}
const candidateSha256 = hash.digest("hex");
assert.equal(candidateSha256, approved.candidateSha256);
assert.equal(candidateSha256, friday.fridayEvidence.sha256);

const evidence = {
  candidateSha256,
  at: new Date().toISOString(),
  scope:
    "Disposable loopback HTTP with synthetic records and a private temporary MongoDB instance",
  runtime: {
    node: process.version,
    platform: platform(),
    osRelease: release(),
    arch: arch(),
    logicalConcurrency: availableParallelism(),
    mongo: "7.0.24",
  },
  performance: [],
  controls: [],
  reliability: [],
};

let app;
async function request(path, { method = "GET", cookie, body } = {}) {
  const began = performance.now();
  const response = await fetch(app.url + path, {
    method,
    signal: AbortSignal.timeout(5000),
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    ms: performance.now() - began,
    headers: response.headers,
    text,
  };
}
async function login(account) {
  const result = await request("/api/login", { method: "POST", body: account });
  assert.equal(result.status, 200);
  assert.equal(Object.hasOwn(JSON.parse(result.text), "password"), false);
  return result.headers.get("set-cookie");
}
async function check(target, name, operation, expected) {
  const result = await operation();
  target.push({
    name,
    expected,
    actual: result.status,
    pass: result.status === expected,
  });
  assert.equal(result.status, expected, name);
  return result;
}
const percentile = (values, p) => values[Math.ceil(values.length * p) - 1];
const round = (n) => Math.round(n * 100) / 100;
const summarize = (samples) => {
  const durations = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const errors = samples.filter(
    (sample) => sample.status !== 200 || !sample.valid,
  ).length;
  return {
    requests: samples.length,
    errors,
    p50Ms: round(percentile(durations, 0.5)),
    p95Ms: round(percentile(durations, 0.95)),
    maxMs: round(durations.at(-1)),
  };
};
const paths = ["/health", "/api/alumni", "/api/alumni/AL-QA-001"];
try {
  app = await start(3188);
  const header = await login(app.accounts[0]);
  const admin = header.split(";")[0];
  const alumnus = (await login(app.accounts[1])).split(";")[0];
  const controls = evidence.controls;
  controls.push({
    name: "Session cookie and response headers",
    httpOnly: /; HttpOnly/i.test(header),
    sameSiteStrict: /; SameSite=Strict/i.test(header),
    secure: /; Secure/i.test(header),
    maxAgeSeconds: Number(/Max-Age=(\d+)/i.exec(header)?.[1]),
    apiCacheControl: (
      await request("/api/session", { cookie: admin })
    ).headers.get("cache-control"),
    htmlCspPresent: (await request("/")).headers.has("content-security-policy"),
  });
  await check(controls, "Unsigned directory", () => request(paths[1]), 401);
  await check(
    controls,
    "Invalid sign-in",
    () =>
      request("/api/login", {
        method: "POST",
        body: {
          email: app.accounts[0].email,
          password: "incorrect-fixture-value",
        },
      }),
    401,
  );
  await check(
    controls,
    "Alumnus own profile",
    () => request(paths[2], { cookie: alumnus }),
    200,
  );
  await check(
    controls,
    "Alumnus directory denied",
    () => request(paths[1], { cookie: alumnus }),
    403,
  );
  await check(
    controls,
    "Alumnus other profile denied",
    () => request("/api/alumni/AL-QA-002", { cookie: alumnus }),
    403,
  );
  await check(
    controls,
    "Alumnus create denied",
    () => request(paths[1], { cookie: alumnus, method: "POST", body: {} }),
    403,
  );
  await check(
    controls,
    "Alumnus edit denied",
    () => request(paths[2], { cookie: alumnus, method: "PUT", body: {} }),
    403,
  );
  await check(
    controls,
    "Alumnus sign-out",
    () => request("/api/logout", { cookie: alumnus, method: "POST" }),
    200,
  );
  await check(
    controls,
    "Signed-out session rejected",
    () => request("/api/session", { cookie: alumnus }),
    401,
  );

  const measure = async (path) => {
    const startAt = performance.now();
    try {
      const result = await request(path, { cookie: admin });
      const value = JSON.parse(result.text);
      const valid =
        path === paths[0]
          ? value.status === "ready"
          : path === paths[1]
            ? value.length === 20
            : value._id === "AL-QA-001";
      return { path, ms: result.ms, status: result.status, valid };
    } catch (error) {
      return {
        path,
        ms: performance.now() - startAt,
        valid: false,
        error: error.name,
      };
    }
  };
  for (let i = 0; i < 12; i++)
    assert.ok((await measure(paths[i % paths.length])).valid);
  for (const concurrency of [1, 4, 8]) {
    let cursor = 0;
    const samples = [];
    const began = performance.now();
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < 90) {
          const path = paths[cursor++ % paths.length];
          samples.push(await measure(path));
        }
      }),
    );
    const elapsedMs = performance.now() - began;
    evidence.performance.push({
      concurrency,
      elapsedMs: round(elapsedMs),
      requestsPerSecond: round(90000 / elapsedMs),
      ...summarize(samples),
      endpoints: Object.fromEntries(
        paths.map((path) => [
          path,
          summarize(samples.filter((sample) => sample.path === path)),
        ]),
      ),
      samples: samples.map(({ ms, ...sample }) => ({
        ...sample,
        ms: round(ms),
      })),
    });
  }
  const reliability = evidence.reliability;
  const original = JSON.parse(
    (await request(paths[2], { cookie: admin })).text,
  );
  const body = Object.fromEntries(fields.map(([key]) => [key, original[key]]));
  Object.assign(body, {
    email: "op15-race@example.invalid",
    registration: "OP15-RACE",
  });
  const pair = await Promise.all(
    [0, 1].map(() =>
      request(paths[1], { method: "POST", cookie: admin, body }),
    ),
  );
  const statuses = pair.map((item) => item.status).sort();
  reliability.push({
    name: "Concurrent duplicate create",
    actual: statuses,
    expected: [201, 409],
  });
  assert.deepEqual(statuses, [201, 409]);
  const created = JSON.parse(pair.find((item) => item.status === 201).text);
  const nextAdmin = (await login(app.accounts[0])).split(";")[0];
  const records = JSON.parse(
    (await request(paths[1], { cookie: nextAdmin })).text,
  );
  assert.equal(records.length, 21);
  assert.equal(records.filter((item) => item.email === body.email).length, 1);
  const reopened = await check(
    reliability,
    "Created record opened from a second session",
    () => request("/api/alumni/" + created._id, { cookie: nextAdmin }),
    200,
  );
  assert.deepEqual(JSON.parse(reopened.text), created);
  await app.close();
  app = null;
  const restart = performance.now();
  app = await start(3188);
  await check(
    reliability,
    "Health after clean relaunch",
    () => request("/health"),
    200,
  );
  reliability.push({
    name: "Clean relaunch to health",
    ms: round(performance.now() - restart),
  });
  await check(
    reliability,
    "Pre-restart session rejected",
    () => request("/api/session", { cookie: nextAdmin }),
    401,
  );
  const restoredAdmin = (await login(app.accounts[0])).split(";")[0];
  const restored = JSON.parse(
    (await request(paths[1], { cookie: restoredAdmin })).text,
  );
  const ids = restored.map((item) => item._id);
  assert.deepEqual(
    ids,
    Array.from(
      { length: 20 },
      (_, i) => "AL-QA-" + String(i + 1).padStart(3, "0"),
    ),
  );
  assert.ok(restored.every((item) => item.email !== body.email));
  reliability.push({
    name: "Seed identity and clean reset",
    restoredCount: ids.length,
    rehearsalRowAbsent: true,
  });
  await writeFile(
    new URL("measurements.json", import.meta.url),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.table(
    evidence.performance.map(({ samples, endpoints, ...row }) => row),
  );
  console.log(JSON.stringify(reliability));
  if (process.argv.includes("--browser")) {
    console.log(
      "Disposable browser copy:",
      app.url,
      JSON.stringify(app.accounts[0]),
    );
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} catch (error) {
  evidence.failure = error.message;
  await writeFile(
    new URL("measurements.json", import.meta.url),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  throw error;
} finally {
  if (app) await app.close();
}
