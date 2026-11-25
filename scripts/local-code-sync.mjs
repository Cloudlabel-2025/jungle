#!/usr/bin/env node
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  lstat,
  unlink,
  realpath,
  rename,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, join, dirname, basename, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LocalLabFolder, readLocalProject } from "../lib/local-lab-sync.js";
import { sameTeamFiles } from "../lib/team-lab-merge.js";

export function localDirectory(path, root = path) {
  const safe = async (name, create = false, isDir = false) => {
    if (
      !name ||
      name.includes("/") ||
      name.includes("\\") ||
      name === "." ||
      name === ".."
    )
      throw Error("Invalid local file name.");
    const full = resolve(path, name);
    if (!full.startsWith(root + sep))
      throw Error("Refusing access outside the connected folder.");
    try {
      if ((await lstat(full)).isSymbolicLink())
        throw Error("Symbolic links cannot be synced.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      if (!create) throw e;
    }
    if (isDir && create) await mkdir(full, { recursive: true });
    return full;
  };
  return {
    name: basename(path),
    kind: "directory",
    async *entries() {
      for (const e of await readdir(path, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        const p = join(path, e.name);
        yield [
          e.name,
          e.isDirectory() ? localDirectory(p, root) : localFile(p),
        ];
      }
    },
    async getDirectoryHandle(name, { create = false } = {}) {
      return localDirectory(await safe(name, create, true), root);
    },
    async getFileHandle(name, { create = false } = {}) {
      return localFile(await safe(name, create));
    },
    async removeEntry(name) {
      await unlink(await safe(name));
    },
  };
}
function localFile(path) {
  return {
    kind: "file",
    async getFile() {
      const bytes = await readFile(path);
      return { size: bytes.length, text: async () => bytes.toString("utf8") };
    },
    async createWritable() {
      let value = "";
      return {
        async write(text) {
          value = text;
        },
        async close() {
          if ((await lstat(path).catch(() => null))?.isSymbolicLink())
            throw Error("Symbolic links cannot be synced.");
          const temp = `${path}.vow-sync-tmp-${randomUUID()}`;
          try {
            await writeFile(temp, value, { flag: "wx", mode: 0o600 });
            await rename(temp, path);
          } finally {
            await unlink(temp).catch(() => {});
          }
        },
        async abort() {},
      };
    },
  };
}

export async function runLocalSync({
  config,
  folderPath,
  once = false,
  initialChoice,
  log = console.log,
  signal,
}) {
  const origin = new URL(config.origin);
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    )
  )
    throw Error("Use HTTPS for local project connections.");
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    !config.grantId ||
    !config.token ||
    !config.projectId
  )
    throw Error("Invalid local connection configuration.");
  await mkdir(folderPath, { recursive: true });
  const root = await realpath(folderPath),
    handle = localDirectory(root),
    folder = new LocalLabFolder(handle, config.scopeKey);
  let disk = await folder.open();
  const endpoint = new URL("/api/team-lab/local", origin);
  endpoint.searchParams.set("grantId", config.grantId);
  if (config.collegeId)
    endpoint.searchParams.set("collegeId", config.collegeId);
  let remoteSnapshot;
  const request = async (body) => {
    const target = new URL(endpoint);
    if (!body && remoteSnapshot)
      target.searchParams.set("version", String(remoteSnapshot.version));
    const r = await fetch(target, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
    const result = await r.json();
    if (!r.ok)
      throw Object.assign(
        Error(result.error || "The team project could not be reached."),
        { status: r.status },
      );
    if (!result.conflict) {
      if (!result.files && remoteSnapshot?.version === result.version)
        result.files = remoteSnapshot.files;
      if (!result.files)
        throw Error("The team project response is incomplete.");
      remoteSnapshot = result;
    }
    return result;
  };
  const ignore = [
    ".vow-sync-config.json",
    ".vow-sync.mjs",
    ".vow-sync.json",
    ".vow-sync-conflicts.json",
    ".vow-sync-backups/",
    "*.vow-sync-tmp-*",
  ];
  const ignorePath = join(root, ".gitignore");
  if ((await lstat(ignorePath).catch(() => null))?.isSymbolicLink())
    throw Error("The local Git ignore file must not be a symbolic link.");
  const oldIgnore = await readFile(ignorePath, "utf8").catch((e) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  const additions = ignore.filter(
    (line) => !oldIgnore.split(/\r?\n/).includes(line),
  );
  if (additions.length)
    await writeFile(
      ignorePath,
      oldIgnore +
        (oldIgnore.endsWith("\n") || !oldIgnore ? "" : "\n") +
        "# Wilderness local connection\n" +
        additions.join("\n") +
        "\n",
    );
  let reported = "",
    lastVersion = -1;
  while (!signal?.aborted) {
    try {
      const remote = await request();
      if (remote.projectId !== config.projectId)
        throw Object.assign(
          Error("This connection belongs to another team project."),
          { status: 403 },
        );
      disk = await readLocalProject(handle);
      if (!folder.base && Object.keys(disk).length) {
        if (!["local", "team"].includes(initialChoice))
          throw Object.assign(
            Error(
              "Folder already contains source. Run again with --use-local or --use-team after comparing it with the team project. No source was replaced.",
            ),
            { status: 409 },
          );
        folder.base = initialChoice === "local" ? remote.files : disk;
      }
      const decisions = JSON.parse(
        await readFile(join(root, ".vow-sync-conflicts.json"), "utf8").catch(
          () => '{"files":{}}',
        ),
      );
      const choices = {};
      for (const [path, row] of Object.entries(decisions.files || {}))
        if (["local", "team"].includes(row.choose))
          choices[path] = {
            side: row.choose === "local" ? "local" : "editor",
            disk: row.local === null ? undefined : row.local,
            editor: row.team === null ? undefined : row.team,
          };
      const plan = folder.plan(disk, remote.files, choices);
      if (plan.conflicts.length) {
        await writeFile(
          join(root, ".vow-sync-conflicts.json"),
          JSON.stringify(
            {
              version: remote.version,
              instructions:
                "Compare local and team versions. For each file set choose to local or team. The decision is rejected if either version changes.",
              files: Object.fromEntries(
                plan.conflicts.map((p) => [
                  p,
                  {
                    local: disk[p] ?? null,
                    team: remote.files[p] ?? null,
                    choose: null,
                  },
                ]),
              ),
            },
            null,
            2,
          ),
        );
        if (reported !== "conflict") {
          log(
            "Sync paused: overlapping edits are retained. Resolve .vow-sync-conflicts.json in your editor.",
          );
          reported = "conflict";
        }
        if (once) return { conflict: true, paths: plan.conflicts };
      } else {
        const result = sameTeamFiles(plan.files, remote.files)
          ? remote
          : await request({
              projectId: config.projectId,
              expectedVersion: remote.version,
              files: plan.files,
            });
        if (!result.conflict) {
          await folder.commit(disk, result.files, () => !signal?.aborted);
          await folder.acknowledge(result.files);
          await unlink(join(root, ".vow-sync-conflicts.json")).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
          if (lastVersion !== result.version || reported) {
            log(
              `Synced team version ${result.version}. Watching local source changes.`,
            );
            lastVersion = result.version;
            reported = "";
          }
          if (once) return { version: result.version, files: result.files };
        }
      }
    } catch (e) {
      if (signal?.aborted) return;
      if (once || [401, 403, 409].includes(e.status)) throw e;
      if (reported !== e.message) {
        log(`Sync paused: ${e.message}`);
        reported = e.message;
      }
    }
    await new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, 1500);
      signal?.addEventListener("abort", finish, { once: true });
    });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2),
    value = (name) => {
      const i = args.indexOf(name);
      return i < 0 ? undefined : args[i + 1];
    };
  const control = new AbortController();
  process.once("SIGINT", () => control.abort());
  process.once("SIGTERM", () => control.abort());
  try {
    const config = JSON.parse(
      await readFile(
        resolve(
          value("--config") ||
            join(
              dirname(fileURLToPath(import.meta.url)),
              ".vow-sync-config.json",
            ),
        ),
        "utf8",
      ),
    );
    await runLocalSync({
      config,
      folderPath: resolve(value("--folder") || process.cwd()),
      once: args.includes("--once"),
      initialChoice: args.includes("--use-local")
        ? "local"
        : args.includes("--use-team")
          ? "team"
          : undefined,
      signal: control.signal,
    });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
