import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdtemp, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appPort, portInUse, claimLauncher } from "../scripts/dev-runtime.mjs";
test("launcher respects the selected app port and rejects invalid ports", () => {
  assert.equal(appPort([]), 3000);
  assert.equal(appPort([], "3100"), 3100);
  assert.equal(appPort(["--port", "3200"]), 3200);
  assert.equal(appPort(["-p", "3300"]), 3300);
  assert.equal(appPort(["--port=3400"]), 3400);
  for (const args of [
    ["--port"],
    ["-p", "0"],
    ["--port", "65536"],
    ["--port", "no"],
  ])
    assert.throws(() => appPort(args), /development port/);
});
test("launcher prevents concurrent starts and recovers a stale owner record", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "codewild-launcher-test-"),
  );
  const lockPath = path.join(directory, "launcher.lock");
  try {
    const release = await claimLauncher(lockPath);
    await assert.rejects(() => claimLauncher(lockPath), /already running/);
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).pid, process.pid);
    await release();
    await writeFile(lockPath, JSON.stringify({ pid: 2147483647 }));
    const releaseRecovered = await claimLauncher(lockPath);
    await releaseRecovered();
  } finally {
    try {
      await unlink(lockPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rmdir(directory);
  }
});
test("launcher detects an occupied local port before starting a database", async () => {
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  try {
    assert.equal(await portInUse(port), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(await portInUse(port), false);
});
