"use client";
import { useState } from "react";
import {
  UserRound,
  DoorClosed,
  DoorOpen,
  FileText,
  FileSearch,
  Fingerprint,
  Scale,
  ArrowLeft,
  ArrowRight,
  Play,
  LockKeyhole,
  Check,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Search,
} from "lucide-react";
import { FinaleAttempt } from "./FlightFinale";
import FlightEvidenceConsole, { AttemptDebrief } from "./FlightEvidenceConsole";
import {
  experimentFeedback,
  attemptComplete,
} from "@/lib/final-flight-games.js";
import { companionText } from "@/lib/companion-name.js";

export default function InvestigationDeck({
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
  const [variantId, setVariantId] = useState(null);
  const variant = activity?.variants?.find((v) => v.id === variantId);
  const technical = activity?.id === "D4-G02";
  if (!selected)
    return (
      <div className="deck-arrival">
        <div className="deck-hero">
          <span className="finale-eyebrow">
            CLAIMS ARE EASY. PROOF TAKES WORK.
          </span>
          <h3>
            Find the crack
            <br />
            in the story.
          </h3>
          <p>
            Open a dossier. Challenge the evidence. Build a test that could
            prove you wrong.
          </p>
          <div className="deck-fire-mark" aria-hidden="true">
            <Scale size={100} />
            <span>F · I · R · E</span>
          </div>
        </div>
        <div className="deck-dossiers">
          {activities.map((a, i) => {
            const r = attempts.find((r) => r.activityId === a.id),
              done = attemptComplete(r);
            return (
              <button
                key={a.id}
                className="deck-dossier"
                onClick={() => {
                  setVariantId(null);
                  choose(a.id);
                }}
                disabled={busy}
              >
                <span className="dossier-tab">CASE FILE / 0{i + 1}</span>
                {i === 0 ? <FileSearch size={48} /> : <Fingerprint size={48} />}
                <h4>{a.name}</h4>
                <p>
                  {i === 0
                    ? "An extraordinary promise. An incomplete evidence trail."
                    : "A familiar identity. A door that opens for the wrong person."}
                </p>
                <strong>
                  {done ? (
                    <>
                      <Check size={16} /> Case secured
                    </>
                  ) : r ? (
                    "Resume investigation"
                  ) : (
                    "Break the seal"
                  )}
                  <ArrowRight size={18} />
                </strong>
              </button>
            );
          })}
        </div>
      </div>
    );
  return (
    <div className="deck-case">
      <div className="finale-subnav">
        <button disabled={busy} onClick={() => choose(null)}>
          <ArrowLeft size={15} /> Case files
        </button>
        <h3>{activity?.name}</h3>
        <span>{technical ? "PERMISSION BOUNDARY" : "CLAIM VERIFICATION"}</span>
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
            ) : (
              <DeckBoard record={record} technical={technical} game={game} />
            )
          }
        </FinaleAttempt>
      ) : (
        <div className="deck-case-selection">
          <aside>
            <Search size={36} />
            <h4>Choose your dossier</h4>
            <p>
              Inspect a case before committing. Your timer starts only when you
              open the investigation.
            </p>
            {activity?.variants.map((v) => (
              <button
                key={v.id}
                aria-pressed={variantId === v.id}
                onClick={() => setVariantId(v.id)}
                disabled={busy}
              >
                {v.name}
                <ArrowRight size={14} />
              </button>
            ))}
          </aside>
          <article>
            <span className="finale-eyebrow">SEALED BRIEFING</span>
            <h4>{variant?.name || "Select a case file"}</h4>
            <p>
              {variant
                ? companionText(variant.brief)
                : "Every claim needs a fair test. Every permission needs a boundary."}
            </p>
            <button
              className="finale-button"
              disabled={!variant || busy || !open}
              onClick={() => start(variant.id)}
            >
              <LockKeyhole size={16} />
              {busy ? "Opening…" : "Open investigation · 1 energy"}
            </button>
            <small>
              {activity?.durationMinutes} minutes · case locks on confirmed
              start
            </small>
          </article>
        </div>
      )}
    </div>
  );
}

