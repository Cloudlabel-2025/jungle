"use client";
import { useState } from "react";
import { Panel, Badge, Empty, Form } from "./ui";
import { teamRoles, playerRole } from "@/lib/team-roles.js";
const roleName = (code) =>
  teamRoles.find((r) => r.code === code)?.label || code;
const time = (date) =>
  new Date(date).toLocaleString(undefined, { timeZoneName: "short" });
const newTask = () => ({
  title: "",
  instructions: "",
  acceptanceCriteria: "",
  targetRole: "BACKEND",
  dueAt: "",
  priority: "MEDIUM",
});
function localTime(value) {
  const date = new Date(value);
  return new Date(+date - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function ChallengeProgress({ data, selected = "all", onSelect }) {
  const staff = data.user.role !== "GAMER";
  const challenges = (data.challenges || []).filter(
    (c) => c.status === "PUBLISHED",
  );
  return (
    <Panel
      title={staff ? "Challenge progress" : "Your challenge assignments"}
      kicker="TASKS ASSIGNED BY TEAM ROLE"
    >
      {onSelect && (
        <label className="challenge-filter">
          Challenge filter
          <select value={selected} onChange={(e) => onSelect(e.target.value)}>
            <option value="all">All objectives</option>
            {challenges.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!challenges.length && (
        <Empty title="No published challenges yet">
          Role-based tasks appear automatically after Centre Command publishes.
        </Empty>
      )}
      {challenges
        .filter((c) => selected === "all" || c._id === selected)
        .map((c) => {
          const tasks = data.tasks.filter(
            (t) =>
              t.challengeId === c._id &&
              (staff || t.assigneeId === data.user._id),
          );
          if (!tasks.length) return null;
          return (
            <article className="challenge-record" key={c._id}>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <p className="muted">
                Released {time(c.publishedAt)} ·{" "}
                {tasks.filter((t) => t.status === "Done").length}/{tasks.length}{" "}
                approved
              </p>
              <div className="challenge-table-wrap">
                <table className="challenge-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Task / role</th>
                      <th>Player</th>
                      <th>Status</th>
                      <th>Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t._id}>
                        <td>
                          {
                            data.teams.find((team) => team._id === t.teamId)
                              ?.name
                          }
                        </td>
                        <td>
                          {t.title}
                          <small>{roleName(t.targetRole)}</small>
                        </td>
                        <td>
                          {data.roster.find((p) => p._id === t.assigneeId)
                            ?.name || t.assigneeId}
                        </td>
                        <td>
                          <Badge>{t.status}</Badge>
                        </td>
                        <td>{time(t.dueAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
    </Panel>
  );
}
export function ChallengeTaskDetails({ task, data, act, staff }) {
  if (!task.challengeId) return null;
  const owner = task.assigneeId === data.user._id;
  return (
    <section className="challenge-task-detail">
      <div className="callout">
        <div>
          <strong>
            {task.challengeName} · {roleName(task.targetRole)}
          </strong>
          <p className="support-copy">
            Acceptance criteria: {task.acceptanceCriteria}
          </p>
          <small>Released {time(task.releasedAt)}</small>
        </div>
      </div>
      {(owner || staff) && task.submittedAt && (
        <article className="challenge-record">
          <h3>Submission · version {task.submissionVersion}</h3>
          <p className="support-copy">{task.submissionSummary}</p>
          <ul>
            {task.evidenceReferences?.map((reference, i) => (
              <li key={i}>{reference}</li>
            ))}
          </ul>
          <small>Submitted {time(task.submittedAt)}</small>
        </article>
      )}
      {task.reviewFeedback && (
        <p className="callout support-copy">
          Commander feedback: {task.reviewFeedback}
        </p>
      )}
      {staff && task.status === "Review" && (
        <Form
          fields={[
            {
              name: "feedback",
              label: "What should the player improve?",
              type: "textarea",
              min: 10,
            },
          ]}
          submit="Return with feedback"
          onSubmit={(v) =>
            act("commander/task", { taskId: task._id, action: "return", ...v })
          }
        />
      )}
      {owner &&
        !staff &&
        task.status !== "Done" &&
        (task.status === "Review" ? (
          <p className="muted">
            Awaiting Commander review. Feedback will appear here if changes are
            needed.
          </p>
        ) : (
          <>
            <Form
              fields={[
                {
                  name: "status",
                  label: "Work status",
                  options: ["Backlog", "In Progress"].map((value) => ({
                    value,
                    label: value,
                  })),
                },
              ]}
              initial={{ status: task.status }}
              submit="Update work status"
              onSubmit={(v) =>
                act("gamer/task-status", { taskId: task._id, ...v })
              }
            />
            <Form
              fields={[
                {
                  name: "submissionSummary",
                  label: "Completion summary",
                  type: "textarea",
                  min: 10,
                },
                {
                  name: "evidence",
                  label:
                    "Evidence references — one repository, commit, artifact or test reference per line",
                  type: "textarea",
                  min: 3,
                },
              ]}
              initial={{
                submissionSummary: task.submissionSummary,
                evidence: task.evidenceReferences?.join("\n"),
              }}
              submit="Submit challenge task for review"
              onSubmit={(v) =>
                act(
                  "gamer/task-status",
                  {
                    taskId: task._id,
                    status: "Review",
                    submissionSummary: v.submissionSummary,
                    evidenceReferences: v.evidence
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                  "Submission saved for Commander review.",
                )
              }
            />
          </>
        ))}
      {(owner || staff) && (
        <details className="challenge-record">
          <summary>Submission and review history</summary>
          {(data.taskEvents || [])
            .filter((e) => e.taskId === task._id)
            .map((e) => (
              <article className="challenge-record" key={e._id}>
                <strong>{e.kind.replaceAll("_", " ")}</strong> ·{" "}
                {time(e.createdAt)} · {e.actorId}
                <pre className="support-copy">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              </article>
            ))}
        </details>
      )}
    </section>
  );
}
export default function ChallengeManager({ data, act }) {
  const [editor, setEditor] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const change = (key, value) => setEditor((old) => ({ ...old, [key]: value }));
  const taskChange = (index, key, value) =>
    setEditor((old) => ({
      ...old,
      definitions: old.definitions.map((d, i) =>
        i === index ? { ...d, [key]: value } : d,
      ),
    }));
  function edit(challenge) {
    setMessage("");
    setPreview(null);
    setEditor(
      challenge
        ? {
            ...challenge,
            definitions: challenge.definitions.map((d) => ({
              ...d,
              dueAt: localTime(d.dueAt),
            })),
          }
        : {
            _id: crypto.randomUUID(),
            name: "",
            description: "",
            definitions: [newTask()],
          },
    );
  }
  async function getPreview(challenge) {
    setBusy(true);
    setPreview(null);
    setMessage("");
    try {
      const response = await fetch("/api/challenges/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge._id,
          version: challenge.version,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="role-challenges" className="challenge-console">
      <Panel
        title="Challenges"
        kicker="CENTRE COMMAND / ASSIGN TO ALL TEAMS"
        action={
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => edit(null)}
          >
            Create challenge
          </button>
        }
      >
        <p className="challenge-intro">
          Add named tasks, select a team role for each, preview the players,
          then publish to all teams. Each player receives an independent
          assignment.
        </p>
        {message && (
          <p className="challenge-message" role="status">
            {message}
          </p>
        )}
        {editor && (
          <form
            className="field-form challenge-editor"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              try {
                const body = {
                  challengeId: editor._id,
                  version: editor.version,
                  name: editor.name,
                  description: editor.description,
                  definitions: editor.definitions.map((d) => ({
                    ...d,
                    dueAt: new Date(d.dueAt).toISOString(),
                  })),
                };
                if (
                  await act(
                    `challenges/${editor.version ? "update" : "create"}`,
                    body,
                    "Draft saved. Preview recipients before publishing.",
                  )
                )
                  setEditor(null);
              } catch (error) {
                setMessage(error.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{editor.version ? "Edit challenge draft" : "New challenge"}</h3>
            <label>
              Challenge name
              <input
                required
                minLength={3}
                maxLength={160}
                value={editor.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label>
              Challenge description
              <textarea
                required
                minLength={10}
                maxLength={4000}
                rows={3}
                value={editor.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </label>
            {editor.definitions.map((d, index) => (
              <fieldset className="challenge-definition" key={d._id || index}>
                <legend>Task {index + 1}</legend>
                <label>
                  Task name
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={d.title}
                    onChange={(e) => taskChange(index, "title", e.target.value)}
                  />
                </label>
                <label>
                  Instructions
                  <textarea
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={3}
                    value={d.instructions}
                    onChange={(e) =>
                      taskChange(index, "instructions", e.target.value)
                    }
                  />
                </label>
                <label>
                  Acceptance criteria
                  <textarea
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={3}
                    value={d.acceptanceCriteria}
                    onChange={(e) =>
                      taskChange(index, "acceptanceCriteria", e.target.value)
                    }
                  />
                </label>
                <label>
                  Target team role
                  <select
                    value={d.targetRole}
                    onChange={(e) =>
                      taskChange(index, "targetRole", e.target.value)
                    }
                  >
                    {teamRoles.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Deadline ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                  <input
                    required
                    type="datetime-local"
                    value={d.dueAt}
                    onChange={(e) => taskChange(index, "dueAt", e.target.value)}
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={d.priority}
                    onChange={(e) =>
                      taskChange(index, "priority", e.target.value)
                    }
                  >
                    {["MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {editor.definitions.length > 1 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      change(
                        "definitions",
                        editor.definitions.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove task {index + 1}
                  </button>
                )}
              </fieldset>
            ))}
            <div className="button-row">
              <button
                type="button"
                className="btn"
                disabled={busy || editor.definitions.length >= 20}
                onClick={() =>
                  change("definitions", [...editor.definitions, newTask()])
                }
              >
                Add another task
              </button>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancel editing
              </button>
            </div>
          </form>
        )}
        {!data.challenges?.length && !editor && (
          <Empty title="Create the first role-based challenge" />
        )}
        {(data.challenges || []).map((c) => (
          <article className="challenge-record" key={c._id}>
            <h3>{c.name}</h3>
            <Badge tone={c.status === "PUBLISHED" ? "lime" : "amber"}>
              {c.status} · v{c.version}
            </Badge>
            <p>{c.description}</p>
            {c.definitions.map((d) => (
              <p key={d._id}>
                <strong>{d.title}</strong> · {roleName(d.targetRole)}
                <br />
                <small>Due {time(d.dueAt)}</small>
              </p>
            ))}
            {c.status === "DRAFT" && (
              <div className="button-row">
                <button
                  className="btn"
                  disabled={busy || !!editor}
                  onClick={() => edit(c)}
                >
                  Edit draft
                </button>
                <button
                  className="btn primary"
                  disabled={busy || !!editor}
                  onClick={() => getPreview(c)}
                >
                  Preview recipients
                </button>
              </div>
            )}
            {preview?.challengeId === c._id && (
              <div className="challenge-preview">
                <h4>Recipient preview</h4>
                <p>
                  {preview.recipients.length} assignments across{" "}
                  {data.teams.length} teams. Tasks are released only when
                  published.
                </p>
                {preview.errors.length > 0 && (
                  <div role="alert">
                    <strong>Publication is blocked:</strong>
                    <ul>
                      {preview.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                    <p>
                      Correct the team allocations/roles or draft deadlines,
                      then preview again.
                    </p>
                  </div>
                )}
                <div className="challenge-table-wrap">
                  <table className="challenge-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Task</th>
                        <th>Role</th>
                        <th>Recipient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.recipients.map((r) => (
                        <tr key={`${r.definitionId}:${r.teamId}`}>
                          <td>{r.teamName}</td>
                          <td>{r.taskTitle}</td>
                          <td>{roleName(r.targetRole)}</td>
                          <td>{r.userName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    !!editor ||
                    !preview.canPublish ||
                    preview.version !== c.version
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (
                        await act(
                          "challenges/publish",
                          {
                            challengeId: c._id,
                            version: preview.version,
                            previewToken: preview.token,
                          },
                          "Challenge published to the matching player in every team.",
                        )
                      )
                        setPreview(null);
                      else {
                        setPreview(null);
                        setMessage(
                          "Preview recipients again before retrying publication.",
                        );
                      }
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Publish to all teams ({preview.recipients.length} assignments)
                </button>
              </div>
            )}
          </article>
        ))}
      </Panel>
      <ChallengeProgress data={data} selected={filter} onSelect={setFilter} />
    </section>
  );
}
