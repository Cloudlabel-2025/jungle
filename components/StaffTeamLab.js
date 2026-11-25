"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import fetch from "@/lib/college-fetch.js";
import TeamProjectPreview from "./TeamProjectPreview.js";
import TeamLabReviewFeed from "./TeamLabReviewFeed.js";
import LabFullscreenButton from "./LabFullscreenButton.js";
const Editor = dynamic(() => import("./TeamCodeEditor.js"), { ssr: false });
async function get(url, body) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        }
      : { cache: "no-store", signal: AbortSignal.timeout(10000) },
  );
  const result = await r.json();
  if (!r.ok) throw Error(result.error || "Project could not be loaded.");
  return result;
}
export default function StaffTeamLab({ notify }) {
  const [teams, setTeams] = useState([]),
    [teamId, setTeamId] = useState(""),
    [project, setProject] = useState(null),
    [snapshot, setSnapshot] = useState(null),
    [active, setActive] = useState("src/App.jsx"),
    [canReview, setCanReview] = useState(false),
    [feedback, setFeedback] = useState(""),
    [decision, setDecision] = useState("COMMENT"),
    [attach, setAttach] = useState(false),
    [line, setLine] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    requestId = useRef(null);
  useEffect(() => {
    let live = true;
    get("/api/team-lab?view=teams")
      .then((r) => {
        if (live) {
          setTeams(r.teams);
          setCanReview(r.canReview);
          setTeamId(r.teams[0]?.id || "");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [attempt]);
  const endpoint = `/api/team-lab?teamId=${encodeURIComponent(teamId)}`;
  useEffect(() => {
    if (!teamId) return;
    let live = true,
      timer;
    setProject(null);
    setSnapshot(null);
    setError("");
    setFeedback("");
    setActive("src/App.jsx");
    requestId.current = null;
    async function load(first = false) {
      try {
        const p = await get(endpoint);
        if (!live) return;
        setProject(p);
        if (first && !p.notStarted)
          setSnapshot({ files: p.files, version: p.version });
        setError("");
      } catch (e) {
        if (live) setError(e.message);
      }
      if (live) timer = setTimeout(() => load(), 5000);
    }
    load(true);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [teamId, attempt]);
  async function inspect(version) {
    try {
      const r = await get(`${endpoint}&revision=${version}`);
      setSnapshot(r);
      setActive("src/App.jsx");
      setError("");
    } catch (e) {
      notify(e.message, "error");
    }
  }
  async function review(e) {
    e.preventDefault();
    setBusy(true);
    const body = {
      action: "review",
      teamId,
      projectId: project.projectId,
      expectedVersion: snapshot.version,
      status: decision,
      feedback,
      path: attach ? active : undefined,
      line: attach && line ? Number(line) : undefined,
    };
    const signature = JSON.stringify(body);
    if (requestId.current?.signature !== signature)
      requestId.current = { signature, id: crypto.randomUUID() };
    body.requestId = requestId.current.id;
    try {
      await get("/api/team-lab", body);
      setFeedback("");
      requestId.current = null;
      setProject(await get(endpoint));
      notify("Review saved to the inspected version.");
    } catch (e) {
      notify(e.message, "error");
      try {
        setProject(await get(endpoint));
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const url = URL.createObjectURL(
        new Blob(
          [
            zipSync(
              Object.fromEntries(
                Object.entries(snapshot.files).map(([p, s]) => [
                  `wilderness-team/${p}`,
                  strToU8(s),
                ]),
              ),
            ),
          ],
          { type: "application/zip" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `team-project-v${snapshot.version}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      notify(e.message, "error");
    }
  }
  return (
    <div className="team-lab team-staff-review">
      <header className="team-lab-heading">
        <div>
          <span className="eyebrow">MC / CC · PROJECT LOOKOUT</span>
          <h1>Inspect. Guide. Validate.</h1>
          <p>
            Review the team’s saved source and output. Each decision stays
            attached to the version you inspect.
          </p>
        </div>
        <LabFullscreenButton selector=".team-lab" label="lab" />
      </header>
      {error && (
        <p role="alert" className="team-lab-error">
          {error}
          <button
            className="btn small"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </p>
      )}
      <div className="team-lab-toolbar">
        <label>
          Team{" "}
          <select
            aria-label="Team to review"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            {teams.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {snapshot && (
          <>
            <label>
              Inspect version{" "}
              <select
                aria-label="Project version to inspect"
                value={snapshot.version}
                onChange={(e) => inspect(Number(e.target.value))}
              >
                {project?.history?.map((r) => (
                  <option value={r.version} key={r.version}>
                    v{r.version} · {r.author}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn small" onClick={download}>
              Download inspected version
            </button>
          </>
        )}
      </div>
      {!teams.length && !error && (
        <p>No teams are assigned to your review scope.</p>
      )}
      {project?.notStarted && (
        <p>
          This team has not opened its project yet. A player can begin in Field
          workshop.
        </p>
      )}
      {snapshot && project && (
        <>
          {project.version !== snapshot.version && (
            <div className="team-draft-banner" role="status">
              Newer code is available: v{project.version}. You are inspecting v
              {snapshot.version}.
              <button
                className="btn small"
                onClick={() => inspect(project.version)}
              >
                Load latest version
              </button>
            </div>
          )}
          <div className="team-workbench">
            <section className="team-source">
              <div className="team-panel-title">
                <strong>Saved source · v{snapshot.version} · read only</strong>
                <LabFullscreenButton selector=".team-source" label="editor" />
              </div>
              <div className="team-source-layout">
                <nav aria-label="Reviewed project files">
                  {Object.keys(snapshot.files).map((path) => (
                    <button
                      key={path}
                      className={path === active ? "active" : ""}
                      onClick={() => setActive(path)}
                    >
                      {path}
                    </button>
                  ))}
                </nav>
                <div className="team-editor-column">
                  <div className="team-current-file">{active}</div>
                  <Editor
                    path={active}
                    value={snapshot.files[active] ?? ""}
                    disabled
                    onChange={() => {}}
                    onSave={() => {}}
                  />
                </div>
              </div>
            </section>
            <section className="team-results">
              <div className="team-panel-title">
                <strong>Inspected output · v{snapshot.version}</strong>
                <LabFullscreenButton selector=".team-results" label="output" />
              </div>
              <div className="team-preview-note">
                Isolated quick preview. Download the snapshot for full
                package-based execution.
              </div>
              <TeamProjectPreview files={snapshot.files} />
            </section>
          </div>
          {canReview ? (
            <form className="team-review-form" onSubmit={review}>
              <h2>Review version {snapshot.version}</h2>
              <div>
                <label>
                  Decision
                  <select
                    aria-label="Review decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  >
                    <option value="COMMENT">Leave a comment</option>
                    <option value="CHANGES_REQUESTED">Request changes</option>
                    <option value="APPROVED">Approve this version</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={attach}
                    onChange={(e) => setAttach(e.target.checked)}
                  />
                  Reference {active}
                </label>
                {attach && (
                  <label>
                    Line (optional)
                    <input
                      aria-label="Review line"
                      type="number"
                      min="1"
                      max={snapshot.files[active].split("\n").length}
                      value={line}
                      onChange={(e) => setLine(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <label>
                Feedback
                <textarea
                  aria-label="Project review feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  minLength={10}
                  maxLength={4000}
                  required
                  placeholder="Explain what is working, what needs changing and how the team can verify it."
                />
              </label>
              <p>
                Review decisions do not directly change player rewards or edit
                the team’s code.
              </p>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  (snapshot.version !== project.version &&
                    decision !== "COMMENT")
                }
              >
                {busy ? "Saving review…" : "Save project review"}
              </button>
            </form>
          ) : (
            <p>You have read-only project access.</p>
          )}
          <TeamLabReviewFeed
            reviews={project.reviews}
            currentReview={project.currentReview}
            version={project.version}
            onOpenFile={async (path, version) => {
              try {
                if (version !== snapshot.version) await inspect(version);
                setActive(path);
              } catch {}
            }}
          />
        </>
      )}
    </div>
  );
}
