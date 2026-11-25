"use client";
import fetch from "@/lib/college-fetch.js";

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import Link from "next/link";
import MissionAdventure from "./MissionAdventure";
import {
  sprintMissionProgress,
  sprintTrailLinks,
} from "@/lib/mission-experience";
import { useSearchParams } from "next/navigation";
import PlayerVitals from "./PlayerVitals";
import { Panel, Modal, Form, Badge } from "./ui";
import { sprint4Discipline } from "../lib/sprint4-help.js";
import AlumniSprintHistory from "./AlumniSprintHistory";
const field = (name, label, type = "textarea", optional = false) => ({
  name,
  label,
  type,
  optional,
});
const choice = (name, label, values) => ({
  name,
  label,
  options: values.map((v) =>
    typeof v === "string" ? { value: v, label: v } : v,
  ),
});
const reason = field("reason", "Reason and supporting evidence");
const boardStates = ["Ready", "Working", "In Review", "Rework", "Accepted"];
const PlayerMissionContext = createContext(false);
const stamp = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Not scheduled";
function download(value, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Action({
  run,
  action,
  values = {},
  fields = [],
  label,
  convert = (x) => x,
  inlineError = true,
  initial = {},
}) {
  const [submissionError, setSubmissionError] = useState("");
  const playerMission = useContext(PlayerMissionContext);
  return (
    <Form
      quest={playerMission}
      initial={initial}
      fields={fields}
      submit={label || action}
      onSubmit={async (b) => {
        if (inlineError) setSubmissionError("");
        return await run(
          action,
          { ...values, ...convert(b) },
          inlineError ? setSubmissionError : undefined,
        );
      }}
    >
      {submissionError && (
        <p role="alert" className="danger-text">
          {submissionError}
        </p>
      )}
    </Form>
  );
}
function PlayerStageTrail({ task, run }) {
  const stages = task.data.stages;
  const firstUnfinished = stages.findIndex(
    (s) =>
      s.state !== "Complete" ||
      ([0, 1, 3].includes(stages.indexOf(s)) && s.review !== "OK"),
  );
  const [selected, setSelected] = useState(null);
  const index =
    selected ?? (firstUnfinished < 0 ? stages.length - 1 : firstUnfinished);
  const stage = stages[index];
  const reviewed = [0, 1, 3].includes(index);
  const waiting = stage.state === "Complete" && reviewed && !stage.review;
  return (
    <section
      className="player-stage-journey"
      aria-label="Your feature checkpoints"
    >
      <h3>Turn your feature into a working delivery</h3>
      <p>
        Build in Code Lab, leave evidence at each checkpoint, and return for
        your Guide's feedback.
      </p>
      <div className="player-stage-trail">
        {stages.map((s, i) => (
          <button
            type="button"
            key={s.name}
            aria-pressed={index === i}
            onClick={() => setSelected(i)}
          >
            <span>
              {s.state === "Complete" &&
              (![0, 1, 3].includes(i) || s.review === "OK")
                ? "✓"
                : i + 1}
            </span>
            <strong>{s.name}</strong>
            <small>
              {s.review === "OK"
                ? "Approved"
                : s.review === "REWORK"
                  ? "Try again · feedback below"
                  : s.state === "Complete" && [0, 1, 3].includes(i)
                    ? "Awaiting review"
                    : s.state}
            </small>
          </button>
        ))}
      </div>
      <div className="player-stage-active">
        <h4>
          Checkpoint {index + 1} · {stage.name}
        </h4>
        {stage.note && <p className="lesson-copy">{stage.note}</p>}
        {task.state !== "Working" ? (
          <p>Start working on this mission to record checkpoint evidence.</p>
        ) : waiting ? (
          <>
            <p role="status">
              Your Guide is reviewing this checkpoint. Keep coding or explore
              your next checkpoint.
            </p>
            <details className="quest-status-signal">
              <summary>Revise my submitted evidence</summary>
              <p>
                Saving a revision replaces the pending review with a review of
                your latest evidence.
              </p>
              <Action
                key={`${task._id}:${index}:${stage.at}`}
                run={run}
                action="task"
                initial={{ note: stage.note || "" }}
                values={{ taskId: task._id, stage: index, complete: true }}
                fields={[
                  field("note", "Corrected checkpoint reasoning and evidence"),
                ]}
                label="Send revised checkpoint"
              />
            </details>
          </>
        ) : (
          <Action
            key={`${task._id}:${index}:${stage.at || "new"}`}
            run={run}
            action="task"
            values={{ taskId: task._id, stage: index, complete: true }}
            initial={{ note: stage.note || "" }}
            fields={[
              field(
                "note",
                "What did you build or verify? Include your reasoning and evidence.",
              ),
            ]}
            label={
              reviewed
                ? "Send checkpoint to my Guide"
                : "Save checkpoint evidence"
            }
          />
        )}
      </div>
    </section>
  );
}
function JsonAction({ run, action, label, example }) {
  const [error, setError] = useState("");
  return (
    <div>
      <label className="btn">
        {label}
        <input
          aria-label={label}
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 350000) throw Error("JSON exceeds 350 KB.");
              const b = JSON.parse(await f.text());
              setError("");
              await run(action, b);
            } catch (err) {
              setError(err.message);
            }
            e.target.value = "";
          }}
        />
      </label>
      {example && (
        <button
          className="btn"
          onClick={() => download(example, `${action}-format.json`)}
        >
          Download format
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
async function uploadFile(file, values) {
  if (file.size > 5 * 1024 * 1024) throw Error("Upload at most 5 MB.");
  const request = async (body) => {
    const r = await fetch("/api/pilot/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      v = await r.json();
    if (!r.ok) throw Error(v.error);
    return v;
  };
  const intent = await request({
    action: "intent",
    ...values,
    filename: file.name,
    requestId: crypto.randomUUID(),
  });
  const count = intent.chunkSize ? Math.ceil(file.size / intent.chunkSize) : 1;
  for (let part = 0; part < count; part++) {
    const sent = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": intent.contentType,
        ...(intent.chunkSize && {
          "X-Upload-Part": String(part),
          "X-Upload-Parts": String(count),
          "X-Upload-Size": String(file.size),
        }),
      },
      body: intent.chunkSize
        ? file.slice(part * intent.chunkSize, (part + 1) * intent.chunkSize)
        : file,
    });
    if (!sent.ok)
      throw Error(
        "Private storage did not accept the upload. Retry or contact CC.",
      );
  }
  await request({ action: "complete", evidenceId: intent.evidenceId });
  return intent.evidenceId;
}
function FileUpload({ taskId, batchId, report, refresh, onError }) {
  const [busy, setBusy] = useState(false);
  const label = report
    ? `Upload private ${report.reportKind === "PASSPORT" ? "Capability Passport" : "certificate"} PDF`
    : batchId
      ? "Return CSV or XLSX marks"
      : "Upload task evidence";
  return (
    <label className="btn">
      {busy
        ? "Uploading and verifying…"
        : report
          ? label
          : batchId
            ? "Return CSV/XLSX marks"
            : "Upload evidence (three slots, 5 MB each)"}
      <input
        aria-label={label}
        disabled={busy}
        type="file"
        accept={report ? ".pdf" : batchId ? ".csv,.xlsx" : ".pdf,.docx,.xlsx"}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const id = await uploadFile(f, { taskId, batchId, ...report });
            if (batchId) {
              const r = await fetch("/api/pilot/marks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    requestId: crypto.randomUUID(),
                    batchId,
                    evidenceId: id,
                  }),
                }),
                v = await r.json();
              if (!r.ok) throw Error(v.error);
            }
            await refresh();
          } catch (err) {
            onError(err.message);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}
