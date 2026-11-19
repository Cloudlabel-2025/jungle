"use client";
import fetch from "@/lib/college-fetch.js";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { Modal } from "./ui";

const labels = {
  FULL_DAY: "Full day",
  HALF_DAY: "Half day",
  PRESENT: "Full day (legacy correction)",
  LATE: "Full day (legacy correction)",
  IN_PROGRESS: "In progress",
  NEEDS_REVIEW: "Needs review",
  ABSENT: "Absent",
  EXCUSED: "Excused",
  PENDING: "Not checked in",
  DAY_OFF: "Day off",
  NOT_TRACKED: "Not tracked",
  DEFAULT: "Use automatic result",
};
const adjacent = (day, offset) =>
  new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);
export default function AttendanceRegister() {
  const [data, setData] = useState(null),
    [day, setDay] = useState(""),
    [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null),
    [status, setStatus] = useState("FULL_DAY"),
    [reason, setReason] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await fetch(
          `/api/attendance/register${day ? `?day=${encodeURIComponent(day)}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const value = await response.json();
        if (!response.ok)
          throw Error(value.error || "Could not load attendance.");
        if (!controller.signal.aborted) setData(value);
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [day, reload]);
  async function save(event) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/attendance/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.userId,
          day: data.day,
          status,
          reason,
          version: selected.version,
        }),
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error || "Could not save the correction.");
      setMessage(`Attendance updated for ${selected.name}.`);
      setSelected(null);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const time = (value) =>
    value
      ? new Date(value).toLocaleTimeString("en-IN", {
          timeZone: data.timeZone,
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const changeDay = (value) => {
    if (value) {
      setDay(value);
      setMessage("");
      setSelected(null);
    }
  };
  if (!data)
    return (
      <section className="cohort-calendar">
        <h1>Attendance</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Opening attendance…"}
        </p>
        {error && (
          <button className="btn" onClick={() => setReload((n) => n + 1)}>
            Try again
          </button>
        )}
      </section>
    );
  return (
    <section
      className="cohort-calendar attendance-register"
      aria-label="Player attendance"
      aria-busy={loading || saving}
    >
      <header className="calendar-page-heading">
        <div>
          <span className="calendar-eyebrow">
            <ShieldCheck size={16} /> PLAYER ATTENDANCE
          </span>
          <h1>Every arrival counts.</h1>
          <p>
            {data.cohortName} · {data.hours.startTime}–{data.hours.endTime} ·{" "}
            {data.timeZone}
          </p>
        </div>
        <div className="attendance-percentage">
          <strong>
            {data.percentage === null ? "—" : `${data.percentage}%`}
          </strong>
          <span>Attendance for this date</span>
        </div>
      </header>
      <p className="attendance-policy-note">
        <Clock3 size={17} /> Full day: at least{" "}
        {data.minimums.fullDayMinutes / 60} h. Half day: at least{" "}
        {data.minimums.halfDayMinutes / 60} h. Only official session time
        counts; results are final at day end. Half days earn 50% credit. Days
        off and excused absences are excluded. Tracking{" "}
        {data.trackingStartDay > data.today ? "begins" : "began"}{" "}
        {data.trackingStartDay}.
      </p>
      {error && !selected && (
        <p className="calendar-feedback is-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="calendar-feedback" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      <div className="attendance-counts">
        {[
          ["Full day", data.counts.FULL_DAY],
          ["Half day", data.counts.HALF_DAY],
          ["Absent", data.counts.ABSENT],
          ["In progress", data.counts.PENDING + data.counts.IN_PROGRESS],
          ["Excused / day off", data.counts.EXCUSED + data.counts.DAY_OFF],
          ["Needs review", data.counts.NEEDS_REVIEW],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div className="attendance-day-toolbar">
        <div>
          <CalendarDays size={20} />
          <button
            className="icon-btn"
            aria-label="Previous attendance date"
            disabled={loading}
            onClick={() => changeDay(adjacent(data.day, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <label>
            Attendance date
            <input
              aria-label="Attendance date"
              type="date"
              value={day || data.day}
              max={data.today}
              disabled={loading}
              onChange={(e) => changeDay(e.target.value)}
            />
          </label>
          <button
            className="icon-btn"
            aria-label="Next attendance date"
            disabled={loading || data.day >= data.today}
            onClick={() => changeDay(adjacent(data.day, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div>
          <button
            className="btn"
            disabled={loading}
            onClick={() => changeDay(data.today)}
          >
            Today
          </button>
          <button
            className="btn"
            disabled={loading}
            onClick={() => setReload((n) => n + 1)}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>
      {!data.calendar.working && (
        <p className="calendar-feedback">
          {data.calendar.label}: this date does not count towards absence.
        </p>
      )}
      <div
        className="attendance-table"
        role="table"
        aria-label="Daily player attendance"
      >
        <div className="attendance-table-row attendance-table-head" role="row">
          <span role="columnheader">Player</span>
          <span role="columnheader">Result</span>
          <span role="columnheader">Clock in</span>
          <span role="columnheader">Clock out</span>
          <span role="columnheader">Action</span>
        </div>
        {data.rows.map((row) => (
          <div className="attendance-table-row" role="row" key={row.userId}>
            <div role="cell">
              <strong>{row.name}</strong>
              <small>
                {row.team}
                {!row.active ? " · Inactive" : ""}
              </small>
            </div>
            <div role="cell">
              <span
                className={`attendance-badge status-${row.status.toLowerCase()}`}
              >
                {labels[row.status]}
              </span>
              <small>
                {row.source === "MANUAL" ? "Staff correction" : row.label}
              </small>
              {row.late && <small>Late clock-in recorded</small>}
            </div>
            <span role="cell">
              {time(row.clockAt)}
              {row.clockAt && (
                <small>
                  Official: {Math.floor((row.officialMinutes || 0) / 60)} h{" "}
                  {(row.officialMinutes || 0) % 60} m
                </small>
              )}
            </span>
            <span role="cell">
              {time(row.clockOutAt)}
              {(row.extraMinutes > 0 || row.extraActive) && (
                <small>
                  Extra play: {row.extraMinutes} min
                  {row.extraActive ? " · Active" : ""}
                </small>
              )}
            </span>
            <div role="cell">
              {data.canEdit &&
              (data.calendar.working || row.source === "MANUAL") ? (
                <button
                  className="btn"
                  disabled={loading}
                  onClick={() => {
                    setSelected(row);
                    setStatus("FULL_DAY");
                    setReason("");
                    setError("");
                  }}
                >
                  Correct
                  <span className="sr-only"> attendance for {row.name}</span>
                </button>
              ) : (
                "—"
              )}
            </div>
          </div>
        ))}
        {!data.rows.length && (
          <p className="attendance-empty">
            No players are assigned to your attendance scope. CC can check team
            assignments.
          </p>
        )}
      </div>
      <p className="attendance-policy-note">
        Attendance corrections keep original clock times, saved work, stars,
        trophies and XP intact. MC can manage assigned players; CC can manage
        the cohort. Not tracked on this date: {data.counts.NOT_TRACKED}.
      </p>
      <details className="calendar-history">
        <summary>
          Correction history for this date <span>{data.history.length}</span>
        </summary>
        <ol>
          {data.history.map((entry, i) => (
            <li key={i}>
              <strong>
                {data.rows.find((r) => r.userId === entry.userId)?.name ||
                  "Player"}
              </strong>
              <span>
                {labels[entry.before.status]} → {labels[entry.after.status]}
              </span>
              <p>{entry.reason}</p>
              <small>
                {new Date(entry.createdAt).toLocaleString("en-IN", {
                  timeZone: data.timeZone,
                })}{" "}
                · {entry.actorName || entry.actorId}
              </small>
            </li>
          ))}
          {!data.history.length && <li>No corrections recorded.</li>}
        </ol>
      </details>
      {selected && (
        <Modal
          portal
          title="Correct attendance"
          kicker={`${selected.name} · ${data.day}`}
          close={() => {
            if (!saving) setSelected(null);
          }}
        >
          <form className="calendar-editor" onSubmit={save}>
            <p>
              Current result: <strong>{labels[selected.status]}</strong>.
              Original clock-in and clock-out stay saved.
            </p>
            <label>
              Attendance result
              <select
                value={status}
                disabled={saving}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(labels)
                  .filter(([key]) =>
                    [
                      "FULL_DAY",
                      "HALF_DAY",
                      "ABSENT",
                      "EXCUSED",
                      "DEFAULT",
                    ].includes(key),
                  )
                  .map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Reason for correction
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                value={reason}
                disabled={saving}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="calendar-feedback is-error">
                {error}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setSelected(null);
                    setReload((n) => n + 1);
                  }}
                >
                  Refresh attendance
                </button>
              </p>
            )}
            <button className="calendar-save" disabled={saving || loading}>
              {saving ? "Saving…" : "Save correction"}
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
