"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Compass,
  Radio,
  ShieldCheck,
  Send,
  Play,
  LockKeyhole,
  CalendarDays,
  Leaf,
  Trophy,
  Rocket,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Package,
} from "lucide-react";
import useSavedWork, { flushPendingWork } from "./useSavedWork";
import {
  evidencePrompts,
  levelTwoMissions,
  missionEvidenceState,
} from "@/lib/level-two-missions.js";
import LevelTwoMissionArt from "./LevelTwoMissionArt";
import { FlightLevelRewards } from "./WeekOneStarGuide";

const scenarioIcons = [CalendarDays, Leaf, Trophy, Rocket];
const systemIcons = [Compass, CloudSun, Package, Radio];
const timeLeft = (deadline, now) => {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(deadline) - new Date(now)) / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function LevelTwoMissionScene({
  data,
  act,
  now,
  onMap,
  onNext,
  nextLevel,
}) {
  const day = data.weekOneProgram.days.find((d) => d.day === 2);
  const [selected, setSelected] = useState(null),
    [scenario, setScenario] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const heading = useRef(null);
  const activity = day?.activities.find((a) => a.id === selected);
  const record = data.weekOneProgram.attempts.find(
    (a) => a.activityId === selected,
  );
  const levelState = data.weekOneProgram.levelResults?.find((r) => r.userId === data.user._id && r.day === 2);
  const complete = levelState?.result?.completed && !levelState.replayPending ? 2 :
    day?.activities.filter(
      (a) =>
        missionEvidenceState(
          data.weekOneProgram.attempts.find((r) => r.activityId === a.id),
          now,
        ).completed,
    ).length || 0;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [selected, record?._id]);
  const leave = async (callback) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await flushPendingWork(data.user._id);
      callback();
    } catch (e) {
      setError(
        e.message || "Your notes could not be saved. Stay here and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const choose = (id) => {
    setScenario(null);
    setError("");
    setSelected(id);
  };
  const selectedScenario = activity?.variants?.find((v) => v.id === scenario);
  const start = async () => {
    if (!selectedScenario || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await act(
        "week1/program/attempt-start",
        { day: 2, activityId: selected, variantId: selectedScenario.id },
        "Your investigation has started. Your timer and notes are saved.",
      );
      if (!result)
        throw Error(
          "Launch was not confirmed. Your timer starts only after the server confirms it.",
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="level-two-scene" aria-label="Level 2 mission adventure">
      <header className="l2-topline">
        <div>
          <span>FLIGHT / LEVEL 02</span>
          <strong>Explore the unknown</strong>
        </div>
        <div
          className="l2-mission-counter"
          aria-label={`${complete} of 2 missions complete`}
        >
          <CheckCheck size={18} /> {complete}/2 <span>MISSIONS</span>
        </div>
        <button type="button" disabled={busy} onClick={() => leave(onMap)}>
          <Compass size={16} /> Sky map <ArrowRight size={16} />
        </button>
      </header>
      <FlightLevelRewards data={data} day={2} compact />
      {error && (
        <p className="l2-error" role="alert">
          {error}
        </p>
      )}
      {!day ? (
        <div className="l2-locked">
          <LockKeyhole size={40} />
          <h2>Finish your first discovery.</h2>
          <p>Level 2 opens after your saved Level 1 completion.</p>
        </div>
      ) : !activity ? (
        <div className="l2-selection">
          <div className="l2-scene-title">
            <span>YOUR NEXT DISCOVERY</span>
            <h2 ref={heading} tabIndex={-1}>
              Two missions. One explorer.
            </h2>
            <p>Choose your investigation. Complete both to unlock Level 3.</p>
          </div>
          <div className="l2-mission-cards">
            {day.activities.map((a, i) => {
              const meta = levelTwoMissions[a.id],
                saved = data.weekOneProgram.attempts.find(
                  (r) => r.activityId === a.id,
                ),
                status = missionEvidenceState(saved, now);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`l2-mission-card ${status.completed ? "is-complete" : ""}`}
                  onClick={() => choose(a.id)}
                >
                  <span className="l2-card-top">
                    <span>MISSION 0{i + 1}</span>
                    <span>
                      {status.completed ? (
                        <>
                          <Check size={14} /> SECURED
                        </>
                      ) : saved ? (
                        <>
                          <Radio size={14} /> IN PROGRESS
                        </>
                      ) : (
                        <>
                          <Clock3 size={14} /> {a.durationMinutes} MIN
                        </>
                      )}
                    </span>
                  </span>
                  <LevelTwoMissionArt kind={meta.art} />
                  <span className="l2-card-copy">
                    <small>{meta.type}</small>
                    <strong>{a.name}</strong>
                    <span>{meta.description}</span>
                  </span>
                  <span className="l2-card-action">
                    {status.completed
                      ? "View discovery"
                      : saved
                        ? "Resume investigation"
                        : "Explore mission"}
                    <ArrowRight size={20} />
                  </span>
                  {saved && !status.completed && (
                    <span
                      className="l2-card-progress"
                      aria-label={`${status.answered} of ${status.total} notes saved`}
                    >
                      <i
                        style={{
                          width: `${(status.answered / status.total) * 100}%`,
                        }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="l2-bottom-radio">
            <Radio size={17} />
            <p>
              {complete === 2
                ? "Both discoveries secured. Your next flight mission is unlocked."
                : "Pip: Pick either mission. Your research timer starts when you launch a scenario."}
            </p>
            {complete === 2 && nextLevel?.available && (
              <button type="button" onClick={onNext}>
                Continue to Level 3 <ArrowRight size={17} />
              </button>
            )}
          </div>
        </div>
      ) : record ? (
        <LevelTwoInvestigation
          key={`${data.user._id}:${record._id}`}
          record={record}
          dayOpen={day.state === "OPEN" || data.weekOneProgram.progression?.mode === "COMPLETION"}
          ownerId={data.user._id}
          now={now}
          act={act}
          paused={busy}
          onBack={() => leave(() => setSelected(null))}
          onOther={() =>
            leave(() =>
              choose(day.activities.find((a) => a.id !== selected).id),
            )
          }
          onNext={nextLevel?.available ? onNext : null}
          levelComplete={complete === 2}
          headingRef={heading}
        />
      ) : (
        <div className="l2-briefing">
          <div className="l2-briefing-heading">
            <button
              type="button"
              className="l2-back"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <ArrowLeft size={16} /> Missions
            </button>
            <div>
              <span>{levelTwoMissions[selected].type}</span>
              <h2 ref={heading} tabIndex={-1}>
                {activity.name}
              </h2>
            </div>
          </div>
          <div className="l2-scenario-layout">
            <div className="l2-scenario-picker">
              <h3>Choose your scenario</h3>
              <div className="l2-scenario-buttons">
                {activity.variants.map((v, i) => {
                  const Icon =
                    (activity.kind === "GENERAL" ? scenarioIcons : systemIcons)[
                      i
                    ] || Compass;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={scenario === v.id}
                      disabled={busy}
                      onClick={() => setScenario(v.id)}
                    >
                      <Icon size={26} />
                      <strong>{v.name}</strong>
                      <span>
                        {scenario === v.id ? (
                          <Check size={16} />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="l2-scenario-hint">
                <ShieldCheck size={15} /> Your scenario locks when you launch.
                The timer has not started.
              </p>
            </div>
            <aside className="l2-scenario-preview">
              <span className="l2-eyebrow">MISSION BRIEFING</span>
              <h3>
                {selectedScenario?.name || levelTwoMissions[selected].headline}
              </h3>
              <div className="l2-scenario-story">
                <p>
                  {selectedScenario?.brief ||
                    levelTwoMissions[selected].objective}
                </p>
              </div>
              <div className="l2-launch-footer">
                <span>
                  <Clock3 size={17} />
                  {activity.durationMinutes} minutes from launch
                </span>
                <button
                  type="button"
                  className="l2-primary"
                  disabled={!selectedScenario || busy || day.state !== "OPEN"}
                  onClick={start}
                >
                  {busy ? "Launching…" : "Launch investigation"}
                  <Play size={17} fill="currentColor" />
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}

export function LevelTwoInvestigation({
  record,
  dayOpen,
  ownerId,
  now,
  act,
  paused,
  onBack,
  onOther,
  onNext,
  levelComplete,
  headingRef,
}) {
  const d = record.data,
    fields = d.activity.fields,
    saved = missionEvidenceState(record, now);
  const [answers, setAnswers] = useState(d.draft || {}),
    [step, setStep] = useState(() => saved.firstMissing),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false),
    [revising, setRevising] = useState(false),
    [history, setHistory] = useState(false);
  const canWrite =
    dayOpen || d.extensions?.some((e) => new Date(now) <= new Date(e.deadline));
  const work = useSavedWork({
    value: { answers },
    initialValue: { answers: d.draft || {} },
    initialVersion: record.version,
    ownerId,
    enabled: canWrite && !saved.expired && !busy,
    endpoint: "/api/week1/program/attempt-save",
    buildBody: (value, version) => ({
      attemptId: record._id,
      attemptVersion: version,
      answers: value.answers,
    }),
  });
  useEffect(
    () => work.syncVersion(record.version),
    [record.version, JSON.stringify(answers)],
  );
  const visibleAnswers = saved.expired ? d.draft || {} : answers;
  const answered = fields.filter((key) => visibleAnswers[key]?.trim()).length;
  const key = fields[step],
    prompt = evidencePrompts[key] || [
      key,
      "Record your findings for this mission.",
    ];
  const transmit = async () => {
    if (busy || paused) return;
    setError("");
    try {
      const pending = work.flush();
      setBusy(true);
      await pending;
      const result = await act(
        "week1/program/attempt-submit",
        {
          attemptId: record._id,
          attemptVersion: work.getVersion(),
          answers: saved.expired ? d.draft || {} : answers,
        },
        "Your discovery has been saved.",
      );
      if (!result)
        throw Error(
          "Transmission was not confirmed. Your notes are kept here; try again.",
        );
      setReviewing(false);
      setRevising(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const consent = async () => {
    setBusy(true);
    setError("");
    try {
      if (
        !(await act(
          "week1/program/share-consent",
          { activityId: record.activityId, allowed: true },
          "Anonymous sharing consent saved.",
        ))
      )
        throw Error("Sharing consent was not saved. Please try again.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (saved.completed && !reviewing)
    return (
      <div className="l2-debrief">
        <div className="l2-debrief-emblem">
          <CheckCheck size={52} />
        </div>
        <span className="l2-eyebrow">DISCOVERY SECURED</span>
        <h2 ref={headingRef} tabIndex={-1}>
          {d.activity.name}
        </h2>
        <p>
          Your investigation is saved.{" "}
          {levelComplete
            ? "Both Level 2 missions are complete. Level 3 is unlocked."
            : "One more investigation stands between you and Level 3."}
        </p>
        <div className="l2-debrief-actions">
          <button
            className="l2-primary"
            onClick={levelComplete && onNext ? onNext : onOther}
          >
            {levelComplete && onNext
              ? "Continue to Level 3"
              : "Choose the other mission"}
            <ArrowRight size={17} />
          </button>
          <button className="l2-secondary" onClick={() => setReviewing(true)}>
            Read your field notes
          </button>
          {canWrite && !saved.expired && (
            <button
              className="l2-secondary"
              onClick={() => {
                setReviewing(true);
                setRevising(true);
              }}
            >
              Revise discovery
            </button>
          )}
          <button className="l2-back" onClick={onBack}>
            All missions
          </button>
        </div>
        <div className="l2-saved-tools">
          <button disabled={busy} onClick={consent}>
            Allow an approved anonymous summary
          </button>
          <button onClick={() => setHistory(!history)}>
            Transmission log · {d.submissions.length}
          </button>
        </div>
        {history && (
          <div className="l2-log">
            {[...d.submissions].reverse().map((s) => (
              <article key={s.id}>
                <strong>
                  {new Date(s.at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </strong>
                <p>
                  {s.complete
                    ? "Complete evidence saved"
                    : "Partial evidence saved"}
                  {s.late ? " · after the timer ended" : ""}
                </p>
              </article>
            ))}
          </div>
        )}
        {error && (
          <p className="l2-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="l2-investigation">
      <aside className="l2-case-file">
        <button
          type="button"
          className="l2-back"
          disabled={busy || paused}
          onClick={onBack}
        >
          <ArrowLeft size={15} /> Missions
        </button>
        <span className="l2-eyebrow">YOUR LOCKED SCENARIO</span>
        <h3>{d.variant.name}</h3>
        <div className="l2-case-story">
          <p>{d.variant.brief}</p>
        </div>
        <div className={`l2-timer ${saved.expired ? "is-expired" : ""}`}>
          <Clock3 size={20} />
          <strong role="timer" aria-label="Investigation time remaining">
            {saved.completed ? "SAVED" : timeLeft(d.deadline, now)}
          </strong>
          <span>
            {saved.completed
              ? "DISCOVERY SECURED"
              : saved.expired
                ? "TIME ENDED"
                : "REMAINING"}
          </span>
        </div>
      </aside>
      <div className="l2-field-console">
        <header>
          <span className="l2-eyebrow">
            FIELD NOTES / {step + 1} OF {fields.length}
          </span>
          <span className="l2-autosave" role="status">
            {busy
              ? "Transmitting…"
              : work.status ||
                (d.savedAt
                  ? "Saved notes restored"
                  : "Your notes save automatically")}
          </span>
        </header>
        <nav className="l2-note-steps" aria-label="Investigation checkpoints">
          {fields.map((field, i) => (
            <button
              key={field}
              type="button"
              aria-label={`Note ${i + 1}: ${evidencePrompts[field]?.[0] || field}`}
              aria-current={step === i ? "step" : undefined}
              className={visibleAnswers[field]?.trim() ? "is-filled" : ""}
              disabled={busy || paused}
              onClick={() => setStep(i)}
            >
              {visibleAnswers[field]?.trim() ? <Check size={13} /> : i + 1}
            </button>
          ))}
        </nav>
        <h2 ref={headingRef} tabIndex={-1}>
          {prompt[0]}
        </h2>
        <label
          className="l2-answer-label"
          htmlFor={`note-${record._id}-${key}`}
        >
          {prompt[1]}
        </label>
        {saved.expired && !saved.completed && (
          <p className="l2-window-ended">
            Your timer ended. Only your last saved notes can be transmitted.
          </p>
        )}
        <textarea
          id={`note-${record._id}-${key}`}
          className="l2-evidence-input"
          maxLength={8000}
          value={visibleAnswers[key] || ""}
          placeholder="Write what you discovered…"
          readOnly={
            (saved.completed && !revising) || saved.expired || !canWrite
          }
          disabled={busy || paused}
          onChange={(e) => {
            setAnswers((old) => ({ ...old, [key]: e.target.value }));
            setError("");
          }}
        />
        {error && (
          <p className="l2-error" role="alert">
            {error}
          </p>
        )}
        <footer className="l2-console-actions">
          <button
            type="button"
            className="l2-secondary"
            disabled={step === 0 || busy || paused}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft size={17} /> Back
          </button>
          <span>
            {answered}/{fields.length} notes captured
          </span>
          {step < fields.length - 1 ? (
            <button
              type="button"
              className="l2-primary"
              disabled={
                busy ||
                paused ||
                (!visibleAnswers[key]?.trim() &&
                  !saved.completed &&
                  !saved.expired)
              }
              onClick={() => setStep(step + 1)}
            >
              Next clue
              <ChevronRight size={17} />
            </button>
          ) : saved.completed && !revising ? (
            <button className="l2-primary" onClick={() => setReviewing(false)}>
              Return to discovery
              <Check size={17} />
            </button>
          ) : (
            <button
              type="button"
              className="l2-primary"
              disabled={
                busy ||
                paused ||
                !canWrite ||
                (!saved.expired && answered !== fields.length)
              }
              onClick={transmit}
            >
              {busy
                ? "Transmitting…"
                : saved.expired
                  ? "Transmit saved notes"
                  : "Transmit discovery"}
              <Send size={16} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
