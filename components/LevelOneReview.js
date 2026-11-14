"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  Clock3,
  ClipboardCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Modal } from "./ui";
import MissionStars from "./MissionStars";
import XpIcon from "./XpIcon";

export function LevelOneReviewReport({ level }) {
  const result = level.result;
  const automatic = result.source === "SYSTEM";
  const checks = result.checks || {};
  const rows = [
    [
      "checkpoints",
      "Mission started",
      "Genre selected, mission accepted and research started.",
    ],
    [
      "readable",
      "Readable conversation",
      "At least 80 words, with your question and an AI response.",
    ],
    [
      "related",
      "On the right trail",
      "The conversation relates to your assigned question.",
    ],
    [
      "followUp",
      "Follow-up research",
      "At least 3 player messages and 3 AI responses.",
    ],
    [
      "comparison",
      "Compare the evidence",
      "Compare options, claims or trade-offs.",
    ],
    [
      "sources",
      "Bring your sources",
      "Include at least one HTTPS source link.",
    ],
    [
      "onTime",
      "Back before the deadline",
      "Submit the research within your saved time window.",
    ],
  ];
  return (
    <div className="mission-review-report">
      <div className="mission-review-summary">
        <div className="mission-review-award">
          <MissionStars stars={result.stars || 0} />
          <strong>{result.stars || 0} of 3 stars</strong>
        </div>
        <div>
          <span className="mission-review-eyebrow">YOUR DISCOVERY</span>
          <h3>
            {result.completed
              ? "Mission accomplished"
              : "Your next discovery awaits"}
          </h3>
          <p>
            {automatic
              ? "Here’s what your saved research showed."
              : `Reviewed by ${result.source === "CENTRE_COMMAND" ? "CC" : "MC"}.`}
          </p>
          <div className="mission-review-rewards">
            <span>
              <Trophy size={16} /> {level.creditedTrophies || 0} trophies
            </span>
            <span>
              <XpIcon size={18} /> {level.creditedXp || 0} XP
            </span>
            {result.elapsedSeconds != null && (
              <span>
                <Clock3 size={16} /> {Math.ceil(result.elapsedSeconds / 60)} min
              </span>
            )}
          </div>
        </div>
      </div>
      {automatic && (
        <section aria-label="Research checks">
          <h4 className="mission-review-section-title">Your research trail</h4>
          <div className="mission-review-checks">
            {rows.map(([key, title, description]) => {
              const assessed = typeof checks[key] === "boolean",
                met = checks[key] === true;
              const Icon = met ? Check : assessed ? Sparkles : Circle;
              return (
                <article
                  key={key}
                  className={`mission-review-check ${met ? "is-met" : assessed ? "needs-work" : "not-assessed"}`}
                >
                  <span className="mission-review-check-icon">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="mission-review-check-heading">
                      <strong>{title}</strong>
                      <span>
                        {met ? "Met" : assessed ? "To improve" : "Not assessed"}
                      </span>
                    </div>
                    <p>{description}</p>
                    {key === "followUp" && result.evidence && (
                      <small>
                        Your chat: {result.evidence.userTurns} player{" "}
                        {result.evidence.userTurns === 1
                          ? "message"
                          : "messages"}{" "}
                        · {result.evidence.assistantTurns} AI{" "}
                        {result.evidence.assistantTurns === 1
                          ? "response"
                          : "responses"}
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <div className="mission-review-next">
        <Sparkles size={20} aria-hidden="true" />
        <div>
          <h4>
            {result.stars === 3
              ? "You brought home all three stars!"
              : automatic
                ? "Your next move"
                : "Command’s feedback"}
          </h4>
          <p>
            {automatic &&
            result.stars < 3 &&
            rows.some(([key]) => checks[key] === false)
              ? rows
                  .filter(([key]) => checks[key] === false)
                  .map(([key, , description]) =>
                    key === "followUp"
                      ? "Continue the conversation with meaningful follow-up questions until you reach at least 3 player messages and 3 AI responses."
                      : key === "onTime"
                        ? "This submission missed the deadline. Ask MC or CC about an approved replay or a review of your result."
                        : description,
                  )
                  .join(" ")
              : result.reason}
          </p>
          {automatic && result.stars < 3 && (
            <small>
              Improve the highlighted checks before your deadline. If the window
              has ended, ask MC or CC about a replay or a result review.
              Replacing the link does not restart your timer.
            </small>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LevelOneReview({ level }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="mission-review-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="mission-review-trigger-icon">
          <ClipboardCheck size={18} />
        </span>
        <span>
          <strong>View review</strong>
          <small>Your research, stars & next steps</small>
        </span>
        <ArrowUpRight size={18} />
      </button>
      {open && (
        <Modal
          title="Your mission review"
          kicker="LEVEL 1 / FLIGHT REPORT"
          wide
          portal
          close={() => setOpen(false)}
        >
          <LevelOneReviewReport level={level} />
        </Modal>
      )}
    </>
  );
}
