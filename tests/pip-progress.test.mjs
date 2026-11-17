import test from "node:test";
import assert from "node:assert/strict";
import { createPipProgressClient, legacyPipProgress } from "../lib/pip-progress-client.js";
import { emptyPipProgress, mergePipProgress } from "../lib/pip-progress-rules.js";
import { pipScope } from "../lib/pip-tutorial.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
test("device writes serialize, merge steps and keep newer arrow changes while a request is in flight", async () => {
  let account = emptyPipProgress(), release;
  const requests = [], client = createPipProgressClient(account, async (patch) => {
    requests.push(patch);
    if (requests.length === 1) await new Promise((resolve) => { release = resolve; });
    account = { ...mergePipProgress(account, patch), version: account.version + 1 };
    return account;
  });
  client.start();
  client.patch({ seen: ["genre"], following: true });
  client.patch({ dismissed: ["genre"], completed: ["genre"], following: false });
  assert.equal(client.get().following, false);
  release(); await tick(); await tick();
  assert.equal(requests.length, 2);
  assert.deepEqual(account.completed, ["genre"]);
  assert.equal(account.following, false);
  client.receive({ ...emptyPipProgress(), version: 0, following: true });
  assert.equal(client.get().following, false, "a stale workspace snapshot cannot undo a confirmed preference");
  client.patch({ seen: ["genre"] });
  await tick(); assert.equal(requests.length, 2, "duplicate appearances do not spam writes");
  client.stop();
});

test("failed saves retain pending progress and retry; another device resumes without local storage", async () => {
  let account = emptyPipProgress(), tries = 0, retry;
  const timers = { setTimeout(fn) { retry = fn; return 1; }, clearTimeout() {} };
  const client = createPipProgressClient(account, async (patch) => {
    if (!tries++) throw Error("offline");
    account = { ...mergePipProgress(account, patch), version: 1 }; return account;
  }, timers);
  client.start(); client.patch({ seen: ["travelling"], dismissed: ["map-start"] });
  await tick(); assert.match(client.get().error, /Retrying/);
  retry(); await tick();
  assert.equal(client.get().error, "");
  const otherDevice = createPipProgressClient(structuredClone(account), () => assert.fail("no new write needed"));
  assert.ok(otherDevice.get().seen.includes("travelling"));
  assert.ok(otherDevice.get().dismissed.includes("map-start"));
  client.stop(); otherDevice.stop();
});

test("legacy browser preferences migrate only to the matching account and never undo a reset", () => {
  const data = { user: { _id: "p", cohortId: "alpha" }, dayOne: {} }, values = new Map();
  const scope = pipScope(data);
  values.set(scope, "genre"); values.set(`${scope}:follow`, "true");
  values.set('codewild:pip:travel:v1:["p","alpha"]', "seen");
  const storage = { getItem: (key) => values.get(key) };
  const migrated = legacyPipProgress(data, storage);
  assert.deepEqual(migrated.dismissed, ["genre", "travelling"]);
  assert.equal(migrated.following, true);
  assert.deepEqual(legacyPipProgress({ ...data, pipProgress: emptyPipProgress(2) }, storage), {});
  assert.deepEqual(legacyPipProgress({ ...data, user: { _id: "other" } }, storage).seen, []);
  assert.equal(legacyPipProgress({ ...data, pipProgress: { ...emptyPipProgress(), version: 3 } }, storage).following, undefined);
});
