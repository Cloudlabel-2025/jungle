import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { runLocalSync } from "../scripts/local-code-sync.mjs";
import { teamInitialFiles } from "../lib/team-lab-project.js";

test("local runner keeps source when unchanged-version replies omit files and avoids repeated saves", async () => {
  const root = await mkdtemp(join(tmpdir(), "vow-runner-test-")),
    abort = new AbortController(),
    logs = [];
  let reads = 0,
    writes = 0,
    seenVersion;
  const server = createServer((req, res) => {
    assert.equal(
      req.headers.authorization,
      "Bearer fictional-project-connection",
    );
    assert.equal(req.headers.cookie, undefined);
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") {
      writes++;
      res.end("{}");
      return;
    }
    reads++;
    seenVersion = new URL(req.url, "http://localhost").searchParams.get(
      "version",
    );
    res.end(
      JSON.stringify(
        reads === 1
          ? { projectId: "team-qa", version: 1, files: teamInitialFiles }
          : { projectId: "team-qa", version: 1 },
      ),
    );
    if (reads === 2) setTimeout(() => abort.abort(), 200);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const safety = setTimeout(() => abort.abort(), 8000);
  try {
    await runLocalSync({
      config: {
        origin: `http://127.0.0.1:${server.address().port}`,
        grantId: "fictional-grant",
        token: "fictional-project-connection",
        projectId: "team-qa",
        scopeKey: "project:team-qa",
      },
      folderPath: root,
      signal: abort.signal,
      log: (message) => logs.push(message),
    });
    assert.equal(reads, 2);
    assert.equal(seenVersion, "1");
    assert.equal(writes, 0);
    assert.equal(
      await readFile(join(root, "src/App.jsx"), "utf8"),
      teamInitialFiles["src/App.jsx"],
    );
    assert.equal(logs.filter((s) => s.startsWith("Synced")).length, 1);
    assert.match(
      await readFile(join(root, ".gitignore"), "utf8"),
      /\.vow-sync-config\.json/,
    );
  } finally {
    clearTimeout(safety);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    const path = resolve(root);
    if (
      !path.startsWith(resolve(tmpdir()) + sep) ||
      !path.split(sep).at(-1).startsWith("vow-runner-test-")
    )
      throw Error("Unsafe cleanup target");
    await rm(path, { recursive: true, force: true });
  }
});
