import test from "node:test";
import assert from "node:assert/strict";
import { awaitRuntimeStartup } from "../lib/runtime-startup.js";

test("runtime startup returns promptly and does not dispose an active resource", async () => {
  let released = 0;
  assert.equal(
    await awaitRuntimeStartup(Promise.resolve("ready"), {
      timeoutMs: 100,
      releaseLate: () => released++,
    }),
    "ready",
  );
  assert.equal(released, 0);
});
test("a hung runtime has a bounded wait and a late instance is released once", async () => {
  let complete,
    released = 0;
  const pending = new Promise((resolve) => (complete = resolve));
  await assert.rejects(
    awaitRuntimeStartup(pending, {
      timeoutMs: 5,
      releaseLate: () => released++,
    }),
    { code: "STARTUP_TIMEOUT" },
  );
  complete({});
  await pending;
  await Promise.resolve();
  assert.equal(released, 1);
});
test("cancellation releases late resources and ignores later provider failures", async () => {
  const controller = new AbortController();
  let complete,
    released = 0;
  const pending = new Promise((resolve) => (complete = resolve));
  const wait = awaitRuntimeStartup(pending, {
    signal: controller.signal,
    releaseLate: () => released++,
  });
  controller.abort();
  await assert.rejects(wait, { code: "STARTUP_CANCELLED" });
  complete({});
  await pending;
  await Promise.resolve();
  assert.equal(released, 1);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    awaitRuntimeStartup(Promise.reject(new Error("late failure")), {
      signal: cancelled.signal,
    }),
    { code: "STARTUP_CANCELLED" },
  );
});
test("provider errors keep their original diagnostic", async () => {
  await assert.rejects(
    awaitRuntimeStartup(Promise.reject(new Error("provider unavailable"))),
    /provider unavailable/,
  );
});
