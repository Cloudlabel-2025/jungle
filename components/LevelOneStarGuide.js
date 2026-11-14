"use client";
import { useState } from "react";
import {
  Clock3,
  Sparkles,
  Trophy,
  Compass,
  MessagesSquare,
  Search,
  Send,
  Lightbulb,
} from "lucide-react";
import { levelOneReward } from "@/lib/level-one-rules.js";
import MissionStars from "./MissionStars";
import XpIcon from "./XpIcon";
import { Modal } from "./ui";

export function LevelOneStarGuideContent({ record, now }) {
  const [target, setTarget] = useState(3);
  const [tip, setTip] = useState(false);
  const deadline = record?.deadline;
  const expired = deadline && now && new Date(now) > new Date(deadline);
  const objectives = [
    [
      Compass,
      "Chart your course",
      "Lock your genre and question. Accept the mission, then Begin research.",
    ],
    [
      MessagesSquare,
      target === 1 ? "Bring back a discovery" : "Keep asking questions",
      target === 1
        ? "Share a conversation about your mission with at least 80 words, your question and an AI response."
        : "Reach 3 player messages and 3 AI responses about your mission, with at least 80 words. Your first question counts.",
    ],
    ...(target >= 2
      ? [
          [
            Search,
            "Follow the evidence",
            "Compare claims or options. Include at least one HTTPS source link in the conversation.",
          ],
        ]
      : []),
    ...(target === 3
      ? [
          [
            Send,
            "Beat your research deadline",
            "Meet every objective above and submit your shared chat before the deadline.",
          ],
        ]
      : []),
  ];
  return (
    <div className="level-star-guide star-hunt-briefing">
      <aside className="star-hunt-companion" aria-label="Pip’s mission advice">
        <span className="star-hunt-flight-code">
          <Compass size={14} /> FLIGHT 01
        </span>
        <img
          className="star-hunt-pip"
          src="/images/pip/pip-guiding.webp"
          alt="Pip guiding your discovery"
          width="300"
          height="300"
        />
        <div className="star-hunt-speech">
          <span>PIP / YOUR FLIGHT COMPANION</span>
          <p>
            {tip
              ? "Try asking: “Compare three explanations. What evidence supports each?” Then: “Which sources are reliable, and what is still uncertain?”"
              : target === 3
                ? "“The first answer is just the beginning. Dig deeper, check the evidence, then bring your discovery home!”"
                : target === 2
                  ? "“Good explorers question what they find. Follow up, compare the claims and bring your sources.”"
                  : "“Start with your mission question. Bring back a readable chat that explores the right topic.”"}
          </p>
          <button type="button" onClick={() => setTip(!tip)}>
            <Lightbulb size={14} />{" "}
            {tip ? "Back to briefing" : "Give me a research tip"}
          </button>
        </div>
      </aside>
      <div className="star-hunt-main">
        <header className="star-hunt-goal">
          <div>
            <span>YOUR OPTIONAL CHALLENGE</span>
            <h3>
              {target === 3
                ? "Bring home all three."
                : target === 2
                  ? "Go deeper. Earn two."
                  : "Make your first discovery."}
            </h3>
            <p>
              {target === 3
                ? "Complete the research. Make it back in time."
                : target === 2
                  ? "Full research submitted late earns 2 stars."
                  : "Relevant, readable mission research earns 1 star."}
            </p>
          </div>
          <MissionStars stars={target} />
        </header>
        <ol
          className="star-hunt-objectives"
          aria-label={`Requirements for ${target} ${target === 1 ? "star" : "stars"}`}
        >
          {objectives.map(([Icon, title, description], index) => (
            <li key={title}>
              <span className="star-hunt-number">0{index + 1}</span>
              <Icon size={19} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div
          className="star-hunt-rewards"
          role="group"
          aria-label="Choose a star goal"
        >
          {[1, 2, 3].map((stars) => {
            const reward = levelOneReward(stars);
            return (
              <button
                key={stars}
                type="button"
                aria-pressed={target === stars}
                onClick={() => setTarget(stars)}
                className={target === stars ? "is-selected" : ""}
              >
                <strong>
                  {stars} {stars === 1 ? "STAR" : "STARS"}
                </strong>
                <span>
                  <Trophy size={14} /> {reward.trophies} <XpIcon size={16} />{" "}
                  {reward.xp} XP
                </span>
              </button>
            );
          })}
        </div>
        <div
          className={`star-hunt-timer ${expired ? "is-expired" : ""}`}
          role="note"
        >
          <Clock3 size={18} />
          <div>
            <strong>
              {expired
                ? "Your research deadline has passed"
                : deadline
                  ? "Your saved research deadline"
                  : "Your timer starts when you begin research"}
            </strong>
            <p>
              {deadline
                ? new Date(deadline).toLocaleString("en-IN", {
                    timeZone: record?.config?.timeZone || "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : `${record?.config?.durationMinutes || 90} minutes from Begin research.`}
              {" · "}
              {expired
                ? "Late full research earns 2 stars. Ask MC or CC about a replay or review."
                : "Replacing a link does not restart the timer; chat content added after the deadline cannot earn the on-time star."}
            </p>
          </div>
        </div>
        <p className="star-hunt-footnote">
          Public ChatGPT Share link only—no pasted transcript needed. Improving
          a result awards only the difference. Choosing a goal here does not
          change your score or timer.
        </p>
      </div>
    </div>
  );
}

export default function LevelOneStarGuide({ record, now }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="level-star-guide-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Sparkles size={15} /> How to earn 3 stars
      </button>
      {open && (
        <Modal
          title="How to earn 3 stars"
          kicker="LEVEL 1 / FLIGHT BRIEFING"
          variant="star-guide"
          portal
          close={() => setOpen(false)}
        >
          <LevelOneStarGuideContent record={record} now={now} />
        </Modal>
      )}
    </>
  );
}
