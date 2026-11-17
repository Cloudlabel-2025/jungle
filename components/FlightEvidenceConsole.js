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
import { reportPrompts } from "@/lib/final-flight-games.js";

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
  return (
    <section
      className={`flight-evidence-console ${passport ? "research-passport" : "fire-report"}`}
      aria-label={passport ? "Research passport" : "FIRE evidence report"}
    >
      <nav aria-label="Evidence checkpoints">
        {fields.map((k, i) => (
          <button
            key={k}
            aria-pressed={i === index}
            className={present(k) ? "is-filled" : ""}
            disabled={game.busy}
            onClick={() => game.move(i)}
          >
            {present(k) ? <Check size={13} /> : <span>{i + 1}</span>}
            <small>{fieldLabels[k] || k}</small>
          </button>
        ))}
      </nav>
      <div className="evidence-writing">
        <span className="finale-eyebrow">
          {passport ? "PASSPORT STAMP" : "FIRE REPORT"} {index + 1} /{" "}
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
        <div className="evidence-writing-meta">
          <small>
            {game.count}/{game.total} checkpoints recorded
          </small>
          <small>
            {key === "url"
              ? "Use a fresh, publicly readable chat"
              : `${value.trim().split(/\s+/).filter(Boolean).length} words · clear, distinct explanations earn stronger results`}
          </small>
        </div>
        <div className="finale-actions">
          <button
            className="finale-button secondary"
            disabled={index === 0 || game.busy}
            onClick={() => game.move(index - 1)}
          >
            <ArrowLeft size={16} /> Back
          </button>
          {index < fields.length - 1 ? (
            <button
              className="finale-button"
              disabled={game.busy}
              onClick={() => game.move(index + 1)}
            >
              Next checkpoint <ArrowRight size={16} />
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
              {game.expired ? "Transmit saved evidence" : "Transmit discovery"}
            </button>
          )}
        </div>
        {(game.expired || game.count === game.total) &&
          index < fields.length - 1 && (
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
    </section>
  );
}