function DeckBoard({ record, technical, game }) {
  const s = game.state,
    report = s.mode === "report",
    brief = companionText(record.data.variant?.brief || ""),
    clues = brief
      .replace(/^Starter mission · fictional scenario\.\s*/, "")
      .match(/[^.!?]+[.!?]*/g) || [brief];
  const inspection = Math.min(s.inspected || 0, clues.length - 1),
    feedback = experimentFeedback(technical, {
      actor: s.actor || "self",
      policy: s.policy || "signin",
      plan: s.plan || "success",
    });
  return (
    <>
      <div className="deck-work-modes">
        <button
          aria-pressed={!report}
          onClick={() => game.patch({ mode: "board" })}
          disabled={game.readOnly || game.busy}
        >
          <Eye size={16} /> Evidence & tests
        </button>
        <button
          aria-pressed={report}
          onClick={() => game.patch({ mode: "report" })}
          disabled={game.readOnly || game.busy}
        >
          <Flame size={16} /> Build FIRE report{" "}
          <small>
            {game.count}/{game.total}
          </small>
        </button>
      </div>
      <div
        className={`deck-evidence-room ${report ? "has-field-notebook" : ""}`}
      >
        <section className="deck-clue-reader">
          <span className="finale-eyebrow">
            PINNED EVIDENCE / {inspection + 1} OF {clues.length}
          </span>
          <blockquote>{clues[inspection]}</blockquote>
          <div className="deck-clue-pins">
            {clues.map((c, i) => (
              <button
                key={i}
                aria-label={`Inspect clue ${i + 1}`}
                aria-pressed={inspection === i}
                disabled={game.readOnly || game.busy}
                onClick={() => game.patch({ inspected: i })}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="deck-note">
            Read every clue. The strongest claim may still have missing
            evidence.
          </p>
          <div className="deck-scratch-line" aria-hidden="true" />
        </section>
        {report ? (
          <aside className="deck-field-notebook">
            <span className="finale-eyebrow">
              YOUR FIELD NOTEBOOK / KEEP THE CLUES IN SIGHT
            </span>
            <FlightEvidenceConsole game={game} record={record} />
          </aside>
        ) : (
          <section className="deck-test-bench">
            <span className="finale-eyebrow">
              {technical
                ? "SANDBOX / FICTIONAL REQUEST"
                : "VERIFICATION DESIGN / PRACTICE"}
            </span>
            <h4>
              {technical
                ? "Who gets through the door?"
                : "Can your test challenge the claim?"}
            </h4>
            <DeckExperimentVisual
              technical={technical}
              state={s}
              feedback={feedback}
            />
            {technical ? (
              <>
                <div className="deck-switches">
                  <fieldset disabled={game.readOnly || game.busy}>
                    <legend>Requested record</legend>
                    {[
                      ["self", "My crew record"],
                      ["other", "Another crew record"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={(s.actor || "self") === id}
                        onClick={() => game.patch({ actor: id, runs: 0 })}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                  <fieldset disabled={game.readOnly || game.busy}>
                    <legend>Server permission rule</legend>
                    {[
                      ["signin", "Signed in only"],
                      ["owner", "Signed in + ownership"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={(s.policy || "signin") === id}
                        onClick={() => game.patch({ policy: id, runs: 0 })}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                </div>
                <p className="deck-note">
                  Ownership sandbox only. Diagnose your pinned case separately;
                  role mismatches may need a different correction.
                </p>
              </>
            ) : (
              <div className="deck-test-plans">
                {[
                  ["success", "Show only successful runs"],
                  ["assume", "Accept the confident promise"],
                  ["fair", "Keep all runs and use a comparison"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={(s.plan || "success") === id}
                    disabled={game.readOnly || game.busy}
                    onClick={() => game.patch({ plan: id, runs: 0 })}
                  >
                    <Scale size={18} />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              className="finale-button"
              disabled={game.readOnly || game.busy}
              onClick={() =>
                game.patch({ runs: Math.min(999, (s.runs || 0) + 1) })
              }
            >
              <Play size={16} />{" "}
              {technical ? "Send test request" : "Run verification check"}
            </button>
            {s.runs > 0 && (
              <div
                className={`deck-test-feedback ${feedback.safe ? "is-safe" : "is-risk"}`}
                role="status"
              >
                {feedback.safe ? <ShieldCheck /> : <ShieldAlert />}
                <div>
                  <strong>{feedback.title}</strong>
                  <p>{feedback.text}</p>
                </div>
              </div>
            )}
            <button
              className="finale-text-button"
              disabled={game.readOnly || game.busy}
              onClick={() => game.patch({ mode: "report" })}
            >
              Record your reasoning <ArrowRight size={15} />
            </button>
          </section>
        )}
      </div>
      {game.readOnly && !game.complete && !report && (
        <FlightEvidenceConsole game={game} record={record} />
      )}
    </>
  );
}

function DeckExperimentVisual({ technical, state, feedback }) {
  if (technical)
    return (
      <div
        className={`deck-door-game ${state.runs > 0 ? "has-run" : ""} ${state.runs > 0 && feedback.title === "Request blocked" ? "is-blocked" : ""}`}
        aria-label="Simulated permission gate"
      >
        <div className="door-identity">
          <UserRound size={28} />
          <strong>Signed-in crew</strong>
          <small>
            {state.actor === "other"
              ? "Requesting another record"
              : "Requesting own record"}
          </small>
        </div>
        <div className="door-boundary">
          {state.runs > 0 && feedback.title !== "Request blocked" ? (
            <DoorOpen size={50} />
          ) : (
            <DoorClosed size={50} />
          )}
          <small>SERVER CHECK</small>
        </div>
        <div className="door-record">
          <FileText size={28} />
          <strong>Crew record</strong>
          <small>
            {state.runs > 0 ? feedback.title : "Waiting for your test"}
          </small>
        </div>
        {state.runs > 0 && (
          <span
            key={`${state.runs}:${state.actor}:${state.policy}`}
            className="door-request-token"
            aria-hidden="true"
          >
            <Fingerprint size={18} />
          </span>
        )}
      </div>
    );
  const all = state.plan === "fair",
    none = state.plan === "assume";
  return (
    <div
      className="deck-trial-table"
      aria-label="Illustrative sample-selection experiment"
    >
      <span className="finale-eyebrow">
        PRACTICE TRAY / 8 ILLUSTRATIVE RUNS
      </span>
      <div>
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className={`${i < 5 ? "trial-pass" : "trial-fail"} ${state.runs > 0 && (none || (!all && i >= 5)) ? "is-excluded" : ""}`}
          >
            <strong>{String(i + 1).padStart(2, "0")}</strong>
            <small>{i < 5 ? "PASS" : "FAIL"}</small>
          </span>
        ))}
      </div>
      <p>
        {state.runs > 0
          ? none
            ? "No runs checked. The claim remains untested."
            : all
              ? "All 8 runs retained. Failures stay in the evidence."
              : "Only 5 successes retained. Three failures are hidden."
          : "Run a check and watch which evidence your plan keeps."}
      </p>
    </div>
  );
}