export default function PilotWorkspace({ user, mode = "board", levels = [] }) {
  const params = useSearchParams();
  const requestedSprint = mode === "board" ? params?.get("sprint") : null;
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState(null),
    [teamId, setTeamId] = useState(""),
    [boardState, setBoardState] = useState(""),
    [mine, setMine] = useState(user.role === "GAMER");
  const [updatedAt, setUpdatedAt] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(
          `/api/pilot${requestedSprint ? `?sprint=${encodeURIComponent(requestedSprint)}` : ""}`,
          { cache: "no-store" },
        ),
        v = await r.json();
      if (!r.ok) throw Error(v.error);
      setData(v);
      setUpdatedAt(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
      setNotice("");
    }
  }, [requestedSprint]);
  useEffect(() => {
    refresh();
    const visibleRefresh = () => {
      if (!document.hidden) refresh();
    };
    const balanceChanged = (event) => {
      if (event.detail?.source !== "programme") visibleRefresh();
    };
    const t = setInterval(visibleRefresh, 60000);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("codewild:balance-changed", balanceChanged);
    window.addEventListener("focus", visibleRefresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", visibleRefresh);
      window.removeEventListener("codewild:balance-changed", balanceChanged);
      window.removeEventListener("focus", visibleRefresh);
    };
  }, [refresh]);
  const run = async (action, b = {}, reportError = setError) => {
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/pilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(action !== "draft" && data?.sprint
              ? { sprintId: data.sprint._id }
              : {}),
            ...b,
            requestId: crypto.randomUUID(),
          }),
        }),
        v = await r.json();
      if (!r.ok) throw Error(v.error);
      setNotice(
        v.correct === false
          ? "Not quite. Check the team board and retry for free."
          : v.errors?.length
            ? "Import quarantined: " + v.errors.join(" ")
            : "Saved and verified by the server.",
      );
      await refresh();
      window.dispatchEvent(
        new CustomEvent("codewild:balance-changed", {
          detail: { source: "programme" },
        }),
      );
      return v;
    } catch (e) {
      reportError(e.message);
      return false;
    }
  };
  const s = data?.sprint,
    staff = user.role !== "GAMER",
    cc = user.role === "CENTRE_COMMAND",
    teams = data?.teams || [],
    activeTeam = teams.find((t) => t.teamId === teamId) || teams[0],
    task = data?.tasks?.find((c) => c._id === selected),
    names = data?.names || {};
  const boardTasks =
    mode === "board"
      ? (data?.tasks || []).filter(
          (card) =>
            card.teamId === activeTeam?.teamId &&
            (!mine ||
              card.userId === user._id ||
              card.data.coGamerId === user._id),
        )
      : [];
  const opts = teams.map((t) => ({
    value: t.teamId,
    label: t.name || t.teamId,
  }));
  if (!data && !error) return <p>Loading programme work…</p>;
  if (!data)
    return (
      <section>
        <p role="alert">{error || "Programme access is unavailable."}</p>
        <button type="button" className="btn" onClick={refresh}>
          Try again
        </button>
        {user.role === "GAMER" && (
          <Link className="btn" href="/gamer/sprint-board?board=programme">
            Return to current trail
          </Link>
        )}
      </section>
    );
  if (
    requestedSprint &&
    user.role === "GAMER" &&
    (s?.state === "CLOSED" ||
      s?.data.acceptances?.some(
        (a) => a.teamId === activeTeam?.teamId && a.decision === "ACCEPTED",
      ))
  )
    return <AlumniSprintHistory data={data} user={user} />;
  const setupNumber = s ? s.data.number + Number(s.state === "CLOSED") : 1;
  const setupManifest = data.setup?.manifests.sprints.find(
    (manifest) => manifest.number === setupNumber,
  );
  const format = setupManifest
    ? {
        config: {
          number: setupNumber,
          ...(setupNumber >= 3 && { contentApproval: "" }),
          calendar: {
            timeZone: "Asia/Kolkata",
            intervals: [
              { startMinute: 600, endMinute: 780 },
              { startMinute: 840, endMinute: 1020 },
            ],
            weekdays: [1, 2, 3, 4, 5],
            holidays: [],
          },
          kickoffStart: "",
          kickoffEnd: "",
          dueAt: "",
          resources: Object.fromEntries(
            setupManifest.tasks.map((c) => [
              c.id,
              { url: "", version: "", author: "CURRICULUM", approval: "" },
            ]),
          ),
          teams: data.setup.source.map((t) => ({
            teamId: t.id,
            members: t.members,
            commanderId: "",
            owners: Object.fromEntries(
              setupManifest.tasks.map((c) => [
                c.id,
                t.members["ABCDE".indexOf(c.owner)] || "",
              ]),
            ),
            rationale: "",
          })),
        },
        reason: "",
      }
    : null;
  return (
    <PlayerMissionContext.Provider value={!staff}>
      <section aria-label="Programme Sprint Work">
        {!staff && s && (
          <>
            <nav
              className="player-sprint-trail"
              aria-label="Alumni Connect expedition trails"
            >
              {sprintTrailLinks(levels, s).map((trail) =>
                trail.href ? (
                  <Link
                    key={trail.number}
                    href={trail.href}
                    aria-current={trail.current ? "step" : undefined}
                  >
                    {trail.label}
                  </Link>
                ) : (
                  <span key={trail.number} aria-disabled="true">
                    {trail.label}
                  </span>
                ),
              )}
            </nav>
            <MissionAdventure
              chapter={`Alumni Connect / Sprint ${s.data.number}`}
              title={
                [
                  "Open the Gates",
                  "Build the Registry",
                  "Repair the Trail",
                  "Prove the Portal",
                  "Deliver Alumni Connect",
                ][s.data.number - 1] || "Your expedition"
              }
              player={user}
              progress={sprintMissionProgress(
                s,
                data.tasks || [],
                user._id,
                activeTeam?.teamId,
              )}
              onContinue={(card) => setSelected(card._id)}
            />
          </>
        )}
        {user.role === "GAMER" && <PlayerVitals player={user} />}
        <div className="workflow-status">
          {updatedAt && (
            <time dateTime={updatedAt.toISOString()}>
              Last checked{" "}
              {updatedAt.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              IST
            </time>
          )}
          <button className="btn small" type="button" onClick={refresh}>
            Refresh programme
          </button>
        </div>
        {error && (
          <p role="alert" className="danger-text">
            {error}
          </p>
        )}
        {notice && !error && <p role="status">{notice}</p>}
        {staff && data?.finalArena && (
          <Panel
            title={`Assigned persona arena ${data.finalArena.arena} · ${data.finalArena.persona}`}
          >
            <p>
              {stamp(data.finalArena.startAt)} – {stamp(data.finalArena.endAt)}.
              Keep each candidate’s five-minute defence private.
            </p>
            {data.finalArena.candidates.map((candidate) => (
              <details key={candidate.taskId}>
                <summary>
                  {candidate.name || candidate.gamerId} · {candidate.teamId}
                </summary>
                {!candidate.questions.length && (
                  <p>Awaiting an MC-reviewed, CC-approved question version.</p>
                )}
                {candidate.questions.map((question) => (
                  <div key={question.id}>
                    <p>
                      <strong>{question.id}</strong> {question.question}
                    </p>
                    <p>
                      Expected evidence:{" "}
                      {question.expected_answer_elements.join("; ")}
                    </p>
                    <p>Equivalent alternate: {question.alternate_question}</p>
                  </div>
                ))}
                <Action
                  run={run}
                  action="final-demo-witness"
                  label="Record this candidate’s private defence"
                  values={{
                    teamId: candidate.teamId,
                    taskId: candidate.taskId,
                    advisoryId: candidate.advisoryId,
                    questionVersion: candidate.questionVersion,
                  }}
                  fields={[
                    choice("decision", "Witness outcome", [
                      "PASS",
                      "FAIL",
                      "BLOCKED",
                    ]),
                    field(
                      "defenceMinutes",
                      "Private defence minutes",
                      "number",
                    ),
                    field("evidence", "Demo and defence evidence", "url"),
                    reason,
                  ]}
                />
              </details>
            ))}
          </Panel>
        )}
        {mode === "setup" && cc && (
          <Panel
            title="Programme setup"
            kicker="Additions to the existing expedition"
          >
            <p>
              Existing projects, map and balances remain available. Load a
              separate approved weekly sprint after Week 1 recovery teams are
              published. Current state: {s?.state || "NOT CONFIGURED"}.
            </p>
            {format && (
              <JsonAction
                run={run}
                action="draft"
                label="Stage approved sprint configuration"
                example={format}
              />
            )}
            <details>
              <summary>
                Frozen task manifests and configuration reference
              </summary>
              <button
                className="btn"
                onClick={() =>
                  download(
                    data.setup?.manifests,
                    "approved-sprint-manifests.json",
                  )
                }
              >
                Download Sprint 1–5 definitions
              </button>
              {data.setup?.partB && (
                <>
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        data.setup.partB.finalFriday,
                        "final-friday-reference.json",
                      )
                    }
                  >
                    Download Final Friday reference
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        data.setup.partB.phase2,
                        "phase-2-approved-catalogue.json",
                      )
                    }
                  >
                    Download optional Phase 2 catalogue
                  </button>
                </>
              )}
              <p>
                Replace dates, MC allocations and Curriculum resources with
                actual approvals. The format uses the current sprint’s task
                definitions and role assignments.
              </p>
            </details>
            {s?.state === "DRAFT" && (
              <>
                <Action
                  run={run}
                  action="approve"
                  fields={[reason]}
                  label="Approve current package"
                />
                <Action
                  run={run}
                  action="load"
                  fields={[reason]}
                  label="Load approved read-only preview"
                />
              </>
            )}
            <details>
              <summary>Versioned policies and permissions</summary>
              <JsonAction
                run={run}
                action="settings"
                label="Apply approved programme policies"
                example={{
                  policyVersion: "",
                  reason: "",
                  rubric: [],
                  assistance: { GUIDE: 1, AI_PROMPT: 1, MC_ONE_TO_ONE: 2 },
                }}
              />
              <JsonAction
                run={run}
                action="access"
                label="Apply approved CC permissions or map-team MC allocation"
                example={{
                  userId: "",
                  permissions: ["reports:read"],
                  reason: "",
                }}
              />
              <JsonAction
                run={run}
                action="rules"
                label="Publish nineteen approved workplace behaviours"
                example={{ policyVersion: "", reason: "", rules: [] }}
              />
            </details>
          </Panel>
        )}
        {!s ? (
          <p>
            Weekly sprint work opens after CC publishes and loads an approved
            package. Existing Objectives continue to work.
          </p>
        ) : (
          <>
            {mode !== "daily" && (
              <Panel
                title={`Sprint ${s.data.number} · Alumni Connect`}
                action={<Badge>{s.state}</Badge>}
              >
                <p>
                  Original commitment: {stamp(s.data.originalDueAt)}. Task
                  acceptance, client acceptance and competency marks are
                  separate.
                </p>
                <details>
                  <summary>
                    Approved acceptance tests and field contract
                  </summary>
                  {(s.data.template.acceptance || []).map((a) => (
                    <p key={a.id}>
                      <strong>{a.id}</strong> · {a.text}
                    </p>
                  ))}
                  {(s.data.template.fieldContract || []).map((a, i) => (
                    <p key={i}>
                      {typeof a === "string" ? a : JSON.stringify(a)}
                    </p>
                  ))}
                </details>
                <label>
                  Team{" "}
                  <select
                    value={activeTeam?.teamId || ""}
                    onChange={(e) => setTeamId(e.target.value)}
                  >
                    {opts.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {activeTeam && (
                  <p>
                    TL: {names[activeTeam.leaderId] || "Selected at kickoff"} ·
                    weekly CL limit: {activeTeam.clCap ?? "Not frozen yet"} ·{" "}
                    {activeTeam.kickoff ? "Kickoff recorded" : "Preview only"}
                  </p>
                )}
                {staff &&
                  activeTeam &&
                  !activeTeam.kickoff &&
                  s.state !== "DRAFT" && (
                    <Action
                      run={run}
                      action="kickoff"
                      values={{ teamId: activeTeam.teamId }}
                      fields={[
                        field(
                          "evidence",
                          "Completed kickoff and class evidence",
                        ),
                      ]}
                      label="Record completed kickoff"
                    />
                  )}
              </Panel>
            )}
            {["daily", "board"].includes(mode) && (
              <details open={mode === "daily"}>
                <summary>My Day, Daily Spark and handovers</summary>
                <Panel title="My Day · What’s Due Today?">
                  <p>
                    Team commitments are shared; your own work is highlighted.
                  </p>
                  {data.tasks
                    .filter(
                      (c) =>
                        c.teamId === activeTeam?.teamId &&
                        !["Accepted"].includes(c.state),
                    )
                    .map((c) => (
                      <p key={c._id}>
                        <button
                          className="btn"
                          onClick={() => setSelected(c._id)}
                        >
                          {c.data.code} · {c.data.title}
                        </button>{" "}
                        ·{" "}
                        {c.userId === user._id
                          ? "Your work"
                          : names[c.userId] || "MC Joker"}{" "}
                        · {c.state} · Due {stamp(c.data.dueAt)}
                      </p>
                    ))}
                  {data.handovers
                    .filter(
                      (h) => h.userId === user._id && h.state === "TRANSIT",
                    )
                    .map((h) => (
                      <div key={h._id}>
                        <p>Incoming handover · ready {stamp(h.data.readyAt)}</p>
                        <Action
                          run={run}
                          action="receive"
                          values={{ handoverId: h._id }}
                          label="Acknowledge handover receipt"
                        />
                      </div>
                    ))}
                  {data.notices
                    .filter(
                      (n) =>
                        n.teamId === activeTeam?.teamId ||
                        (staff && n.state === "WORKER_FAILURE"),
                    )
                    .map((n) => (
                      <p key={n._id}>
                        {n.state}:{" "}
                        {n.data.text || n.data.reason || n.data.message}
                      </p>
                    ))}
                  {user.role === "GAMER" &&
                    data.sparks
                      .filter((q) => q.teamId === activeTeam?.teamId && q.text)
                      .map((q) => (
                        <div key={q.teamId}>
                          <h3>Daily Spark</h3>
                          <p>{q.text}</p>
                          {q.answered ? (
                            <p>Your daily star is recorded.</p>
                          ) : (
                            <Action
                              run={run}
                              action="spark"
                              values={{ teamId: q.teamId }}
                              fields={[
                                choice(
                                  "answer",
                                  "Team member",
                                  q.choices.map((id) => ({
                                    value: id,
                                    label: names[id] || id,
                                  })),
                                ),
                              ]}
                              label="Answer Daily Spark"
                            />
                          )}
                        </div>
                      ))}
                  <p>
                    Daily Spark stars:{" "}
                    {
                      data.ledgers.filter(
                        (l) => l.state === "SPARK" && l.userId === user._id,
                      ).length
                    }
                    . These do not change competency marks.
                  </p>
                </Panel>
              </details>
            )}
            {["daily", "board", "journal"].includes(mode) &&
              user.role === "GAMER" &&
              activeTeam && (
                <details>
                  <summary>SOD, EOD, journal and rule acknowledgements</summary>
                  <Action
                    run={run}
                    action="daily"
                    values={{ teamId: activeTeam.teamId }}
                    fields={[
                      choice("kind", "Daily record", [
                        "CLOCK",
                        "AGENDA",
                        "SOD",
                        "EOD",
                        "JOURNAL",
                        "RULE_ACK",
                      ]),
                      field(
                        "note",
                        "Actual work, blockers, help, tomorrow or acknowledgement",
                      ),
                    ]}
                    label="Save attributed daily record"
                  />
                  {data.daily.map((d) => (
                    <p key={d._id}>
                      {d.state} · {d.data.day} ·{" "}
                      {d.data.note || `Verified hygiene ${d.data.score}/10`}
                    </p>
                  ))}
                  {data.policies
                    .filter((p) => p.state === "RULEBOOK")
                    .map((p) => (
                      <div key={p._id}>
                        <h3>Rulebook {p.data.version}</h3>
                        <ol>
                          {p.data.value.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ol>
                      </div>
                    ))}
                </details>
              )}
            {mode === "board" && (
              <>
                <div className="pilot-board-controls">
                  <label className="pilot-board-mine">
                    <input
                      type="checkbox"
                      checked={mine}
                      onChange={(e) => setMine(e.target.checked)}
                    />
                    My assigned work
                  </label>
                  <label className="pilot-board-filter">
                    Status
                    <select
                      value={boardState}
                      onChange={(e) => setBoardState(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {boardStates.map((state) => (
                        <option key={state}>{state}</option>
                      ))}
                    </select>
                  </label>
                  <p aria-live="polite" className="pilot-board-count">
                    {
                      boardTasks.filter(
                        (card) => !boardState || card.state === boardState,
                      ).length
                    }{" "}
                    tasks shown
                  </p>
                </div>
                <div
                  className={
                    boardState
                      ? "pilot-kanban pilot-kanban-filtered"
                      : "pilot-kanban"
                  }
                >
                  {boardStates
                    .filter((state) => !boardState || state === boardState)
                    .map((state) => {
                      const cards = boardTasks.filter(
                        (card) => card.state === state,
                      );
                      return (
                        <section
                          className="pilot-board-column"
                          key={state}
                          aria-label={state}
                        >
                          <h3>
                            {state} <span>{cards.length}</span>
                          </h3>
                          {!cards.length && (
                            <p className="pilot-board-empty">No tasks</p>
                          )}
                          {cards.map((c) => (
                            <button
                              className="quest-card"
                              key={c._id}
                              onClick={() => setSelected(c._id)}
                            >
                              <strong>
                                {c.data.code} · {c.data.title}
                              </strong>
                              <span className="pilot-card-meta">
                                {names[c.userId] || "MC Joker"} · {c.data.tt}
                                {c.data.hours
                                  ? ` · ${c.data.hours}h`
                                  : " · Estimate pending"}
                              </span>
                              <span className="pilot-card-date">
                                Due {stamp(c.data.dueAt)}
                              </span>
                              {c.data.depends.length > 0 && (
                                <small>
                                  Prerequisites: {c.data.depends.join(", ")}
                                </small>
                              )}
                            </button>
                          ))}
                        </section>
                      );
                    })}
                </div>
              </>
            )}
            {["board", "help"].includes(mode) && activeTeam && (
              <details>
                <summary>Client interruptions and assistance</summary>
                <p>At most two active CLs; the slot frees at In Review.</p>
                {data.clients
                  .filter(
                    (c) =>
                      c.teamId === activeTeam.teamId && c.state !== "PROPOSED",
                  )
                  .map((c) => (
                    <Panel
                      key={c._id}
                      title={`${c.data.item?.title || "Ineligible common event"} · ${c.state}`}
                    >
                      <p>
                        {c.data.item?.instructions} · {c.data.reason}
                      </p>
                      <p>
                        Acceptance: {c.data.item?.acceptance} · Due{" "}
                        {stamp(c.data.dueAt)}
                      </p>
                      {c.userId === user._id &&
                        ["ASSIGNED", "REWORK"].includes(c.state) && (
                          <Action
                            run={run}
                            action="cl-work"
                            values={{ clientId: c._id, next: "WORKING" }}
                            fields={[
                              {
                                ...choice(
                                  "taskId",
                                  "Pause your current task (optional)",
                                  [
                                    { value: "", label: "No current task" },
                                    ...data.tasks
                                      .filter(
                                        (t) =>
                                          t.userId === user._id &&
                                          t.state === "Working",
                                      )
                                      .map((t) => ({
                                        value: t._id,
                                        label: t.data.code,
                                      })),
                                  ],
                                ),
                                optional: true,
                              },
                              field(
                                "remainingMinutes",
                                "Remaining work minutes",
                                "number",
                                true,
                              ),
                            ]}
                            convert={(b) => ({
                              ...b,
                              taskId: b.taskId || undefined,
                              remainingMinutes: Number(b.remainingMinutes || 0),
                            })}
                            label="Start client work"
                          />
                        )}
                      {c.userId === user._id && c.state === "WORKING" && (
                        <Action
                          run={run}
                          action="cl-work"
                          values={{ clientId: c._id, next: "IN_REVIEW" }}
                          fields={[
                            field("evidence", "Executed test URL", "url"),
                            reason,
                          ]}
                          label="Submit client work for review"
                        />
                      )}
                      {staff && c.state === "IN_REVIEW" && (
                        <Action
                          run={run}
                          action="cl-work"
                          values={{ clientId: c._id }}
                          fields={[
                            choice("next", "Review outcome", [
                              "ACCEPTED",
                              "REWORK",
                            ]),
                            reason,
                          ]}
                          label="Record independent CL review"
                        />
                      )}
                    </Panel>
                  ))}
                {staff && (
                  <>
                    <JsonAction
                      run={run}
                      action="cl-propose"
                      label="Record MC client assignment proposal"
                      example={{
                        teamId: activeTeam.teamId,
                        itemCode: "",
                        userId: "",
                        reason: "",
                      }}
                    />
                    {cc && (
                      <>
                        <JsonAction
                          run={run}
                          action="bank"
                          label="Publish versioned approved CL bank"
                          example={{ policyVersion: "", reason: "", items: [] }}
                        />
                        <JsonAction
                          run={run}
                          action="cl-release"
                          label="Approve common five-team client release"
                          example={{ itemCode: "", eventKey: "", reason: "" }}
                        />
                        <JsonAction
                          run={run}
                          action="help-grant"
                          label="Grant approved Help Pass allowance"
                          example={{
                            teamId: activeTeam.teamId,
                            userId: "",
                            amount: 1,
                            reason: "",
                          }}
                        />
                      </>
                    )}
                  </>
                )}
                {user.role === "GAMER" && (
                  <Action
                    run={run}
                    action="help"
                    inlineError
                    values={{ teamId: activeTeam.teamId }}
                    fields={[
                      choice("package", "Help requested", [
                        "ESSENTIAL",
                        "MC_ONE_TO_ONE",
                        "GUIDE",
                        "AI_PROMPT",
                        ...(data.sprint.data.number >= 4
                          ? [
                              {
                                value: "EARNED_AI_PROMPT",
                                label: "Redeem earned guided AI Help",
                              },
                            ]
                          : []),
                      ]),
                      choice("category", "Support umbrella", [
                        "EXPERIENCE",
                        "COGNITION",
                        "EXPERT_INTERVENTION_NEEDED",
                      ]),
                      {
                        ...choice("taskId", "Related task (optional)", [
                          { value: "", label: "General help" },
                          ...data.tasks
                            .filter(
                              (t) =>
                                t.teamId === activeTeam.teamId &&
                                (t.userId === user._id ||
                                  t.data.coGamerId === user._id),
                            )
                            .map((t) => ({ value: t._id, label: t.data.code })),
                        ]),
                        optional: true,
                      },
                      reason,
                    ]}
                    convert={(b) => ({ ...b, taskId: b.taskId || undefined })}
                    label="Request help"
                  />
                )}
                {user.role === "GAMER" && data.sprint.data.number >= 4 && (
                  <>
                    <p>
                      After using your three personal Help Passes, ask a
                      teammate to sponsor one MC coaching request, or redeem
                      guided AI Help earned through three verified Daily
                      Discoveries or one successful Weekly Quest. You can earn
                      one credit per week and carry one unused credit into the
                      next week.
                    </p>
                    <p>
                      Available guided AI Help credits:{" "}
                      {
                        data.ledgers.filter(
                          (l) =>
                            l.state === "EARNED_AI_HELP" &&
                            l.userId === user._id &&
                            !l.data.spentAt &&
                            [
                              data.sprint.data.number,
                              data.sprint.data.number + 1,
                            ].includes(l.data.week),
                        ).length
                      }
                    </p>
                    <Action
                      run={run}
                      action="help-sponsor-request"
                      inlineError
                      values={{ teamId: activeTeam.teamId }}
                      fields={[
                        choice(
                          "donorId",
                          "Sponsor",
                          activeTeam.members
                            .filter((id) => id !== user._id)
                            .map((id) => ({
                              value: id,
                              label: names[id] || id,
                            })),
                        ),
                        choice("category", "Support umbrella", [
                          "EXPERIENCE",
                          "COGNITION",
                          "EXPERT_INTERVENTION_NEEDED",
                        ]),
                        {
                          ...reason,
                          label:
                            "Coaching request shared with the selected teammate",
                        },
                      ]}
                      label="Ask for sponsorship"
                    />
                    {data.ledgers
                      .filter(
                        (l) =>
                          l.state === "HELP_SPONSOR_REQUEST" &&
                          l.sprintId === data.sprint._id &&
                          l.teamId === activeTeam.teamId,
                      )
                      .map((l) => (
                        <div key={l._id}>
                          <p>
                            {names[l.userId] || l.userId} requested sponsorship
                            from {names[l.data.donorId] || l.data.donorId}.{" "}
                            {l.data.status}. {l.data.description}
                          </p>
                          {l.data.status === "PENDING" &&
                            (l.userId === user._id
                              ? [["CANCEL", "Cancel request"]]
                              : [
                                  ["APPROVE", "Sponsor with one Help Pass"],
                                  ["DECLINE", "Decline request"],
                                ]
                            ).map(([decision, label]) => (
                              <Action
                                key={decision}
                                run={run}
                                action="help-sponsor-response"
                                inlineError
                                values={{
                                  teamId: activeTeam.teamId,
                                  sponsorshipId: l._id,
                                  decision,
                                }}
                                label={label}
                              />
                            ))}
                        </div>
                      ))}
                  </>
                )}
                {data.ledgers
                  .filter(
                    (l) =>
                      l.userId === user._id &&
                      ["HELP_PASS", "EARNED_AI_HELP"].includes(l.state) &&
                      l.data.resource,
                  )
                  .map((l) => (
                    <p key={l._id}>
                      <a
                        href={l.data.resource}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {l.state === "EARNED_AI_HELP"
                          ? "Open approved guided AI Help resource"
                          : `Open approved ${l.data.package} resource`}
                      </a>
                    </p>
                  ))}
              </details>
            )}
            {(staff ||
              data.reviews.some(
                (r) => r.state === "PENDING" && r.data.reviewerId === user._id,
              )) &&
              ["board", "approvals", "setup"].includes(mode) && (
                <details
                  open={data.reviews.some(
                    (r) =>
                      r.state === "PENDING" &&
                      (r.data.reviewerId === user._id ||
                        (cc && r.data.reviewerRole === "CENTRE_COMMAND")),
                  )}
                >
                  <summary>Independent review queue and exceptions</summary>
                  {data.reviews
                    .filter(
                      (r) =>
                        r.state === "PENDING" &&
                        (r.data.reviewerId === user._id ||
                          (cc && r.data.reviewerRole === "CENTRE_COMMAND")),
                    )
                    .map((r) => (
                      <Panel
                        title={`${r.data.kind} · ${data.tasks.find((c) => c._id === r.data.taskId)?.data.code || r.data.taskId}${r.data.kind === "STAGE" ? ` · ${data.stages[r.data.index]}` : ""}`}
                        key={r._id}
                      >
                        <p>
                          Owner: {names[r.userId]} · Review due{" "}
                          {stamp(r.data.dueAt)}
                        </p>
                        {r.data.kind === "STAGE" && (
                          <blockquote className="lesson-copy">
                            {
                              data.tasks.find((c) => c._id === r.data.taskId)
                                ?.data.stages[r.data.index]?.note
                            }
                          </blockquote>
                        )}
                        <button
                          className="btn"
                          onClick={() => setSelected(r.data.taskId)}
                        >
                          Inspect actual task and evidence
                        </button>
                        <Action
                          run={run}
                          action="review"
                          values={{ reviewId: r._id }}
                          fields={[
                            choice("decision", "Independent finding", [
                              "OK",
                              "REWORK",
                            ]),
                            reason,
                          ]}
                          label="Record review"
                        />
                      </Panel>
                    ))}
                  {staff && activeTeam && (
                    <JsonAction
                      run={run}
                      action="hygiene"
                      label="Verify daily hygiene evidence"
                      example={{
                        teamId: activeTeam.teamId,
                        userId: "",
                        day: "",
                        reason: "",
                      }}
                    />
                  )}
                  {cc && (
                    <JsonAction
                      run={run}
                      action="close"
                      label="Close the fully disposed sprint"
                      example={{ reason: "" }}
                    />
                  )}
                </details>
              )}
            {["board", "acceptance", "setup"].includes(mode) && activeTeam && (
              <details>
                <summary>
                  Client acceptance, recovery and optional extensions
                </summary>
                <p>
                  Client gates are separate from task reviews. All seven current
                  gates must pass before a key is awarded.
                </p>
                {s.data.gates
                  .filter((g) => g.teamId === activeTeam.teamId)
                  .map((g) => (
                    <p key={g.code}>
                      {g.code}: {g.decision} · {g.reason}
                    </p>
                  ))}
                {s.data.acceptances
                  .filter((a) => a.teamId === activeTeam.teamId)
                  .map((a) => (
                    <p key={a.teamId}>
                      {a.decision} · {a.key || "No acceptance key"}
                    </p>
                  ))}
                {staff && s.data.number === 5 && (
                  <>
                    {(data.policies || [])
                      .filter(
                        (policy) => policy._id === s.data.finalFridayPlanId,
                      )
                      .map((policy) => (
                        <Panel key={policy._id} title="Final Friday arena plan">
                          <p>
                            {stamp(policy.data.value.startAt)} –{" "}
                            {stamp(policy.data.value.endAt)}
                          </p>
                          {policy.data.value.arenas.map((arena) => (
                            <p key={arena.arena}>
                              {arena.persona} ·{" "}
                              {names[arena.assessor] || arena.assessor}
                            </p>
                          ))}
                        </Panel>
                      ))}
                    {cc && (
                      <JsonAction
                        run={run}
                        action="final-friday-plan"
                        label="Publish the five-arena Final Friday plan"
                        example={{
                          startAt: "",
                          assessorIds: ["", "", "", "", ""],
                          policyVersion: "",
                          reason: "",
                        }}
                      />
                    )}
                    <JsonAction
                      run={async (action, values) => {
                        const result = await run(action, values);
                        if (result?.export)
                          download(
                            result.export,
                            "thursday-advisory-export.json",
                          );
                        return result;
                      }}
                      action="final-friday-export"
                      label="Download de-identified Thursday export"
                      example={{
                        teamId: activeTeam.teamId,
                        commit: "",
                        sourceArtifactLink: "",
                        deployedTestUrl: "",
                        knownDefects: [],
                        sanitised: false,
                        reason: "",
                      }}
                    />
                    <JsonAction
                      run={run}
                      action="final-friday-import"
                      label="Import advisory questions for staff review"
                      example={{
                        teamId: activeTeam.teamId,
                        payload: {},
                        reason: "",
                      }}
                    />
                    {(data.audit || [])
                      .filter(
                        (row) =>
                          row.teamId === activeTeam.teamId &&
                          row.state === "FINAL_FRIDAY_ADVISORY_IMPORTED",
                      )
                      .map((row) => (
                        <details key={row._id}>
                          <summary>
                            Imported advisory · {row.data.status} · version{" "}
                            {row.data.version}
                          </summary>
                          {(row.data.findings || []).map((finding, index) => (
                            <p key={index}>
                              {finding.id} · {finding.category} ·{" "}
                              {finding.summary} {finding.evidenceRef}
                            </p>
                          ))}
                          {(row.data.provisionalAssessments || []).map(
                            (item, index) => (
                              <p key={index}>
                                {item.gamerId} · {item.criterion} ·{" "}
                                {item.rating} · {item.reason}
                              </p>
                            ),
                          )}
                          {row.data.questions.map((set) => (
                            <div key={set.gamerId}>
                              <strong>{set.gamerId}</strong>
                              {set.questions.map((item, index) => (
                                <p key={index}>{item.question}</p>
                              ))}
                            </div>
                          ))}
                          {!cc && (
                            <JsonAction
                              run={run}
                              action="final-question-review"
                              label="Submit reviewed question version to CC"
                              example={{
                                teamId: activeTeam.teamId,
                                advisoryId: row._id,
                                questionVersion: row.data.version,
                                questionSets: row.data.questions.map((set) => ({
                                  gamer_id: set.gamerId,
                                  team_id: "T01",
                                  questions: set.questions,
                                })),
                                reason: "",
                              }}
                            />
                          )}
                          {cc && row.data.status === "AWAITING_CC_APPROVAL" && (
                            <Action
                              run={run}
                              action="final-question-approve"
                              label="Approve this question version"
                              values={{
                                teamId: activeTeam.teamId,
                                advisoryId: row._id,
                                questionVersion: row.data.version,
                              }}
                              fields={[reason]}
                            />
                          )}
                        </details>
                      ))}
                    <JsonAction
                      run={run}
                      action="final-friday-advisory"
                      label="Record human-reviewed Thursday AI artifacts"
                      example={{
                        teamId: activeTeam.teamId,
                        commit: "",
                        codeManifest: "",
                        individualDossiers: "",
                        reviewedQuestions: "",
                        reason: "",
                      }}
                    />
                    {cc && (
                      <JsonAction
                        run={run}
                        action="final-admin-booking"
                        label="Book optional ten-minute reviewer slot"
                        example={{
                          teamId: activeTeam.teamId,
                          userId: "",
                          voluntary: false,
                          assessorId: "",
                          startAt: "",
                          reason: "",
                        }}
                      />
                    )}
                    {cc && (
                      <JsonAction
                        run={run}
                        action="final-admin-chair"
                        label="Record separate Administrator’s Chair bonus"
                        example={{
                          teamId: activeTeam.teamId,
                          userId: "",
                          voluntary: false,
                          bonus: 0,
                          durationMinutes: 10,
                          environment: "ISOLATED_BRANCH",
                          target: "",
                          baseline: "",
                          rollback: "",
                          sharedReleaseUnchanged: false,
                          assessorId: "",
                          criteria: Object.fromEntries(
                            ["A", "B", "C", "D", "E"].map((id) => [
                              id,
                              { earned: false, evidence: "" },
                            ]),
                          ),
                          evidence: "",
                          reason: "",
                        }}
                      />
                    )}
                    <JsonAction
                      run={run}
                      action="final-award"
                      label="Record Final Friday award evidence"
                      example={{
                        teamId: activeTeam.teamId,
                        category: "",
                        decision: "RECOMMEND",
                        userId: "",
                        evidence: "",
                        reason: "",
                        override: false,
                      }}
                    />
                    {cc && (
                      <JsonAction
                        run={run}
                        action="final-showcase"
                        label="Record persona showcase selection"
                        example={{
                          teamId: activeTeam.teamId,
                          userId: "",
                          evidence: "",
                          reason: "",
                        }}
                      />
                    )}
                    {(data.daily || [])
                      .filter(
                        (record) =>
                          record.state === "FINAL_AWARD" &&
                          record.teamId === activeTeam.teamId,
                      )
                      .map((record) => (
                        <p key={record._id}>
                          {record.data.category} · {record.data.decision} ·{" "}
                          {names[record.data.recipient] ||
                            record.data.recipient ||
                            "Withheld"}
                        </p>
                      ))}
                    {(data.daily || [])
                      .filter(
                        (record) =>
                          record.state === "FINAL_DEMO_WITNESS" &&
                          record.teamId === activeTeam.teamId,
                      )
                      .map((record) => (
                        <p key={record._id}>
                          {record.data.code} · {names[record.userId]} ·{" "}
                          {record.data.decision} · {record.data.defenceMinutes}{" "}
                          minutes
                        </p>
                      ))}
                    <Action
                      run={run}
                      action="final-demo-witness"
                      values={{
                        teamId: activeTeam.teamId,
                        advisoryId:
                          s.data.approvedQuestions?.[activeTeam.teamId]
                            ?.advisoryId,
                        questionVersion:
                          s.data.approvedQuestions?.[activeTeam.teamId]
                            ?.version,
                      }}
                      fields={[
                        choice(
                          "taskId",
                          "Final persona demonstration",
                          data.tasks
                            .filter(
                              (card) =>
                                card.teamId === activeTeam.teamId &&
                                card.data.technicalRole === "Business persona",
                            )
                            .map((card) => ({
                              value: card._id,
                              label: `${card.data.code} · ${card.data.title}`,
                            })),
                        ),
                        choice("decision", "Witness outcome", [
                          "PASS",
                          "FAIL",
                          "BLOCKED",
                        ]),
                        field(
                          "defenceMinutes",
                          "Private defence minutes",
                          "number",
                        ),
                        field(
                          "evidence",
                          "Witnessed demo and defence evidence",
                          "url",
                        ),
                        reason,
                      ]}
                      label="Record private Final Friday witness evidence"
                    />
                  </>
                )}
                {cc && (
                  <>
                    <Action
                      run={run}
                      action="gate"
                      values={{ teamId: activeTeam.teamId }}
                      fields={[
                        choice(
                          "index",
                          "Client acceptance gate",
                          [1, 2, 3, 4, 5, 6, 7].map((i) => ({
                            value: String(i),
                            label:
                              s.data.template.acceptance?.[i - 1]?.id ||
                              `AC-${i}`,
                          })),
                        ),
                        choice("decision", "Test finding", [
                          "PASS",
                          "FAIL",
                          "BLOCKED",
                        ]),
                        field(
                          "evidence",
                          "Actual executed test or demo URL",
                          "url",
                        ),
                        reason,
                      ]}
                      convert={(b) => ({ ...b, index: Number(b.index) })}
                      label="Record client gate evidence"
                    />
                    <Action
                      run={run}
                      action="accept"
                      values={{ teamId: activeTeam.teamId }}
                      fields={[
                        choice("decision", "Client disposition", [
                          "ACCEPTED",
                          "NOT_ACCEPTED",
                        ]),
                        reason,
                      ]}
                      label="Record CC client disposition"
                    />
                    {s.data.number === 2 && (
                      <Action
                        run={run}
                        action="gate"
                        values={{ teamId: activeTeam.teamId }}
                        fields={[
                          choice("code", "Independent deployment gate", [
                            "QA-06",
                            "QA-08",
                          ]),
                          choice("decision", "Finding", [
                            "PASS",
                            "FAIL",
                            "BLOCKED",
                          ]),
                          field(
                            "evidence",
                            "Executed test evidence URL",
                            "url",
                          ),
                          reason,
                        ]}
                        label="Record independent deployment gate"
                      />
                    )}
                    <JsonAction
                      run={run}
                      action="extension-publish"
                      label="Publish approved Phase 2 content"
                      example={{
                        policyVersion: "",
                        reason: "",
                        template: { tasks: [], resources: {} },
                      }}
                    />
                  </>
                )}
                {user.role === "GAMER" &&
                  (s.data.extensionIds || []).map((id) => (
                    <Action
                      key={id}
                      run={run}
                      action="extension-start"
                      values={{ teamId: activeTeam.teamId, extensionId: id }}
                      label={`Start approved extension ${id.split(":").at(-1)}`}
                    />
                  ))}
                {staff && (
                  <>
                    <JsonAction
                      run={run}
                      action="midpoint-open"
                      label="Open individual midpoint recovery"
                      example={{
                        teamId: activeTeam.teamId,
                        userId: "",
                        score: 0,
                        evidence: "",
                        reason: "",
                      }}
                    />
                    <JsonAction
                      run={run}
                      action="extension-verify"
                      label="Verify separately scored extension achievements"
                      example={{
                        teamId: activeTeam.teamId,
                        extensionId: "",
                        results: [],
                        reason: "",
                      }}
                    />
                  </>
                )}
                {data.recoveries
                  .filter((r) => r.teamId === activeTeam.teamId)
                  .map((r) => (
                    <Panel
                      key={r._id}
                      title={`Individual recovery · ${names[r.userId]} · ${r.state}`}
                    >
                      <p>{r.data.attempts.length}/2 attempts submitted.</p>
                      {r.userId === user._id && r.state === "OPEN" && (
                        <Action
                          run={run}
                          action="midpoint-submit"
                          values={{ teamId: r.teamId, userId: r.userId }}
                          fields={[
                            field("evidence", "Recovery evidence URL", "url"),
                            reason,
                          ]}
                          label="Submit individual recovery attempt"
                        />
                      )}
                      {staff && r.state === "PENDING" && (
                        <Action
                          run={run}
                          action="midpoint-review"
                          values={{ teamId: r.teamId, userId: r.userId }}
                          fields={[
                            choice("decision", "Independent outcome", [
                              "PASS",
                              "FAIL",
                            ]),
                            reason,
                          ]}
                          label="Verify individual attempt"
                        />
                      )}
                    </Panel>
                  ))}
              </details>
            )}
            {activeTeam && (
              <details>
                <summary>Meetings and optional challenges</summary>
                {(data.meetings || [])
                  .filter((m) => m.teamId === activeTeam.teamId)
                  .map((m) => (
                    <p key={m._id}>
                      {m.state} · {stamp(m.data.startAt || m.data.at)} ·{" "}
                      {m.data.agenda || m.data.note}
                    </p>
                  ))}
                {(staff || activeTeam.leaderId === user._id) && (
                  <Action
                    run={run}
                    action="daily-report"
                    values={{
                      teamId: activeTeam.teamId,
                      kind: staff ? "MC_EXCEPTIONS" : "TEAM_EOD",
                    }}
                    fields={[
                      field(
                        "note",
                        staff
                          ? "Single team exceptions report"
                          : "Truthful team EOD: done, progress, blocked, help, tomorrow",
                      ),
                    ]}
                    label={
                      staff ? "Save MC exceptions report" : "Save TL team EOD"
                    }
                  />
                )}
                {staff && (
                  <Action
                    run={run}
                    action="meeting-publish"
                    values={{ teamId: activeTeam.teamId }}
                    fields={[
                      field("startAt", "Meeting time with timezone", "text"),
                      field("agenda", "Published SOD agenda"),
                    ]}
                    label="Publish team meeting agenda"
                  />
                )}
                {cc && (
                  <JsonAction
                    run={run}
                    action="challenge-publish"
                    label="Publish approved optional challenges"
                    example={{
                      policyVersion: "",
                      reason: "",
                      quests: [
                        {
                          id: "",
                          role: "PRIMARY",
                          title: "",
                          instructions: "",
                        },
                      ],
                      discovery: "",
                      goat: "",
                    }}
                  />
                )}
                {user.role === "GAMER" &&
                  data.policies
                    .filter((p) => p._id === s.data.challengeId)
                    .map((p) => (
                      <div key={p._id}>
                        {p.data.value.quests.map((q) => (
                          <p key={q.id}>
                            {q.id} · {q.role} · {q.title}: {q.instructions}
                          </p>
                        ))}
                        <p>Discovery: {p.data.value.discovery}</p>
                        <p>GOAT: {p.data.value.goat}</p>
                        <Action
                          run={run}
                          action="challenge-start"
                          values={{ teamId: activeTeam.teamId }}
                          fields={[
                            choice("kind", "Optional challenge", [
                              "QUEST",
                              "DISCOVERY",
                              "GOAT",
                            ]),
                            field(
                              "code",
                              "Quest code (for weekly quest)",
                              "text",
                              true,
                            ),
                          ]}
                          label="Start optional challenge"
                        />
                      </div>
                    ))}
                {data.daily
                  .filter(
                    (r) =>
                      r.state === "CHALLENGE" && r.teamId === activeTeam.teamId,
                  )
                  .map((r) => (
                    <Panel
                      key={r._id}
                      title={`${r.data.kind} · ${r.data.status}`}
                    >
                      <p>
                        {r.data.prompt} · Due {stamp(r.data.dueAt)}
                      </p>
                      {r.data.evidence && (
                        <a
                          href={r.data.evidence}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Inspect submitted evidence
                        </a>
                      )}
                      {r.userId === user._id &&
                        ["WORKING", "REWORK"].includes(r.data.status) && (
                          <Action
                            run={run}
                            action="challenge-submit"
                            values={{ teamId: r.teamId, attemptId: r._id }}
                            fields={[
                              field("evidence", "Actual work URL", "url"),
                              reason,
                            ]}
                            label="Submit optional work"
                          />
                        )}
                      {staff &&
                        ["IN_REVIEW", "EXPIRED"].includes(r.data.status) && (
                          <Action
                            run={run}
                            action="challenge-review"
                            values={{ teamId: r.teamId, attemptId: r._id }}
                            fields={[
                              choice("decision", "Independent finding", [
                                "PASS",
                                "REWORK",
                              ]),
                              reason,
                            ]}
                            label="Review optional work"
                          />
                        )}
                    </Panel>
                  ))}
              </details>
            )}
            {staff && activeTeam && (
              <details>
                <summary>Audited corrections and rule follow-up</summary>
                <JsonAction
                  run={run}
                  action="rule-followup"
                  label="Record an additional rule explanation"
                  example={{
                    teamId: activeTeam.teamId,
                    userId: "",
                    reason: "",
                  }}
                />
                {cc && (
                  <>
                    <JsonAction
                      run={run}
                      action="rule-consequence"
                      label="Apply eligible one-time accountability consequence"
                      example={{
                        teamId: activeTeam.teamId,
                        userId: "",
                        reason: "",
                      }}
                    />
                    <JsonAction
                      run={run}
                      action="midpoint-dispose"
                      label="Record human midpoint disposition"
                      example={{
                        teamId: activeTeam.teamId,
                        userId: "",
                        decision: "",
                        reason: "",
                      }}
                    />
                    <JsonAction
                      run={run}
                      action="mark-correct"
                      label="Correct a committed mark with audit history"
                      example={{ markId: "", ratings: {}, reason: "" }}
                    />
                    <Action
                      run={run}
                      action="reconcile-roster"
                      fields={[reason]}
                      label="Revalidate an unchanged team allocation against the published roster"
                    />
                    <JsonAction
                      run={run}
                      action="audit-review"
                      label="Open a CC audit without using a Gamer reassessment"
                      example={{ reviewId: "", evidence: "" }}
                    />
                  </>
                )}
                {(data.audit || []).map((e) => (
                  <p key={e._id}>
                    {stamp(e.createdAt)} · {e.state} ·{" "}
                    {e.data.reason || e.data.action || ""}
                  </p>
                ))}
              </details>
            )}
            {["rewards", "board", "reports"].includes(mode) && (
              <details open={mode === "rewards"}>
                <summary>
                  Verified competency and separate programme ledgers
                </summary>
                <p>
                  Your current lives and energy are shared across every page.
                  The entries below are historical records; energy adjustments
                  require an approved policy.
                </p>
                {data.ledgers
                  .filter((l) => l.userId === user._id || staff)
                  .map((l) => (
                    <p key={l._id}>
                      {names[l.userId] || l.userId} ·{" "}
                      {l.state === "ADMIN_CHAIR"
                        ? "Administrator’s Chair bonus"
                        : l.state}{" "}
                      ·{" "}
                      {l.state === "ENERGY"
                        ? "Balance change recorded (history)"
                        : (l.data.human?.total ??
                          l.data.score ??
                          l.data.bonus ??
                          l.data.energy ??
                          l.data.amount ??
                          l.data.category ??
                          l.data.milestone ??
                          "Recorded")}
                    </p>
                  ))}
                {staff && activeTeam && (
                  <>
                    <JsonAction
                      run={run}
                      action="energy-propose"
                      label="Propose evidenced energy adjustment"
                      example={{
                        teamId: activeTeam.teamId,
                        userId: "",
                        amount: -1,
                        reason: "",
                      }}
                    />
                    {cc && (
                      <>
                        <JsonAction
                          run={run}
                          action="energy-decide"
                          label="Independently approve or reject energy proposal"
                          example={{
                            proposalId: "",
                            decision: "APPROVE",
                            reason: "",
                          }}
                        />
                        <JsonAction
                          run={run}
                          action="energy-recover"
                          label="Record human-verified energy recovery"
                          example={{
                            teamId: activeTeam.teamId,
                            userId: "",
                            lives: 1,
                            reason: "",
                          }}
                        />
                        <JsonAction
                          run={run}
                          action="core-results"
                          label="Publish verified weekly core results"
                          example={{
                            teamId: activeTeam.teamId,
                            results: activeTeam.members.map((userId) => ({
                              userId,
                              score: null,
                              evidence: "",
                            })),
                            reason: "",
                          }}
                        />
                        <JsonAction
                          run={run}
                          action="core-correct"
                          label="Correct core result with retained history"
                          example={{
                            teamId: activeTeam.teamId,
                            userId: "",
                            score: null,
                            evidence: "",
                            reason: "",
                          }}
                        />
                      </>
                    )}
                  </>
                )}
              </details>
            )}
            {s.data.number === 5 && ["board", "setup"].includes(mode) && (
              <details>
                <summary>Optional Phase 2 cross-team work</summary>
                {user.role === "MISSION_COMMANDER" && (
                  <JsonAction
                    run={run}
                    action="phase2-plan"
                    label="Stage cross-team card assignments"
                    example={{
                      levelId: "P2-S1",
                      branch: "",
                      owners: {},
                      reason: "",
                    }}
                  />
                )}
                {(data.phase2 || []).map((group) => (
                  <Panel key={group.levelId} title={group.levelId}>
                    <p>
                      {group.state} ·{" "}
                      <a href={group.branch}>Isolated work branch</a>
                    </p>
                    {cc && group.state === "PHASE2_DRAFT" && (
                      <Action
                        run={run}
                        action="phase2-approve"
                        values={{ levelId: group.levelId }}
                        fields={[reason]}
                        label="Approve workgroup"
                      />
                    )}
                    {cc && group.state === "PHASE2_COMPLETE" && (
                      <Action
                        run={run}
                        action="phase2-bonus"
                        values={{ levelId: group.levelId }}
                        fields={[
                          choice(
                            "userId",
                            "Contributor",
                            [
                              ...new Set(group.cards.map((card) => card.owner)),
                            ].map((id) => ({
                              value: id,
                              label: names[id] || id,
                            })),
                          ),
                          field("bonus", "Approved bonus", "number"),
                          field("evidence", "Evidence URL", "url"),
                          reason,
                        ]}
                        label="Record Phase 2 bonus"
                      />
                    )}
                    {group.cards.map((card) => (
                      <details key={card.id}>
                        <summary>
                          {card.id} · {card.title} · {card.status}
                        </summary>
                        <p>{card.instructions}</p>
                        {card.depends.length > 0 && (
                          <p>Prerequisites {card.depends.join(", ")}</p>
                        )}
                        {staff && (
                          <p>Owner {names[card.owner] || card.owner}</p>
                        )}
                        {card.submission && (
                          <a href={card.submission.evidence}>
                            Submitted evidence
                          </a>
                        )}
                        {!staff &&
                          group.state === "PHASE2_ACTIVE" &&
                          ["READY", "REWORK"].includes(card.status) && (
                            <Action
                              run={run}
                              action="phase2-submit"
                              values={{
                                levelId: group.levelId,
                                cardId: card.id,
                              }}
                              fields={[
                                field("evidence", "Evidence URL", "url"),
                                reason,
                              ]}
                              label="Submit optional work"
                            />
                          )}
                        {cc && card.status === "SUBMITTED" && (
                          <Action
                            run={run}
                            action="phase2-review"
                            values={{ levelId: group.levelId, cardId: card.id }}
                            fields={[
                              choice("decision", "Outcome", [
                                "ACCEPTED",
                                "REWORK",
                              ]),
                              reason,
                            ]}
                            label="Review optional work"
                          />
                        )}
                      </details>
                    ))}
                  </Panel>
                ))}
              </details>
            )}
            {s.data.number === 5 &&
              ["rewards", "board", "reports", "setup"].includes(mode) &&
              activeTeam && (
                <details open={mode === "rewards"}>
                  <summary>Private Capability Passport and certificate</summary>
                  {(staff ? activeTeam.members : [user._id]).map((gamerId) => {
                    const record = (data.daily || []).find(
                      (row) =>
                        row.userId === gamerId &&
                        [
                          "FINAL_REPORT_GENERATED",
                          "FINAL_REPORT_STALE",
                          "FINAL_REPORT_REVIEWED",
                          "FINAL_REPORT_ISSUED",
                        ].includes(row.state),
                    );
                    return (
                      <Panel key={gamerId} title={names[gamerId] || gamerId}>
                        {cc && (
                          <JsonAction
                            run={run}
                            action="final-profile"
                            label="Approve criterion evidence and development profile"
                            example={{
                              teamId: activeTeam.teamId,
                              userId: gamerId,
                              rubricVersion: "",
                              reason: "",
                              criteria: (
                                data.setup?.partB.finalFriday.passport.page1
                                  .criterion_scores || []
                              ).map((row) => ({
                                criterion_id: row.criterion_id,
                                approved_score: null,
                                evidence_refs: [],
                              })),
                              strengths: [],
                              gaps: [],
                            }}
                          />
                        )}
                        {record?.state === "FINAL_REPORT_ISSUED" && (
                          <p>
                            <a
                              href={`/api/pilot/files/${record.data.passportId}`}
                            >
                              Private Capability Passport
                            </a>
                            {" · "}
                            <a
                              href={`/api/pilot/files/${record.data.certificateId}`}
                            >
                              Certificate of Assessed Completion
                            </a>
                          </p>
                        )}
                        {cc && record?.state === "FINAL_REPORT_ISSUED" && (
                          <Action
                            run={run}
                            action="final-report-reopen"
                            values={{
                              teamId: activeTeam.teamId,
                              userId: gamerId,
                            }}
                            fields={[reason]}
                            label="Reopen private documents for authorised correction"
                          />
                        )}
                        {!record && !staff && (
                          <p>Awaiting assessed completion and CC issuance.</p>
                        )}
                        {staff && record?.state !== "FINAL_REPORT_ISSUED" && (
                          <>
                            <p>
                              Generate a two-page Passport and one-page
                              certificate from the current records. Both PDFs
                              are saved privately. Download and inspect them
                              before MC review; the learner receives access only
                              after CC issuance.
                            </p>
                            {record && (
                              <p>
                                Document status:{" "}
                                {record.state.replaceAll("_", " ")}
                              </p>
                            )}
                            <Action
                              run={run}
                              action="final-report-generate"
                              values={{
                                teamId: activeTeam.teamId,
                                userId: gamerId,
                              }}
                              fields={[
                                field("course", "Course / programme", "text"),
                                field(
                                  "projectId",
                                  "Assessed project ID",
                                  "text",
                                ),
                                field(
                                  "commit",
                                  "Full assessed commit SHA",
                                  "text",
                                ),
                                field(
                                  "sourceArtifactLink",
                                  "Sanitised source reference",
                                  "url",
                                  true,
                                ),
                                field(
                                  "deployedTestUrl",
                                  "Approved staging URL",
                                  "url",
                                  true,
                                ),
                                field(
                                  "sanitised",
                                  "I confirm source references have been checked for private data and credentials",
                                  "checkbox",
                                ),
                                reason,
                              ]}
                              convert={(b) => ({
                                ...b,
                                sanitised: Object.hasOwn(b, "sanitised"),
                              })}
                              label="Generate and save both private PDFs"
                            />
                            {(data.finalReportFiles || [])
                              .filter(
                                (file) =>
                                  file.userId === gamerId &&
                                  file.teamId === activeTeam.teamId,
                              )
                              .map((file) => (
                                <p key={file.id}>
                                  <a href={`/api/pilot/files/${file.id}`}>
                                    {file.filename}
                                  </a>
                                  {" · "}
                                  {file.kind} · {file.id}
                                </p>
                              ))}
                            {!cc && (
                              <Action
                                run={run}
                                action="final-report-review"
                                values={{
                                  teamId: activeTeam.teamId,
                                  userId: gamerId,
                                  passportPages: 2,
                                }}
                                fields={[
                                  ...[
                                    ["passportId", "PASSPORT"],
                                    ["certificateId", "CERTIFICATE"],
                                  ].map(([name, kind]) =>
                                    choice(
                                      name,
                                      kind === "PASSPORT"
                                        ? "Checked Passport PDF"
                                        : "Checked certificate PDF",
                                      (data.finalReportFiles || [])
                                        .filter(
                                          (file) =>
                                            file.userId === gamerId &&
                                            file.teamId === activeTeam.teamId &&
                                            file.kind === kind,
                                        )
                                        .map((file) => ({
                                          value: file.id,
                                          label: file.filename,
                                        })),
                                    ),
                                  ),
                                  field(
                                    "verified",
                                    "I checked the two Passport pages, exact certificate wording and supporting evidence",
                                    "checkbox",
                                  ),
                                  reason,
                                ]}
                                convert={(b) => ({
                                  ...b,
                                  certificateWordingVerified: Object.hasOwn(
                                    b,
                                    "verified",
                                  ),
                                  evidenceVerified: Object.hasOwn(
                                    b,
                                    "verified",
                                  ),
                                })}
                                label="Confirm assigned MC review of both PDFs"
                              />
                            )}
                            {cc &&
                              record?.state === "FINAL_REPORT_REVIEWED" && (
                                <Action
                                  run={run}
                                  action="final-report-issue"
                                  values={{
                                    teamId: activeTeam.teamId,
                                    userId: gamerId,
                                  }}
                                  fields={[reason]}
                                  label="Approve and issue the two private documents"
                                />
                              )}
                          </>
                        )}
                      </Panel>
                    );
                  })}
                </details>
              )}
            {staff && ["board", "reports", "setup"].includes(mode) && (
              <details>
                <summary>Manual assessment export and marks return</summary>
                <p>
                  The JSON includes attributed notes and extracted text.
                  Download any original attachments from their task cards and
                  include them in your approved external review. Private
                  attachment links require your signed-in session; missing or
                  unreadable evidence must remain unobserved until human
                  verification.
                </p>
                <Action
                  run={run}
                  action="export"
                  fields={[
                    field("promptVersion", "Approved prompt version", "text"),
                    field("prompt", "Approved external grading instructions"),
                    reason,
                  ]}
                  label="Create evidence grading batch"
                />
                {(data.batches || []).map((batch) => (
                  <Panel
                    key={batch._id}
                    title={`Assessment batch · ${batch.state}`}
                  >
                    <a
                      href={`/api/pilot/marks?id=${batch._id}`}
                      className="btn"
                    >
                      Download evidence, rubric and return CSV
                    </a>
                    {["EXPORTED", "QUARANTINED"].includes(batch.state) && (
                      <FileUpload
                        batchId={batch._id}
                        refresh={refresh}
                        onError={setError}
                      />
                    )}
                    <p>{batch.data.import?.errors?.join(" ")}</p>
                    {batch.state === "VALIDATED" &&
                      batch.data.import.rows.map((row) => (
                        <details key={row.key}>
                          <summary>
                            {names[row.gamer_id] || row.gamer_id} ·{" "}
                            {
                              data.tasks.find((c) => c._id === row.task_id)
                                ?.data.code
                            }{" "}
                            · AI suggestion {row.total_score}
                          </summary>
                          <p>{row.rationale}</p>
                          <Action
                            run={run}
                            action="mark-review"
                            values={{ batchId: batch._id, key: row.key }}
                            fields={[
                              ...batch.data.rubric.map((c) =>
                                choice(
                                  c.key,
                                  `${c.name} (${c.weight} maximum)`,
                                  [
                                    { value: "null", label: "Unobserved" },
                                    ...Array.from({ length: 5 }, (_, i) => ({
                                      value: String(i),
                                      label: String(i),
                                    })),
                                  ],
                                ),
                              ),
                              reason,
                            ]}
                            convert={(b) => ({
                              reason: b.reason,
                              ratings: Object.fromEntries(
                                batch.data.rubric.map((c) => [
                                  c.key,
                                  b[c.key] === "null" ? null : Number(b[c.key]),
                                ]),
                              ),
                            })}
                            label="Verify thirteen evidence ratings"
                          />
                        </details>
                      ))}
                    {batch.state === "VALIDATED" && (
                      <Action
                        run={run}
                        action="mark-commit"
                        values={{ batchId: batch._id }}
                        fields={[reason]}
                        label="Commit human-reviewed marks"
                      />
                    )}
                  </Panel>
                ))}
              </details>
            )}
          </>
        )}
        {task && (
          <Modal
            title={`${task.data.code} · ${task.data.title}`}
            close={() => setSelected(null)}
            wide
          >
            <dl className="pilot-task-facts">
              <div>
                <dt>Status</dt>
                <dd>
                  {task.state} · Owner {names[task.userId] || "MC Joker"} ·{" "}
                  {task.data.tt}
                </dd>
              </div>
              <div>
                <dt>Current target</dt>
                <dd>{stamp(task.data.dueAt)}</dd>
              </div>
              <div>
                <dt>Prerequisites</dt>
                <dd>{task.data.depends.join(", ") || "None"}</dd>
              </div>
              <div>
                <dt>Original target</dt>
                <dd>{stamp(task.data.originalDueAt)}</dd>
              </div>
            </dl>
            {task.data.instructions && <p>{task.data.instructions}</p>}
            {task.data.uat && (
              <p>
                Planned Client’s Chair session: {task.data.uat.day} ·{" "}
                {task.data.hours} protected hours · Independent recommendation
              </p>
            )}
            {task.data.evidenceRequired && (
              <p>Evidence: {task.data.evidenceRequired}</p>
            )}
            <p>
              <a href={task.data.basic.url} target="_blank" rel="noreferrer">
                Free Curriculum basic clues · {task.data.basic.version}
              </a>
            </p>
            {s?.data.number === 4 &&
              sprint4Discipline(task.data.code) &&
              user.role === "GAMER" &&
              [task.userId, task.data.coGamerId].includes(user._id) && (
                <section aria-label="Task-specific Sprint 4 help">
                  <h3>Task-specific Sprint 4 help</h3>
                  <p>
                    Choose a Help Pass option for this card. Essential help
                    remains available in the Help Desk.
                  </p>
                  <Action
                    run={run}
                    action="help"
                    inlineError
                    values={{
                      taskId: task._id,
                      teamId: task.teamId,
                      category: "COGNITION",
                      frozenGuide: true,
                    }}
                    fields={[
                      choice("package", "Task help option", [
                        { value: "AI_PROMPT", label: "FIRE / STORY prompts" },
                        { value: "GUIDE", label: "Detailed testing guide" },
                        {
                          value: "MC_ONE_TO_ONE",
                          label: "MC 1:1 for this task",
                        },
                      ]),
                      field("reason", "What help do you need for this task?"),
                    ]}
                    label="Request help for this task"
                  />
                  {data.ledgers
                    .filter(
                      (l) =>
                        l.userId === user._id &&
                        l.data.taskId === task._id &&
                        (l.data.guidance || l.data.ticketId),
                    )
                    .map((l) =>
                      l.data.guidance ? (
                        <details key={l._id} open>
                          <summary>
                            {l.data.guidance.title} ·{" "}
                            {l.data.package === "GUIDE"
                              ? "Detailed testing guide"
                              : "FIRE / STORY prompts"}
                          </summary>
                          {l.data.guidance.sections.map((section) => (
                            <p key={section.name}>
                              <strong>{section.name}</strong> {section.text}
                            </p>
                          ))}
                        </details>
                      ) : (
                        <p key={l._id}>
                          MC 1:1 request saved for {task.data.code}. Help Desk
                          ticket {l.data.ticketId}.
                        </p>
                      ),
                    )}
                </section>
              )}
            {task.data.evidence.map((e) => (
              <p key={e.id}>
                <a href={e.url} target="_blank" rel="noreferrer">
                  {e.summary}
                </a>{" "}
                · {names[e.by] || e.by} · {e.warning}
              </p>
            ))}
            {task.data.coGamerId === user._id &&
              !["Accepted", "In Review"].includes(task.state) && (
                <>
                  <p>
                    Your contribution remains attributed separately from the
                    task owner.
                  </p>
                  <Action
                    run={run}
                    action="task"
                    values={{ taskId: task._id }}
                    fields={[
                      field("evidence", "Your contribution URL", "url"),
                      field("summary", "Your actual contribution"),
                    ]}
                    label="Attach Co-Gamer contribution"
                  />
                  <FileUpload
                    taskId={task._id}
                    refresh={refresh}
                    onError={setError}
                  />
                </>
              )}
            {task.userId === user._id &&
              !["Accepted", "In Review"].includes(task.state) && (
                <>
                  <Action
                    run={run}
                    action="task"
                    values={{
                      taskId: task._id,
                      cardVersion: task.version,
                      next: task.state === "Working" ? "In Review" : "Working",
                    }}
                    label={
                      task.state === "Working"
                        ? "Send my feature for final review"
                        : task.state === "Rework"
                          ? "Return to my feature"
                          : "Start my mission"
                    }
                  />
                  <PlayerStageTrail task={task} run={run} />
                  <Action
                    run={run}
                    action="task"
                    values={{ taskId: task._id }}
                    fields={[
                      field(
                        "evidence",
                        "Repository, commit, test or demo URL",
                        "url",
                      ),
                      field(
                        "summary",
                        "Contribution and verification performed",
                      ),
                    ]}
                    label="Attach attributed evidence link"
                  />
                  <FileUpload
                    taskId={task._id}
                    refresh={refresh}
                    onError={setError}
                  />
                  <details className="quest-status-signal">
                    <summary>Signal a delay or ask for help</summary>
                    <Action
                      run={run}
                      action="forecast"
                      values={{ taskId: task._id }}
                      fields={[
                        choice("status", "Delivery forecast", [
                          "ON_TRACK",
                          "AT_RISK",
                        ]),
                        { ...reason, optional: true },
                        field(
                          "eta",
                          "Revised ETA with explicit timezone",
                          "text",
                          true,
                        ),
                      ]}
                      label="Record advance delivery status"
                    />
                    <Action
                      run={run}
                      action="task"
                      values={{ taskId: task._id }}
                      fields={[
                        choice("blocked", "Blocker status", [
                          { value: "false", label: "No current blocker" },
                          { value: "true", label: "Blocked" },
                        ]),
                        field(
                          "note",
                          "Truthful blocker status and help needed",
                        ),
                      ]}
                      convert={(b) => ({ ...b, blocked: b.blocked === "true" })}
                      label="Update blocker"
                    />
                  </details>
                </>
              )}
            {staff &&
              task.data.stages.map((s, i) => (
                <p key={i}>
                  {s.name}: {s.state} · {s.review || "Not reviewed"} · {s.note}
                </p>
              ))}
            {data.reviews
              .filter(
                (r) =>
                  r.data.taskId === task._id &&
                  r.userId === user._id &&
                  r.state === "DECIDED",
              )
              .map((r) => (
                <div key={r._id}>
                  <p>
                    {r.data.kind}: {r.data.decision} · {r.data.reason}
                  </p>
                  <Action
                    run={run}
                    action="reassess"
                    values={{ reviewId: r._id }}
                    fields={[
                      field("evidence", "Evidence challenging this finding"),
                    ]}
                    label="Request formal reassessment (three per game)"
                  />
                </div>
              ))}
            {(task.userId === user._id || staff) &&
              task.state === "Accepted" && (
                <Action
                  run={run}
                  action="handover"
                  values={{ fromId: task._id }}
                  fields={[
                    choice(
                      "toId",
                      "Dependent receiving task",
                      data.tasks
                        .filter(
                          (c) =>
                            c.teamId === task.teamId &&
                            c.data.depends.includes(task.data.code),
                        )
                        .map((c) => ({ value: c._id, label: c.data.code })),
                    ),
                    field("evidence", "Handover readiness evidence"),
                  ]}
                  label="Send prerequisite handover"
                />
              )}
            {staff && (
              <>
                {!["Accepted", "In Review"].includes(task.state) && (
                  <Action
                    run={run}
                    action="assign-helper"
                    values={{ taskId: task._id }}
                    fields={[
                      choice(
                        "userId",
                        "Approved Co-Gamer",
                        (
                          teams.find((t) => t.teamId === task.teamId)
                            ?.members || []
                        )
                          .filter((id) => id !== task.userId)
                          .map((id) => ({ value: id, label: names[id] || id })),
                      ),
                      reason,
                    ]}
                    label="Assign an attributed Co-Gamer"
                  />
                )}
                <Action
                  run={run}
                  action="deadline"
                  values={{ taskId: task._id }}
                  fields={[
                    field(
                      "dueAt",
                      "Approved revised target with timezone",
                      "text",
                    ),
                    reason,
                  ]}
                  label="Approve revised individual target"
                />
                {cc && (
                  <Action
                    run={run}
                    action="estimate"
                    values={{ taskId: task._id }}
                    fields={[
                      field("hours", "Approved working hours", "number"),
                      reason,
                    ]}
                    convert={(b) => ({ ...b, hours: Number(b.hours) })}
                    label="Record approved estimate"
                  />
                )}
              </>
            )}
          </Modal>
        )}
      </section>
    </PlayerMissionContext.Provider>
  );
}
