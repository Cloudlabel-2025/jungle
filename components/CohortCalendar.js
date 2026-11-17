"use client";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  RotateCcw,
  Check,
  Clock3,
} from "lucide-react";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatDate = (date, options) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-IN", {
    timeZone: "UTC",
    ...options,
  });
function adjacentMonth(month, direction) {
  const value = new Date(month + "-01T12:00:00Z");
  value.setUTCMonth(value.getUTCMonth() + direction);
  return value.toISOString().slice(0, 7);
}

export function CalendarMonthGrid({ data, selected, onSelect }) {
  const offset = new Date(data.month + "-01T12:00:00Z").getUTCDay();
  return (
    <div className="cohort-calendar-grid" role="group" aria-label="Month dates">
      {weekdays.map((day) => (
        <span className="calendar-weekday" key={day}>
          {day}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span
          className="calendar-empty"
          key={`empty-${i}`}
          aria-hidden="true"
        />
      ))}
      {data.days.map((day) => (
        <button
          type="button"
          key={day.date}
          className={`calendar-date ${day.working ? "is-working" : "is-leave"} ${selected === day.date ? "is-selected" : ""} ${data.today === day.date ? "is-today" : ""}`}
          aria-label={`${formatDate(day.date, { day: "numeric", month: "long", year: "numeric" })}: ${day.label}`}
          aria-pressed={selected === day.date}
          aria-current={data.today === day.date ? "date" : undefined}
          onClick={() => onSelect(day.date)}
        >
          <span className="calendar-date-number">
            {Number(day.date.slice(-2))}
            {data.today === day.date && <small>Today</small>}
          </span>
          <span className="calendar-date-kind">
            {day.working ? <Sun size={13} /> : <Moon size={13} />}
            {day.working
              ? "Working"
              : day.source === "WEEKLY"
                ? "Weekly off"
                : "Leave"}
          </span>
          {day.source !== "WEEKLY" && (
            <span className="calendar-date-label" title={day.label}>
              {day.label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function CohortCalendar() {
  const detailsRef = useRef(null);
  const [data, setData] = useState(null),
    [month, setMonth] = useState("");
  const [selected, setSelected] = useState(""),
    [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [mode, setMode] = useState("LEAVE"),
    [label, setLabel] = useState(""),
    [reason, setReason] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [hoursReason, setHoursReason] = useState("");
  const [fullHours, setFullHours] = useState("6"),
    [halfHours, setHalfHours] = useState("4"),
    [minimumReason, setMinimumReason] = useState("");
  useEffect(() => {
    if (!data) return;
    setStartTime(data.attendanceHours.startTime);
    setEndTime(data.attendanceHours.endTime);
    setHoursReason("");
    setFullHours(String((data.attendanceMinimums?.fullDayMinutes ?? 360) / 60));
    setHalfHours(String((data.attendanceMinimums?.halfDayMinutes ?? 240) / 60));
    setMinimumReason("");
  }, [data?.version]);
  async function saveMinimums(event) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MINIMUMS",
          minimums: {
            fullDayMinutes: Number(fullHours) * 60,
            halfDayMinutes: Number(halfHours) * 60,
          },
          reason: minimumReason,
          version: data.version,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not save minimum hours.");
      setMessage(
        `Attendance minimums saved, effective ${result.effectiveDay}. Finalized results and staff corrections stay saved.`,
      );
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function saveHours(event) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "HOURS",
          hours: { startTime, endTime },
          reason: hoursReason,
          version: data.version,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not save attendance hours.");
      setMessage("Attendance hours updated for your cohort.");
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await fetch(
          `/api/calendar${month ? `?month=${encodeURIComponent(month)}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "Could not load the calendar.");
        if (controller.signal.aborted) return;
        setData(result);
        setSelected((old) =>
          result.days.some((d) => d.date === old)
            ? old
            : result.days.some((d) => d.date === result.today)
              ? result.today
              : result.days[0].date,
        );
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [month, reload]);
  const current = data?.days.find((d) => d.date === selected);
  useEffect(() => {
    if (!current) return;
    setMode(current.working ? "WORKING" : "LEAVE");
    setLabel(current.label);
    setReason("");
  }, [selected, data?.version]);
  function changeMode(value) {
    setMode(value);
    setLabel(
      value === "WORKING"
        ? "Working day"
        : current && !current.working && current.source !== "WEEKLY"
          ? current.label
          : "Leave day",
    );
  }
  async function save(event) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selected,
          status: mode,
          label,
          reason,
          version: data.version,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not save this date.");
      setMessage(
        `${formatDate(selected, { day: "numeric", month: "long" })} is now ${result.label.toLowerCase()}.`,
      );
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (!data)
    return (
      <section className="cohort-calendar calendar-loading">
        <CalendarDays size={32} />
        <h1>Cohort calendar</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="btn" onClick={() => setReload((n) => n + 1)}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">Opening your calendar…</p>
        )}
      </section>
    );
  const working = data.days.filter((d) => d.working).length;
  return (
    <section
      className="cohort-calendar"
      aria-label="Cohort calendar"
      aria-busy={loading || saving}
    >
      <header className="calendar-page-heading">
        <div>
          <span className="calendar-eyebrow">
            <CalendarDays size={15} /> EXPEDITION CALENDAR
          </span>
          <h1>Your days, planned.</h1>
          <p>
            {data.cohortName} · {data.timeZone}
          </p>
        </div>
        <div className="calendar-month-counts">
          <span>
            <Sun size={17} />
            <strong>{working}</strong> working days
          </span>
          <span>
            <Moon size={17} />
            <strong>{data.days.length - working}</strong> days off
          </span>
        </div>
      </header>
      <details className="calendar-hours">
        <summary>
          <Clock3 size={18} /> Attendance hours{" "}
          <strong>
            {data.attendanceHours.startTime} – {data.attendanceHours.endTime}
          </strong>
          <span>{data.canEdit ? "Edit hours" : data.timeZone}</span>
        </summary>
        <p>
          Clock in during these hours on working days. Official attendance
          closes at the end time. Players can continue in a separate extra
          session, without repeated prompts. Extra play ends at the next daily
          start.
        </p>
        {data.canEdit && (
          <form
            className="calendar-editor calendar-hours-form"
            onSubmit={saveHours}
          >
            <label>
              Clock-in opens
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={saving || loading}
              />
            </label>
            <label>
              Official attendance ends
              <input
                type="time"
                required
                min={startTime}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={saving || loading}
              />
            </label>
            <label>
              Reason for hours change
              <input
                required
                minLength={5}
                maxLength={1000}
                value={hoursReason}
                onChange={(e) => setHoursReason(e.target.value)}
                disabled={saving || loading}
              />
            </label>
            <button className="calendar-save" disabled={saving || loading}>
              {saving ? "Saving…" : "Save attendance hours"}
              <Check size={17} />
            </button>
            <small>
              {data.timeZone} · Applies to Week 1 and expedition attendance.
              Today's open attendance follows new hours. Closed attendance and
              past records stay saved; extra play remains separate.
            </small>
          </form>
        )}
      </details>
      <details className="calendar-hours">
        <summary>
          <Clock3 size={18} /> Minimum official hours{" "}
          <strong>
            Full {(data.attendanceMinimums?.fullDayMinutes ?? 360) / 60} h ·
            Half {(data.attendanceMinimums?.halfDayMinutes ?? 240) / 60} h
          </strong>
          <span>{data.canEdit ? "Edit minimums" : "Official time only"}</span>
        </summary>
        <p>
          Only official session time counts. Breaks and extra play are excluded.
          Results become final at the scheduled day end; below the half-day
          minimum counts as absent. A half day earns 50% attendance credit.
        </p>
        <p>
          {data.attendanceMinimums?.effectiveDay
            ? `Applies from ${data.attendanceMinimums.effectiveDay}.`
            : "Default minimums apply until CC saves a policy."}{" "}
          Changes saved after day end apply from the next day. Previously
          finalized results keep their minimums.
        </p>
        {data.canEdit && (
          <form
            className="calendar-editor calendar-hours-form"
            onSubmit={saveMinimums}
          >
            <label>
              Full-day minimum (hours)
              <input
                type="number"
                required
                min="0.25"
                step="0.25"
                value={fullHours}
                onChange={(e) => setFullHours(e.target.value)}
                disabled={saving || loading}
              />
            </label>
            <label>
              Half-day minimum (hours)
              <input
                type="number"
                required
                min="0.25"
                step="0.25"
                value={halfHours}
                onChange={(e) => setHalfHours(e.target.value)}
                disabled={saving || loading}
              />
            </label>
            <label>
              Reason for minimum-hours change
              <input
                required
                minLength={5}
                maxLength={1000}
                value={minimumReason}
                onChange={(e) => setMinimumReason(e.target.value)}
                disabled={saving || loading}
              />
            </label>
            <button className="calendar-save" disabled={saving || loading}>
              {saving ? "Saving…" : "Save attendance minimums"}
              <Check size={17} />
            </button>
            <small>
              Half day must be below full day. Both minimums must fit within
              official working hours.
            </small>
          </form>
        )}
      </details>
      {error && (
        <div className="calendar-feedback is-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            Refresh calendar
          </button>
        </div>
      )}
      {message && (
        <p className="calendar-feedback" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      <div className="calendar-layout">
        <div className="calendar-month-panel">
          <div className="calendar-toolbar">
            <div className="calendar-month-title">
              <CalendarDays size={20} />
              <h2>
                {formatDate(data.month + "-01", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
            </div>
            <div>
              <button
                type="button"
                aria-label="Previous month"
                disabled={saving || loading}
                onClick={() => {
                  setMonth(adjacentMonth(data.month, -1));
                  setMessage("");
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => {
                  setMonth(data.today.slice(0, 7));
                  setSelected(data.today);
                }}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                disabled={saving || loading}
                onClick={() => {
                  setMonth(adjacentMonth(data.month, 1));
                  setMessage("");
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <CalendarMonthGrid
            data={data}
            selected={selected}
            onSelect={(date) => {
              if (!saving && !loading) {
                setSelected(date);
                setMessage("");
                if (
                  detailsRef.current?.parentElement.getBoundingClientRect()
                    .width <= 780
                )
                  requestAnimationFrame(() =>
                    detailsRef.current?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "auto"
                        : "smooth",
                      block: "start",
                    }),
                  );
              }
            }}
          />
          <footer className="calendar-legend">
            <span>
              <i className="working-dot" /> Working day
            </span>
            <span>
              <i className="leave-dot" /> Leave / weekly off
            </span>
            <span>
              <i className="today-dot" /> Today
            </span>
          </footer>
        </div>
        {current && (
          <aside
            ref={detailsRef}
            className="calendar-day-panel"
            aria-label="Selected date"
          >
            <span className="calendar-eyebrow">
              {formatDate(selected, { weekday: "long" })}
            </span>
            <h2>{formatDate(selected, { day: "numeric", month: "long" })}</h2>
            <span
              className={`calendar-status ${current.working ? "is-working" : "is-leave"}`}
            >
              {current.working ? <Sun size={16} /> : <Moon size={16} />}
              {current.label}
            </span>
            <p className="calendar-day-note">
              {current.working
                ? "Players can clock in on this date when their play session is available."
                : "No new clock-in on this date. Your saved work and progress stay safe."}
            </p>
            {data.canEdit ? (
              <form onSubmit={save} className="calendar-editor">
                <p>Set this date for everyone in {data.cohortName}.</p>
                <fieldset disabled={saving || loading}>
                  <legend>Day type</legend>
                  {[
                    ["LEAVE", "Leave day"],
                    ["WORKING", "Working day"],
                    ["DEFAULT", "Weekly pattern"],
                  ].map(([value, text]) => (
                    <label
                      key={value}
                      className={mode === value ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="calendar-type"
                        value={value}
                        checked={mode === value}
                        onChange={() => changeMode(value)}
                      />
                      {text}
                    </label>
                  ))}
                </fieldset>
                {mode !== "DEFAULT" && (
                  <label>
                    Day name
                    <input
                      required
                      maxLength={100}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      disabled={saving || loading}
                    />
                  </label>
                )}
                <label>
                  Reason for change
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={saving || loading}
                    placeholder="Why is this date changing?"
                  />
                </label>
                <button className="calendar-save" disabled={saving || loading}>
                  {saving
                    ? "Saving…"
                    : mode === "DEFAULT"
                      ? "Restore weekly pattern"
                      : mode === "LEAVE"
                        ? "Mark as leave"
                        : "Make working day"}
                  {mode === "DEFAULT" ? (
                    <RotateCcw size={17} />
                  ) : (
                    <Check size={17} />
                  )}
                </button>
                <small>
                  Changes are recorded. Saved attendance and work are preserved.
                </small>
              </form>
            ) : (
              <div className="calendar-readonly">
                <Clock3 size={18} />
                <p>
                  Centre Command manages leave and working dates for your
                  cohort.
                </p>
              </div>
            )}
          </aside>
        )}
      </div>
      <div className="calendar-weekly-pattern">
        <span>Weekly working days</span>
        {weekdays.map((name, index) => (
          <span
            key={name}
            className={data.weekdays.includes(index) ? "is-working" : ""}
          >
            {name}
          </span>
        ))}
        <small>Date changes take priority over the weekly pattern.</small>
      </div>
      {data.canEdit && data.history.length > 0 && (
        <details className="calendar-history">
          <summary>
            Recent calendar changes this month{" "}
            <span>{data.history.length}</span>
          </summary>
          <ol>
            {data.history.map((entry, i) => (
              <li key={`${entry.createdAt}-${i}`}>
                <strong>
                  {formatDate(entry.date, { day: "numeric", month: "short" })}
                </strong>
                <span>
                  {entry.before.label} → {entry.after.label}
                </span>
                <p>{entry.reason}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
