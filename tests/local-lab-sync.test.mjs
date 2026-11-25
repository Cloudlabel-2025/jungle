import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
  lstat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import {
  LocalLabFolder,
  readLocalProject,
  localSourcePath,
} from "../lib/local-lab-sync.js";
import { teamInitialFiles } from "../lib/team-lab-project.js";

// Real temporary files behind the browser's directory-handle interface. No app
// globals or browser permissions are mocked into the product at runtime.
function directory(path) {
  return {
    name: path.split(sep).at(-1),
    kind: "directory",
    async *entries() {
      for (const e of await readdir(path, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        yield [
          e.name,
          e.isDirectory()
            ? directory(join(path, e.name))
            : file(join(path, e.name)),
        ];
      }
    },
    async getDirectoryHandle(name, { create = false } = {}) {
      const p = join(path, name);
      if (create) await mkdir(p, { recursive: true });
      else await lstat(p);
      return directory(p);
    },
    async getFileHandle(name, { create = false } = {}) {
      const p = join(path, name);
      if (!create) await lstat(p);
      return file(p);
    },
    async removeEntry(name) {
      await rm(join(path, name));
    },
  };
}
function file(path) {
  return {
    kind: "file",
    async getFile() {
      const bytes = await readFile(path);
      return { size: bytes.length, text: async () => bytes.toString("utf8") };
    },
    async createWritable() {
      let text = "";
      return {
        async write(value) {
          text = value;
        },
        async close() {
          await writeFile(path, text);
        },
        async abort() {},
      };
    },
  };
}
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), "vow-local-sync-"));
  try {
    await fn(directory(root), root);
  } finally {
    const resolved = resolve(root),
      prefix = resolve(tmpdir()) + sep;
    if (
      !resolved.startsWith(prefix) ||
      !resolved.split(sep).at(-1).startsWith("vow-local-sync-")
    )
      throw Error("Unsafe test cleanup path");
    await rm(resolved, { recursive: true, force: true });
  }
}
async function apply(folder, disk, editor) {
  const plan = folder.plan(disk, editor);
  assert.deepEqual(plan.conflicts, []);
  await folder.commit(disk, plan.files);
  await folder.acknowledge(plan.files);
  return plan.files;
}

test("local folder sync downloads team code, uploads local edits and retains private files", async () =>
  fixture(async (root, path) => {
    const folder = new LocalLabFolder(root, "college:one:team");
    assert.deepEqual(await folder.open(), {});
    await apply(folder, {}, teamInitialFiles);
    assert.equal(
      await readFile(join(path, "src/App.jsx"), "utf8"),
      teamInitialFiles["src/App.jsx"],
    );
    await writeFile(join(path, ".env.local"), "PRIVATE=keep-me");
    await mkdir(join(path, ".git"));
    await writeFile(join(path, ".git/config"), "keep git");
    const editor = {
      ...teamInitialFiles,
      "README.md": teamInitialFiles["README.md"] + "\nFrom browser\n",
    };
    await apply(folder, await readLocalProject(root), editor);
    await writeFile(
      join(path, "src/App.jsx"),
      teamInitialFiles["src/App.jsx"] + "\n// From VS Code\n",
    );
    const next = await apply(folder, await readLocalProject(root), editor);
    assert.match(next["src/App.jsx"], /From VS Code/);
    assert.equal(
      await readFile(join(path, ".env.local"), "utf8"),
      "PRIVATE=keep-me",
    );
    assert.equal(await readFile(join(path, ".git/config"), "utf8"), "keep git");
    const reconnected = new LocalLabFolder(root, "college:one:team");
    await reconnected.open();
    assert.deepEqual(reconnected.base, next);
    await assert.rejects(
      new LocalLabFolder(root, "college:two:team").open(),
      /another team/,
    );
  }));
test("local conflicts need a decision, preserve backups and reject decisions after another edit", async () =>
  fixture(async (root, path) => {
    const f = new LocalLabFolder(root, "team");
    await apply(f, {}, teamInitialFiles);
    const editor = {
      ...teamInitialFiles,
      "README.md": "Browser replacement\n",
    };
    await writeFile(join(path, "README.md"), "Local replacement\n");
    const disk = await readLocalProject(root),
      conflict = f.plan(disk, editor);
    assert.deepEqual(conflict.conflicts, ["README.md"]);
    assert.equal(
      await readFile(join(path, "README.md"), "utf8"),
      "Local replacement\n",
    );
    const choices = {
      "README.md": {
        side: "editor",
        disk: disk["README.md"],
        editor: editor["README.md"],
      },
    };
    assert.deepEqual(
      f.plan({ ...disk, "README.md": "changed again" }, editor, choices)
        .conflicts,
      ["README.md"],
    );
    const resolved = f.plan(disk, editor, choices);
    assert.deepEqual(resolved.conflicts, []);
    await f.commit(disk, resolved.files);
    await f.acknowledge(resolved.files);
    const backups = await readdir(join(path, ".vow-sync-backups"));
    const archived = await Promise.all(
      backups.map((n) =>
        readFile(join(path, ".vow-sync-backups", n, "README.md"), "utf8").catch(
          () => "",
        ),
      ),
    );
    assert.ok(archived.includes("Local replacement\n"));
  }));
test("local file changes during syncing are retained and optional deletions sync both ways", async () =>
  fixture(async (root, path) => {
    const f = new LocalLabFolder(root, "team"),
      initial = { ...teamInitialFiles, "src/extra.js": "original" };
    await apply(f, {}, initial);
    const disk = await readLocalProject(root),
      editor = { ...initial, "src/extra.js": "remote" };
    await writeFile(join(path, "src/extra.js"), "new local edit");
    await assert.rejects(f.commit(disk, editor), /changed during syncing/);
    assert.equal(
      await readFile(join(path, "src/extra.js"), "utf8"),
      "new local edit",
    );
    await writeFile(join(path, "src/extra.js"), "original");
    const removed = { ...initial };
    delete removed["src/extra.js"];
    await apply(f, await readLocalProject(root), removed);
    await assert.rejects(readFile(join(path, "src/extra.js")), {
      code: "ENOENT",
    });
    await apply(f, await readLocalProject(root), initial);
    await rm(join(path, "src/extra.js"));
    const localRemoval = await apply(f, await readLocalProject(root), initial);
    assert.equal(localRemoval["src/extra.js"], undefined);
  }));
test("local sync never imports secrets, dependencies, build output or path traversal", () => {
  for (const p of [
    "../secret.js",
    ".env.local",
    "node_modules/app.js",
    ".git/config",
    "dist/app.js",
    "src/__proto__/a.js",
    "package-lock.json",
  ])
    assert.equal(localSourcePath(p), false, p);
  assert.equal(localSourcePath("src/helpers.ts"), true);
});
