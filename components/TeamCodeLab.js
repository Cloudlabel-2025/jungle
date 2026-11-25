"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Download,
  Save,
  Code2,
  Users,
  History,
  Plus,
  FileCode2,
  Play,
  ArrowUpRight,
  Shield,
  RotateCcw,
} from "lucide-react";
import fetch from "@/lib/college-fetch.js";
import {
  requiredTeamPaths,
  validateTeamFiles,
} from "@/lib/team-lab-project.js";
import { labDocument } from "@/lib/lab-runtime.js";
import useTeamLab from "./useTeamLab.js";
import { Modal } from "./ui";
import LabFullscreenButton from "./LabFullscreenButton.js";
import TeamLabReviewFeed from "./TeamLabReviewFeed.js";
const LocalLabSync = dynamic(() => import("./LocalLabSync.js"), { ssr: false });
const Editor = dynamic(() => import("./TeamCodeEditor"), {
  ssr: false,
  loading: () => <p>Opening editor…</p>,
});
const NodeRuntime = dynamic(() => import("./TeamNodeRuntime"), {
  ssr: false,
  loading: () => <p>Loading terminal tools…</p>,
});

export default function TeamCodeLab({ data, notify, studio = false }) {
  const [active, setActive] = useState("src/App.jsx"),
    [panel, setPanel] = useState("preview"),
    [doc, setDoc] = useState(""),
    [previewError, setPreviewError] = useState(""),
    [previewUrl, setPreviewUrl] = useState(""),
    [runtimeReady, setRuntimeReady] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [revision, setRevision] = useState(null),
    [newPath, setNewPath] = useState(""),
    [addOpen, setAddOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [testDoc, setTestDoc] = useState(null),
    [testOutput, setTestOutput] = useState([]),
    [testing, setTesting] = useState(false),
    [reviewOpen, setReviewOpen] = useState(false),
    [reviewNote, setReviewNote] = useState(""),
    [requestingReview, setRequestingReview] = useState(false);
  const work = useTeamLab(data.user._id, active),
    { files, setFiles, ready } = work,
    runtime = useRef(""),
    generation = useRef(0),
    testFrame = useRef(),
    previewFrame = useRef(),
    previewId = useRef(),
    testId = useRef(),
    testTimeout = useRef();
  useEffect(() => {
    if (!(active in files)) setActive("src/App.jsx");
  }, [files, active]);
  useEffect(() => {
    let live = true;
    fetch("/vendor/lab-runtime.js")
      .then((r) => {
        if (!r.ok) throw Error("The quick preview runtime is unavailable.");
        return r.text();
      })
      .then((js) => {
        if (live) {
          runtime.current = js;
          setRuntimeReady(true);
        }
      })
      .catch((e) => {
        if (live) setPreviewError(e.message);
      });
    return () => {
      live = false;
      clearTimeout(testTimeout.current);
    };
  }, []);
  async function compile(runTests = false) {
    const n = ++generation.current;
    try {
      if (!runtime.current)
        throw Error(
          "Quick preview is still loading. Use Refresh preview to retry.",
        );
      const imported = await import("@babel/standalone"),
        babel = imported.default || imported;
      // The quick runner is deliberately the starter's single-module sandbox.
      // The full Node preview resolves the complete project and package imports.
      const source = files["src/App.jsx"].replace(
        /^import\s+React\s+from\s+['"]react['"];?\s*$/m,
        "",
      );
      const code = babel.transform(source, {
        filename: "App.jsx",
        presets: [["env", { modules: "commonjs" }], "react"],
      }).code;
      const id = crypto.randomUUID(),
        tests = runTests
          ? babel.transform(files["tests/ledger.test.js"], { presets: ["env"] })
              .code
          : "";
      const next = labDocument({
        runtime: runtime.current,
        code,
        css: files["src/styles.css"],
        tests,
        runId: id,
        runTests,
      });
      if (runTests) {
        setTestOutput([]);
        setTesting(true);
        testId.current = id;
        setTestDoc(next);
        setPanel("tests");
        clearTimeout(testTimeout.current);
        testTimeout.current = setTimeout(() => {
          setTesting(false);
          setTestOutput([
            {
              name: "Test timeout",
              ok: false,
              error: "Execution exceeded 10 seconds.",
            },
          ]);
          setTestDoc(null);
          testId.current = null;
        }, 10000);
      } else if (n === generation.current) {
        previewId.current = id;
        setDoc(next);
        setPreviewError("");
      }
    } catch (e) {
      if (runTests) {
        setTesting(false);
        notify(e.message, "error");
      } else if (n === generation.current) setPreviewError(e.message);
    }
  }
  useEffect(() => {
    if (!ready || !runtimeReady) return;
    const timer = setTimeout(() => compile(), 600);
    return () => clearTimeout(timer);
  }, [ready, runtimeReady, files["src/App.jsx"], files["src/styles.css"]]);
  useEffect(() => {
    const receive = (event) => {
      const message = event.data;
      if (
        event.source === testFrame.current?.contentWindow &&
        message?.codewild &&
        message.runId === testId.current
      ) {
        if (message.type === "tests" || message.type === "error") {
          clearTimeout(testTimeout.current);
          setTesting(false);
          setTestDoc(null);
          testId.current = null;
          setTestOutput(
            message.type === "tests"
              ? Array.isArray(message.payload)
                ? message.payload.slice(0, 100).map((row) => ({
                    name: String(row?.name ?? "Test"),
                    ok: row?.ok === true,
                    error: row?.error ? String(row.error) : "",
                  }))
                : [
                    {
                      name: "Test runner response",
                      ok: false,
                      error: "Invalid response from the sandbox.",
                    },
                  ]
              : [
                  {
                    name: "Test execution",
                    ok: false,
                    error: String(message.payload),
                  },
                ],
          );
        }
      }
      if (
        event.source === previewFrame.current?.contentWindow &&
        message?.codewild &&
        message.runId === previewId.current &&
        message.type === "error"
      )
        setPreviewError(String(message.payload));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  async function save() {
    setSaving(true);
    try {
      await work.flush();
      notify("Team project synced.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  }
  async function download(snapshot = files, version = work.meta.version) {
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const archive = zipSync(
        Object.fromEntries(
          Object.entries(snapshot).map(([path, text]) => [
            `wilderness-team/${path}`,
            strToU8(text),
          ]),
        ),
      );
      const url = URL.createObjectURL(
        new Blob([archive], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `wilderness-team-v${version ?? "draft"}${work.unsaved && snapshot === files ? "-draft" : ""}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      notify(e.message, "error");
    }
  }
  function addFile(e) {
    e.preventDefault();
    const path = newPath.trim();
    if (path in files) {
      notify("That file already exists.", "error");
      return;
    }
    const next = { ...files, [path]: "" };
    if (!validateTeamFiles(next)) {
      notify(
        "Use a relative source path such as src/helpers.js, within the project limits.",
        "error",
      );
      return;
    }
    setFiles(next);
    setActive(path);
    setNewPath("");
    setAddOpen(false);
  }
  return (
    <div className={`team-lab ${studio ? "team-lab-full" : ""}`}>
      <header className="team-lab-heading">
        <div>
          <span className="eyebrow">PART II / THE BUILDING GROUNDS</span>
          <h1>Your crew. One project.</h1>
          <p>
            Build, test and ship together. Every saved change joins your team’s
            project.
          </p>
        </div>
        <span className="team-lab-shield">
          <Shield size={24} /> TEAM WORKSHOP
        </span>
      </header>
      <div className="team-lab-toolbar">
        <span>
          <Users size={17} />
          <strong>{work.meta.teamName || "Your team"}</strong>
          <small>v{work.meta.version ?? 0}</small>
        </span>
        <div>
          <LabFullscreenButton selector=".team-lab" label="lab" />
          <button
            className="btn small"
            disabled={
              !ready || Boolean(work.draft) || work.conflicts.length > 0
            }
            onClick={() => setReviewOpen(true)}
          >
            Request MC / CC review
          </button>
          <button
            className="btn small"
            disabled={
              !ready ||
              Boolean(work.draft) ||
              saving ||
              work.conflicts.length > 0
            }
            onClick={save}
          >
            <Save size={14} />
            {saving ? "Syncing…" : "Save team project"}
          </button>
          <button
            className="btn small"
            onClick={() => download()}
            disabled={!ready || Boolean(work.draft)}
          >
            <Download size={14} />
            Download ZIP
          </button>
          <button
            className="btn small"
            onClick={() => setHistoryOpen(true)}
            disabled={!ready || Boolean(work.draft)}
          >
            <History size={14} />
            History
          </button>
          {!studio && (
            <a
              className="btn small primary"
              href="/code-studio"
              target="_blank"
              rel="noopener"
            >
              Open coding studio <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </div>
      <div className="team-sync-strip">
        <span className={work.unsaved ? "pending" : "synced"} role="status">
          {work.status}
        </span>
        <div aria-label="Teammates in the lab">
          {work.meta.presence.map((p) => (
            <span className="team-presence" key={p.userId} title={p.path}>
              {p.name}
              {p.userId === data.user._id ? " (you)" : ""}
              <small>{p.path?.split("/").at(-1)}</small>
            </span>
          ))}
        </div>
      </div>
      {work.error && (
        <div role="alert" className="team-lab-error">
          {work.error}
          <button className="btn small" onClick={work.retry}>
            Retry connection
          </button>
        </div>
      )}
      {work.draft && (
        <div className="team-draft-banner">
          <strong>An unsynced draft from this device is available.</strong>
          <button className="btn small" onClick={work.recover}>
            Recover draft
          </button>
          <button
            className="btn small"
            onClick={() => download(work.draft.files, work.draft.version)}
          >
            Download draft
          </button>
          <button className="btn small" onClick={work.dismissDraft}>
            Dismiss draft
          </button>
        </div>
      )}
      {work.conflicts.length > 0 && (
        <section
          className="team-conflicts"
          aria-label="Review overlapping edits"
        >
          <h2>Two ideas reached the same lines.</h2>
          <p>
            Your edits stay in the editor. Compare your teammate’s version
            before choosing, or combine both in the editor and keep your
            version.
          </p>
          {work.conflicts.map((path) => (
            <article key={path}>
              <strong>{path}</strong>
              <div className="team-conflict-columns">
                <div>
                  <small>Your version</small>
                  <pre>{files[path] ?? "(deleted)"}</pre>
                </div>
                <div>
                  <small>Saved team version</small>
                  <pre>{work.teamFiles[path] ?? "(deleted)"}</pre>
                </div>
              </div>
              <button
                className="btn small"
                onClick={() => work.resolve(path, false)}
              >
                Keep my edited version
              </button>
              <button
                className="btn small"
                onClick={() => work.resolve(path, true)}
              >
                Use team version
              </button>
            </article>
          ))}
        </section>
      )}
      <div className="team-workbench">
        <section className="team-source">
          <div className="team-panel-title">
            <LabFullscreenButton selector=".team-source" label="editor" />
            <strong>
              <Code2 size={15} />
              Source
            </strong>
            {!requiredTeamPaths.includes(active) && (
              <button
                className="btn small"
                disabled={!ready || Boolean(work.draft)}
                onClick={() => setDeleteOpen(true)}
              >
                Delete file
              </button>
            )}
            <button
              className="btn small"
              disabled={!ready || Boolean(work.draft)}
              onClick={() => setAddOpen(true)}
            >
              <Plus size={13} />
              New file
            </button>
          </div>
          <div className="team-source-layout">
            <nav aria-label="Project files">
              {Object.keys(files).map((path) => (
                <button
                  className={active === path ? "active" : ""}
                  key={path}
                  onClick={() => setActive(path)}
                >
                  <FileCode2 size={13} />
                  <span>{path}</span>
                  {files[path] !== work.teamFiles[path] && (
                    <i aria-label="Unsynced edits" />
                  )}
                </button>
              ))}
            </nav>
            <div className="team-editor-column">
              <div className="team-current-file">
                {active}
                <small>Tab to indent · Ctrl/⌘ S to sync</small>
              </div>
              <Editor
                path={active}
                value={files[active] ?? ""}
                onChange={(value) =>
                  setFiles((f) => ({ ...f, [active]: value }))
                }
                onSave={save}
                disabled={!ready || Boolean(work.draft)}
              />
            </div>
          </div>
        </section>
        <section className="team-results">
          <div className="team-panel-title">
            <LabFullscreenButton selector=".team-results" label="output" />
            <div>
              <button
                className={panel === "preview" ? "selected" : ""}
                onClick={() => setPanel("preview")}
              >
                Preview
              </button>
              <button
                className={panel === "tests" ? "selected" : ""}
                onClick={() => setPanel("tests")}
              >
                Tests
              </button>
            </div>
            <button
              className="btn small"
              disabled={!ready || testing}
              onClick={() => compile(true)}
            >
              <Play size={13} />
              {testing ? "Testing…" : "Quick test"}
            </button>
            <button
              className="btn small"
              disabled={!ready || Boolean(work.draft)}
              onClick={() => compile()}
              aria-label="Refresh preview"
            >
              <RotateCcw size={13} />
            </button>
          </div>
          {panel === "preview" ? (
            <>
              <div className="team-preview-note">
                {previewUrl ? (
                  <>
                    <span>Node server · your runtime</span>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open preview in new tab ↗
                    </a>
                    <button onClick={() => setPreviewUrl("")}>
                      Use quick preview
                    </button>
                    <small>
                      If the embedded preview cannot load, open it in a new tab.
                    </small>
                  </>
                ) : (
                  <>
                    Quick preview · App.jsx + styles.css
                    {studio
                      ? " · Start Node for packages and multiple modules."
                      : " · Open the studio for Node commands."}
                  </>
                )}
              </div>
              {previewError && !previewUrl && (
                <p role="alert" className="team-lab-error">
                  {previewError} For package imports and multiple modules, start
                  Node in the coding studio.
                </p>
              )}
              {previewUrl ? (
                <iframe
                  title="Team project Node preview"
                  src={previewUrl}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
                  allow="cross-origin-isolated"
                />
              ) : doc ? (
                <iframe
                  title="Team project quick preview"
                  ref={previewFrame}
                  srcDoc={doc}
                  sandbox="allow-scripts"
                />
              ) : (
                <p>Preparing your project preview…</p>
              )}
            </>
          ) : (
            <div
              className="team-test-results"
              role="log"
              aria-label="Test results"
            >
              <p>
                Quick tests execute the ledger test file against App.jsx. Use{" "}
                <code>npm test</code> in Node for full project tests. Results
                are practice feedback; they do not award trophies.
              </p>
              {testOutput.length ? (
                testOutput.map((r, i) => (
                  <p key={i} className={r.ok ? "passed" : "failed"}>
                    {r.ok ? "✓" : "×"} {r.name}
                    {r.error && <code>{r.error}</code>}
                  </p>
                ))
              ) : (
                <p>
                  {testing
                    ? "Running…"
                    : "Run a quick test to check your changes."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      <LocalLabSync work={work} ownerId={data.user._id} notify={notify} />
      <TeamLabReviewFeed
        reviews={work.meta.reviews}
        currentReview={work.meta.currentReview}
        version={work.meta.version ?? 0}
        onOpenFile={(path, version) => {
          if (version === work.meta.version && path in files) setActive(path);
          else
            work
              .loadRevision(version)
              .then((r) => {
                setRevision(r);
                setHistoryOpen(true);
              })
              .catch((e) => notify(e.message, "error"));
        }}
      />
      {reviewOpen && (
        <Modal
          title="Request a team project review"
          close={() => setReviewOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setRequestingReview(true);
              try {
                await work.requestReview(reviewNote);
                setReviewOpen(false);
                setReviewNote("");
                notify("Your saved project is ready for MC / CC review.");
              } catch (error) {
                notify(error.message, "error");
              } finally {
                setRequestingReview(false);
              }
            }}
          >
            <p>
              Your latest changes will save before the request. Describe what is
              ready and what the reviewer should check.
            </p>
            <label>
              Review summary
              <textarea
                aria-label="Review request summary"
                required
                minLength={10}
                maxLength={4000}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={requestingReview}>
              {requestingReview
                ? "Saving and requesting…"
                : "Send project for review"}
            </button>
          </form>
        </Modal>
      )}
      {studio ? (
        <NodeRuntime
          files={files}
          setFiles={setFiles}
          notify={notify}
          onPreview={(url) => {
            setPreviewUrl(url);
            setPanel("preview");
          }}
        />
      ) : (
        <div className="team-studio-invite">
          <Code2 size={21} />
          <div>
            <strong>Ready to run the whole project?</strong>
            <p>
              The coding studio has your own Node terminal, package installs and
              a live server preview.
            </p>
          </div>
          <a
            className="btn primary small"
            href="/code-studio"
            target="_blank"
            rel="noopener"
          >
            Enter coding studio <ArrowUpRight size={14} />
          </a>
        </div>
      )}
      <footer className="team-lab-footer">
        Saved changes reach teammates in about 2–3 seconds while the lab is
        open. Overlapping edits need review. ZIP downloads are snapshots;
        connect a local folder for automatic two-way source syncing while the
        lab is open.
      </footer>
      {testDoc && (
        <iframe
          className="test-runner"
          title="Team lab isolated test runner"
          ref={testFrame}
          srcDoc={testDoc}
          sandbox="allow-scripts"
        />
      )}
      {deleteOpen && (
        <Modal title="Delete this file?" close={() => setDeleteOpen(false)}>
          <p>
            Remove {active} from the shared project. Earlier versions remain in
            history.
          </p>
          <button
            className="btn primary"
            onClick={() => {
              setFiles((current) => {
                const next = { ...current };
                delete next[active];
                return next;
              });
              setActive("src/App.jsx");
              setDeleteOpen(false);
            }}
          >
            Delete shared file
          </button>
        </Modal>
      )}
      {addOpen && (
        <Modal title="Add a project file" close={() => setAddOpen(false)}>
          <form onSubmit={addFile}>
            <label>
              File path
              <input
                autoFocus
                aria-label="New file path"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="src/helpers.js"
                required
                maxLength={120}
              />
            </label>
            <p>
              Up to 32 source files. Keep private credentials outside your
              shared project.
            </p>
            <button className="btn primary" type="submit">
              Create file
            </button>
          </form>
        </Modal>
      )}
      {historyOpen && (
        <Modal
          title="Your team’s trail"
          close={() => {
            setHistoryOpen(false);
            setRevision(null);
          }}
        >
          <p>
            Each saved version records its author and changed files. Inspect or
            download a snapshot before bringing it into the editor.
          </p>
          <div className="team-history">
            {work.meta.history.map((r) => (
              <button
                key={r.version}
                onClick={async () => {
                  try {
                    setRevision(await work.loadRevision(r.version));
                  } catch (e) {
                    notify(e.message, "error");
                  }
                }}
              >
                <strong>
                  v{r.version} · {r.author}
                </strong>
                <small>
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  {r.paths.join(", ") || "Starter project"}
                </small>
              </button>
            ))}
          </div>
          {revision && (
            <div className="team-history-detail">
              <h3>
                Version {revision.version} · {revision.author}
              </h3>
              <button
                className="btn small"
                onClick={() => download(revision.files, revision.version)}
              >
                Download this version
              </button>
              <p>
                Restoring puts this snapshot into your editor. It saves as a new
                team version and keeps existing history.
              </p>
              <button
                className="btn small"
                onClick={() => {
                  setFiles(revision.files);
                  setHistoryOpen(false);
                  setRevision(null);
                }}
              >
                Restore this version to editor
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
