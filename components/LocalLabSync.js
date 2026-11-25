"use client";
import { useEffect, useRef, useState } from "react";
import { collegeStorageKey } from "@/lib/college-fetch.js";
import { LocalLabFolder, readLocalProject } from "@/lib/local-lab-sync.js";
import { mergeTeamFiles, sameTeamFiles } from "@/lib/team-lab-merge.js";
import { validateTeamFiles } from "@/lib/team-lab-project.js";
import LocalLabRunner from "./LocalLabRunner.js";

function handles(key, value, remove = false) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("vow-local-code-folders", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction(
          "handles",
          value || remove ? "readwrite" : "readonly",
        ),
        store = tx.objectStore("handles"),
        req = remove
          ? store.delete(key)
          : value
            ? store.put(value, key)
            : store.get(key);
      let result;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
export default function LocalLabSync({ work, ownerId, notify }) {
  const [supported, setSupported] = useState(false),
    [name, setName] = useState(""),
    [status, setStatus] = useState(
      "Connect a dedicated project folder to sync edits from VS Code and this lab.",
    ),
    [pending, setPending] = useState(null),
    [conflicts, setConflicts] = useState(null),
    [connected, setConnected] = useState(false),
    [savedHandle, setSavedHandle] = useState(null),
    [busy, setBusy] = useState(false);
  const folder = useRef(null),
    latest = useRef(work),
    resolutions = useRef({}),
    running = useRef(false),
    live = useRef(true),
    epoch = useRef(0);
  latest.current = work;
  const key = collegeStorageKey(
    `local-code:${ownerId}:${work.meta.projectId || ""}`,
  );
  useEffect(() => {
    live.current = true;
    setSupported(typeof window.showDirectoryPicker === "function");
    return () => {
      live.current = false;
      epoch.current++;
      latest.current.setBackgroundSync(false);
    };
  }, []);
  useEffect(() => {
    if (!work.ready || !work.meta.projectId) return;
    let active = true;
    handles(key)
      .then(async (h) => {
        if (active && h) {
          setSavedHandle(h);
          if (
            (await h.queryPermission({ mode: "readwrite" })) === "granted" &&
            active
          )
            await activate(h);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key, work.ready]);
  async function activate(handle) {
    const f = new LocalLabFolder(
        handle,
        collegeStorageKey(`project:${latest.current.meta.projectId}`),
      ),
      disk = await f.open();
    if (!live.current) return;
    folder.current = f;
    setName(handle.name);
    if (!f.base && Object.keys(disk).length) {
      if (!validateTeamFiles(disk))
        throw Error(
          "Choose an empty folder or an exported project with all required entry files. No files were changed.",
        );
      setPending({ disk, editor: structuredClone(latest.current.files) });
      setStatus("Choose which existing project to use for the first sync.");
      return;
    }
    await handles(key, handle);
    setConnected(true);
    latest.current.setBackgroundSync(true);
    setStatus("Local folder connected. Syncing automatically…");
  }
  async function connect(reuse = false) {
    setBusy(true);
    try {
      const h = reuse
        ? savedHandle
        : await window.showDirectoryPicker({
            id: "wilderness-team-code",
            mode: "readwrite",
          });
      if (
        reuse &&
        (await h.requestPermission({ mode: "readwrite" })) !== "granted"
      )
        throw Error("Folder permission was not granted.");
      await activate(h);
    } catch (e) {
      if (e.name !== "AbortError") {
        setStatus(e.message);
        notify(e.message, "error");
      }
    } finally {
      setBusy(false);
    }
  }
  async function firstSync(choice) {
    folder.current.base = choice === "local" ? pending.editor : pending.disk;
    try {
      await handles(key, folder.current.root);
      setPending(null);
      setConnected(true);
      latest.current.setBackgroundSync(true);
    } catch (e) {
      setStatus(e.message);
    }
  }
  async function tick() {
    if (running.current || !folder.current) return;
    running.current = true;
    const boundEpoch = epoch.current;
    try {
      const run = async () => {
        const w = latest.current;
        if (!w.ready || w.draft || w.conflicts.length) {
          setStatus(
            "Resolve the lab draft or overlapping team edits before syncing the folder.",
          );
          return;
        }
        const f = folder.current,
          disk = await readLocalProject(f.root),
          editor = structuredClone(w.files),
          plan = f.plan(disk, editor, resolutions.current);
        if (plan.conflicts.length) {
          if (live.current)
            setConflicts({ paths: plan.conflicts, disk, editor });
          setStatus(
            "Local and editor changes overlap. Both versions are retained.",
          );
          return;
        }
        if (boundEpoch !== epoch.current) return;
        await f.commit(disk, plan.files, () => boundEpoch === epoch.current);
        const combined = mergeTeamFiles(
          editor,
          latest.current.files,
          plan.files,
        );
        if (combined.conflicts.length) {
          setStatus(
            "The editor changed during folder syncing. Comparing both versions again…",
          );
          return;
        }
        if (boundEpoch !== epoch.current) return;
        if (!sameTeamFiles(latest.current.files, combined.files))
          latest.current.setFiles(combined.files);
        await f.acknowledge(plan.files);
        resolutions.current = {};
        setConflicts(null);
        setStatus(`Local folder synced · ${new Date().toLocaleTimeString()}`);
      };
      if (navigator.locks)
        await navigator.locks.request(
          `vow-folder:${key}:${name}`,
          { ifAvailable: true },
          (lock) => (lock ? run() : undefined),
        );
      else await run();
    } catch (e) {
      if (live.current && boundEpoch === epoch.current)
        setStatus(`Sync paused: ${e.message}`);
    } finally {
      running.current = false;
    }
  }
  useEffect(() => {
    if (!connected) return;
    let stopped = false,
      timer;
    const poll = async () => {
      await tick();
      if (!stopped) timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [connected, key]);
  async function disconnect() {
    epoch.current++;
    setConnected(false);
    latest.current.setBackgroundSync(false);
    setPending(null);
    setConflicts(null);
    setSavedHandle(null);
    resolutions.current = {};
    await handles(key, null, true).catch(() => {});
    setStatus(
      "Local sync disconnected. Your folder and team project are retained.",
    );
  }
  return (
    <section className="team-local-sync" aria-label="Automatic local code sync">
      <div className="team-panel-title">
        <strong>Local code sync{name ? ` · ${name}` : ""}</strong>
        <div>
          {connected || pending ? (
            <button className="btn small" onClick={disconnect}>
              Disconnect folder
            </button>
          ) : (
            <>
              {savedHandle && (
                <button
                  className="btn small"
                  disabled={busy || !work.ready || Boolean(work.draft)}
                  onClick={() => connect(true)}
                >
                  Reconnect folder
                </button>
              )}
              <button
                className="btn small"
                disabled={
                  !supported || busy || !work.ready || Boolean(work.draft)
                }
                onClick={() => connect()}
              >
                {busy ? "Connecting…" : "Connect local folder"}
              </button>
            </>
          )}
        </div>
      </div>
      <p role="status">{status}</p>
      <LocalLabRunner work={work} notify={notify} />
      <small>
        Choose a dedicated folder once. Keep this lab open for automatic two-way
        syncing. Git metadata, dependencies, build output and hidden files stay
        local. Replaced source is backed up in .vow-sync-backups.
      </small>
      {!supported && (
        <p>
          Local folder access requires a supported desktop browser such as
          Chrome or Edge. ZIP downloads remain available.
        </p>
      )}
      {pending && (
        <div className="team-draft-banner">
          <p>
            This folder already contains source. Compare the projects before
            choosing the starting copy. No files have been replaced.
          </p>
          <details>
            <summary>Compare existing source</summary>
            <div className="team-conflict-columns">
              <pre>
                {Object.entries(pending.disk)
                  .map(([p, s]) => `${p}\n${s}`)
                  .join("\n\n")}
              </pre>
              <pre>
                {Object.entries(pending.editor)
                  .map(([p, s]) => `${p}\n${s}`)
                  .join("\n\n")}
              </pre>
            </div>
          </details>
          <button className="btn small" onClick={() => firstSync("local")}>
            Use local project
          </button>
          <button className="btn small" onClick={() => firstSync("team")}>
            Use team project
          </button>
        </div>
      )}
      {conflicts && (
        <div className="team-conflicts">
          <h3>Resolve local / editor changes</h3>
          {conflicts.paths.map((path) => (
            <article key={path}>
              <strong>{path}</strong>
              <div className="team-conflict-columns">
                <div>
                  <small>Local folder</small>
                  <pre>{conflicts.disk[path] ?? "(deleted)"}</pre>
                </div>
                <div>
                  <small>Lab editor</small>
                  <pre>{conflicts.editor[path] ?? "(deleted)"}</pre>
                </div>
              </div>
              <button
                className="btn small"
                onClick={() => {
                  resolutions.current[path] = {
                    side: "local",
                    disk: conflicts.disk[path],
                    editor: conflicts.editor[path],
                  };
                  setStatus("Using your local file on the next sync.");
                }}
              >
                Use local file
              </button>
              <button
                className="btn small"
                onClick={() => {
                  resolutions.current[path] = {
                    side: "editor",
                    disk: conflicts.disk[path],
                    editor: conflicts.editor[path],
                  };
                  setStatus("Using your editor file on the next sync.");
                }}
              >
                Use editor file
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
