"use client";
import { useState } from "react";
import { Panel, Form, Badge, Empty } from "./ui";
import { umbrellas, interventions, transitions } from "@/lib/support-rules.js";
import {
  EffortWorkspace,
  EffortReport,
  CaseComparison,
} from "./EffortWorkspace";

const field = (name, label, optional = false) => ({
  name,
  label,
  type: "textarea",
  optional,
});
const choice = (name, label, values) => ({
  name,
  label,
  options: values.map((v) =>
    typeof v === "string" ? { value: v, label: v.replaceAll("_", " ") } : v,
  ),
});
const stamp = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { timeZoneName: "short" })
    : "Not yet recorded";
const label = (value) => value?.replaceAll("_", " ");
const caseFields = [
  "title",
  "cause",
  "unsuccessful",
  "successful",
  "applicability",
  "prerequisites",
  "anonymisation",
  "validationEvidence",
].map((k) =>
  field(
    k,
    {
      unsuccessful: "Unsuccessful approaches (redacted)",
      successful: "Successful recovery (redacted)",
      anonymisation: "Redaction checklist and evidence (private)",
      validationEvidence: "Resolution validation evidence (private)",
    }[k] || k,
  ),
);

function Action({ title, children }) {
  return (
    <details className="support-action">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
function Desk({ data, act, now }) {
  const [selected, setSelected] = useState("");
  const s = data.support,
    user = data.user,
    cc = user.role === "CENTRE_COMMAND",
    staff = user.role !== "GAMER";
  const ticket = s.tickets.find((t) => t._id === selected);
  const send = (action, values) =>
    act(`support/${action}`, { ticketId: ticket?._id, ...values });
  return (
    <>
      <p className="muted">
        Private support for you and the responsible command team. Asking for
        help carries no score penalty. Receipts and acknowledgements do not
        satisfy the response SLA.
      </p>
      {!staff && (
        <Action title="Raise a private ticket">
          <Form
            fields={[
              field(
                "description",
                "Describe the problem, impact, and help needed",
              ),
              choice("taskId", "Related task (optional)", [
                { value: "", label: "No related task" },
                ...data.tasks.map((t) => ({ value: t._id, label: t.title })),
              ]),
            ]}
            submit="Submit ticket"
            onSubmit={(v) => send("ticket-create", v)}
          />
        </Action>
      )}
      {cc && !s.calendar && (
        <p role="status">
          Configure the cohort working calendar in Expedition setup before
          assigning tickets.
        </p>
      )}
      <div className="support-ticket-list">
        {!s.tickets.length && <Empty title="No tickets in your queue" />}
        {s.tickets.map((t) => (
          <button
            key={t._id}
            className={`support-ticket ${selected === t._id ? "selected" : ""}`}
            onClick={() => setSelected(t._id)}
          >
            <span>
              <Badge tone={t.breachedAt ? "red" : "lime"}>
                {label(t.state)}
              </Badge>{" "}
              {t.escalated && <Badge tone="red">Escalated</Badge>}
            </span>
            <strong>{t.description.slice(0, 110)}</strong>
            <small>
              {t.category ? label(t.category) : "Awaiting CC triage"} ·{" "}
              {t.assignedAt
                ? `Response due ${stamp(t.dueAt)}`
                : `Unassigned: ${t.unassignedWaitMinutes} elapsed min`}{" "}
              {t.breachedAt ? " · SLA breached" : ""}
            </small>
          </button>
        ))}
      </div>
      {ticket && (
        <Panel title="Ticket workspace" kicker={ticket._id}>
          <p className="support-copy">{ticket.description}</p>
          <EffortWorkspace
            key={ticket._id}
            ticket={ticket}
            data={data}
            act={act}
          />
          <p className="muted">
            Created {stamp(ticket.createdAt)} · Owner{" "}
            {s.operators.find((o) => o._id === ticket.assignedTo)?.name ||
              ticket.assignedTo ||
              "Unassigned"}
            <br />
            First response {stamp(ticket.firstResponseAt)} · Task{" "}
            {ticket.taskId || "None"} · Issue {ticket.issueId || "None"}
            <br />
            Original assignment {stamp(ticket.assignedAt)} · First-response
            deadline {stamp(ticket.dueAt)} · Unassigned wait{" "}
            {ticket.unassignedWaitMinutes} min
          </p>
          {ticket.breachedAt && (
            <p className="danger-text">
              SLA breach recorded {stamp(ticket.breachedAt)}. The breach remains
              in the history.
            </p>
          )}
          {cc && (
            <>
              <Action title="Classify / correct support umbrella">
                <Form
                  fields={[
                    choice("category", "Primary umbrella", umbrellas),
                    field("tags", "Secondary tags, comma separated", true),
                    field("reason", "Classification or correction reason"),
                  ]}
                  initial={{
                    category: ticket.category || umbrellas[0],
                    tags: ticket.tags.join(", "),
                  }}
                  onSubmit={(v) =>
                    send("ticket-classify", {
                      ...v,
                      tags: v.tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Action>
              <Action title="Assign / reassign owner">
                <Form
                  fields={[
                    choice(
                      "userId",
                      "Command owner",
                      s.operators.map((o) => ({
                        value: o._id,
                        label: `${o.name} · ${label(o.role)}`,
                      })),
                    ),
                    field("reason", "Assignment reason"),
                  ]}
                  onSubmit={(v) => send("ticket-assign", v)}
                />
                <p className="muted">
                  Reassignment preserves the original first-response obligation.
                </p>
              </Action>
            </>
          )}
          {staff && (
            <>
              <button
                className="btn"
                onClick={() => send("ticket-acknowledge", {})}
              >
                Acknowledge receipt
              </button>
              <Action title="Give a substantive response">
                <Form
                  fields={[
                    field(
                      "guidance",
                      "Meaningful guidance, resolution, or concrete next action",
                    ),
                  ]}
                  submit="Record substantive response"
                  onSubmit={(v) => send("ticket-response", v)}
                />
              </Action>
              <Action title="Record human intervention">
                <Form
                  fields={[
                    choice(
                      "kind",
                      "Intervention route",
                      Object.entries(interventions).map(([value, title]) => ({
                        value,
                        label: `${value} · ${title}`,
                      })),
                    ),
                    choice(
                      "performerId",
                      "Performer",
                      s.operators.map((o) => ({ value: o._id, label: o.name })),
                    ),
                    {
                      name: "plannedAt",
                      label: "Planned time — ISO timestamp with timezone",
                      optional: true,
                      placeholder: "2026-10-27T10:00:00+05:30",
                    },
                    {
                      name: "actualAt",
                      label: "Actual time — ISO timestamp with timezone",
                      optional: true,
                    },
                    field(
                      "guidance",
                      "Guidance level and concrete next action",
                    ),
                    field("outcome", "Outcome / planned outcome"),
                    field(
                      "artifact",
                      "Response, session, or human audio evidence reference",
                    ),
                  ]}
                  onSubmit={(v) => send("intervention", v)}
                />
                <p className="muted">
                  Appointments are manual. Record a substantive response
                  separately when the student has been given a concrete next
                  action.
                </p>
              </Action>
              <Action title="Link a technical issue">
                <Form
                  fields={[
                    field(
                      "issueId",
                      "Existing issue ID (leave blank to create)",
                      true,
                    ),
                    field("symptom", "Symptom (for a new issue)", true),
                    field("cause", "Cause taxonomy (for a new issue)", true),
                    field(
                      "recurrenceOf",
                      "Previous issue ID for recurrence (optional)",
                      true,
                    ),
                  ]}
                  onSubmit={(v) => send("issue", v)}
                />
              </Action>
              <Action title="Escalate">
                <Form
                  fields={[field("reason", "Escalation reason")]}
                  onSubmit={(v) => send("ticket-escalate", v)}
                />
              </Action>
            </>
          )}
          <Action title="Record an attempt / recovery">
            <Form
              fields={[
                field("approach", "What was attempted"),
                field("rationale", "Why this approach was chosen"),
                choice("result", "Outcome", ["UNSUCCESSFUL", "SUCCESSFUL"]),
                field("artifact", "Evidence / artifact reference"),
              ]}
              onSubmit={(v) => send("attempt", v)}
            />
          </Action>
          {s.attempts
            .filter((a) => a.ticketId === ticket._id)
            .map((a) => (
              <article className="support-record" key={a._id}>
                <Badge>{a.result}</Badge>
                <p>{a.approach}</p>
                <p className="muted">
                  {a.rationale}
                  <br />
                  Evidence: {a.artifact}
                  <br />
                  {a._id} ·{" "}
                  {a.verifiedBy ? `Verified by ${a.verifiedBy}` : "Unverified"}
                </p>
                {staff && a.result === "SUCCESSFUL" && !a.verifiedBy && (
                  <Form
                    fields={[field("reason", "How the recovery was verified")]}
                    submit="Verify recovery"
                    onSubmit={(v) =>
                      send("attempt-verify", { ...v, attemptId: a._id })
                    }
                  />
                )}
              </article>
            ))}
          {s.interventions
            .filter((i) => i.ticketId === ticket._id)
            .map((i) => (
              <article className="support-record" key={i._id}>
                <strong>
                  {i.kind} · {interventions[i.kind]}
                </strong>
                <p>{i.guidance}</p>
                <p>{i.outcome}</p>
                <small>
                  Planned {stamp(i.plannedAt)} · Actual {stamp(i.actualAt)} ·
                  Evidence {i.artifact} · Approved {i.approvedBy}
                </small>
              </article>
            ))}
          {(() => {
            const states = (transitions[ticket.state] || []).filter(
              (v) =>
                !["TRIAGED", "ASSIGNED", "RESPONDED"].includes(v) &&
                (staff || v === "IN_PROGRESS"),
            );
            return states.length ? (
              <Action title="Update state / reopen">
                <Form
                  fields={[
                    choice("state", "Next state", states),
                    field("reason", "Reason for transition"),
                  ]}
                  onSubmit={(v) => send("ticket-state", v)}
                />
              </Action>
            ) : null;
          })()}
          <Action title="Audit history">
            <ol className="support-history">
              {s.events
                .filter((e) => e.ticketId === ticket._id)
                .map((e) => (
                  <li key={e._id}>
                    <strong>{label(e.kind)}</strong> · {stamp(e.createdAt)} ·{" "}
                    {e.actorId}
                    <pre>{JSON.stringify(e.details, null, 2)}</pre>
                  </li>
                ))}
            </ol>
          </Action>
        </Panel>
      )}
    </>
  );
}
function Discovery({ data, act }) {
  const s = data.support,
    staff = data.user.role !== "GAMER",
    cc = data.user.role === "CENTRE_COMMAND";
  return (
    <>
      <p>
        Week 1 is descriptive discovery. AI and human guidance are allowed. No
        numeric baseline, student ranking, or confidence inference is recorded.
      </p>
      {cc && (
        <Action title="Publish challenge for every student">
          <Form
            fields={[
              field("prompt", "Unfamiliar technology / workplace challenge"),
            ]}
            initial={{ prompt: s.discovery.prompt }}
            onSubmit={(v) => act("support/discovery-prompt", v)}
          />
        </Action>
      )}
      {s.discovery.prompt ? (
        <blockquote className="support-copy">
          {s.discovery.prompt}
          <small>Prompt version {s.discovery.version}</small>
        </blockquote>
      ) : (
        <Empty title="Awaiting the Centre Command challenge" />
      )}
      {!staff && s.discovery.prompt && !s.baselines.length && (
        <Form
          fields={[
            field("priorExposure", "Prior exposure — self report"),
            field("activity", "What you did and observed"),
            field(
              "helpUsed",
              "Help requested, AI tools, and how you checked their guidance",
            ),
            field("reflection", "Your reasoning, reflection, and next steps"),
          ]}
          submit="Save descriptive baseline"
          onSubmit={(v) => act("support/baseline", v)}
        />
      )}
      {s.baselines.map((b) => (
        <article className="support-record" key={b._id}>
          <strong>
            {data.roster.find((p) => p._id === b.userId)?.name || b.userId}
          </strong>
          <small>
            {" "}
            · {b._id} · prompt v{b.promptVersion} · {stamp(b.createdAt)}
          </small>
          <p>{b.prompt}</p>
          {[
            "priorExposure",
            "activity",
            "helpUsed",
            "reflection",
            "reasoning",
            "commanderNotes",
          ].map(
            (k) =>
              b[k] && (
                <p className="support-copy" key={k}>
                  <strong>
                    {{
                      priorExposure: "Prior exposure",
                      helpUsed: "Help used",
                      commanderNotes: "Commander's comments",
                    }[k] || k}
                    :{" "}
                  </strong>
                  {b[k]}
                </p>
              ),
          )}
          {staff && (
            <Action title="Record narrative observation">
              <Form
                fields={[
                  field(
                    "reasoning",
                    "Observable reasoning, supported by evidence",
                  ),
                  field("notes", "Narrative comments and support needed"),
                ]}
                initial={{ reasoning: b.reasoning, notes: b.commanderNotes }}
                onSubmit={(v) =>
                  act("support/baseline-review", { ...v, baselineId: b._id })
                }
              />
            </Action>
          )}
        </article>
      ))}
    </>
  );
}
function Library({ data, act }) {
  const [query, setQuery] = useState("");
  const s = data.support,
    cc = data.user.role === "CENTRE_COMMAND";
  const entries = s.cases.filter((c) =>
    JSON.stringify(c.content).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <p>
        Reviewed learning cases include both unsuccessful approaches and
        successful recovery. Source tickets stay private.
      </p>
      <label className="support-search">
        Search permitted cases
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symptoms, causes, and approaches"
        />
      </label>
      {cc && (
        <Action title="Draft a case from a resolved ticket">
          <Form
            fields={[
              choice(
                "ticketId",
                "Source ticket",
                s.tickets
                  .filter((t) => ["RESOLVED", "CLOSED"].includes(t.state))
                  .map((t) => ({
                    value: t._id,
                    label: t.description.slice(0, 80),
                  })),
              ),
              ...caseFields,
            ]}
            submit="Save private draft"
            onSubmit={(v) => act("support/case-draft", v)}
          />
        </Action>
      )}
      {!entries.length && <Empty title="No reviewed cases match" />}
      {entries.map((c) => (
        <article className="support-record" key={c._id}>
          <h3>{c.content.title}</h3>
          <CaseComparison entry={c} data={data} act={act} />
          <Badge>
            {c.status || "PUBLISHED"} · v{c.version}
          </Badge>
          {[
            "cause",
            "unsuccessful",
            "successful",
            "applicability",
            "prerequisites",
          ].map((k) => (
            <p className="support-copy" key={k}>
              <strong>{label(k)}: </strong>
              {c.content[k]}
            </p>
          ))}
          {cc && (
            <>
              <p className="muted">
                Source ticket {c.ticketId}
                <br />
                Redaction evidence: {c.content.anonymisation}
                <br />
                Resolution evidence: {c.content.validationEvidence}
              </p>
              {c.status === "DRAFT" && (
                <Form
                  fields={[
                    field("reason", "Review notes"),
                    choice(
                      "redaction",
                      "Student, college, client and private details scrubbed?",
                      ["Review pending", "Confirmed"],
                    ),
                    choice(
                      "resolution",
                      "Resolution verified against source evidence?",
                      ["Review pending", "Confirmed"],
                    ),
                  ]}
                  submit="Approve and publish to cohort"
                  onSubmit={(v) =>
                    act("support/case-publish", {
                      caseId: c._id,
                      reason: v.reason,
                      redactionConfirmed: v.redaction === "Confirmed",
                      resolutionConfirmed: v.resolution === "Confirmed",
                    })
                  }
                />
              )}
              <Action title="Correct case (returns to private draft)">
                <Form
                  fields={[...caseFields, field("reason", "Correction reason")]}
                  initial={c.content}
                  onSubmit={(v) =>
                    act("support/case-revise", { ...v, caseId: c._id })
                  }
                />
              </Action>
              <Action title="Withdraw guidance">
                <Form
                  fields={[field("reason", "Withdrawal reason")]}
                  onSubmit={(v) =>
                    act("support/case-withdraw", { ...v, caseId: c._id })
                  }
                />
              </Action>
              <Action title="Version history">
                {s.caseVersions
                  .filter((v) => v.caseId === c._id)
                  .map((v) => (
                    <p key={v._id}>
                      Version {v.version} · {v.status} · {v.actorId} ·{" "}
                      {stamp(v.createdAt)}
                      <br />
                      {v.content.title}
                    </p>
                  ))}
              </Action>
            </>
          )}
        </article>
      ))}
    </>
  );
}
function Growth({ data, act }) {
  const mc = data.user.role === "MISSION_COMMANDER",
    cc = data.user.role === "CENTRE_COMMAND";
  return (
    <>
      <p>
        Growth and discovery stay separate from the 100-point competency rubric
        (40 / 20 / 25 / 15). Unobserved dimensions have no score. Any
        professional direction is a hypothesis requiring sufficient evidence.
      </p>
      {mc && (
        <Action title="Available evidence references">
          {[
            ...data.support.baselines.map((b) => ({
              id: b._id,
              userId: b.userId,
              kind: "Baseline",
            })),
            ...data.tasks.map((t) => ({
              id: t._id,
              userId: t.assigneeId,
              kind: "Task",
            })),
            ...data.journals.map((j) => ({
              id: j._id,
              userId: j.userId,
              kind: "Journal",
            })),
            ...data.support.tickets.map((t) => ({
              id: t._id,
              userId: t.createdBy,
              kind: "Assigned ticket",
            })),
          ].map((e) => (
            <p className="support-copy" key={e.id}>
              {e.kind} ·{" "}
              {data.roster.find((p) => p._id === e.userId)?.name || e.userId}
              <br />
              <code>{e.id}</code>
            </p>
          ))}
        </Action>
      )}
      {mc && (
        <Action title="Propose a growth report">
          <Form
            fields={[
              choice(
                "userId",
                "Student",
                data.roster.map((u) => ({ value: u._id, label: u.name })),
              ),
              ...[
                "strengths",
                "unobserved",
                "trajectory",
                "support",
                "pathway",
              ].map((k) =>
                field(
                  k,
                  {
                    unobserved: "Unobserved areas",
                    support: "Assistance history and support needed",
                    pathway:
                      "Possible professional directions / insufficient evidence",
                  }[k] || k,
                ),
              ),
              field(
                "comparison",
                "Evidence of comparable task complexity and opportunity",
              ),
              field(
                "evidenceIds",
                "Student evidence IDs, comma separated (baseline, assigned ticket, task, journal)",
              ),
              ...[
                "Technology application (40%)",
                "AI-enabled problem solving (20%)",
                "Professional collaboration (25%)",
                "Ownership and adaptability (15%)",
              ].map((title, i) => ({
                name: `score${i}`,
                label: `${title} — 0–100 or blank if unobserved`,
                type: "number",
                min: 0,
                max: 100,
                optional: true,
              })),
            ]}
            submit="Propose for CC validation"
            onSubmit={(v) =>
              act("support/growth-propose", {
                ...v,
                evidenceIds: v.evidenceIds
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                scores: [0, 1, 2, 3].map((i) =>
                  v[`score${i}`] === "" || Number.isNaN(v[`score${i}`])
                    ? null
                    : v[`score${i}`],
                ),
              })
            }
          />
        </Action>
      )}
      {!data.support.growth.length && (
        <Empty title="No growth reports available" />
      )}
      {data.support.growth.map((g) => (
        <article className="support-record" key={g._id}>
          <h3>
            {data.roster.find((p) => p._id === g.userId)?.name || g.userId}
          </h3>
          <Badge>{label(g.status)}</Badge>
          <p>
            Competency:{" "}
            {g.total == null
              ? "Incomplete observation — no total"
              : `${g.total.toFixed(1)} / 100`}{" "}
            · {g.rubricVersion}
          </p>
          <p>
            Dimension scores:{" "}
            {g.scores.map((v) => (v == null ? "Unobserved" : v)).join(" / ")}
          </p>
          {[
            "strengths",
            "unobserved",
            "trajectory",
            "support",
            "pathway",
            "comparison",
            "correction",
          ].map(
            (k) =>
              g[k] && (
                <p className="support-copy" key={k}>
                  <strong>{label(k)}: </strong>
                  {g[k]}
                </p>
              ),
          )}
          <p className="muted">Evidence: {g.evidenceIds.join(", ")}</p>
          {cc && g.status === "PROPOSED" && (
            <button
              className="btn primary"
              onClick={() =>
                act("support/growth-validate", { reportId: g._id })
              }
            >
              Validate report
            </button>
          )}
          {!mc && !cc && g.status === "VALIDATED" && (
            <Form
              fields={[
                field("reason", "Requested correction and supporting evidence"),
              ]}
              submit="Request correction"
              onSubmit={(v) =>
                act("support/growth-correction", { ...v, reportId: g._id })
              }
            />
          )}
        </article>
      ))}
      <p className="muted">
        Reports do not establish job qualification or guarantee employment.
        Asking for help, accent, or English fluency alone must not reduce
        scores.
      </p>
    </>
  );
}
function Operations({ data, act }) {
  const s = data.support;
  return (
    <>
      <p>
        Support metrics use the original first-response obligation. Unassigned
        wait is elapsed time and is reported separately from working-time SLA.
      </p>
      <EffortReport data={data} act={act} />
      <div className="detail-grid">
        <span>
          Unassigned backlog
          <strong>{s.tickets.filter((t) => !t.assignedAt).length}</strong>
        </span>
        <span>
          SLA breaches
          <strong>{s.tickets.filter((t) => t.breachedAt).length}</strong>
        </span>
        <span>
          Escalated
          <strong>{s.tickets.filter((t) => t.escalated).length}</strong>
        </span>
        <span>
          Published cases
          <strong>
            {s.cases.filter((c) => c.status === "PUBLISHED").length}
          </strong>
        </span>
      </div>
      {umbrellas.map((u) => (
        <p key={u}>
          {label(u)}: {s.tickets.filter((t) => t.category === u).length}
        </p>
      ))}
      <p>
        Attempt outcomes:{" "}
        {s.attempts.filter((a) => a.result === "SUCCESSFUL").length} successful
        / {s.attempts.filter((a) => a.result === "UNSUCCESSFUL").length}{" "}
        unsuccessful
      </p>
      <p>
        Verified recoveries: {s.attempts.filter((a) => a.verifiedBy).length}
      </p>
      <Action title="Configuration, moderation and report audit">
        {s.governance.map((e) => (
          <article className="support-record" key={e._id}>
            <strong>{label(e.kind)}</strong> · {stamp(e.createdAt)} ·{" "}
            {e.actorId}
            <pre className="support-copy">
              {JSON.stringify(e.details, null, 2)}
            </pre>
          </article>
        ))}
      </Action>
    </>
  );
}
function Configuration({ data, act }) {
  const c = data.support.calendar;
  return (
    <>
      <p>
        Configure the college's eight-hour simulated workday. SLA counts only
        this window, excludes closed days and holidays, and starts at
        assignment. Existing ticket deadlines preserve their assigned calendar.
      </p>
      <Form
        fields={[
          { name: "timeZone", label: "IANA timezone (e.g. Asia/Kolkata)" },
          { name: "start", label: "Working day start", type: "time" },
          {
            name: "weekdays",
            label: "Working weekdays, comma separated (0 Sunday … 6 Saturday)",
          },
          field(
            "holidays",
            "Closed holiday dates, comma separated YYYY-MM-DD",
            true,
          ),
        ]}
        initial={
          c
            ? {
                timeZone: c.timeZone,
                start: `${String(Math.floor(c.startMinute / 60)).padStart(2, "0")}:${String(c.startMinute % 60).padStart(2, "0")}`,
                weekdays: c.weekdays.join(","),
                holidays: c.holidays.join(","),
              }
            : {}
        }
        submit="Save working calendar"
        onSubmit={(v) => {
          const [h, m] = v.start.split(":").map(Number);
          return act("support/calendar", {
            calendar: {
              timeZone: v.timeZone,
              startMinute: h * 60 + m,
              weekdays: v.weekdays.split(",").map((x) => Number(x.trim())),
              holidays: v.holidays
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            },
          });
        }}
      />
    </>
  );
}
export default function SupportConsole({ screen, data, act, now }) {
  const [tab, setTab] = useState("");
  const gamer = data.user.role === "GAMER",
    cc = data.user.role === "CENTRE_COMMAND";
  const tabs = [];
  if (["dashboard", "team-room", "coaching"].includes(screen))
    tabs.push(["desk", "Help Desk", Desk]);
  if (
    ["before-you-board", "coaching"].includes(screen) ||
    (cc && screen === "setup")
  )
    tabs.push(["discovery", "Discovery baseline", Discovery]);
  if (
    screen === "team-room" ||
    (!gamer && screen === "coaching") ||
    (cc && screen === "dashboard")
  )
    tabs.push(["library", "Knowledge Library", Library]);
  if (
    (gamer && screen === "dashboard") ||
    (!gamer && ["coaching", "reports"].includes(screen))
  )
    tabs.push(["growth", "Growth & Discovery", Growth]);
  if (cc && screen === "setup")
    tabs.push(["calendar", "Working calendar", Configuration]);
  if (cc && screen === "reports")
    tabs.push(["operations", "Support operations", Operations]);
  if (!tabs.length || !data.support) return null;
  const active = tabs.find((t) => t[0] === tab) || tabs[0],
    Content = active[2];
  return (
    <div className="support-console">
      <Panel
        title="Campus support & discovery"
        kicker="CODEWILD / HUMAN-LED LEARNING"
      >
        <div className="tabs" role="tablist" aria-label="Support tools">
          {tabs.map(([id, title]) => (
            <button
              role="tab"
              aria-selected={active[0] === id}
              className={active[0] === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              {title}
            </button>
          ))}
        </div>
        <Content key={active[0]} data={data} act={act} now={now} />
        {cc && ["dashboard", "reports"].includes(screen) && (
          <a className="btn" href="/api/support/export">
            Export private support evidence (JSON)
          </a>
        )}
      </Panel>
    </div>
  );
}
