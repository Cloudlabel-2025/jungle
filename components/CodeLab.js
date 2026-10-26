"use client";
import { useEffect, useState, useRef } from "react";
import {
  Play,
  RotateCcw,
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  GitBranch,
  Check,
  Save,
  FileCode2,
  FolderOpen,
  Terminal,
  Maximize2,
} from "lucide-react";
import { initialFiles } from "@/lib/lab-project.js";
import { labDocument } from "@/lib/lab-runtime.js";
import { Badge, Modal } from "./ui";
const widths = { Desktop: "100%", Tablet: "768px", Mobile: "375px" };
function highlight(source) {
  return source
    .split(
      /(\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:export|default|function|return|const|let|if|throw|new|for|of|import|from|try|catch|class|true|false|null)\b|\b\d+\b)/g,
    )
    .map((token, i) =>
      /^\/\//.test(token) ? (
        <span className="syntax-comment" key={i}>
          {token}
        </span>
      ) : /^["']/.test(token) ? (
        <span className="syntax-string" key={i}>
          {token}
        </span>
      ) : /^(export|default|function|return|const|let|if|throw|new|for|of|import|from|try|catch|class|true|false|null)$/.test(
          token,
        ) ? (
        <span className="syntax-keyword" key={i}>
          {token}
        </span>
      ) : /^\d+$/.test(token) ? (
        <span className="syntax-number" key={i}>
          {token}
        </span>
      ) : (
        token
      ),
    );
}
export default function CodeLab({ data, act, notify }) {
  const [files, setFiles] = useState(initialFiles),
    [active, setActive] = useState("src/App.jsx"),
    [runtime, setRuntime] = useState(""),
    [document, setDocument] = useState(""),
    [viewport, setViewport] = useState("Desktop"),
    [command, setCommand] = useState(""),
    [output, setOutput] = useState([
      {
        text: "CODEWILD VM / Browser-isolated development environment",
        type: "accent",
      },
      {
        text: "Apex Financial workspace mounted. Type help to explore.",
        type: "muted",
      },
    ]),
    [compiling, setCompiling] = useState(false),
    [compileError, setCompileError] = useState(""),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(""),
    [loadAttempt, setLoadAttempt] = useState(0),
    [saving, setSaving] = useState(false),
    [savedFiles, setSavedFiles] = useState(initialFiles),
    [resetOpen, setResetOpen] = useState(false),
    [commits, setCommits] = useState([]),
    [staged, setStaged] = useState(null),
    [baseline, setBaseline] = useState(initialFiles),
    [testRun, setTestRun] = useState(null),
    [testRunning, setTestRunning] = useState(false);
  const iframe = useRef(),
    testFrame = useRef(),
    editor = useRef(),
    pre = useRef(),
    gutter = useRef(),
    terminalEnd = useRef(),
    previewGeneration = useRef(0),
    testsGeneration = useRef(0),
    previewRunId = useRef(null),
    activeTestId = useRef(null),
    runningTest = useRef(false),
    mounted = useRef(true),
    currentFiles = useRef(files),
    history = useRef([]),
    historyPos = useRef(0),
    testTimer = useRef();
  const fileContent = files[active];
  currentFiles.current = files;
  const dirty = JSON.stringify(files) !== JSON.stringify(baseline);
  const unsaved = JSON.stringify(files) !== JSON.stringify(savedFiles);
  const append = (text, type = "") =>
    setOutput((o) => [...o.slice(-199), { text, type }]);
  useEffect(() => {
    let live = true;
    setReady(false);
    setLoadError("");
    Promise.all([
      fetch("/vendor/lab-runtime.js").then((r) => {
        if (!r.ok)
          throw new Error("Local React runtime missing. Run npm run prepare.");
        return r.text();
      }),
      fetch("/api/gamer/lab").then(async (r) => {
        const result = await r.json();
        if (!r.ok)
          throw new Error(result.error || "Could not load your saved project.");
        return result;
      }),
    ])
      .then(([js, saved]) => {
        if (!live) return;
        setRuntime(js);
        if (saved.files) {
          if (
            !Object.keys(initialFiles).every(
              (key) => typeof saved.files[key] === "string",
            )
          )
            throw new Error("The saved virtual project is incomplete.");
          setFiles(saved.files);
          setBaseline(saved.files);
          setSavedFiles(saved.files);
        }
        setReady(true);
      })
      .catch((e) => {
        if (live) {
          setLoadError(e.message);
          notify(e.message, "error");
        }
      });
    return () => {
      live = false;
    };
  }, [data.user._id, loadAttempt]);
  function finishTests() {
    clearTimeout(testTimer.current);
    runningTest.current = false;
    activeTestId.current = null;
    setTestRunning(false);
    setTestRun(null);
  }
  async function compile(runTests = false) {
    if (!runtime || !ready) {
      if (runTests)
        append(
          "The workspace is still loading. Retry when it is ready.",
          "error",
        );
      return;
    }
    if (runTests && runningTest.current) {
      append("A test run is already active.", "error");
      return;
    }
    const version = runTests
      ? ++testsGeneration.current
      : ++previewGeneration.current;
    if (runTests) {
      runningTest.current = true;
      setTestRunning(true);
      testTimer.current = setTimeout(() => {
        testsGeneration.current++;
        finishTests();
        append(
          "Test execution timed out. Check pending promises or infinite loops.",
          "error",
        );
      }, 10000);
    } else setCompiling(true);
    try {
      const imported = await import("@babel/standalone");
      const babel = imported.default || imported;
      const code = babel.transform(files["src/App.jsx"], {
        filename: "App.jsx",
        presets: [["env", { modules: "commonjs" }], "react"],
      }).code;
      const tests = runTests
        ? babel.transform(files["tests/ledger.test.js"], { presets: ["env"] })
            .code
        : "";
      const runId = crypto.randomUUID();
      if (
        !mounted.current ||
        version !==
          (runTests ? testsGeneration.current : previewGeneration.current)
      )
        return;
      const doc = labDocument({
        runtime,
        code,
        tests,
        css: files["src/styles.css"],
        runId,
        runTests,
      });
      if (runTests) {
        activeTestId.current = runId;
        setTestRun({ doc, runId });
      } else {
        previewRunId.current = runId;
        setCompileError("");
        setDocument(doc);
      }
    } catch (e) {
      if (!mounted.current) return;
      if (runTests) {
        finishTests();
        append(e.message, "error");
      } else if (version === previewGeneration.current)
        setCompileError(e.message);
    } finally {
      if (!runTests && mounted.current && version === previewGeneration.current)
        setCompiling(false);
    }
  }
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => compile(), 650);
    return () => clearTimeout(timer);
  }, [files["src/App.jsx"], files["src/styles.css"], runtime, ready]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewGeneration.current++;
      testsGeneration.current++;
      clearTimeout(testTimer.current);
    };
  }, []);
  useEffect(() => {
    if (editor.current)
      editor.current.scrollTop = editor.current.scrollLeft = 0;
    if (pre.current) pre.current.scrollTop = pre.current.scrollLeft = 0;
    if (gutter.current) gutter.current.scrollTop = 0;
  }, [active]);
  useEffect(() => {
    const listener = (e) => {
      if (!e.data?.codewild) return;
      const trustedPreview =
        e.source === iframe.current?.contentWindow &&
        e.data.runId === previewRunId.current;
      const trustedTest =
        e.source === testFrame.current?.contentWindow &&
        e.data.runId === activeTestId.current;
      if (!trustedPreview && !trustedTest) return;
      if (e.data.type === "error") {
        if (trustedPreview)
          setCompileError(String(e.data.payload).slice(0, 3000));
        if (trustedTest) {
          finishTests();
          append(`Test runtime error: ${e.data.payload}`, "error");
        }
      }
      if (trustedTest && e.data.type === "tests") {
        const results = e.data.payload;
        if (
          !Array.isArray(results) ||
          results.length > 101 ||
          !results.every(
            (r) =>
              r &&
              typeof r.name === "string" &&
              typeof r.ok === "boolean" &&
              Number.isFinite(r.ms),
          )
        )
          return;
        finishTests();
        for (const r of results.slice(0, 100))
          append(
            `${r.ok ? "PASS" : "FAIL"}  ${String(r.name).slice(0, 300)} (${Number(r.ms).toFixed(1)}ms)${r.error ? "\n      " + String(r.error).slice(0, 1000) : ""}`,
            r.ok ? "success" : "error",
          );
        append(
          `${results.filter((r) => r.ok).length} passed / ${results.filter((r) => !r.ok).length} failed / ${results.length} tests`,
          results.length && results.every((r) => r.ok) ? "success" : "error",
        );
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    const terminal = terminalEnd.current?.parentElement;
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  }, [output]);
  async function format() {
    const path = active,
      source = fileContent;
    try {
      const [prettier, babel, estree, postcss] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
        import("prettier/plugins/postcss"),
      ]);
      const formatted = await prettier.format(source, {
        parser: path.endsWith(".css") ? "css" : "babel",
        plugins: [babel, estree, postcss],
        singleQuote: true,
      });
      if (!mounted.current) return;
      if (currentFiles.current[path] !== source) {
        notify(
          "This file changed while formatting. Run Format again.",
          "error",
        );
        return;
      }
      setFiles((f) => ({ ...f, [path]: formatted }));
      notify("Virtual file formatted.");
    } catch (e) {
      notify(e.message, "error");
    }
  }
  async function saveProject() {
    if (!ready || saving) return;
    setSaving(true);
    const snapshot = { ...files };
    try {
      if (
        await act(
          "gamer/lab",
          { files: snapshot },
          "Virtual project saved to your MongoDB workspace.",
        )
      )
        setSavedFiles(snapshot);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  async function run(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    setCommand("");
    history.current.push(cmd);
    historyPos.current = history.current.length;
    append(`player@codewild-vm:~$ ${cmd}`, "prompt");
    if (cmd === "clear") {
      setOutput([]);
      return;
    }
    if (cmd === "help") {
      append(
        'help                         Show this field guide\nls                           List virtual files\nnpm test                     Execute your actual ledger tests in a sandbox\ngit status                   Inspect virtual working tree\ngit add .                    Stage current virtual files\ngit commit -m "message"      Commit staged files in browser memory\ngit log                      Show virtual commit history\ngit push origin sprint-2     Simulate a push (no external repository)\nstatus                       Read current server vitals\ncurl /api/transactions       Inspect the virtual API fixture\nclear                        Clear terminal',
      );
      return;
    }
    if (cmd === "ls") {
      append(Object.keys(files).join("\n"));
      return;
    }
    if (cmd === "status") {
      append(
        JSON.stringify(
          {
            operative: data.user.name,
            hp: `${data.user.hp}/5`,
            experienceXP: data.user.xp,
            level: data.user.level,
            trophies: data.user.trophies,
            cleanStreak: data.user.streak,
            squad: data.teams.find((t) => t._id === data.user.teamId)?.name,
            serverTime: data.serverTime,
          },
          null,
          2,
        ),
        "accent",
      );
      return;
    }
    if (cmd === "npm test") {
      append("Running tests against your current App.jsx exports…", "muted");
      await compile(true);
      return;
    }
    if (cmd === "git status") {
      const changes = Object.keys(files).filter(
        (k) => files[k] !== baseline[k],
      );
      append(
        `On branch sprint-2\n${staged ? "Staged snapshot: " + Object.keys(staged).length + " files\n" : ""}${changes.length ? "Modified:\n" + changes.map((f) => "  " + f).join("\n") : "Working tree clean."}`,
      );
      return;
    }
    if (cmd === "git add .") {
      setStaged({ ...files });
      append("3 virtual files staged. No host files accessed.", "success");
      return;
    }
    if (cmd.startsWith("git commit")) {
      const match = cmd.match(/^git commit -m ["'](.+)["']$/);
      if (!match) {
        append('Usage: git commit -m "your message"', "error");
        return;
      }
      if (!staged) {
        append("Nothing staged. Run git add . first.", "error");
        return;
      }
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(staged) + Date.now()),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 7);
      setCommits((c) => [
        { hash, message: match[1], at: new Date().toISOString() },
        ...c,
      ]);
      setBaseline(staged);
      setStaged(null);
      append(
        `[sprint-2 ${hash}] ${match[1]}\nVirtual commit recorded in browser memory.`,
        "success",
      );
      return;
    }
    if (cmd === "git log") {
      append(
        commits.length
          ? commits.map((c) => `${c.hash}  ${c.message}\n${c.at}`).join("\n\n")
          : "No virtual commits yet.",
      );
      return;
    }
    if (cmd === "git push origin sprint-2") {
      append(
        commits.length
          ? `SIMULATED PUSH · ${commits[0].hash}\nTraining PR: https://git.codewild.internal/viper/pull/${commits.length}\nThis is a simulation URL. No network push was made.`
          : "Create a virtual commit before simulating a push.",
        commits.length ? "success" : "error",
      );
      return;
    }
    if (cmd === "curl /api/transactions") {
      append(
        "VIRTUAL API FIXTURE / not a network request\n" +
          JSON.stringify(
            {
              transactions: [
                {
                  id: "fixture_01",
                  from: "primary",
                  to: "savings",
                  amountPaise: 25000,
                },
              ],
              currency: "INR",
              source: "training fixture",
            },
            null,
            2,
          ),
      );
      return;
    }
    append(
      `Command unavailable: ${cmd}\nThis virtual terminal only supports the commands listed by help.`,
      "error",
    );
  }
  return (
    <div className="code-lab">
      <div className="lab-heading">
        <div>
          <span className="eyebrow">
            <span className="mini-square" />
            G07 / FIELD WORKSHOP · CODE LAB
          </span>
          <h1>
            Your tools for the unknown<span className="title-dot">.</span>
          </h1>
        </div>
        <Badge tone="lime">
          <ShieldIcon />
          HOST-ISOLATED
        </Badge>
        <button
          className="btn small"
          disabled={!ready || saving}
          onClick={saveProject}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save project"}
        </button>
        {ready && (
          <Badge tone={unsaved ? "amber" : "lime"}>
            {unsaved ? "UNSAVED CHANGES" : "PROJECT SAVED"}
          </Badge>
        )}
      </div>
      <div className="lab-mission">
        <Code2 size={17} />
        <strong>APEX FINANCIAL</strong>
        <span>
          Double-entry transfers. Zero negative balances. Make it work.
        </span>
        <span className="lab-branch">
          <GitBranch size={13} />
          sprint-2
        </span>
      </div>
      <div className="lab-grid">
        <section className="editor-panel">
          <div className="lab-panel-bar">
            <span>
              <FolderOpen size={14} />
              EXPLORER
            </span>
            <div>
              <button
                title="Format active file"
                onClick={format}
                disabled={!ready}
              >
                Format
              </button>
              <button
                title="Reset virtual project"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
          </div>
          <div className="file-tabs">
            {Object.keys(files).map((path) => (
              <button
                className={active === path ? "active" : ""}
                key={path}
                onClick={() => setActive(path)}
              >
                <FileCode2 size={13} />
                {path.split("/").pop()}
                {files[path] !== baseline[path] && <i />}
              </button>
            ))}
          </div>
          <div className="editor-path">
            {active.split("/")[0]} <span aria-hidden="true">/</span>
            {active.split("/").pop()}
            <span>JavaScript / JSX</span>
          </div>
          <div className="editor-surface">
            <div className="line-gutter" ref={gutter}>
              {fileContent.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre ref={pre} aria-hidden="true" className="highlight-layer">
              {highlight(fileContent)}
              {"\n"}
            </pre>
            <textarea
              ref={editor}
              aria-label={`Edit ${active}`}
              className="code-input"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              value={fileContent}
              disabled={!ready}
              maxLength={25000}
              onChange={(e) =>
                setFiles((f) => ({ ...f, [active]: e.target.value }))
              }
              onScroll={(e) => {
                pre.current.scrollTop = e.target.scrollTop;
                pre.current.scrollLeft = e.target.scrollLeft;
                gutter.current.scrollTop = e.target.scrollTop;
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const s = e.target.selectionStart,
                    end = e.target.selectionEnd;
                  setFiles((f) => ({
                    ...f,
                    [active]:
                      fileContent.slice(0, s) + "  " + fileContent.slice(end),
                  }));
                  setTimeout(() => {
                    editor.current.selectionStart =
                      editor.current.selectionEnd = s + 2;
                  }, 0);
                }
              }}
            />
          </div>
          <div className="editor-status">
            <span>
              <GitBranch size={12} />
              sprint-2{dirty ? "*" : ""}
            </span>
            <span>
              UTF-8 <i /> {fileContent.split("\n").length} lines <i /> Browser
              memory
            </span>
          </div>
        </section>
        <div className="lab-right">
          <section className="browser-panel">
            <div className="lab-panel-bar">
              <span>
                <Monitor size={14} />
                LIVE PREVIEW
              </span>
              <div className="viewport-controls">
                {Object.entries({
                  Desktop: Monitor,
                  Tablet,
                  Mobile: Smartphone,
                }).map(([v, Icon]) => (
                  <button
                    className={viewport === v ? "active" : ""}
                    key={v}
                    aria-label={`${v} viewport`}
                    title={v}
                    onClick={() => setViewport(v)}
                  >
                    <Icon size={14} />
                  </button>
                ))}
                <button title="Recompile preview" onClick={() => compile()}>
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
            <div className="browser-address">
              <span className="browser-dots">
                <i />
                <i />
                <i />
              </span>
              <span>
                <ShieldIcon />
                apex-banking.internal/portal
              </span>
              <Badge>{compiling ? "COMPILING" : "LOCAL"}</Badge>
            </div>
            <div
              className="preview-container"
              style={{ justifyContent: "flex-start" }}
            >
              {compileError ? (
                <div className="compiler-error">
                  <strong>Compilation / runtime error</strong>
                  <pre>{compileError}</pre>
                </div>
              ) : null}
              {document && (
                <iframe
                  title="Apex Financial sandbox preview"
                  ref={iframe}
                  sandbox="allow-scripts"
                  srcDoc={document}
                  style={{
                    width: widths[viewport],
                    maxWidth: viewport === "Desktop" ? "100%" : "none",
                    marginInline: "auto",
                  }}
                />
              )}
              {!ready && (
                <div className="loading-state">
                  {loadError ? (
                    <div>
                      <p>{loadError}</p>
                      <button
                        className="btn small"
                        onClick={() => setLoadAttempt((v) => v + 1)}
                      >
                        Retry workspace load
                      </button>
                    </div>
                  ) : (
                    "Mounting isolated runtime…"
                  )}
                </div>
              )}
            </div>
          </section>
          <section className="terminal-panel">
            <div className="lab-panel-bar">
              <span>
                <Terminal size={14} />
                CYBER TERMINAL
              </span>
              <button
                disabled={testRunning || !ready}
                onClick={() => run("npm test")}
              >
                <Play size={12} />
                {testRunning ? "Testing…" : "Run tests"}
              </button>
            </div>
            <div
              className="terminal-output"
              role="log"
              aria-label="Virtual terminal output"
            >
              {output.map((line, i) => (
                <pre className={line.type} key={i}>
                  {line.text}
                </pre>
              ))}
              <div ref={terminalEnd} />
            </div>
            <form
              className="terminal-command"
              onSubmit={(e) => {
                e.preventDefault();
                run(command);
              }}
            >
              <label htmlFor="command-input">player@codewild-vm:~$</label>
              <input
                id="command-input"
                aria-label="Virtual terminal command"
                autoComplete="off"
                spellCheck={false}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    historyPos.current = Math.max(0, historyPos.current - 1);
                    setCommand(history.current[historyPos.current] || "");
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    historyPos.current = Math.min(
                      history.current.length,
                      historyPos.current + 1,
                    );
                    setCommand(history.current[historyPos.current] || "");
                  }
                }}
              />
              <button aria-label="Run virtual command">Run</button>
            </form>
          </section>
        </div>
      </div>
      <div className="lab-bottom-note">
        <Check size={13} />
        Code executes in an opaque-origin sandbox. Network, host files, and
        operating-system commands are unavailable.
        <span>VIRTUAL GIT RESETS ON RELOAD · USE SAVE PROJECT FOR SOURCE</span>
      </div>
      {testRun && (
        <iframe
          ref={testFrame}
          title="Isolated ledger test runner"
          sandbox="allow-scripts"
          srcDoc={testRun.doc}
          className="test-runner"
        />
      )}
      {resetOpen && (
        <Modal title="Reset virtual project?" close={() => setResetOpen(false)}>
          <p className="muted">
            This replaces the three in-memory files with the original Apex
            banking project. Saved MongoDB files are only replaced when you
            choose Save project.
          </p>
          <button
            className="btn primary"
            onClick={() => {
              setFiles({ ...initialFiles });
              setResetOpen(false);
            }}
          >
            Reset editor files <RotateCcw size={15} />
          </button>
        </Modal>
      )}
    </div>
  );
}
function ShieldIcon() {
  return <Check size={12} />;
}
