"use client";
import FlightLevelRetry from "./FlightLevelRetry";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Lightbulb,
  MousePointer2,
  LockKeyhole,
  Play,
} from "lucide-react";
import { LabAttempt } from "./SignalLabAttempt";
import { flushPendingWork } from "./useSavedWork";
import ViewObjectivesLink from "./ViewObjectivesLink";
import { FlightLevelRewards } from "./WeekOneStarGuide";
import { missionEvidenceState } from "@/lib/level-two-missions.js";

export default function SimpleLevelThreeEntry({
  data,
  act,
  now,
  onMap,
  onNext,
  nextLevel,
}) {
  const p = data.weekOneProgram,
    day = p.days.find((d) => d.day === 3),
    activities = day?.activities || [];
  const [selected, setSelected] = useState(
    () =>
      p.attempts
        .filter(
          (r) =>
            activities.some((a) => a.id === r.activityId) &&
            !missionEvidenceState(r, now).completed,
        )
        .toSorted(
          (a, b) =>
            (Date.parse(b.data.savedAt || b.data.startedAt) || 0) -
            (Date.parse(a.data.savedAt || a.data.startedAt) || 0),
        )[0]?.activityId || null,
  );
  const [variantId, setVariantId] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bodyRef = useRef(null);
  const activity = activities.find((a) => a.id === selected),
    record = p.attempts.find((r) => r.activityId === selected),
    variant =
      activity?.variants.find((v) => v.id === variantId) ||
      activity?.variants[0];
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [selected, record?._id]);
  const available =
    Boolean(day) &&
    p.progression?.levels?.find((l) => l.day === 3)?.available !== false;
  const dayOpen = day?.state === "OPEN" || p.progression?.mode === "COMPLETION";
  const level = p.levelResults?.find(
    (r) => r.userId === data.user._id && r.day === 3,
  );
  const done = (a) =>
    missionEvidenceState(
      p.attempts.find((r) => r.activityId === a.id),
      now,
    ).completed;
  const complete =
    Boolean(level?.result?.completed && !level.replayPending) ||
    (activities.length === 2 && activities.every(done));
  const leave = async (fn) => {
    if (busy) return;
    setError("");
    try {
      setBusy(true);
      await flushPendingWork(data.user._id);
      fn?.();
    } catch (e) {
      setError(
        e.message || "Your work could not be saved. Stay here and retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const choose = (id) =>
    leave(() => {
      setSelected(id);
      setVariantId(null);
    });
  const start = async () => {
    if (!variant || busy || !available || !dayOpen) return;
    setBusy(true);
    setError("");
    try {
      if (
        !(await act(
          "week1/program/attempt-start",
          { day: 3, activityId: selected, variantId: variant.id },
          "Mission started. Your energy is unchanged; your progress saves automatically.",
        ))
      )
        throw Error("Starting was not confirmed. Try again.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="pip-signal-lab simple-level-three"
      aria-label="Kiko's Signal Lab"
    >
      <header className="simple-level-header">
        <div>
          <span>LEVEL 3 / LEARN BY EXPLAINING</span>
          <h2>
            {record
              ? selected === "D3-G01"
                ? "Explain a clue"
                : "Follow a click"
              : "Help Kiko understand."}
          </h2>
        </div>
        {record && (
          <button
            className="lab-secondary"
            disabled={busy}
            onClick={() => choose(null)}
          >
            Missions
          </button>
        )}
        <ViewObjectivesLink level={3} ownerId={data.user._id} />
        <button
          className="lab-secondary"
          disabled={busy}
          onClick={() => leave(onMap)}
        >
          <Compass size={15} /> Sky map
        </button>
      </header>
      <FlightLevelRetry data={data} act={act} day={3} now={now}/>
      {error && (
        <p className="signal-lab-error" role="alert">
          {error}
        </p>
      )}
      {!available ? (
        <div className="signal-lab-locked">
          <LockKeyhole size={40} />
          <h3>Finish Level 2 to open these missions.</h3>
        </div>
      ) : (
        <>
          <div className="simple-level-body" ref={bodyRef}>
            {!selected ? (
              <div className="simple-lab-home">
                <div className="simple-lab-home-intro">
                  <img
                    src="/images/pip/pip-welcoming.webp"
                    alt="Kiko welcomes you"
                  />
                  <div>
                    <span>YOU TRY IT. THEN TEACH ME.</span>
                    <h3>Two missions. Three simple steps.</h3>
                    <p>
                      Read the case → try the challenge → explain what you
                      learned.
                    </p>
                  </div>
                </div>
                <nav
                  className="simple-mission-choices"
                  aria-label="Lab missions"
                >
                  {activities.map((a, i) => {
                    const r = p.attempts.find((r) => r.activityId === a.id),
                      Icon = i === 0 ? Lightbulb : MousePointer2;
                    return (
                      <button
                        key={a.id}
                        disabled={busy}
                        onClick={() => choose(a.id)}
                      >
                        <Icon size={40} />
                        <small>MISSION 0{i + 1}</small>
                        <h4>{i === 0 ? "Explain a clue" : "Follow a click"}</h4>
                        <p>
                          {i === 0
                            ? "Spot what changes the story. Explain what the evidence supports."
                            : "Put a click’s journey in order. Explain how the result reaches the screen."}
                        </p>
                        <strong>
                          {done(a) ? (
                            <>
                              <Check size={16} /> Completed
                            </>
                          ) : r ? (
                            "Continue mission"
                          ) : (
                            "Play mission"
                          )}
                          <ArrowRight size={18} />
                        </strong>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ) : (
              <>
                {!record && (
                  <div className="simple-case-bar">
                    <button disabled={busy} onClick={() => choose(null)}>
                      <ArrowLeft size={14} /> Missions
                    </button>
                    {!record && (
                      <span>
                        {selected === "D3-G01"
                          ? "Mission 1 · Explain a clue"
                          : "Mission 2 · Follow a click"}
                      </span>
                    )}
                  </div>
                )}
                {record ? (
                  <LabAttempt
                    key={`${data.user._id}:${record._id}:${record.data.startedAt}`}
                    record={record}
                    ownerId={data.user._id}
                    now={now}
                    act={act}
                    dayOpen={dayOpen}
                    paused={busy}
                    complete={complete}
                    onOther={() =>
                      choose(activities.find((a) => a.id !== selected)?.id)
                    }
                    onNext={nextLevel?.available ? onNext : null}
                    data={data}
                  />
                ) : (
                  <div className="simple-case-picker">
                    <div>
                      <span className="simple-lab-kicker">CHOOSE A CASE</span>
                      <h3>
                        {selected === "D3-G01"
                          ? "Which mystery will you explain?"
                          : "Which action will you follow?"}
                      </h3>
                      <p>
                        Pick a case. Kiko will guide you one step at a time.
                      </p>
                      <div
                        className="simple-case-options"
                        aria-label="Choose a lab case"
                      >
                        {activity?.variants.map((v) => (
                          <button
                            key={v.id}
                            aria-pressed={variant?.id === v.id}
                            disabled={busy}
                            onClick={() => setVariantId(v.id)}
                          >
                            {v.name}
                            {variant?.id === v.id && <Check size={17} />}
                          </button>
                        ))}
                      </div>
                      <button
                        className="lab-primary"
                        disabled={busy || !dayOpen || !variant}
                        onClick={start}
                      >
                        <Play size={17} />
                        {busy ? "Starting…" : "Play this case"}
                      </button>
                      <small>
                        {activity?.durationMinutes} minutes · your saved timer
                        begins when the mission starts.
                      </small>
                    </div>
                    <img
                      src="/images/pip/pip-guiding.webp"
                      alt="Kiko guides your next step"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <footer className="simple-level-footer">
            <FlightLevelRewards data={data} day={3} compact />
            {complete && nextLevel?.available && !record && (
              <button
                className="lab-primary"
                disabled={busy}
                onClick={() => leave(onNext)}
              >
                Level 4 <ArrowRight size={16} />
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
