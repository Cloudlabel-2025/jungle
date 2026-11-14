"use client";
import { useState } from "react";
import { Modal } from "./ui";
import { flushPendingWork } from "./useSavedWork";
import { PipArrival } from "./PipGuide";
import { needsClockInTutorial } from "@/lib/attendance-policy";

export default function AttendancePrompt({ data, act, now, open, close }) {
  const [dismissedEntry, setDismissedEntry] = useState("");
  const [dismissedWarning, setDismissedWarning] = useState("");
  const [acknowledgedOut, setAcknowledgedOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const s = data?.playSession;
  if (!s || data.user.role !== "GAMER") return null;
  const scope = `${data.user._id}:${s.day}`;
  const warningToken = `${scope}:${s.responseDeadline}`;
  const outToken = `${data.user._id}:${s.clockOutAt}`;
  const warning = Boolean(s.state === "ACTIVE" && s.responseDeadline);
  const timedOut = Boolean(
    s.clockOutReason === "TIMEOUT" &&
    s.state !== "ACTIVE" &&
    acknowledgedOut !== outToken,
  );
  const entry = s.state !== "ACTIVE" && dismissedEntry !== scope;
  if (
    !open &&
    !entry &&
    !timedOut &&
    !(warning && dismissedWarning !== warningToken)
  )
    return null;
  const remaining = s.responseDeadline
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(s.responseDeadline) - new Date(now).getTime()) / 1000,
        ),
      )
    : 0;
  const dismiss = () => {
    setDismissedEntry(scope);
    setDismissedWarning(warningToken);
    setAcknowledgedOut(outToken);
    setError("");
    close();
  };
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      if (action === "clock-out") await flushPendingWork(data.user._id);
      const result = await act(
        `attendance/${action}`,
        action === "clock-in" ? { latenessReason: reason } : {},
        action === "clock-in"
          ? "You are clocked in. Enjoy your game."
          : action === "stay"
            ? "Still playing. We'll check again in 30 minutes."
            : "You are clocked out. Your game progress is saved.",
      );
      if (result) dismiss();
      else
        setError(
          "Could not update attendance. Check the message and try again.",
        );
    } catch (e) {
      setError(e.message || "Could not update attendance. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const flightArrival =
    data.story?.flight && !warning && !timedOut && needsClockInTutorial(s);
  return (
    <Modal
      portal
      companion={flightArrival ? <PipArrival available={s.available} /> : null}
      title={
        warning
          ? "Are you still playing?"
          : timedOut
            ? "You were clocked out"
            : s.state === "ACTIVE"
              ? "Your play session"
              : flightArrival
                ? "Ready for take-off?"
                : "Clock in to play"
      }
      kicker={flightArrival ? "YOUR FLIGHT STARTS HERE" : "PLAYER ATTENDANCE"}
      close={dismiss}
    >
      <div className="attendance-prompt" aria-busy={busy}>
        {warning ? (
          <>
            <p>
              Your scheduled day has ended. Stay clocked in if you are still
              playing, or clock out when you are finished.
            </p>
            <p
              className="attendance-countdown"
              role="timer"
              aria-label="Time left to answer"
            >
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")} left to respond
            </p>
            <p className="muted">
              No response within {s.responseMinutes} minutes clocks you out
              automatically. “Still playing” keeps you clocked in; we'll check
              again in {s.continueMinutes} minutes.
            </p>
            <div className="attendance-actions">
              <button
                className="btn primary"
                disabled={busy || !remaining}
                onClick={() => run("stay")}
              >
                Still playing
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => run("clock-out")}
              >
                Clock out now
              </button>
            </div>
          </>
        ) : timedOut ? (
          <>
            <p>
              We did not receive a response to the end-of-day check, so your
              play session was clocked out automatically.
            </p>
            <p className="muted">
              Your research and game progress are saved. You can clock in again
              when attendance is available.
            </p>
            <button className="btn primary" onClick={dismiss}>
              Got it
            </button>
          </>
        ) : s.state === "ACTIVE" ? (
          <>
            <p>
              You are clocked in. You can finish your session whenever you are
              ready.
            </p>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => run("clock-out")}
            >
              Clock out now
            </button>
          </>
        ) : (
          <>
            {!flightArrival && (
              <p>
                {s.state === "OUT"
                  ? "Your last play session has ended. Clock in again to resume."
                  : "Welcome back. Clock in to start your play session."}
              </p>
            )}
            {!s.available ? (
              <p className="attendance-notice">{s.reason}</p>
            ) : (
              <>
                {!data.story?.flight && (
                  <label>
                    Reason if you are arriving late
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      maxLength={1000}
                    />
                  </label>
                )}
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => run("clock-in")}
                >
                  {busy ? "Clocking in…" : "Clock in"}
                </button>
              </>
            )}
            <button className="btn" onClick={dismiss}>
              Not now
            </button>
          </>
        )}
        {!flightArrival && (
          <p className="muted">
            Clocking out does not submit your EOD reflection.
          </p>
        )}
        {error && (
          <p role="alert" className="attendance-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
