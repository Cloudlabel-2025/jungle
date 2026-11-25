"use client";
import { useEffect, useRef, useState } from "react";
import { fileTree, validateTeamFiles } from "@/lib/team-lab-project.js";
import { mergeTeamFiles, mergeText } from "@/lib/team-lab-merge.js";
import "@xterm/xterm/css/xterm.css";
import LabFullscreenButton from "./LabFullscreenButton.js";
import { awaitRuntimeStartup } from "@/lib/runtime-startup.js";

export default function TeamNodeRuntime({
  files,
  setFiles,
  notify,
  onPreview,
}) {
  const host = useRef(),
    runtime = useRef(),
    terminal = useRef(),
    shell = useRef(),
    writer = useRef(),
    mirror = useRef({}),
    queue = useRef(Promise.resolve()),
    latest = useRef(files),
    alive = useRef(true),
    cleanup = useRef(() => {}),
    startup = useRef(null),
    processes = useRef(new Map());
  const [phase, setPhase] = useState("idle"),
    [stalled, setStalled] = useState(false),
    [error, setError] = useState(""),
    [commands, setCommands] = useState([]);
  latest.current = files;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      startup.current?.abort();
      for (const job of processes.current.values()) job.process?.kill();
      cleanup.current();
      const previousRuntime = runtime.current,
        previousTerminal = terminal.current;
      runtime.current = null;
      terminal.current = null;
      previousRuntime?.teardown();
      previousTerminal?.dispose();
    };
  }, []);
  function sync(next) {
    const job = queue.current
      .catch(() => {})
      .then(async () => {
        if (!runtime.current) return;
        const read = async (path) => {
          try {
            return await runtime.current.fs.readFile(path, "utf-8");
          } catch (e) {
            if (e.code === "ENOENT" || String(e.message).includes("ENOENT"))
              return undefined;
            throw e;
          }
        };
        for (const path of Object.keys(mirror.current))
          if (!(path in next)) {
            const disk = await read(path);
            if (disk !== undefined && disk !== mirror.current[path])
              throw new Error(
                `The team removed ${path}, but it has terminal edits. Copy or import those edits before updating your runtime.`,
              );
            await runtime.current.fs.rm(path, { force: true });
          }
        for (const [path, content] of Object.entries(next)) {
          if (mirror.current[path] === content) continue;
          const disk = await read(path),
            merged = mergeText(mirror.current[path], disk, content);
          if (merged.conflict)
            throw new Error(
              `Terminal edits in ${path} overlap with editor changes. Both are retained. Copy your terminal changes into the editor before syncing the runtime.`,
            );
          if (path.includes("/"))
            await runtime.current.fs.mkdir(
              path.slice(0, path.lastIndexOf("/")),
              { recursive: true },
            );
          await runtime.current.fs.writeFile(path, merged.value ?? content);
        }
        mirror.current = { ...next };
        if (alive.current) setError("");
      });
    queue.current = job;
    return job;
  }
  useEffect(() => {
    if (phase === "ready") sync(files).catch((e) => setError(e.message));
  }, [files, phase]);
  async function start() {
    if (startup.current || phase === "ready" || stalled) return;
    const controller = new AbortController();
    startup.current = controller;
    const deadline = performance.now() + 30000;
    const wait = (promise, releaseLate) =>
      awaitRuntimeStartup(promise, {
        signal: controller.signal,
        timeoutMs: Math.max(1, deadline - performance.now()),
        releaseLate,
      });
    setPhase("starting");
    setError("");
    try {
      if (!window.crossOriginIsolated)
        throw new Error(
          "This browser has not enabled the isolated runtime. Open the full studio in Chrome or Edge, then reload.",
        );
      const [{ WebContainer }, { Terminal }, { FitAddon }] = await wait(
        Promise.all([
          import("@webcontainer/api"),
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
        ]),
      );
      if (!alive.current) return;
      const term = new Terminal({
        convertEol: true,
        fontFamily: '"JetBrains Mono",monospace',
        fontSize: 12,
        cursorBlink: true,
        theme: {
          background: "#0b140f",
          foreground: "#dce7d5",
          cursor: "#e8cb88",
        },
        scrollback: 1500,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host.current);
      fit.fit();
      terminal.current = term;
      term.writeln("WILDERNESS / Your own Node.js runtime");
      term.writeln(
        "Source is shared. This terminal and its processes belong to you.",
      );
      const wc = await wait(
        WebContainer.boot({
          coep: "credentialless",
          workdirName: "wilderness-team",
        }),
        (late) => late.teardown(),
      );
      if (!alive.current) {
        wc.teardown();
        return;
      }
      runtime.current = wc;
      await wait(wc.mount(fileTree(latest.current)));
      mirror.current = { ...latest.current };
      const off = wc.on("server-ready", (_port, url) => {
        const parsed = new URL(url);
        if (
          alive.current &&
          ["https:", "http:"].includes(parsed.protocol) &&
          parsed.origin !== location.origin &&
          _port !== 24678
        )
          onPreview(url);
      });
      wc.on("error", (e) => {
        if (alive.current) setError(e.message);
      });
      const process = await wait(
        wc.spawn("jsh", {
          terminal: { cols: term.cols, rows: term.rows },
        }),
        (late) => late.kill(),
      );
      shell.current = process;
      writer.current = process.input.getWriter();
      process.output
        .pipeTo(
          new WritableStream({
            write(chunk) {
              if (alive.current) term.write(chunk);
            },
          }),
        )
        .catch(() => {});
      const input = term.onData((value) =>
        writer.current?.write(value).catch(() => {}),
      );
      const resize = new ResizeObserver(() => {
        try {
          fit.fit();
          shell.current?.resize({ cols: term.cols, rows: term.rows });
        } catch {}
      });
      resize.observe(host.current);
      cleanup.current = () => {
        off();
        input.dispose();
        resize.disconnect();
        shell.current?.kill();
        writer.current?.releaseLock();
      };
      if (alive.current) {
        setPhase("ready");
        term.focus();
      }
    } catch (e) {
      const previousRuntime = runtime.current;
      runtime.current = null;
      previousRuntime?.teardown();
      terminal.current?.dispose();
      terminal.current = null;
      if (alive.current) {
        setPhase("idle");
        setStalled(["STARTUP_TIMEOUT", "STARTUP_CANCELLED"].includes(e.code));
        setError(e.message || "The Node runtime could not start.");
      }
    } finally {
      if (startup.current === controller) startup.current = null;
    }
  }
  async function importFiles() {
    try {
      await queue.current.catch(() => {});
      const disk = {};
      const read = async (dir = "") => {
        for (const entry of await runtime.current.fs.readdir(dir || ".", {
          withFileTypes: true,
        })) {
          if (
            [
              "node_modules",
              ".git",
              ".vite",
              "package-lock.json",
              "pnpm-lock.yaml",
              "yarn.lock",
            ].includes(entry.name) ||
            entry.name.startsWith(".")
          )
            continue;
          const path = dir ? `${dir}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            if (path.split("/").length < 6) await read(path);
          } else if (entry.isFile()) {
            if (Object.keys(disk).length >= 32)
              throw new Error(
                "Import supports up to 32 source files. Download larger generated artifacts from the runtime separately.",
              );
            disk[path] = await runtime.current.fs.readFile(path, "utf-8");
          }
        }
      };
      await read();
      if (!validateTeamFiles(disk))
        throw new Error(
          "Keep the starter entry files and source limits before importing terminal changes.",
        );
      const merged = mergeTeamFiles(mirror.current, disk, latest.current);
      if (merged.conflicts.length)
        throw new Error(
          `Terminal and editor changed ${merged.conflicts.join(", ")}. Copy those terminal edits into the editor to review them.`,
        );
      setFiles(merged.files);
      notify("Terminal source imported. The team save will sync it.");
    } catch (e) {
      notify(e.message, "error");
    }
  }
  async function runProjectCommand(kind) {
    if (processes.current.has(kind)) return;
    const job = {};
    processes.current.set(kind, job);
    setCommands([...processes.current.keys()]);
    try {
      await sync(latest.current);
      if (processes.current.get(kind) !== job) return;
      const args =
        kind === "install"
          ? ["install", "--fetch-retries=0", "--fetch-timeout=20000"]
          : kind === "dev"
            ? ["run", "dev"]
            : ["test"];
      terminal.current.writeln(`\r\n$ npm ${args.join(" ")}`);
      const process = await runtime.current.spawn("npm", args);
      job.process = process;
      if (processes.current.get(kind) !== job) {
        process.kill();
        return;
      }
      process.output
        .pipeTo(
          new WritableStream({
            write(chunk) {
              if (alive.current) terminal.current.write(chunk);
            },
          }),
        )
        .catch(() => {});
      const code = await process.exit;
      if (processes.current.get(kind) === job) processes.current.delete(kind);
      if (alive.current) {
        setCommands([...processes.current.keys()]);
        terminal.current.writeln(`\r\n[${kind} exited ${code}]`);
      }
    } catch (e) {
      if (processes.current.get(kind) === job) processes.current.delete(kind);
      if (alive.current) {
        setCommands([...processes.current.keys()]);
        setError(e.message);
      }
    }
  }
  async function restartShell() {
    try {
      for (const job of processes.current.values()) job.process?.kill();
      processes.current.clear();
      setCommands([]);
      shell.current?.kill();
      writer.current?.releaseLock();
      const term = terminal.current,
        process = await runtime.current.spawn("jsh", {
          terminal: { cols: term.cols, rows: term.rows },
        });
      shell.current = process;
      writer.current = process.input.getWriter();
      process.output
        .pipeTo(
          new WritableStream({
            write(chunk) {
              if (alive.current) term.write(chunk);
            },
          }),
        )
        .catch(() => {});
      term.writeln(
        "\r\nStopped tracked commands and opened a fresh shell. Your source is retained.",
      );
      onPreview("");
      term.focus();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="team-terminal">
      <div className="team-panel-title">
        <LabFullscreenButton selector=".team-terminal" label="terminal" />
        <strong>Your terminal</strong>
        <span>Node.js · independent session</span>
        {phase === "ready" && (
          <div>
            <button className="btn small" onClick={importFiles}>
              Import terminal files
            </button>
            <button className="btn small" onClick={restartShell}>
              Stop / fresh shell
            </button>
          </div>
        )}
      </div>
      <div className="team-command-hints">
        {phase === "ready" ? (
          <>
            {[
              ["install", "Install packages"],
              ["dev", "Run preview server"],
              ["test", "Run Node tests"],
            ].map(([kind, label]) => (
              <button
                className="btn small"
                key={kind}
                disabled={commands.includes(kind)}
                onClick={() => runProjectCommand(kind)}
              >
                {commands.includes(kind) ? `${label}…` : label}
              </button>
            ))}
          </>
        ) : (
          <>
            <code>npm install</code>
            <code>npm run dev</code>
            <code>npm test</code>
          </>
        )}
        <span>
          Ctrl+C interrupts a shell command. Stop / fresh shell recovers a stuck
          terminal.
        </span>
      </div>
      {phase !== "ready" && (
        <div className="team-runtime-start">
          <p>
            Start Node to install packages, run commands and open your project
            preview. Your team’s saved code loads here.
          </p>
          <button
            className="btn primary"
            onClick={stalled ? () => window.location.reload() : start}
            disabled={phase === "starting"}
          >
            {phase === "starting"
              ? "Starting Node…"
              : stalled
                ? "Reload coding studio"
                : "Start Node terminal"}
          </button>
          {phase === "starting" && (
            <button
              type="button"
              className="btn"
              onClick={() => startup.current?.abort()}
            >
              Cancel Node startup
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="team-lab-error">
          {error} Your editor, team saves and downloads remain available.
        </p>
      )}
      <div
        className="team-xterm"
        ref={host}
        aria-label="Interactive Node terminal"
      />
      <small>
        Editor changes update these files automatically. After commands create
        or change source, use Import terminal files to share those changes. This
        is a Node shell, not Windows CMD.
      </small>
    </section>
  );
}
