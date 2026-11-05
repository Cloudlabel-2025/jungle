"use client";
import { useState, useEffect, useCallback } from "react";
import { Panel, Modal, Form, Badge } from "./ui";
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
}) {
  return (
    <Form
      fields={fields}
      submit={label || action}
      onSubmit={(b) => run(action, { ...values, ...convert(b) })}
    />
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
    }),
    sent = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": intent.contentType },
      body: file,
    });
  if (!sent.ok)
    throw Error(
      "Private storage did not accept the upload. Retry or contact CC.",
    );
  await request({ action: "complete", evidenceId: intent.evidenceId });
  return intent.evidenceId;
}
function FileUpload({ taskId, batchId, refresh, onError }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn">
      {busy
        ? "Uploading and verifying…"
        : batchId
          ? "Return CSV/XLSX marks"
          : "Upload evidence (three slots, 5 MB each)"}
      <input
        aria-label={
          batchId ? "Return CSV or XLSX marks" : "Upload task evidence"
        }
        disabled={busy}
        type="file"
        accept={batchId ? ".csv,.xlsx" : ".pdf,.docx,.xlsx"}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const id = await uploadFile(f, { taskId, batchId });
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
export function PilotBoardSlot({ data, children }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <div className="button-row" aria-label="Objective boards">
        <button
          className={`btn ${!show ? "primary" : ""}`}
          onClick={() => setShow(false)}
        >
          Existing Objectives
        </button>
        <button
          className={`btn ${show ? "primary" : ""}`}
          onClick={() => setShow(true)}
        >
          Programme Sprint Work
        </button>
      </div>
      {show ? <PilotWorkspace user={data.user} /> : children}
    </>
  );
}
export default function PilotWorkspace({ user, mode = "board" }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState(null),
    [teamId, setTeamId] = useState(""),
    [mine, setMine] = useState(user.role === "GAMER");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/pilot", { cache: "no-store" }),
        v = await r.json();
      if (!r.ok) throw Error(v.error);
      setData(v);
      setError("");
    } catch (e) {
      setError(e.message);
      setNotice("");
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);
  const run = async (action, b = {}) => {
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
      return v;
    } catch (e) {
      setError(e.message);
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
  const opts = teams.map((t) => ({ value: t.teamId, label: t.teamId }));
  if (!data && !error) return <p>Loading programme work…</p>;
  if (!data)
    return <p role="alert">{error || "Programme access is unavailable."}</p>;
  const format = data.setup
    ? {
        config: {
          number: s?.state === "CLOSED" ? s.data.number + 1 : 1,
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
            (data.setup.manifests.sprints[0]?.tasks || []).map((c) => [
              c.id,
              { url: "", version: "", author: "CURRICULUM", approval: "" },
            ]),
          ),
          teams: data.setup.source.map((t) => ({
            teamId: t.id,
            members: t.members,
            commanderId: "",
            owners: Object.fromEntries(
              data.setup.manifests.sprints[0].tasks.map((c) => [
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
    <section aria-label="Programme Sprint Work">
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
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
          <JsonAction
            run={run}
            action="draft"
            label="Stage approved sprint configuration"
            example={format}
          />
          <details>
            <summary>Frozen task manifests and configuration reference</summary>
            <button
              className="btn"
              onClick={() =>
                download(
                  data.setup?.manifests,
                  "approved-sprint-manifests.json",
                )
              }
            >
              Download Sprint 1 and Sprint 2 definitions
            </button>
            <p>
              Replace dates, MC allocations and Curriculum resources with actual
              approvals. Format dates are intentionally empty. After Sprint 1,
              use the Sprint 2 task definitions and role assignments, not the
              Sprint 1 owners.
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
                acceptance, client acceptance and competency marks are separate.
              </p>
              <details>
                <summary>Approved acceptance tests and field contract</summary>
                {(s.data.template.acceptance || []).map((a) => (
                  <p key={a.id}>
                    <strong>{a.id}</strong> · {a.text}
                  </p>
                ))}
                {(s.data.template.fieldContract || []).map((a, i) => (
                  <p key={i}>{typeof a === "string" ? a : JSON.stringify(a)}</p>
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
                      field("evidence", "Completed kickoff and class evidence"),
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
                  .filter((h) => h.userId === user._id && h.state === "TRANSIT")
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
              <label>
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => setMine(e.target.checked)}
                />{" "}
                My assigned work
              </label>
              <div className="pilot-kanban">
                {["Ready", "Working", "In Review", "Rework", "Accepted"].map(
                  (state) => (
                    <Panel title={state} key={state}>
                      {data.tasks
                        .filter(
                          (c) =>
                            c.teamId === activeTeam?.teamId &&
                            c.state === state &&
                            (!mine ||
                              c.userId === user._id ||
                              c.data.coGamerId === user._id),
                        )
                        .map((c) => (
                          <button
                            className="quest-card"
                            key={c._id}
                            onClick={() => setSelected(c._id)}
                          >
                            <strong>
                              {c.data.code} · {c.data.title}
                            </strong>
                            <p>
                              {c.data.tt} · {names[c.userId] || "MC Joker"} ·{" "}
                              {c.data.hours || "Estimate awaiting approval"}{" "}
                              {c.data.hours ? "working hours" : ""}
                            </p>
                            <small>
                              {c.data.depends.join(", ") || "Independent start"}{" "}
                              · due {stamp(c.data.dueAt)}
                            </small>
                          </button>
                        ))}
                    </Panel>
                  ),
                )}
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
                  values={{ teamId: activeTeam.teamId }}
                  fields={[
                    choice("package", "Help requested", [
                      "ESSENTIAL",
                      "MC_ONE_TO_ONE",
                      "GUIDE",
                      "AI_PROMPT",
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
                          .filter((t) => t.teamId === activeTeam.teamId)
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
              {data.ledgers
                .filter(
                  (l) =>
                    l.userId === user._id &&
                    l.state === "HELP_PASS" &&
                    l.data.resource,
                )
                .map((l) => (
                  <p key={l._id}>
                    <a href={l.data.resource} target="_blank" rel="noreferrer">
                      Open approved {l.data.package} resource
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
              <details>
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
                      title={`${r.data.kind} · ${data.tasks.find((c) => c._id === r.data.taskId)?.data.code || r.data.taskId}`}
                      key={r._id}
                    >
                      <p>
                        Owner: {names[r.userId]} · Review due{" "}
                        {stamp(r.data.dueAt)}
                      </p>
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
                          label: `AC-${i}`,
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
                        field("evidence", "Executed test evidence URL", "url"),
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
                      { id: "", role: "PRIMARY", title: "", instructions: "" },
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
                example={{ teamId: activeTeam.teamId, userId: "", reason: "" }}
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
                Legacy map balances remain unchanged. Programme energy requires
                an approved policy.
              </p>
              {data.ledgers
                .filter((l) => l.userId === user._id || staff)
                .map((l) => (
                  <p key={l._id}>
                    {names[l.userId] || l.userId} · {l.state} ·{" "}
                    {l.data.human?.total ??
                      l.data.score ??
                      l.data.bonus ??
                      l.data.energy ??
                      l.data.amount ??
                      l.data.category ??
                      l.data.milestone ??
                      "Recorded"}
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
          {staff && ["board", "reports", "setup"].includes(mode) && (
            <details>
              <summary>Manual assessment export and marks return</summary>
              <p>
                The JSON includes attributed notes and extracted text. Download
                any original attachments from their task cards and include them
                in your approved external review. Private attachment links
                require your signed-in session; missing or unreadable evidence
                must remain unobserved until human verification.
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
                  <a href={`/api/pilot/marks?id=${batch._id}`} className="btn">
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
                            data.tasks.find((c) => c._id === row.task_id)?.data
                              .code
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
                              choice(c.key, `${c.name} (${c.weight} maximum)`, [
                                { value: "null", label: "Unobserved" },
                                ...Array.from({ length: 5 }, (_, i) => ({
                                  value: String(i),
                                  label: String(i),
                                })),
                              ]),
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
          <p>
            {task.state} · Owner {names[task.userId] || "MC Joker"} ·{" "}
            {task.data.tt}
          </p>
          <p>
            Prerequisites: {task.data.depends.join(", ") || "None"} · Original
            target {stamp(task.data.originalDueAt)} · Current target{" "}
            {stamp(task.data.dueAt)}
          </p>
          <p>
            <a href={task.data.basic.url} target="_blank" rel="noreferrer">
              Free Curriculum basic clues · {task.data.basic.version}
            </a>
          </p>
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
                  Your contribution remains attributed separately from the task
                  owner.
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
                  values={{ taskId: task._id, cardVersion: task.version }}
                  fields={[
                    choice(
                      "next",
                      "Next work state",
                      task.state === "Working" ? ["In Review"] : ["Working"],
                    ),
                  ]}
                  label="Update task state"
                />
                <Action
                  run={run}
                  action="task"
                  values={{ taskId: task._id }}
                  fields={[
                    choice(
                      "stage",
                      "SDLC stage",
                      data.stages.map((v, i) => ({
                        value: String(i),
                        label: v,
                      })),
                    ),
                    choice("complete", "Stage progress", [
                      { value: "false", label: "In progress" },
                      {
                        value: "true",
                        label: "Complete; request checkpoint review",
                      },
                    ]),
                    field(
                      "note",
                      "Actual reasoning and evidence for this stage",
                    ),
                  ]}
                  convert={(b) => ({
                    ...b,
                    stage: Number(b.stage),
                    complete: b.complete === "true",
                  })}
                  label="Record SDLC evidence"
                />
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
                    field("summary", "Contribution and verification performed"),
                  ]}
                  label="Attach attributed evidence link"
                />
                <FileUpload
                  taskId={task._id}
                  refresh={refresh}
                  onError={setError}
                />
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
                    field("note", "Truthful blocker status and help needed"),
                  ]}
                  convert={(b) => ({ ...b, blocked: b.blocked === "true" })}
                  label="Update blocker"
                />
              </>
            )}
          {task.data.stages.map((s, i) => (
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
          {(task.userId === user._id || staff) && task.state === "Accepted" && (
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
                        teams.find((t) => t.teamId === task.teamId)?.members ||
                        []
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
  );
}
