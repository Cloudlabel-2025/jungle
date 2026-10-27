"use client";
import { useRef, useState } from "react";
import { Form, Badge } from "./ui";
import {
  activeMinutes,
  durationLabel,
  comparisonTotals,
} from "@/lib/effort-rules.js";

const field = (name, label) => ({ name, label, type: "textarea" });
const select = (name, label, values) => ({
  name,
  label,
  options: values.map((v) =>
    typeof v === "string" ? { value: v, label: v } : v,
  ),
});
const kind = select("sessionKind", "Period type", [
  "ACTIVE",
  "WAITING",
  "BLOCKED",
]);
const interval = [
  field(
    "startedAt",
    "Start (ISO timestamp with timezone, e.g. 2026-10-26T09:00:00+05:30)",
  ),
  field("endedAt", "End (ISO timestamp with timezone)"),
  kind,
  field("reason", "Activity / correction reason and provenance"),
];
const context = [
  field("rationale", "Why these problems are technically comparable"),
  field("technology", "Technology and version"),
  field("difficulty", "Complexity, difficulty and opportunity"),
  field("environment", "Environment and context"),
  field("aiUse", "AI assistance used on both tasks"),
  field("humanGuidance", "Human guidance available on both tasks"),
  field("evidence", "Evidence references for comparability"),
];
function Action({ title, children }) {
  return (
    <details className="support-action">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
// Preserve keys on a failed/network-ambiguous retry of the same payload.
function useWrite(act) {
  const pending = useRef(new Map());
  return async (action, values) => {
    const input = JSON.stringify({ action, values });
    if (!pending.current.has(input))
      pending.current.set(input, crypto.randomUUID());
    const result = await act(`support/${action}`, {
      ...values,
      idempotencyKey: pending.current.get(input),
    });
    if (result !== false) pending.current.delete(input);
    return result;
  };
}
export function EffortWorkspace({ ticket, data, act }) {
  const write = useWrite(act);
  const e = data.support.effort;
  if (!e) return null;
  const sessions = e.sessions.filter((s) => s.ticketId === ticket._id);
  const timeZone = data.support.calendar?.timeZone || "UTC";
  const stamp = (value) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          timeZone,
          timeZoneName: "short",
        })
      : "Running";
  const candidates = data.support.tickets.filter(
    (t) => new Date(t.createdAt) < new Date(ticket.createdAt),
  );
  const comparisons = e.comparisons.filter(
    (r) => r.originalTicketId === ticket._id || r.repeatTicketId === ticket._id,
  );
  return (
    <section aria-label="Investigation effort and comparable tasks">
      <h3>
        Investigation effort · {durationLabel(activeMinutes(sessions))} active
      </h3>
      <p className="muted">
        Completed active sessions count toward effort. Waiting and blocked
        periods are excluded. Times shown in {timeZone}; manual entries require
        a dated interval to prevent overlap across tickets.
      </p>
      <Action title="Start a timer">
        <Form
          fields={[kind, field("reason", "Activity and provenance")]}
          submit="Start timer"
          onSubmit={(v) =>
            write("effort-start", { ...v, ticketId: ticket._id })
          }
        />
      </Action>
      <Action title="Record a completed period">
        <Form
          fields={interval}
          submit="Save period"
          onSubmit={(v) =>
            write("effort-create", { ...v, ticketId: ticket._id })
          }
        />
      </Action>
      {sessions.map((s) => (
        <article className="support-record" key={s._id}>
          <Badge>
            {s.sessionKind} · {s.origin} · v{s.version}
          </Badge>
          <p>
            {stamp(s.startedAt)} → {stamp(s.endedAt)} ·{" "}
            {s.endedAt
              ? durationLabel(
                  (new Date(s.endedAt) - new Date(s.startedAt)) / 60000,
                )
              : "Stop timer to include elapsed effort"}
          </p>
          <p>
            {s.reason} · Submitted by {s.submittedBy}
          </p>
          {!s.endedAt && (
            <Form
              fields={[
                field("reason", "What was investigated during this period"),
              ]}
              submit="Stop timer"
              onSubmit={(v) =>
                write("effort-stop", {
                  ...v,
                  ticketId: ticket._id,
                  sessionId: s._id,
                  version: s.version,
                })
              }
            />
          )}
          <Action title="Correct this period">
            <Form
              fields={interval}
              initial={{
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                sessionKind: s.sessionKind,
              }}
              onSubmit={(v) =>
                write("effort-update", {
                  ...v,
                  ticketId: ticket._id,
                  sessionId: s._id,
                  version: s.version,
                })
              }
            />
          </Action>
          <Action title="Remove an incorrect period">
            <Form
              fields={[field("reason", "Removal reason (history is retained)")]}
              submit="Remove period"
              onSubmit={(v) =>
                write("effort-delete", {
                  ...v,
                  ticketId: ticket._id,
                  sessionId: s._id,
                  version: s.version,
                })
              }
            />
          </Action>
        </article>
      ))}
      {!!candidates.length && (
        <Action title="Link this repeat to an earlier comparable ticket">
          <Form
            fields={[
              select(
                "originalTicketId",
                "Original ticket",
                candidates.map((t) => ({
                  value: t._id,
                  label: t.description.slice(0, 100),
                })),
              ),
              ...context,
            ]}
            submit="Propose comparison"
            onSubmit={(v) =>
              write("comparison-link", { ...v, repeatTicketId: ticket._id })
            }
          />
        </Action>
      )}
      {comparisons.map((r) => (
        <article className="support-record" key={r._id}>
          <h4>
            {r.status === "VERIFIED"
              ? "Verified difference between comparable tasks"
              : "Candidate difference — human review required"}
            : {durationLabel(r.deltaMinutes, true)}
          </h4>
          <Badge>
            {r.status} · v{r.version}
          </Badge>
          <p>
            Original {r.originalTicketId}: {durationLabel(r.originalMinutes)} ·
            Repeat {r.repeatTicketId}: {durationLabel(r.repeatMinutes)}
          </p>
          {context.map((f) => (
            <p key={f.name}>
              <strong>{f.label}: </strong>
              {r[f.name]}
            </p>
          ))}
          {r.reviewerId && (
            <p>
              Reviewer {r.reviewerId} · {stamp(r.reviewedAt)}
            </p>
          )}
          <p>{r.reviewReason}</p>
          {e.canReview && (
            <Action title="Review comparability">
              <Form
                fields={[
                  select("status", "Decision", ["VERIFIED", "REJECTED"]),
                  select(
                    "confirmed",
                    "Comparable complexity and assistance verified?",
                    ["NO", "YES"],
                  ),
                  field(
                    "reason",
                    "Review rationale / rejection or override reason",
                  ),
                ]}
                onSubmit={(v) =>
                  write("comparison-review", {
                    comparisonId: r._id,
                    version: r.version,
                    status: v.status,
                    comparabilityConfirmed: v.confirmed === "YES",
                    reason: v.reason,
                  })
                }
              />
            </Action>
          )}
          {(data.user.role === "CENTRE_COMMAND" ||
            (r.proposedBy === data.user._id && r.status === "PENDING")) && (
            <Action title="Unlink candidate">
              <Form
                fields={[field("reason", "Unlink reason")]}
                onSubmit={(v) =>
                  write("comparison-unlink", {
                    ...v,
                    comparisonId: r._id,
                    version: r.version,
                  })
                }
              />
            </Action>
          )}
        </article>
      ))}
    </section>
  );
}
export function EffortReport({ data, act }) {
  const write = useWrite(act);
  const [technology, setTechnology] = useState("");
  const [umbrella, setUmbrella] = useState("");
  const e = data.support.effort;
  if (!e) return null;
  const rows = e.comparisons.filter(
    (r) =>
      r.technology.toLowerCase().includes(technology.toLowerCase()) &&
      (!umbrella ||
        data.support.tickets.find((t) => t._id === r.repeatTicketId)
          ?.category === umbrella),
  );
  const totals = comparisonTotals(rows);
  return (
    <section aria-label="Comparable task differences">
      <h3>Verified difference between comparable tasks</h3>
      <p>
        Prior experience, solution reuse, AI assistance, coaching, workload and
        difficulty can affect effort. These records do not establish a causal
        productivity increase and do not affect scores.
      </p>
      <label>
        Technical area
        <input
          value={technology}
          onChange={(e) => setTechnology(e.target.value)}
        />
      </label>
      <label>
        Repeat ticket umbrella
        <select value={umbrella} onChange={(e) => setUmbrella(e.target.value)}>
          <option value="">All umbrellas</option>
          {["EXPERIENCE", "COGNITION", "EXPERT_INTERVENTION_NEEDED"].map(
            (u) => (
              <option key={u}>{u}</option>
            ),
          )}
        </select>
      </label>
      <p>
        {totals.sampleCount} verified comparisons · Signed total{" "}
        {durationLabel(totals.deltaMinutes, true)} · {totals.pendingCount}{" "}
        pending · {totals.rejectedCount} rejected
      </p>
      {rows.map((r) => (
        <p key={r._id}>
          {r.technology} · {r.status} · {durationLabel(r.deltaMinutes, true)} ·{" "}
          {r._id}
        </p>
      ))}
      <a
        className="btn"
        href={`/api/support/comparisons/export?${new URLSearchParams({ technology, umbrella })}`}
      >
        Export verified comparisons (JSON)
      </a>
      {data.user.role === "CENTRE_COMMAND" && (
        <Action title="Delegate MC comparison review">
          <p>
            Only selected MCs may review assigned tickets. Leave the IDs blank
            to revoke all delegation.
          </p>
          <Form
            fields={[
              {
                ...field("reviewerIds", "MC user IDs, comma separated"),
                optional: true,
              },
              field("reason", "Delegation policy reason"),
            ]}
            initial={{ reviewerIds: e.reviewerIds.join(", ") }}
            onSubmit={(v) =>
              write("comparison-policy", {
                reviewerIds: v.reviewerIds
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                reason: v.reason,
              })
            }
          />
        </Action>
      )}
    </section>
  );
}
export function CaseComparison({ entry, data, act }) {
  const write = useWrite(act);
  const candidates =
    data.support.effort?.comparisons.filter(
      (r) =>
        r.status === "VERIFIED" &&
        [r.originalTicketId, r.repeatTicketId].includes(entry.ticketId),
    ) || [];
  return (
    <>
      {entry.comparisonSummary && (
        <p>
          {entry.comparisonSummary.label}:{" "}
          {durationLabel(entry.comparisonSummary.deltaMinutes, true)}. Reviewed
          descriptive evidence; no causal productivity claim.
        </p>
      )}
      {data.user.role === "CENTRE_COMMAND" &&
        entry.status === "DRAFT" &&
        !!candidates.length && (
          <Action title="Attach a reviewed comparison summary">
            <Form
              fields={[
                select(
                  "comparisonId",
                  "Verified comparison",
                  candidates.map((r) => ({
                    value: r._id,
                    label: `${r.technology}: ${durationLabel(r.deltaMinutes, true)}`,
                  })),
                ),
                field(
                  "reason",
                  "Source validation and redaction review reason",
                ),
              ]}
              onSubmit={(v) =>
                write("case-comparison", { ...v, caseId: entry._id })
              }
            />
          </Action>
        )}
    </>
  );
}
