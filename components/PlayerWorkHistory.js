"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";

export default function PlayerWorkHistory({
  ownerId,
  initialDate,
  close,
  back,
}) {
  const [date, setDate] = useState(initialDate),
    [history, setHistory] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0);
  const request = useRef(null),
    generation = useRef(0);
  const load = async (cursor, append = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const token = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ date });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/player/work-history?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not load your saved work.");
      if (token !== generation.current || result.ownerId !== ownerId) return;
      setHistory((previous) =>
        append && previous?.date === result.date
          ? {
              ...result,
              entries: [
                ...previous.entries,
                ...result.entries.filter(
                  (e) => !previous.entries.some((old) => old.id === e.id),
                ),
              ],
            }
          : result,
      );
    } catch (e) {
      if (e.name !== "AbortError" && token === generation.current)
        setError(e.message);
    } finally {
      if (token === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    setHistory(null);
    load();
    return () => {
      generation.current++;
      request.current?.abort();
    };
  }, [date, ownerId, retry]);
  const zone = history?.timeZone || "Asia/Kolkata";
  const time = (value) =>
    new Date(value).toLocaleString("en-IN", {
      timeZone: zone,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const duration = (seconds) =>
    `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return (
    <Modal
      title="My saved work"
      kicker="DATE / ATTENDANCE / PROGRESS"
      close={close}
      wide
    >
      <div className="player-work-history">
        <div className="work-history-controls">
          <button className="btn small" onClick={back}>
            Back to profile
          </button>
          <label>
            Work date
            <input
              type="date"
              value={date}
              max={history?.today || initialDate}
              onInput={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
        </div>
        <p className="muted">
          Your saved account records, shown in {zone}. Drafts remain separate
          from submitted work.
        </p>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              className="btn"
              disabled={loading}
              onClick={() => setRetry((v) => v + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {loading && !history && <p role="status">Loading your saved work…</p>}
        {history && (
          <>
            <section className="work-history-attendance">
              <h3>Attendance & extra play</h3>
              <p>
                {duration(history.clockedSeconds)} official attendance on this
                date. {duration(history.extraSeconds || 0)} extra play, recorded
                separately.
              </p>
              {!history.sessions.length ? (
                <p className="muted">No clock-in recorded for this date.</p>
              ) : (
                <ol>
                  {history.sessions.map((s, i) => (
                    <li key={s.id}>
                      <strong>
                        {s.kind === "EXTRA"
                          ? "Extra play"
                          : "Official attendance"}{" "}
                        · Session {i + 1}
                      </strong>
                      <span>
                        {time(s.clockInAt)} →{" "}
                        {s.clockOutAt
                          ? time(s.clockOutAt)
                          : s.ongoing
                            ? "Still clocked in"
                            : s.unknownEnd
                              ? "Clock-out not recorded"
                              : "Session boundary"}
                      </span>
                      <small>
                        {s.unknownEnd
                          ? "Historical clock-in; duration unavailable"
                          : s.reason === "SCHEDULED_END"
                            ? "Official day ended"
                            : s.reason === "NEXT_DAY"
                              ? "Extra play ended at the next daily start"
                              : s.reason === "TIMEOUT"
                                ? "Automatic clock-out"
                                : s.reason === "MANUAL"
                                  ? "Manual clock-out"
                                  : s.ongoing
                                    ? "Active"
                                    : "Recorded session"}{" "}
                        {s.clockedSeconds != null &&
                          `· ${duration(s.clockedSeconds)} on this date`}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section>
              <h3>Saved activities</h3>
              {!history.entries.length ? (
                <p className="muted">
                  No saved activities found for this date.
                </p>
              ) : (
                <ol className="work-history-timeline">
                  {history.entries.map((entry) => {
                    const index = history.sessions.findIndex(
                      (s) => s.id === entry.sessionId,
                    );
                    return (
                      <li key={entry.id}>
                        <div className="work-history-entry-heading">
                          <strong>{entry.title}</strong>
                          <span
                            className={`work-save-state ${entry.status === "Draft" ? "is-draft" : ""}`}
                          >
                            {entry.status}
                          </span>
                        </div>
                        <p className="work-entry-time">
                          {time(entry.at)} ·{" "}
                          {index >= 0
                            ? `Session ${index + 1}`
                            : "No active clock-in recorded for this save"}
                        </p>
                        {entry.details?.length > 0 && (
                          <details>
                            <summary>View saved work</summary>
                            <dl>
                              {entry.details.map((d, i) => (
                                <div key={i}>
                                  <dt>{d.label}</dt>
                                  <dd>{d.text.trim()}</dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        )}
                        {entry.link && (
                          <a
                            className="text-link"
                            href={entry.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open submitted research chat
                          </a>
                        )}
                        {entry.download && (
                          <a
                            className="text-link"
                            href={entry.download}
                            download
                          >
                            Download saved workspace
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {history.nextCursor && (
                <button
                  className="btn"
                  disabled={loading}
                  onClick={() => load(history.nextCursor, true)}
                >
                  {loading ? "Loading…" : "Load earlier activities"}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
