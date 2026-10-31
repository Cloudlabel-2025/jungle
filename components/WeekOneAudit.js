"use client";
import { useState, useEffect } from "react";
import { WeekPanel, weekTime } from "./WeekOneShared";

export default function WeekOneAudit() {
  const [kind, setKind] = useState(""),
    [events, setEvents] = useState([]),
    [cursor, setCursor] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(reset = false) {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        ...(kind ? { kind } : {}),
        ...(!reset && cursor ? { cursor } : {}),
      });
      const response = await fetch(`/api/week1/audit?${params}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEvents((old) =>
        reset
          ? result.events
          : [
              ...old,
              ...result.events.filter((e) => !old.some((v) => v._id === e._id)),
            ],
      );
      setCursor(result.nextCursor);
      setError("");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load(true);
  }, [kind]);
  return (
    <WeekPanel title="Rules and decision audit">
      <label>
        Audit category
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {[
            ["", "All decisions"],
            ["RULE_VERSION_PUBLISHED", "Rules versions"],
            ["PROFESSIONAL_EXCEPTION_DECIDED", "Professional exceptions"],
            ["ASSESSMENT_IMPORTED", "AI assessment imports"],
            ["HUMAN_ASSESSMENT_VERIFIED", "Human grading reviews"],
            ["CC_RESULTS_LOCKED_AND_PUBLISHED", "Result publication"],
            ["TEAM_ADJUSTMENT_DECIDED", "Allocation decisions"],
            ["COHORT_ACCOUNTS_PROVISIONED", "Account provisioning"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {events.map((event) => (
        <details key={event._id}>
          <summary>
            {weekTime(event.createdAt)} · {event.kind.replaceAll("_", " ")}
          </summary>
          <p className="muted">
            Actor: {event.actorId} · Audit event: {event._id}
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            {JSON.stringify(event.details, null, 2)}
          </pre>
        </details>
      ))}
      <div className="button-row">
        <button className="btn" disabled={busy} onClick={() => load(true)}>
          Refresh decisions
        </button>
        {cursor && (
          <button className="btn" disabled={busy} onClick={() => load()}>
            Load earlier decisions
          </button>
        )}
      </div>
    </WeekPanel>
  );
}
