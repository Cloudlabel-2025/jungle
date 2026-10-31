"use client";
import { useState } from "react";
import { Panel, Form, Badge } from "./ui";
export const runProgram = (act, action, body = {}) =>
  act(`week1/program/${action}`, body);
export const weekTime = (date) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Pending";
export const textField = (name, label, optional = false) => ({
  name,
  label,
  type: "textarea",
  optional,
});
export function WeekPanel({ children, bodyStyle = {}, ...props }) {
  return (
    <Panel {...props}>
      <div
        style={{
          padding: "18px 22px",
          display: "grid",
          gap: 16,
          minWidth: 0,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </Panel>
  );
}
export function WeekForm({ action, act, values = {}, ...props }) {
  return (
    <Form
      {...props}
      onSubmit={(body) => {
        for (const key of [
          "approve",
          "resolve",
          "allowed",
          "genuine",
          "publishAnonymously",
          "unavailable",
        ])
          if (key in body) body[key] = body[key] === "true";
        return runProgram(act, action, { ...values, ...body });
      }}
    />
  );
}
export function EmptyWeek({
  children = "Your Mission Commander will open this activity when it is ready.",
}) {
  return (
    <WeekPanel title="Preparing your next mission">
      <p className="muted">{children}</p>
    </WeekPanel>
  );
}
export function Evidence({ value }) {
  return (
    <dl>
      {Object.entries(value || {}).map(([key, answer]) => (
        <div className="history-entry" key={key}>
          <dt>
            <strong>{key}</strong>
          </dt>
          <dd
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              marginLeft: 0,
            }}
          >
            {Array.isArray(answer)
              ? answer.join(" → ")
              : String(answer ?? "Unanswered")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function JsonImport({ title, onImport }) {
  const [error, setError] = useState("");
  return (
    <label>
      {title}
      <input
        type="file"
        accept="application/json,.json"
        onChange={async (event) => {
          try {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 90000)
              throw new Error("Choose a JSON file smaller than 90 KB.");
            const value = JSON.parse(await file.text());
            await onImport(value);
            setError("");
          } catch (error) {
            setError(error.message);
          }
        }}
      />
      {error && (
        <span role="alert" className="danger-text">
          {error}
        </span>
      )}
    </label>
  );
}
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ResultCard({ row, weights }) {
  return (
    <WeekPanel
      title={row.name || "My results"}
      kicker="PRIVATE WEEK 1 RESULT"
      action={<Badge>{row.status}</Badge>}
    >
      {row.total === null ? (
        <p>
          Assessment evidence is pending. Missing marks have not been treated as
          zero.
        </p>
      ) : (
        <>
          <h3>{row.total.toFixed(2)} / 100</h3>
          {row.distinction && (
            <Badge tone="lime">EXCEPTIONAL ACHIEVEMENT</Badge>
          )}
        </>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(row.parts).map(([key, percent]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>
                  {percent === null
                    ? "Pending"
                    : `${((percent / 100) * weights[key]).toFixed(2)} / ${weights[key]}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {row.comparison.status === "READY" ? (
        <p>
          Aligned Day 1: {row.comparison.before.toFixed(2)}%. Day 5:{" "}
          {row.comparison.after.toFixed(2)}%. Difference:{" "}
          {row.comparison.delta.toFixed(2)} percentage points. This comparison
          uses the same four-criterion rubric and does not establish a causal
          learning effect.
        </p>
      ) : (
        <p className="muted">
          Day 1 comparison: pending evidence. Your current Day 5 result is
          preserved.
        </p>
      )}
      {row.baseline && (
        <p className="muted">
          Original five-criterion baseline: {row.baseline.total.toFixed(2)} /{" "}
          {row.baseline.maximum}. This baseline is preserved separately.
        </p>
      )}
      <details>
        <summary>Professional evidence and deductions</summary>
        {row.professional.ledger.map((d) => (
          <div key={d.day} className="history-entry">
            <strong>
              Day {d.day}:{" "}
              {d.score === null
                ? "Not Assessed — factual review required"
                : `${d.score.toFixed(2)} / 2`}
              {d.penalty ? `, deduction ${d.penalty}` : ""}
            </strong>
            {d.events.map((e) => (
              <p key={e.id}>
                {e.id}: {e.met ? "Met" : "Not met"}
              </p>
            ))}
          </div>
        ))}
      </details>
      <details>
        <summary>Capability evidence</summary>
        {row.capabilities.map((area) => (
          <div className="history-entry" key={area.area}>
            <strong>
              {area.area}:{" "}
              {area.percent === null
                ? "Not Assessed"
                : `${area.percent.toFixed(2)}%`}
            </strong>
            {area.criteria.map((c) => (
              <p key={c.key}>
                {c.name}:{" "}
                {c.percent === null
                  ? "Not Assessed"
                  : `${c.percent.toFixed(2)}% (${c.observations} observations)`}
              </p>
            ))}
          </div>
        ))}
      </details>
      {row.specialistRecommendations?.map((r) => (
        <p key={r.area}>
          {r.message} {r.status.replaceAll("_", " ")}
        </p>
      ))}
    </WeekPanel>
  );
}
