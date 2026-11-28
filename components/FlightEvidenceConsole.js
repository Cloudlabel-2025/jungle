"use client";
import { useState } from "react";
import {
  Check,
  Send,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { fieldLabels } from "@/lib/week-one-catalog.js";
import { reportPrompts, fireJourney } from "@/lib/final-flight-games.js";

export function AttemptDebrief({ game, record }) {
  const [review, setReview] = useState(false),
    [revision, setRevision] = useState(-1);
  const d = record.data,
    submissions = d.submissions,
    selected = submissions[revision < 0 ? submissions.length - 1 : revision];
  return (
    <div className="finale-debrief">
      <div className="finale-seal">
        <Check size={36} />
      </div>
      <span className="finale-eyebrow">
        {game.complete ? "MISSION SECURED" : "ATTEMPT SAVED"}
      </span>
      <h3>
        {game.complete
          ? "Your work is on the flight record."
          : "Your saved result needs attention."}
      </h3>
      <p>
        {game.complete
          ? "Your evidence is saved. Your level rewards appear when both missions are complete."
          : "A sealed quiz with missing answers does not complete this mission. Ask MC or CC to allow a replay."}
      </p>
      {d.result?.percent != null && (
        <strong className="finale-score">
          {d.result.percent.toFixed(0)}% <small>knowledge score</small>
        </strong>
      )}
      <div className="finale-actions">
        <button
          className="finale-button secondary"
          onClick={() => setReview(!review)}
        >
          <BookOpen size={16} />
          {review ? "Close flight record" : "View saved evidence"}
        </button>
        {!game.sealed && !game.expired && game.canWrite && (
          <button
            className="finale-button"
            onClick={() => game.setRevising(true)}
          >
            <RotateCcw size={16} /> Refine evidence
          </button>
        )}
      </div>
      {review && (
        <section className="finale-record" aria-label="Saved mission evidence">
          <nav aria-label="Submission revisions">
            {submissions.map((s, i) => (
              <button
                key={s.id || i}
                aria-pressed={
                  (revision < 0 ? submissions.length - 1 : revision) === i
                }
                onClick={() => setRevision(i)}
              >
                Transmission {i + 1}
              </button>
            ))}
          </nav>
          {Object.entries(selected?.answers || {}).map(([k, v]) => (
            <div key={k}>
              <strong>
                {d.activity.questions?.find((q) => q.id === k)?.question ||
                  fieldLabels[k] ||
                  k}
              </strong>
              <p>
                {d.activity.kind === "QUIZ"
                  ? (d.activity.questions.find((q) => q.id === k)?.options[v] ??
                    "Not answered")
                  : String(v)}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default function FlightEvidenceConsole({
  game,
  record,
  passport = false,
}) {
  const fields = record.data.activity.fields,
    index = Math.min(game.cursor, fields.length - 1),
    key = fields[index],
    value = game.answers[key] || "";
  const present = (k) => Boolean(String(game.answers[k] || "").trim());
  const missing = fields.filter(k => !present(k));
  const stages=fireJourney(fields),stage=stages.find(step=>step.fields.includes(key));
  const journey=passport?fields:stages.flatMap(step=>step.fields),position=journey.indexOf(key);
  const checkpointButtons=keys=>keys.map(k=>{const i=fields.indexOf(k);return <button key={k} type="button" aria-label={`${i+1}. ${fieldLabels[k]||k}${present(k)?", filled":", answer needed"}`} title={fieldLabels[k]||k} aria-pressed={i===index} className={present(k)?"is-filled":""} disabled={game.busy} onClick={()=>game.move(i)}>{present(k)?<Check size={13}/>:<span>{i+1}</span>}<small>{fieldLabels[k]||k}</small></button>;});
  return (
    <section
      className={`flight-evidence-console ${passport ? "research-passport" : "fire-report"}`}
      aria-label={passport ? "Research passport" : "FIRE evidence report"}
    >
      {passport ? <nav aria-label="Evidence checkpoints">{checkpointButtons(fields)}</nav> : <nav className="fire-journey" aria-label="FIRE investigation journey">
        {stages.map(step=><button type="button" key={step.id} className={step.fields.every(present)?"is-filled":""} aria-current={stage.id===step.id?"step":undefined} aria-pressed={stage.id===step.id} disabled={game.busy} onClick={()=>game.move(fields.indexOf(step.fields.find(k=>!present(k))||step.fields[0]))}>
          <span className="fire-journey-mark">{step.mark||<Send size={16}/>}</span><span className="fire-journey-label">{step.title}<small>{step.fields.filter(present).length}/{step.fields.length}</small></span>
        </button>)}
      </nav>}
      <div className="evidence-writing">
        {!passport && stage.fields.length>1 && <nav className="fire-stage-checkpoints" aria-label={`${stage.title} checkpoints`}>{checkpointButtons(stage.fields)}</nav>}
        <span className="finale-eyebrow">
          {passport ? "PASSPORT STAMP" : "INVESTIGATION STEP"} {position + 1} /{" "}
          {fields.length}
        </span>
        <h3>{fieldLabels[key] || key}</h3>
        <p>
          {reportPrompts[key] ||
            "Explain what you found and how you checked it."}
        </p>
        <label className="sr-only" htmlFor={`finale-note-${record._id}`}>
          {fieldLabels[key] || key}
        </label>
        {key === "url" ? (
          <input
            id={`finale-note-${record._id}`}
            type="url"
            placeholder="https://… shared conversation"
            value={value}
            maxLength={2000}
            readOnly={game.readOnly}
            disabled={game.busy}
            onChange={(e) => game.update(key, e.target.value)}
          />
        ) : (
          <textarea
            id={`finale-note-${record._id}`}
            rows={4}
            maxLength={8000}
            placeholder="Explain it in your own words…"
            value={value}
            readOnly={game.readOnly}
            disabled={game.busy}
            onChange={(e) => game.update(key, e.target.value)}
          />
        )}
        <div className="evidence-submit-controls"><div className="evidence-writing-meta">
          <small>
            {game.count}/{game.total} checkpoints filled{game.savedCount != null ? ` · ${game.savedCount}/${game.total} saved` : ""}
          </small>
          <small>
            {!passport ? game.status || "Auto-save active" : key === "url"
              ? "Use a fresh, publicly readable chat"
              : `${value.trim().split(/\s+/).filter(Boolean).length} words · clear, distinct explanations earn stronger results`}
          </small>
        </div>
        <div className="finale-actions">
          <button
            className="finale-button secondary"
            disabled={position === 0 || game.busy}
            onClick={() => game.move(fields.indexOf(journey[position-1]))}
          >
            <ArrowLeft size={16} /> Back
          </button>
          {position < fields.length - 1 && (passport || game.count < game.total && !game.expired) ? (
            <button
              className="finale-button"
              disabled={game.busy}
              onClick={() => game.move(fields.indexOf(journey[position+1]))}
            >
              {passport ? "Next checkpoint" : "Continue investigation"} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="finale-button"
              disabled={
                game.busy ||
                !game.canWrite ||
                (!game.expired && game.count < game.total)
              }
              onClick={game.submit}
            >
              <Send size={16} />
              {game.busy ? "Saving your report…" : game.expired ? "Transmit saved evidence" : "Transmit discovery"}
            </button>
          )}
        </div>
        <div className="evidence-submit-status" aria-live="polite">
          {game.error ? <p role="alert" className="evidence-submit-error">{game.error}</p> : (passport || game.busy) && <p>{game.busy ? "Saving your answers and confirming your submission. Keep this page open." : game.status || "Your draft saves automatically."}</p>}
          {!game.canWrite && <p className="evidence-submit-error">This mission is read-only. Ask MC or CC to reopen it.</p>}
          {!game.expired && missing.length > 0 && (passport || position===fields.length-1) && <p>{position===fields.length-1 ? `Still needed: ${missing.map(k => fieldLabels[k] || k).join(", ")}.` : `${missing.length} checkpoints left. Follow the trail to complete your investigation.`}</p>}
          {passport && missing.length === 0 && !game.busy && !game.error && game.canWrite && <p>All checkpoints filled. Transmit discovery to finish this mission.</p>}
        </div>
        {passport && (game.expired || game.count === game.total) &&
          position < fields.length - 1 && (
            <button
              className="finale-text-button"
              disabled={game.busy || !game.canWrite}
              onClick={game.submit}
            >
              <Send size={14} />{" "}
              {game.expired
                ? "Transmit saved evidence"
                : "Transmit all recorded evidence"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
