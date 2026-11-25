"use client";
import { useState } from "react";
import {
  Compass,
  Check,
  LockKeyhole,
  ArrowRight,
  Clock3,
  ShieldCheck,
  Flag,
} from "lucide-react";
import { flushPendingWork } from "./useSavedWork";
import useFlightAttempt from "./useFlightAttempt";
import ViewObjectivesLink from "./ViewObjectivesLink";
import { FlightLevelRewards } from "./WeekOneStarGuide";
import { attemptComplete } from "@/lib/final-flight-games.js";
import InvestigationDeck from "./InvestigationDeck";
import FinalFlightTrial from "./FinalFlightTrial";

export default function FlightFinale({
  data,
  act,
  now,
  dayNumber,
  onMap,
  onNext,
  nextLevel,
}) {
  const p = data.weekOneProgram,
    day = p.days.find((d) => d.day === dayNumber),
    levels = p.progression?.levels;
  const available =
    Boolean(day) &&
    levels?.find((l) => l.day === dayNumber)?.available !== false;
  const open = day?.state === "OPEN" || p.progression?.mode === "COMPLETION";
  const activities = day?.activities || [];
  const [selected, setSelected] = useState(
    () =>
      activities.find((a) =>
        p.attempts.some((r) => r.activityId === a.id && !attemptComplete(r)),
      )?.id || null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const activity = activities.find((a) => a.id === selected),
    record = p.attempts.find((r) => r.activityId === selected);
  const savedLevel = p.levelResults?.find(
    (r) => r.day === dayNumber && r.userId === data.user._id,
  );
  const completed =
    (savedLevel?.result?.completed && !savedLevel.replayPending) ||
    (activities.length === 2 &&
      activities.every((a) =>
        attemptComplete(p.attempts.find((r) => r.activityId === a.id)),
      ));
  const leave = async (fn) => {
    if (busy) return;
    setError("");
    try {
      setBusy(true);
      await flushPendingWork(data.user._id);
      fn?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const start = async (variantId) => {
    if (busy || !available || !open) return;
    setBusy(true);
    setError("");
    try {
      if (
        !(await act(
          "week1/program/attempt-start",
          {
            day: dayNumber,
            activityId: activity.id,
            ...(variantId ? { variantId } : {}),
          },
          "Mission started. 1 energy spent; your timer and progress are saved.",
        ))
      )
        throw Error("Mission start was not confirmed. Try again.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const props = {
    activities,
    selected,
    activity,
    record,
    choose: (id) => leave(() => setSelected(id)),
    start,
    busy,
    now,
    open,
    ownerId: data.user._id,
    act,
    attempts: p.attempts,
  };
  return (
    <section
      className={`flight-finale ${dayNumber === 4 ? "verdict-deck" : "captains-run"}`}
      aria-label={
        dayNumber === 4
          ? "Level 4 Investigation Deck"
          : "Level 5 Final Flight Trial"
      }
    >
      <header className="finale-header">
        <div>
          <span className="finale-eyebrow">FLIGHT / LEVEL 0{dayNumber}</span>
          <h2>
            {dayNumber === 4 ? (
              <>
                <ShieldCheck /> Investigation Deck
              </>
            ) : (
              <>
                <Flag /> The Captain’s Run
              </>
            )}
          </h2>
        </div>
        <ViewObjectivesLink level={dayNumber} ownerId={data.user._id} />
        <button
          className="finale-button secondary"
          disabled={busy}
          onClick={() => leave(onMap)}
        >
          <Compass size={16} /> Sky map
        </button>
      </header>
      {error && (
        <p role="alert" className="finale-error">
          {error}
        </p>
      )}
      {!available ? (
        <div className="finale-lock">
          <LockKeyhole size={48} />
          <h3>Complete Level {dayNumber - 1} to enter.</h3>
        </div>
      ) : (
        <>
          <div className="finale-scroll">
            {dayNumber === 4 ? (
              <InvestigationDeck {...props} />
            ) : (
              <FinalFlightTrial {...props} />
            )}
          </div>
          <footer className="finale-rewards">
            <FlightLevelRewards data={data} day={dayNumber} compact />
            {completed && dayNumber < 5 && nextLevel?.available && (
              <button
                className="finale-button"
                disabled={busy}
                onClick={() => leave(onNext)}
              >
                Continue to Level 5 <ArrowRight size={16} />
              </button>
            )}
            {completed && dayNumber === 5 && (
              <span>
                <Check size={16} /> Flight learning complete · clearance and
                team approval follow.
              </span>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

export function FinaleAttempt({ record, ownerId, now, open, act, children }) {
  const game = useFlightAttempt({ record, ownerId, now, open, act }),
    d = record.data;
  const seconds = Math.max(
    0,
    Math.ceil((new Date(d.deadline) - new Date(now)) / 1000),
  );
  return (
    <div className="finale-attempt">
      <div className="finale-attempt-status">
        <strong>{d.variant?.name || d.activity.name}</strong>
        <span role="timer">
          <Clock3 size={13} />
          {d.submittedAt && !game.revising
            ? "RESULT SAVED"
            : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
        <small role="status">
          {game.busy ? "Saving transmission…" : game.status}
        </small>
      </div>
      {game.expired && !game.complete && (
        <p className="finale-warning">
          Time has ended. Only your last saved work can be submitted. Ask MC for
          an extension if needed.
        </p>
      )}
      {!game.canWrite && (
        <p className="finale-warning">
          This attempt is read-only. Ask MC or CC about reopening it.
        </p>
      )}
      {game.error && (
        <p role="alert" className="finale-error">
          {game.error}
        </p>
      )}
      {children(game)}
    </div>
  );
}
