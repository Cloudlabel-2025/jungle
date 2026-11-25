"use client";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Compass,
  ExternalLink,
  History,
  LockKeyhole,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { missionImageFor } from "@/lib/mission-images";
import { Modal } from "./ui";
import { firstResearchReady } from "./LevelOneJourney";
import LevelOneResult from "./LevelOneResult";
import LevelOneStarGuide from "./LevelOneStarGuide";

// Presentation only: acknowledgement, timer and evidence still use Day 1 actions.
export default function FlightMissionBriefing({
  onClaimCheck,
  record: r,
  question: g,
  timer,
  remaining,
  now,
  nextLevel,
  onContinue,
  busy,
  error,
  onAction,
  formatDate,
  children,
}) {
  const [showLog, setShowLog] = useState(false);
  const [revise, setRevise] = useState(false);
  const submission = r.submissions.at(-1);
  useEffect(() => setRevise(false), [submission?.id]);
  const verified = r.levelOne
    ? Boolean(r.levelOne.result?.completed)
    : Boolean(submission && r.verification?.status === "VERIFIED");
  const waitingCheck =
    r.levelOne?.claimCheckRequired && firstResearchReady(r) && !verified;
  const phase = verified
    ? "verified"
    : waitingCheck
      ? "claim-check"
      : submission
        ? "submitted"
        : r.startedAt
          ? "research"
          : r.acknowledgedAt
            ? "ready"
            : "briefing";
  const cover = missionImageFor(r.researchAssignment?.questionId || g.id);
  const title = g.name.split(" · ").at(-1);
  const status = {
    "claim-check": "Mission 1 secured",
    briefing: "Mission discovered",
    ready: "Ready for launch",
    research: "Investigation underway",
    submitted: "Signal received",
    verified: "Evidence verified",
  }[phase];
  return (
    <section
      className="flight-research-scene flight-active-mission mission-briefing-scene"
      data-phase={phase}
      aria-label="Your research mission"
    >
      <div className="flight-world flight-mission-objective">
        <div className="flight-scene-heading">
          <h3>{title}</h3>
          <p>
            {verified ? "Your discovery is saved." : "Your mission is waiting."}
          </p>
        </div>
        <article
          className="mission-briefing-board"
          aria-label="Mission briefing"
          style={cover ? { "--briefing-cover": `url("${cover}")` } : undefined}
        >
          <div className="mission-briefing-poster" aria-hidden="true">
            <span className="mission-poster-code">
              <Compass size={15} /> FLIGHT / 01
            </span>
            <div className="mission-poster-caption">
              <span>{r.researchAssignment?.genreName || "Discovery"}</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="mission-briefing-copy">
            <span className="mission-briefing-kicker">
              <Target size={15} /> YOUR OBJECTIVE
              <LevelOneStarGuide record={r} now={now} />
            </span>
            <h4>Follow your curiosity.</h4>
            <p className="mission-question">{g.question}</p>
            <ul
              className="mission-field-guide"
              aria-label="Research field guide"
            >
              <li>
                <Compass size={18} />
                <span>Explore your options</span>
              </li>
              <li>
                <Search size={18} />
                <span>Check the claims</span>
              </li>
              <li>
                <Radio size={18} />
                <span>Bring back your chat</span>
              </li>
            </ul>
            <span className="mission-contract-lock">
              <LockKeyhole size={12} /> Your question is locked and saved.
            </span>
          </div>
        </article>
        <div
          className="mission-route-progress"
          aria-label="Research mission progress"
        >
          {[
            ["Accept", Boolean(r.acknowledgedAt || verified)],
            ["Research", Boolean(r.startedAt || verified)],
            ["Transmit", Boolean(submission || verified)],
          ].map(([label, done], i) => (
            <div
              key={label}
              className={
                done
                  ? "is-complete"
                  : i === (r.startedAt ? 2 : r.acknowledgedAt ? 1 : 0)
                    ? "is-current"
                    : ""
              }
            >
              <span>{done ? <Check size={13} /> : i + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </div>
      <aside
        className="flight-radio-panel mission-launch-panel"
        aria-label="Mission control"
      >
        <div className="flight-radio-channel">
          <Radio size={18} />
          <span>
            FLIGHT RADIO<small>MISSION CONTROL</small>
          </span>
          <i aria-hidden="true" />
        </div>
        <div className="mission-control-emblem" aria-hidden="true">
          {verified ? (
            <ShieldCheck size={34} />
          ) : submission ? (
            <Check size={34} />
          ) : r.startedAt ? (
            <Search size={34} />
          ) : (
            <Compass size={34} />
          )}
        </div>
        <span className="mission-phase-status" role="status">
          {r.levelOne?.result && !verified && !waitingCheck
            ? "Correction needed"
            : status}
        </span>
        <h4>
          {verified
            ? "Discovery confirmed."
            : submission
              ? "Good work, explorer."
              : r.startedAt
                ? "Find your answers."
                : r.acknowledgedAt
                  ? "Ready to explore?"
                  : "Your adventure starts here."}
        </h4>
        {!submission && !verified && (
          <div
            className={`mission-countdown ${r.startedAt ? "is-running" : ""}`}
            role={r.startedAt ? "timer" : undefined}
            aria-label={
              r.startedAt ? "Research time remaining" : "Research window"
            }
          >
            <Clock3 size={18} />
            <strong>{r.startedAt ? timer : "90:00"}</strong>
            <span>
              {r.startedAt
                ? remaining > 0
                  ? "REMAINING"
                  : "WINDOW ENDED"
                : "STARTS AT LAUNCH"}
            </span>
          </div>
        )}
        <p className="mission-control-copy">
          {waitingCheck
            ? "Mission 1 is saved. Complete the claim check in Mission 2 to finish Level 1."
            : verified
              ? r.levelOne
                ? "Your level result is saved. Continue your journey from the flight map."
                : "Command has verified your evidence. The next level opens when it is released."
              : submission
                ? r.levelOne
                  ? "Your conversation is saved. Check your automatic result below."
                  : "Your conversation is saved. Command will check your evidence."
                : r.startedAt
                  ? "Investigate with your AI tool. Return with a shared conversation link."
                  : r.acknowledgedAt
                    ? "Launch when you are ready. The timer keeps running after you leave."
                    : "Read the objective, then accept your mission. Your timer has not started."}
        </p>
        {waitingCheck && (
          <button
            className="flight-mission-action mission-launch-action"
            data-pip-target="claim-check"
            onClick={onClaimCheck}
            disabled={busy}
          >
            Play Mission 2 · Check one claim <ArrowRight size={16} />
          </button>
        )}
        {r.levelOne && !waitingCheck && (
          <LevelOneResult level={r.levelOne} compact={verified} />
        )}
        {verified && nextLevel?.available && onContinue && (
          <button
            className="flight-mission-action mission-launch-action"
            onClick={onContinue}
          >
            Continue to Level {nextLevel.day}
            <ArrowRight size={18} />
          </button>
        )}
        {!verified && !r.acknowledgedAt && (
          <button
            className="flight-mission-action mission-launch-action"
            data-pip-target="accept"
            disabled={busy}
            onClick={() => onAction("acknowledge")}
          >
            <span>{busy ? "Accepting…" : "Accept mission"}</span>
            <ShieldCheck size={18} />
          </button>
        )}
        {!verified && r.acknowledgedAt && !r.startedAt && (
          <button
            className="flight-mission-action mission-launch-action"
            data-pip-target="begin"
            disabled={busy}
            onClick={() => onAction("start")}
          >
            <span>{busy ? "Launching…" : "Begin research · 1 energy"}</span>
            <ArrowRight size={18} />
          </button>
        )}
        {!verified && r.startedAt && !submission && children}
        {error && (
          <p className="flight-radio-error" role="alert">
            {error}
          </p>
        )}
        {submission && (
          <div className="mission-evidence-receipt" data-pip-target="receipt">
            <a href={submission.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Open your research chat
            </a>
            {!verified && r.verification?.reason && (
              <p>{r.verification.reason}</p>
            )}
            {!submission.evidence && (
              <button
                className="mission-log-trigger"
                data-pip-target="review-link"
                disabled={busy}
                onClick={() => onAction("review-link")}
              >
                {busy
                  ? "Reading shared chat…"
                  : "Review shared chat automatically"}
              </button>
            )}
            <button
              className="mission-log-trigger"
              data-pip-target="replace-chat"
              onClick={() => setRevise(true)}
            >
              Replace chat link <ArrowRight size={14} />
            </button>
            <button
              className="mission-log-trigger"
              onClick={() => setShowLog(true)}
            >
              <History size={14} /> Transmission log{" "}
              <span>{r.submissions.length}</span>
            </button>
          </div>
        )}
        <div className="mission-control-footer">
          <Sparkles size={12} />
          {submission
            ? "Evidence saved to your account"
            : "One mission. Your own discovery."}
        </div>
      </aside>
      {showLog && (
        <Modal
          title="Transmission log"
          kicker="YOUR SAVED RESEARCH"
          close={() => setShowLog(false)}
        >
          {[...r.submissions].reverse().map((s) => (
            <div className="history-entry" key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                Open chat · {formatDate(s.at)}
              </a>
              <p>{s.reason}</p>
            </div>
          ))}
        </Modal>
      )}
      {revise && (
        <Modal
          title="Update your transmission"
          kicker="RESEARCH EVIDENCE"
          close={() => setRevise(false)}
        >
          {children}
        </Modal>
      )}
    </section>
  );
}
