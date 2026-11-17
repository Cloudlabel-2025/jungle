"use client";
import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { flushPendingWork } from "./useSavedWork";
import { PipArrival } from "./PipGuide";
import { needsClockInTutorial } from "@/lib/attendance-policy";
import usePipProgress from "./usePipProgress";

const attendanceLabels = {
  FULL_DAY: "Full day",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  IN_PROGRESS: "In progress",
  NEEDS_REVIEW: "Needs review",
  EXCUSED: "Excused",
  DAY_OFF: "Day off",
  NOT_TRACKED: "Not tracked",
  PENDING: "Not checked in",
};

export default function AttendancePrompt({ data, act, now, open, close }) {
  const [dismissedEntry, setDismissedEntry] = useState("");
  const [dismissedWarning, setDismissedWarning] = useState("");
  const [acknowledgedOut, setAcknowledgedOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const tutorial = usePipProgress(data);
  const [arrivalVisit, setArrivalVisit] = useState("");
  const s = data?.playSession;
  const arrivalStep = s?.available ? "clock-in" : "attendance-unavailable", arrivalToken = `${tutorial.account}:${s?.day}:${arrivalStep}`;
  const arrivalKnown = [tutorial.seen, tutorial.dismissed, tutorial.completed].some((ids) => ids.includes(arrivalStep));
  const arrivalCandidate = Boolean(s && data.user.role === "GAMER" && data.story?.flight && needsClockInTutorial(s) && (open || dismissedEntry !== `${data.user._id}:${s.day}`));
  const arrivalActive = arrivalCandidate && (arrivalVisit === arrivalToken || !arrivalKnown);
  useEffect(() => {
    if (arrivalActive && arrivalVisit !== arrivalToken) {
      setArrivalVisit(arrivalToken);
      tutorial.patch({ seen: [arrivalStep] });
    }
  }, [arrivalActive, arrivalToken, arrivalStep, arrivalVisit]);
  if (!s || data.user.role !== "GAMER") return null;
  const scope = `${data.user._id}:${s.day}`;
  const warningToken = `${scope}:${s.responseDeadline}`;
  const outToken = `${data.user._id}:${s.clockOutAt}`;
  const warning = Boolean(s.state === "CHOICE" && s.responseDeadline);
  const timedOut = Boolean(
    (s.endDecision === "EXPIRED" || s.clockOutReason === "TIMEOUT") &&
    !["ACTIVE", "EXTRA", "CHOICE"].includes(s.state) &&
    acknowledgedOut !== outToken,
  );
  const entry =
    !["ACTIVE", "EXTRA", "CHOICE"].includes(s.state) &&
    dismissedEntry !== scope;
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
    if (arrivalActive) tutorial.patch({ dismissed: [arrivalStep] });
    setArrivalVisit("");
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
          : action === "continue"
            ? "Extra play started. Your official attendance is already closed."
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
    arrivalActive && !warning && !timedOut;
  return (
    <Modal
      portal
      companion={flightArrival ? <PipArrival available={s.available} /> : null}
      title={
        warning
          ? "Your working day has ended"
          : timedOut
            ? "You were clocked out"
            : s.state === "ACTIVE"
              ? "Your play session"
              : s.state === "EXTRA"
                ? s.extraSession?.purpose === "UAT"
                  ? "UAT play session"
                  : "Extra play session"
                : flightArrival
                  ? "Ready for take-off?"
                  : "Clock in to play"
      }
      kicker={flightArrival ? "YOUR FLIGHT STARTS HERE" : "PLAYER ATTENDANCE"}
      close={dismiss}
    >
      <div className="attendance-prompt" aria-busy={busy}>
        {!flightArrival &&
          s.officialAttendance &&
          (s.clockAt ||
            ["ABSENT", "HALF_DAY", "FULL_DAY", "EXCUSED"].includes(
              s.officialAttendance.status,
            )) && (
            <div
              className="attendance-notice"
              aria-label="Your official attendance"
            >
              <strong>
                {attendanceLabels[s.officialAttendance.status]} ·{" "}
                {s.officialAttendance.day}
                {s.officialAttendance.corrected ? " · Staff corrected" : ""}
              </strong>
              <p>
                {Math.floor(s.officialAttendance.minutes / 60)} h{" "}
                {s.officialAttendance.minutes % 60} m official time. Full day:{" "}
                {s.officialAttendance.fullDayMinutes / 60} h; half day:{" "}
                {s.officialAttendance.halfDayMinutes / 60} h. Extra play is
                excluded.
              </p>
              {s.officialAttendance.provisional && (
                <small>Final result at the official day end.</small>
              )}
            </div>
          )}
        {warning ? (
          <>
            <p>
              Your official attendance is closed at{" "}
              {new Date(s.clockOutAt).toLocaleTimeString("en-IN", {
                timeZone: s.timeZone,
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Continue in a separate extra play session, or finish for today.
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
              No response within {s.responseMinutes} minutes ends this session.
              Extra play does not count as official attendance, and there are no
              repeated prompts.
            </p>
            <div className="attendance-actions">
              <button
                className="btn primary"
                disabled={busy || !remaining}
                onClick={() => run("continue")}
              >
                Continue playing
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => run("clock-out")}
              >
                Finish for today
              </button>
            </div>
          </>
        ) : timedOut ? (
          <>
            <p>
              Your official attendance ended at the scheduled time. No extra
              session was started because you did not respond.
            </p>
            <p className="muted">
              Your research and game progress are saved. You can clock in again
              when attendance is available, or start extra play below if
              available.
            </p>
            <button className="btn primary" onClick={dismiss}>
              Got it
            </button>
            {s.extraAvailable && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => run("continue")}
              >
                Start extra play
              </button>
            )}
          </>
        ) : s.state === "EXTRA" ? (
          <>
            <p>
              {s.extraSession?.purpose === "UAT"
                ? "Your UAT session is open for testing. This time does not count towards official attendance."
                : "You are playing in an extra session. Your official attendance has already ended."}
            </p>
            <p className="muted">
              No repeated check-ins. Finish whenever you are ready; extra play
              ends automatically at the next daily start.
            </p>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => run("clock-out")}
            >
              {s.extraSession?.purpose === "UAT"
                ? "End UAT session"
                : "End extra session"}
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
              <>
                <p className="attendance-notice">{s.reason}</p>
                {s.extraAvailable && (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => run("continue")}
                  >
                    Start extra play
                  </button>
                )}
              </>
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
