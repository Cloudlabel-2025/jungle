"use client";
import { Children, cloneElement, createContext, isValidElement, useContext, useId, useState } from "react";
import { ArrowUpRight, BookOpen, ChevronRight, Download, Inbox, Search, UserRound } from "lucide-react";
import PaginatedList from "./PaginatedList";
import { Panel, Form, Badge, Empty, Modal } from "./ui";
import { filterSupportTickets, supportQueueCounts, supportTicketClosed, supportTicketOverdue } from "@/lib/support-queue.js";
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
const label = (value) => value?.replaceAll("_", " ").toLowerCase().replace(/^\w/, letter => letter.toUpperCase());
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
      title: "Case title",
      cause: "Root cause",
      unsuccessful: "Unsuccessful approaches (redacted)",
      successful: "Successful recovery (redacted)",
      applicability: "When to use this guidance",
      prerequisites: "Prerequisites",
      anonymisation: "Redaction checklist and evidence (private)",
      validationEvidence: "Resolution validation evidence (private)",
    }[k] || k,
  ),
);

const SupportDialogContext = createContext(false);
function Action({ title, children }) {
  const dialog = useContext(SupportDialogContext);
  const [open, setOpen] = useState(false);
  if (dialog) return <>
    <button type="button" className="support-command" onClick={() => setOpen(true)}><span>{title}</span><ChevronRight size={16} aria-hidden="true" /></button>
    {open && <Modal title={title} close={() => setOpen(false)} portal wide>
      <div className="support-action-dialog">{Children.map(children, child => isValidElement(child) && child.type === Form
        ? cloneElement(child, { onSubmit: async values => { const result = await child.props.onSubmit(values); if (result !== false) setOpen(false); return result; } }) : child)}</div>
    </Modal>}
  </>;
  return (
    <details className="support-action">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
function RequestDetailSurface({ enhanced, ticket, close, children }) {
  if (enhanced) return <Modal title="Request details" kicker={label(ticket.state)} close={close} portal wide>
    <div className="support-ticket-detail support-request-dialog">{children}</div>
  </Modal>;
  return <Panel title="Ticket workspace" kicker={ticket._id}>{children}</Panel>;
}
function Desk({ data, act, now, paginated = false, enhanced = false, queueFilter = "open", setQueueFilter }) {
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const s = data.support,
    user = data.user,
    cc = user.role === "CENTRE_COMMAND",
    staff = user.role !== "GAMER";
  const ticket = s.tickets.find((t) => t._id === selected);
  const names = Object.fromEntries([...(data.roster || []), ...(s.operators || [])].map(person => [person._id, person.name]));
  const queue = enhanced ? filterSupportTickets(s.tickets, { query, filter: queueFilter, names }) : s.tickets;
  const send = (action, values) =>
    act(`support/${action}`, { ticketId: ticket?._id, ...values });
  return (
    <div className={enhanced ? "support-desk" : undefined}>
      {!enhanced && <p className="muted">
        Private support for you and the responsible command team. Asking for
        help carries no score penalty. Receipts and acknowledgements do not
        satisfy the response SLA.
      </p>}
      {enhanced && <div className="support-queue-toolbar">
        <label className="support-searchbox"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search support tickets" placeholder="Search requests, people or topics…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="support-queue-filters" role="group" aria-label="Filter ticket queue">
          {[["open", "Open"], ...(cc ? [["unassigned", "Unassigned"]] : []), ["overdue", "Overdue"], ["closed", "Resolved"], ["all", "All"]].map(([id, title]) => <button type="button" key={id} aria-pressed={queueFilter === id} onClick={() => setQueueFilter(id)}>{title}</button>)}
        </div>
      </div>}
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
        <p role="status" className={enhanced ? "support-calendar-note" : undefined}>
          Configure the cohort working calendar in Expedition setup before
          assigning tickets.
        </p>
      )}
      <div className={enhanced ? "support-desk-layout" : undefined}>
      <div className={enhanced ? "support-queue" : undefined}>
      {enhanced && <div className="support-queue-heading"><h3>Request queue</h3><span role="status" aria-live="polite">{queue.length} {queue.length === 1 ? "request" : "requests"}</span></div>}
      <PaginatedList key={enhanced ? `${query}:${queueFilter}` : "tickets"} items={queue} label="tickets" pageSize={enhanced ? 3 : 5} enabled={paginated} className="support-ticket-list">
        {tickets => <>
        {!queue.length && <Empty title={s.tickets.length ? "No matching requests" : "No support requests yet"}>
          {enhanced && <><p>{s.tickets.length ? "Try another search or view all requests." : "Requests from your campus will appear here when someone needs help."}</p>{s.tickets.length > 0 && <button type="button" className="btn small" onClick={() => { setQuery(""); setQueueFilter("all"); }}>Clear filters</button>}</>}
        </Empty>}
        {tickets.map((t) => (
          <button
            key={t._id}
            className={`support-ticket ${selected === t._id ? "selected" : ""}`}
            type="button"
            aria-pressed={selected === t._id}
            aria-haspopup={enhanced ? "dialog" : undefined}
            onClick={() => setSelected(t._id)}
          >
            <span>
              <Badge tone={supportTicketOverdue(t) ? "red" : ""}>
                {label(t.state)}
              </Badge>{" "}
              {enhanced && supportTicketOverdue(t) && <Badge tone="red">Overdue</Badge>}
              {t.escalated && <Badge tone="red">Escalated</Badge>}
            </span>
            {enhanced && <span className="support-ticket-person"><UserRound size={14} aria-hidden="true" />{names[t.createdBy] || "Campus request"}<ChevronRight size={16} aria-hidden="true" /></span>}
            <strong>{t.description.slice(0, 110)}</strong>
            {!enhanced && <small>
              {t.category ? label(t.category) : "Awaiting CC triage"} ·{" "}
              {t.assignedAt
                ? `Response due ${stamp(t.dueAt)}`
                : `Unassigned: ${t.unassignedWaitMinutes} elapsed min`}{" "}
              {t.breachedAt ? " · SLA breached" : ""}
            </small>}
            {enhanced && <span className="support-ticket-owner">Owner: {names[t.assignedTo] || "Not assigned"}</span>}
          </button>
        ))}
        </>}
      </PaginatedList>
      </div>
      <div>
      {ticket && (
        <RequestDetailSurface enhanced={enhanced} ticket={ticket} close={() => setSelected("")}>
          <p className="support-copy">{ticket.description}</p>
          {enhanced ? <Action title="Investigation effort & comparisons"><EffortWorkspace key={ticket._id} ticket={ticket} data={data} act={act} /></Action> : <EffortWorkspace
            key={ticket._id}
            ticket={ticket}
            data={data}
            act={act}
          />}
          {enhanced ? <dl className="support-request-facts">
            <div><dt>Requested by</dt><dd>{names[ticket.createdBy] || "Campus member"}</dd></div>
            <div><dt>Assigned owner</dt><dd>{names[ticket.assignedTo] || "Unassigned"}</dd></div>
            <div><dt>Created</dt><dd>{stamp(ticket.createdAt)}</dd></div>
            <div><dt>Response due</dt><dd>{ticket.dueAt ? stamp(ticket.dueAt) : "Assign an owner first"}</dd></div>
            <div><dt>First response</dt><dd>{ticket.firstResponseAt ? stamp(ticket.firstResponseAt) : "Awaiting response"}</dd></div>
            <div><dt>Category</dt><dd>{ticket.category ? label(ticket.category) : "Needs classification"}</dd></div>
          </dl> : <p className="muted">
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
          </p>}
          {ticket.breachedAt && (
            <p className="danger-text">
              SLA breach recorded {stamp(ticket.breachedAt)}. The breach remains
              in the history.
            </p>
          )}
          <div className={enhanced ? "support-request-actions" : undefined} role={enhanced ? "group" : undefined} aria-label={enhanced ? "Request actions" : undefined}>
          {cc && (
            <>
              <Action title="Classify request">
                <Form
                  fields={[
                    choice("category", "Support category", umbrellas),
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
              <Action title="Assign an owner">
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
              <Action title="Respond to request">
                <Form
                  fields={[
                    field(
                      "guidance",
                      "Meaningful guidance, resolution, or concrete next action",
                    ),
                  ]}
                    submit="Save response"
                  onSubmit={(v) => send("ticket-response", v)}
                />
              </Action>
              <Action title="Record a support session">
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
              <Action title="Escalate request">
                <Form
                  fields={[field("reason", "Escalation reason")]}
                  onSubmit={(v) => send("ticket-escalate", v)}
                />
              </Action>
            </>
          )}
          <Action title="Record a recovery attempt">
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
              <Action title="Update request status">
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
          </div>
        </RequestDetailSurface>
      )}
      </div>
      </div>
    </div>
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
function Library({ data, act, paginated = false, enhanced = false }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const s = data.support,
    cc = data.user.role === "CENTRE_COMMAND";
  const entries = s.cases.filter((c) =>
    (status === "all" || (c.status || "PUBLISHED") === status) && JSON.stringify(c.content).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selectedCase = s.cases.find(entry => entry._id === selected);
  const resolvedTickets = s.tickets.filter(ticket => supportTicketClosed(ticket));
  return (
    <div className={enhanced ? "support-library" : undefined}>
      <p className="support-library-intro">Find verified approaches from resolved requests. Drafts stay private until reviewed and published.</p>
      <label className={enhanced ? "support-searchbox" : "support-search"}>
        {enhanced ? <Search size={17} aria-hidden="true" /> : "Search permitted cases"}
        <input type="search" aria-label="Search knowledge cases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symptoms, causes, and approaches"
        />
      </label>
      {enhanced && <div className="support-library-tools">{cc ? <div className="support-queue-filters" role="group" aria-label="Filter knowledge cases">{[["all", "All cases"], ["PUBLISHED", "Published"], ["DRAFT", "Drafts"]].map(([id, title]) => <button type="button" key={id} aria-pressed={status === id} onClick={() => setStatus(id)}>{title}</button>)}</div> : <span>Published guidance</span>}<span role="status" aria-live="polite">{entries.length} {entries.length === 1 ? "case" : "cases"}</span></div>}
      {cc && (resolvedTickets.length > 0 ? (
        <Action title="Draft a case from a resolved ticket">
          <Form
            fields={[
              choice(
                "ticketId",
                "Source ticket",
                resolvedTickets
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
      ) : <p className="support-library-hint">Resolve a support request to create a learning case from its evidence.</p>)}
      {!entries.length && <Empty title={s.cases.length ? "No matching cases" : "Build your campus knowledge library"}><p>{s.cases.length ? "Try a different phrase or view all cases." : "Reviewed solutions will appear here as your team resolves requests."}</p>{s.cases.length > 0 && <button type="button" className="btn small" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button>}</Empty>}
      <PaginatedList key={`${query}:${status}`} items={entries} label="cases" pageSize={enhanced ? 3 : 4} enabled={paginated} className={enhanced ? "support-case-grid" : undefined}>{rows => rows.map(c => enhanced ? (
        <button type="button" className="support-case-preview" key={c._id} onClick={() => setSelected(c._id)}>
          <span className="support-case-status"><BookOpen size={18} aria-hidden="true" /><Badge>{c.status || "PUBLISHED"}</Badge></span>
          <strong>{c.content.title}</strong><span className="support-case-excerpt">{c.content.cause || c.content.applicability || "Open this case to review its approach and evidence."}</span>
          <span className="support-case-open">Read case <ArrowUpRight size={16} aria-hidden="true" /></span>
        </button>
      ) : <KnowledgeCaseDetails key={c._id} entry={c} data={data} act={act} />)}</PaginatedList>
      {enhanced && selectedCase && <Modal title={selectedCase.content.title} close={() => setSelected(null)} portal wide><div className="support-case-dialog"><KnowledgeCaseDetails entry={selectedCase} data={data} act={act} showTitle={false} /></div></Modal>}
    </div>
  );
}
function KnowledgeCaseDetails({ entry: c, data, act, showTitle = true }) {
  const s = data.support, cc = data.user.role === "CENTRE_COMMAND";
  return <article className="support-record">
          {showTitle && <h3>{c.content.title}</h3>}
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
              <strong>{{ cause: "Root cause", unsuccessful: "What did not work", successful: "Verified solution", applicability: "When to use this", prerequisites: "Before you start" }[k]}: </strong>
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
        </article>;
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
        guided={false}
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
export { Desk as SupportDesk, Library as SupportLibrary };

export default function SupportConsole({ screen, data, act, now, paginated = false }) {
  const [tab, setTab] = useState("");
  const [queueFilter, setQueueFilter] = useState("open");
  const tabId = useId();
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
    (!gamer && screen === "dashboard")
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
  const enhanced = !gamer && screen === "dashboard";
  const counts = supportQueueCounts(data.support.tickets);
  const active = tabs.find((t) => t[0] === tab) || tabs[0],
    Content = active[2];
  function tabKey(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault(); buttons[next].click(); buttons[next].focus();
  }
  return (
    <SupportDialogContext.Provider value={enhanced}>
    <div className={`support-console ${enhanced ? "support-console-enhanced" : ""}`}>
      <Panel
        title="Campus support & discovery"
        kicker={enhanced ? "CAMPUS CARE / KNOWLEDGE" : "VOW / HUMAN-LED LEARNING"}
        action={enhanced && cc ? <a href="/api/support/export" className="support-export"><Download size={16} aria-hidden="true" /><span>Download PDF</span></a> : undefined}
      >
        {enhanced && <>
          <div className="support-summary">
            {[["open", "Open requests", counts.open], ...(cc ? [["unassigned", "Need an owner", counts.unassigned]] : []), ["overdue", "Overdue response", counts.overdue], ["library", "Knowledge cases", data.support.cases.length]].map(([id, title, count]) => <button key={id} type="button" onClick={() => { setTab(id === "library" ? "library" : "desk"); if (id !== "library") setQueueFilter(id); }}><strong>{count}</strong><span>{title}</span></button>)}
          </div>
        </>}
        <div className={`tabs ${enhanced ? "support-tabs" : ""}`} role="tablist" aria-label="Support tools" onKeyDown={tabKey}>
          {tabs.map(([id, title]) => (
            <button
              role="tab"
              aria-selected={active[0] === id}
              id={`${tabId}-${id}`}
              aria-controls={`${tabId}-content`}
              tabIndex={active[0] === id ? 0 : -1}
              className={active[0] === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              {enhanced && (id === "desk" ? <Inbox size={18} aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />)}{title}
            </button>
          ))}
        </div>
        <div className={enhanced ? "support-tab-content" : undefined} role="tabpanel" id={`${tabId}-content`} aria-labelledby={`${tabId}-${active[0]}`} tabIndex={0}>
          <Content key={active[0]} data={data} act={act} now={now} paginated={paginated || enhanced} enhanced={enhanced} queueFilter={queueFilter} setQueueFilter={setQueueFilter} />
        </div>
        {cc && !enhanced && ["dashboard", "reports"].includes(screen) && (
          <a className="btn" href="/api/support/export">
            Download support report (PDF)
          </a>
        )}
      </Panel>
    </div>
    </SupportDialogContext.Provider>
  );
}
