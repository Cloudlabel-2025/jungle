"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Send,
} from "lucide-react";
import useSavedWork from "./useSavedWork";
import SimpleSignalChallenge from "./SimpleSignalChallenge";
import {
  storyEvidencePrompts,
  missionAnswerPresent,
} from "@/lib/level-three-missions.js";
import { missionEvidenceState } from "@/lib/level-two-missions.js";
import { labTime } from "@/lib/signal-lab.js";

export function LabAttempt({
  record,
  ownerId,
  now,
  act,
  dayOpen,
  paused,
  complete,
  onOther,
  onNext,
  data,
}) {
  const d = record.data,
    fields = d.activity.fields,
    saved = missionEvidenceState(record, now),
    general = record.activityId === "D3-G01";
  const [answers, setAnswers] = useState(d.draft || {}),
    [labState, setLabState] = useState(
      d.labState || { circuit: [], fault: "none", prediction: "" },
    );
  const [step, setStep] = useState(saved.firstMissing),
    [mode, setMode] = useState(
      saved.completed
        ? "result"
        : fields.some(
              (k) => k !== "sequence" && missionAnswerPresent(k, d.draft?.[k]),
            ) &&
            (general ||
              missionAnswerPresent(
                "sequence",
                d.draft?.sequence,
                d.variant.cards,
              ))
          ? "teach"
          : d.labState?.prediction ||
              d.labState?.circuit?.length ||
              d.draft?.sequence?.length ||
              fields.some(
                (k) =>
                  k !== "sequence" && missionAnswerPresent(k, d.draft?.[k]),
              )
            ? "build"
            : "read",
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revising, setRevising] = useState(false),
    [history, setHistory] = useState(false);
  const [practice, setPractice] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [hasTested, setHasTested] = useState(
    Boolean(
      d.labState?.prediction ||
      fields.some(
        (k) => k !== "sequence" && missionAnswerPresent(k, d.draft?.[k]),
      ),
    ),
  );
  const [lastSaved, setLastSaved] = useState({
    answers: d.draft || {},
    labState: d.labState || { circuit: [], fault: "none", prediction: "" },
  });
  const canWrite =
    dayOpen || d.extensions?.some((e) => new Date(now) <= new Date(e.deadline));
  const readOnly = saved.expired || !canWrite || (saved.completed && !revising);
  const work = useSavedWork({
    value: { answers, labState },
    initialValue: {
      answers: d.draft || {},
      labState: d.labState || { circuit: [], fault: "none", prediction: "" },
    },
    initialVersion: record.version,
    ownerId,
    enabled: !readOnly && !busy,
    endpoint: "/api/week1/program/attempt-save",
    onSaved: setLastSaved,
    onReconciled: value => { setAnswers(value.answers); setLabState(value.labState); },
    attemptStartedAt:d.startedAt,
    submittedAt:d.submittedAt,
    buildBody: (value, version) => ({
      attemptId: record._id,
      attemptVersion: version,
      answers: value.answers,
      labState: value.labState,
    }),
  });
  useEffect(() => work.syncVersion(record.version), [record.version]);
  const visible = saved.expired ? lastSaved.answers : answers,
    visibleLab = saved.expired ? lastSaved.labState : labState;
  const answered = fields.filter((k) =>
    missionAnswerPresent(k, visible[k], d.variant.cards),
  ).length;
  const firstWrittenMissing = fields.findIndex(
    (k) => k !== "sequence" && !missionAnswerPresent(k, visible[k]),
  );
  const explanationStep =
    firstWrittenMissing < 0 ? fields.length - 1 : firstWrittenMissing;
  const key = fields[step],
    prompt = storyEvidencePrompts[key] || [
      key,
      "Explain what you learned in your own words.",
    ];
  const navigate = async (next) => {
    if (busy || paused) return;
    setError("");
    try {
      await work.flush();
      next();
    } catch (e) {
      setError(e.message);
    }
  };
  const submit = async () => {
    if (busy || paused) return;
    setError("");
    try {
      const pending = work.flush(undefined,{force:true});
      setBusy(true);
      await pending;
      const result = await act(
        "week1/program/attempt-submit",
        {
          attemptId: record._id,
          attemptVersion: work.getVersion(),
          answers: visible,
          useSavedDraft: true,
        },
        "Your lab discovery is saved.",
      );
      if (!result)
        throw Error(
          "Submission was not confirmed. Your explanation remains here; retry.",
        );
      setRevising(false);
      setMode("result");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const consent = async () => {
    setBusy(true);
    try {
      if (
        !(await act(
          "week1/program/share-consent",
          { activityId: record.activityId, allowed: true },
          "Anonymous summary consent saved.",
        ))
      )
        throw Error("Consent was not saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="signal-lab-attempt simple-lab-attempt">
      <div className="signal-lab-toolbar">
        <strong>{d.variant.name}</strong>
        <span role="timer" aria-label="Lab time remaining">
          <Clock3 size={13} />
          {saved.completed ? "SAVED" : labTime(d.deadline, now)}
        </span>
        <span className="signal-lab-save" role="status">
          {mode === "practice"
            ? "Practice run · saved result unchanged"
            : busy
              ? "Transmitting…"
              : work.status ||
                (d.savedAt ? "Saved lab restored" : "Auto-save active")}
        </span>
      </div>
      {mode !== "result" && (
        <nav className="simple-play-steps" aria-label="Mission steps">
          {[
            ["read", "Read the case"],
            ["build", "Try it"],
            ["teach", "Explain it"],
          ].map(([id, label], i) => (
            <button
              key={id}
              aria-current={
                mode === id || (mode === "practice" && id === "build")
                  ? "step"
                  : undefined
              }
              disabled={
                busy || paused || (id === "teach" && !hasTested && !readOnly)
              }
              onClick={() =>
                navigate(() => {
                  if (id === "teach" && fields[step] === "sequence")
                    setStep(explanationStep);
                  setMode(id);
                })
              }
            >
              <span>{i + 1}</span>
              {label}
            </button>
          ))}
        </nav>
      )}
      {saved.expired && !saved.completed && (
        <p className="signal-lab-error">
          Your timer ended. Your saved board and notes are read-only; transmit
          the last saved evidence or ask MC for an extension.
        </p>
      )}
      {error && (
        <p className="signal-lab-error" role="alert">
          {error}
        </p>
      )}
      {mode === "result" ? (
        <div className="signal-lab-result">
          <div className="signal-lab-medal">
            <CheckCheck size={54} />
          </div>
          <span className="lab-eyebrow">
            {saved.completed ? "MISSION COMPLETE" : "EVIDENCE SAVED"}
          </span>
          <h3>
            {!saved.completed
              ? "Your saved work is safe."
              : general
                ? "You connected the explanation!"
                : "You traced the hidden system!"}
          </h3>
          <p>
            Your challenge and explanation are saved.
            {complete
              ? " Both missions are complete."
              : " Complete the other mission next."}
          </p>

          <div className="signal-lab-result-actions">
            <button
              className="lab-primary"
              disabled={busy || paused}
              onClick={
                !saved.completed
                  ? () => setMode("teach")
                  : complete && onNext
                    ? onNext
                    : onOther
              }
            >
              {!saved.completed
                ? "Review saved answers"
                : complete && onNext
                  ? "Continue to Level 4"
                  : "Choose the other mission"}
              <ArrowRight size={16} />
            </button>
            <button className="lab-secondary" onClick={() => setMode("teach")}>
              Review explanation
            </button>
          </div>
          <details className="simple-result-more">
            <summary>More options</summary>
            <div className="signal-lab-result-actions">
              <button
                className="lab-secondary"
                onClick={() => {
                  setPractice({
                    sequence: [...(visible.sequence || [])],
                    labState: structuredClone(visibleLab),
                  });
                  setMode("practice");
                }}
              >
                Practice simulation
              </button>
              {canWrite && !saved.expired && (
                <button
                  className="lab-secondary"
                  onClick={() => {
                    setRevising(true);
                    setMode("teach");
                  }}
                >
                  Revise discovery
                </button>
              )}
            </div>
            <div className="signal-lab-saved-tools">
              <button disabled={busy} onClick={consent}>
                Allow an approved anonymous summary
              </button>
              <button
                onClick={() => setHistory(!history)}
                aria-expanded={history}
              >
                Transmission log · {d.submissions.length}
              </button>
            </div>
            {history && (
              <div className="signal-lab-history">
                {[...d.submissions].reverse().map((s) => (
                  <p key={s.id}>
                    {new Date(s.at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    · {s.complete ? "Complete" : "Partial"} evidence
                    {s.late ? " · after timer" : ""}
                  </p>
                ))}
              </div>
            )}
          </details>
        </div>
      ) : mode === "read" || mode === "build" || mode === "practice" ? (
        <SimpleSignalChallenge
          stage={mode === "read" ? "read" : "build"}
          onTested={() => setHasTested(true)}
          onReady={() => navigate(() => setMode("build"))}
          activityId={record.activityId}
          variant={d.variant}
          sequence={
            mode === "practice" ? practice.sequence : visible.sequence || []
          }
          labState={mode === "practice" ? practice.labState : visibleLab}
          onSequence={(sequence) =>
            mode === "practice"
              ? setPractice((old) => ({ ...old, sequence }))
              : setAnswers((old) => ({ ...old, sequence }))
          }
          onLabState={(next) =>
            mode === "practice"
              ? setPractice((old) => ({ ...old, labState: next }))
              : setLabState(next)
          }
          readOnly={mode === "practice" ? false : readOnly}
          disabled={busy || paused}
          onTeach={() =>
            navigate(() => {
              if (fields[step] === "sequence") setStep(explanationStep);
              setMode("teach");
            })
          }
        />
      ) : (
        <section
          className="simple-lab-explain"
          aria-label="Explain your discovery"
        >
          <header>
            <img
              src="/images/pip/pip-thinking.webp"
              alt="Kiko listens to your explanation"
            />
            <div>
              <span className="simple-lab-kicker">STEP 3 / YOUR TURN</span>
              <h3>Help Kiko understand.</h3>
              <p>One short answer at a time. Your words save automatically.</p>
            </div>
            <button
              className="lab-secondary"
              disabled={busy || paused}
              onClick={() => navigate(() => setMode("read"))}
            >
              View case
            </button>
          </header>
          <div className="simple-answer-progress">
            <span>
              Answer{" "}
              {Math.max(
                1,
                fields.filter((k) => k !== "sequence").indexOf(key) + 1,
              )}{" "}
              of {fields.filter((k) => k !== "sequence").length}
            </span>
            <progress
              value={answered}
              max={fields.length}
              aria-label="Explanation progress"
            />
            <button
              className="simple-answers-toggle"
              onClick={() => setShowAnswers(!showAnswers)}
              aria-expanded={showAnswers}
            >
              Jump to an answer
            </button>
          </div>
          {showAnswers && (
            <nav
              className="simple-answer-jumps"
              aria-label="Explanation checkpoints"
            >
              {fields.map((field, i) => (
                <button
                  key={field}
                  aria-label={"Explain " + field}
                  aria-current={step === i ? "step" : undefined}
                  disabled={busy || paused}
                  onClick={() =>
                    navigate(() => {
                      if (field === "sequence") setMode("build");
                      else setStep(i);
                    })
                  }
                >
                  {missionAnswerPresent(
                    field,
                    visible[field],
                    d.variant.cards,
                  ) && <Check size={13} />}{" "}
                  {field === "sequence"
                    ? "Click journey"
                    : storyEvidencePrompts[field]?.[0] || field}
                </button>
              ))}
            </nav>
          )}
          <div className="simple-one-answer">
            <small>{prompt[0]}</small>
            <h4>
              {{
                scene: "What is happening?",
                need: "What needs to be understood?",
                how: "How does it work?",
                concept: "Which idea does this explain?",
                takeaway: "What did you learn?",
                evidence: "Which clues support your answer?",
                uncertainty: "What is still uncertain?",
                components: "What does each part do?",
                failure: "Where could it go wrong?",
                limit: "What can this model not explain?",
              }[key] || prompt[0]}
            </h4>
            <label htmlFor={"lab-" + record._id + "-" + key}>{prompt[1]}</label>
            <textarea
              id={"lab-" + record._id + "-" + key}
              maxLength={8000}
              value={typeof visible[key] === "string" ? visible[key] : ""}
              readOnly={readOnly}
              disabled={busy || paused}
              placeholder="Kiko, here’s what I learned…"
              onChange={(e) =>
                setAnswers((old) => ({ ...old, [key]: e.target.value }))
              }
            />
            <small>
              {answered}/{fields.length} answers drafted in this mission · use
              clear, distinct explanations for stronger stars.
            </small>
          </div>
          <footer>
            <button
              className="lab-secondary"
              disabled={busy || paused}
              onClick={() => {
                  if (step === 0 || fields[step - 1] === "sequence")
                    setMode("build");
                  else setStep(step - 1);
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <span className="simple-mobile-answer-count">
              {Math.max(
                1,
                fields.filter((k) => k !== "sequence").indexOf(key) + 1,
              )}
              /{fields.filter((k) => k !== "sequence").length}
            </span>
            {step < fields.length - 1 ? (
              <button
                className="lab-primary"
                disabled={
                  busy ||
                  paused ||
                  (!readOnly &&
                    !missionAnswerPresent(key, visible[key], d.variant.cards))
                }
                onClick={() => setStep(step + 1)}
              >
                Next answer <ArrowRight size={15} />
              </button>
            ) : saved.completed && !revising ? (
              <button className="lab-primary" onClick={() => setMode("result")}>
                Return to result
              </button>
            ) : (
              <button
                className="lab-primary"
                disabled={
                  busy ||
                  paused ||
                  !canWrite ||
                  (!saved.expired && answered !== fields.length)
                }
                onClick={submit}
              >
                <Send size={15} />
                {busy
                  ? "Sending…"
                  : saved.expired
                    ? "Transmit saved notes"
                    : "Send my explanation"}
              </button>
            )}
          </footer>
        </section>
      )}
    </div>
  );
}
