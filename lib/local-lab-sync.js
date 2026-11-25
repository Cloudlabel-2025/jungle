import { mergeTeamFiles, sameTeamFiles } from "./team-lab-merge.js";
import { validateTeamFiles } from "./team-lab-project.js";

const metaPath = ".vow-sync.json";
const textExtension = /\.(?:[cm]?jsx?|tsx?|css|scss|json|html|md|txt|svg)$/i;
export function localSourcePath(path) {
  return (
    path.length <= 120 &&
    /^[a-zA-Z0-9_.\-/]+$/.test(path) &&
    textExtension.test(path) &&
    !path
      .split("/")
      .some(
        (s) =>
          !s ||
          s === "." ||
          s === ".." ||
          s.startsWith(".") ||
          [
            "node_modules",
            "dist",
            "build",
            "coverage",
            "__proto__",
            "constructor",
            "prototype",
          ].includes(s),
      ) &&
    path !== "package-lock.json"
  );
}
async function entry(root, path, create = false) {
  const parts = path.split("/");
  let dir = root;
  for (const p of parts.slice(0, -1))
    dir = await dir.getDirectoryHandle(p, { create });
  return { dir, name: parts.at(-1) };
}
async function read(root, path) {
  try {
    const { dir, name } = await entry(root, path);
    const f = await (await dir.getFileHandle(name)).getFile();
    if (f.size > (path === metaPath ? 2000000 : 200000))
      throw Error(`Local file ${path} exceeds the source limits.`);
    const value = await f.text();
    if (value.includes("\0"))
      throw Error(
        `Local file ${path} is binary and cannot be synced as source.`,
      );
    return value;
  } catch (e) {
    if (e.name === "NotFoundError" || e.code === "ENOENT") return undefined;
    throw e;
  }
}
async function write(root, path, value) {
  const { dir, name } = await entry(root, path, true),
    handle = await dir.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  try {
    await stream.write(value);
    await stream.close();
  } catch (e) {
    try {
      await stream.abort();
    } catch {}
    throw e;
  }
}

export async function readLocalProject(root) {
  const files = {};
  let count = 0,
    total = 0;
  async function walk(dir, prefix = "") {
    for await (const [name, handle] of dir.entries()) {
      if (
        name.startsWith(".") ||
        ["node_modules", "dist", "build", "coverage"].includes(name)
      )
        continue;
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        if (path.split("/").length < 6) await walk(handle, path);
      } else if (localSourcePath(path)) {
        if (++count > 32)
          throw Error(
            "This folder contains more than 32 source files. Choose a dedicated project folder.",
          );
        const value = await read(root, path);
        if (value.length > 50000 || (total += value.length) > 200000)
          throw Error("Local source exceeds the project limits.");
        files[path] = value;
      }
    }
  }
  await walk(root);
  return files;
}

export class LocalLabFolder {
  constructor(root, projectId) {
    this.root = root;
    this.projectId = projectId;
    this.base = null;
  }
  async open() {
    const raw = await read(this.root, metaPath);
    if (raw) {
      let saved;
      try {
        saved = JSON.parse(raw);
      } catch {
        throw Error(
          "The folder sync marker is unreadable. Choose another folder or restore its marker.",
        );
      }
      if (saved.projectId !== this.projectId)
        throw Error(
          "This folder is connected to another team project. Choose a different folder.",
        );
      if (!validateTeamFiles(saved.files))
        throw Error(
          "The folder sync marker is incomplete. Reconnect using a dedicated project folder.",
        );
      this.base = saved.files;
      this.recorded = true;
    }
    return readLocalProject(this.root);
  }
  plan(disk, editor, resolutions = {}) {
    const local = {
      ...disk,
      ...Object.fromEntries(
        Object.entries(editor).filter(([p]) => !localSourcePath(p)),
      ),
    };
    const merged = mergeTeamFiles(this.base || {}, local, editor);
    for (const path of [...merged.conflicts])
      if (
        resolutions[path] &&
        resolutions[path].disk === disk[path] &&
        resolutions[path].editor === editor[path]
      ) {
        const chosen = resolutions[path].side === "local" ? disk : editor;
        if (chosen[path] === undefined) delete merged.files[path];
        else merged.files[path] = chosen[path];
        merged.conflicts = merged.conflicts.filter((p) => p !== path);
      }
    return merged;
  }
  async commit(disk, files, keepGoing = () => true) {
    if (!validateTeamFiles(files))
      throw Error(
        "Keep the required entry files and project size limits before syncing.",
      );
    const changed = [
      ...new Set([...Object.keys(disk), ...Object.keys(files)]),
    ].filter((p) => localSourcePath(p) && disk[p] !== files[p]);
    // Check the entire write set before changing any files. Recheck each file
    // before its atomic close, and preserve overwritten content in local backups.
    for (const path of changed)
      if ((await read(this.root, path)) !== disk[path])
        throw Error(
          `Local ${path} changed during syncing. Retrying without replacing it.`,
        );
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    for (const path of changed) {
      if (!keepGoing()) throw Error("Local sync disconnected.");
      const current = await read(this.root, path);
      if (current !== disk[path])
        throw Error(
          `Local ${path} changed during syncing. Retrying without replacing it.`,
        );
      if (current !== undefined)
        await write(this.root, `.vow-sync-backups/${stamp}/${path}`, current);
      if (files[path] === undefined) {
        const { dir, name } = await entry(this.root, path);
        await dir.removeEntry(name);
      } else await write(this.root, path, files[path]);
    }
  }
  async acknowledge(files) {
    if (this.recorded && sameTeamFiles(this.base, files)) return;
    await write(
      this.root,
      metaPath,
      JSON.stringify({ format: 1, projectId: this.projectId, files }, null, 2),
    );
    this.base = structuredClone(files);
    this.recorded = true;
  }
}
