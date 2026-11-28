"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  Compass,
  BookOpen,
  Send,
  ExternalLink,
  Plane,
  LockKeyhole,
} from "lucide-react";
import { FinaleAttempt } from "./FlightFinale";
import FlightEvidenceConsole, { AttemptDebrief } from "./FlightEvidenceConsole";
import { attemptComplete } from "@/lib/final-flight-games.js";
import { companionText } from "@/lib/companion-name.js";

export default function FinalFlightTrial({
  activities,
  selected,
  activity,
  record,
  choose,
  start,
  busy,
  now,
  open,
  ownerId,
  act,
  attempts,
}) {
  if (!selected)
    return (
      <div className="trial-arrival">
        <div className="trial-horizon" aria-hidden="true">
          <div className="trial-crosshair" />
          <Plane size={70} />
          <span>FINAL FLIGHT / TWO CHECKPOINTS</span>
        </div>
        <div className="trial-brief">
          <span className="finale-eyebrow">YOU HAVE THE CONTROLS</span>
          <h3>
            Bring your learning
            <br />
            in for landing.
          </h3>
          <p>
            One fresh discovery. One knowledge run. Show how far you have
            travelled.
          </p>
        </div>
        <nav className="trial-flightplan" aria-label="Final flight checkpoints">
          {activities.map((a, i) => {
            const r = attempts.find((r) => r.activityId === a.id),
              done = attemptComplete(r);
            return (
              <button key={a.id} disabled={busy} onClick={() => choose(a.id)}>
                <span className="trial-checkpoint-number">
                  {done ? <Check /> : String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <small>
                    {i === 0 ? "DISCOVERY PASSPORT" : "KNOWLEDGE RUN"}
                  </small>
                  <strong>
                    {i === 0 ? "Then vs. now" : "Clear the checkpoints"}
                  </strong>
                  <p>
                    {i === 0
                      ? "Revisit your original question with stronger research."
                      : "Make your call, one question at a time."}
                  </p>
                </span>
                <span className="trial-checkpoint-action">
                  {done ? "Saved result" : r ? "Resume" : "Enter"}
                  <ArrowRight size={18} />
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  const quiz = activity?.kind === "QUIZ";
  return (
    <div className="trial-stage">
      <div className="finale-subnav">
        <button disabled={busy} onClick={() => choose(null)}>
          <ArrowLeft size={15} /> Flight plan
        </button>
        <h3>{quiz ? "Knowledge run" : "Discovery passport"}</h3>
        <span>
          {quiz
            ? "ONE QUESTION / ONE DECISION"
            : "YOUR ORIGINAL QUESTION / A FRESH LOOK"}
        </span>
      </div>
      {record ? (
        <FinaleAttempt
          key={`${ownerId}:${record._id}:${record.data.startedAt}`}
          record={record}
          ownerId={ownerId}
          now={now}
          open={open}
          act={act}
        >
          {(game) =>
            (game.complete && !game.revising) || game.sealed ? (
              <AttemptDebrief game={game} record={record} />
            ) : quiz ? (
              <KnowledgeRun game={game} record={record} />
            ) : (
              <DiscoveryPassport game={game} record={record} />
            )
          }
        </FinaleAttempt>
      ) : (
        <div className="trial-launch">
          <div className="trial-launch-emblem">
            {quiz ? <Compass size={66} /> : <BookOpen size={66} />}
          </div>
          <span className="finale-eyebrow">
            {quiz ? "FINAL CHECKPOINT" : "RETURN TO YOUR FIRST DISCOVERY"}
          </span>
          <h4>
            {quiz
              ? `${activity?.questions?.length || 0} decisions. Make each one count.`
              : "Same question. A more capable explorer."}
          </h4>
          <p>
            {quiz
              ? "Choose one answer per checkpoint. Move back to review your decisions before sealing the run. Your saved timer continues if you leave."
              : "Your original question is pinned to your account. Start to open your old research, conduct a fresh AI conversation and record what changed using FIRE and STORY."}
          </p>
          <div className="trial-launch-facts">
            <span>{activity?.durationMinutes} minutes</span>
            <span>
              {quiz ? "One sealed quiz attempt" : "Fresh public chat required"}
            </span>
            <span>Account-saved progress</span>
          </div>
          <button
            className="finale-button"
            disabled={busy || !open || (quiz && !activity?.questions?.length)}
            onClick={() => start()}
          >
            <Flag size={17} />
            {busy
              ? "Starting…"
              : quiz
                ? "Begin knowledge run"
                : "Open discovery passport"}
          </button>
          <small>Starting and continuing missions are free. Your timer starts after the server confirms.</small>
        </div>
      )}
    </div>
  );
}

export function KnowledgeRun({ game, record }) {
  const [review, setReview] = useState(false),
    questions = record.data.activity.questions || [],
    index = Math.min(game.cursor, questions.length - 1),
    question = questions[index];
  if (!question)
    return (
      <p className="finale-warning">
        No questions are available. Ask CC to check this mission’s content.
      </p>
    );
  return (
    <section className="knowledge-run" aria-label="Knowledge checkpoint">
      <nav className="knowledge-runway" aria-label="Quiz checkpoints">
        {questions.map((q, i) => (
          <button
            key={q.id}
            aria-label={`Question ${i + 1}${Number.isInteger(game.answers[q.id]) ? ", answered" : ""}`}
            aria-pressed={index === i && !review}
            className={Number.isInteger(game.answers[q.id]) ? "is-filled" : ""}
            disabled={game.busy}
            onClick={() => {
              setReview(false);
              game.move(i);
            }}
          >
            {index === i && !review ? (
              <Plane size={14} />
            ) : Number.isInteger(game.answers[q.id]) ? (
              <Check size={14} />
            ) : (
              i + 1
            )}
          </button>
        ))}
      </nav>
      {review ? (
        <div className="knowledge-review">
          <span className="finale-eyebrow">BEFORE YOU SEAL THE RUN</span>
          <h4>
            {game.count} of {game.total} decisions recorded
          </h4>
          <p>
            Check any checkpoint above to change your answer. Sealing ends this
            quiz attempt.
          </p>
          <button
            className="finale-button"
            disabled={
              game.busy ||
              !game.canWrite ||
              (!game.expired && game.count !== game.total)
            }
            onClick={game.submit}
          >
            <LockKeyhole size={17} />
            {game.expired ? "Seal last saved answers" : "Seal knowledge run"}
          </button>
        </div>
      ) : (
        <div className="knowledge-question">
          <span className="finale-eyebrow">
            CHECKPOINT {String(index + 1).padStart(2, "0")} / {questions.length}
          </span>
          <h4>{question.question}</h4>
          <div className="knowledge-options">
            {question.options.map((option, i) => (
              <button
                key={i}
                aria-pressed={game.answers[question.id] === i}
                disabled={game.readOnly || game.busy}
                onClick={() => game.update(question.id, i)}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                <strong>{option}</strong>
                {game.answers[question.id] === i && <Check size={20} />}
              </button>
            ))}
          </div>
          <div className="finale-actions">
            <button
              className="finale-button secondary"
              disabled={index === 0 || game.busy}
              onClick={() => game.move(index - 1)}
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <span>
              {game.count}/{game.total} recorded
            </span>
            <button
              className="finale-button"
              disabled={game.busy}
              onClick={() =>
                index === questions.length - 1
                  ? setReview(true)
                  : game.move(index + 1)
              }
            >
              {index === questions.length - 1
                ? "Review flight decisions"
                : "Next checkpoint"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
      {!review && (
        <button
          className="finale-text-button"
          disabled={game.busy}
          onClick={() => setReview(true)}
        >
          Review & seal <Send size={14} />
        </button>
      )}
    </section>
  );
}

function DiscoveryPassport({ game, record }) {
  const d = record.data;
  return (
    <div className="discovery-passport">
      <aside className="passport-origin">
        <span className="finale-eyebrow">STAMP 01 / WHERE YOU BEGAN</span>
        <BookOpen size={35} />
        <h4>Your first discovery</h4>
        <p>{companionText(d.variant?.brief || "")}</p>
        {d.variant?.sourceUrl && (
          <a
            href={d.variant.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} /> Open original research
          </a>
        )}
        <div className="passport-mission">
          <strong>Make the difference visible.</strong>
          <p>
            Use a new chat. Challenge weak claims. Explain what you now
            understand and what remains uncertain.
          </p>
        </div>
      </aside>
      <FlightEvidenceConsole game={game} record={record} passport />
    </div>
  );
}
