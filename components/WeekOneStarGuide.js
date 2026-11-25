"use client";
import { useState } from "react";
import { Sparkles, Trophy, Check, Clock3, Compass } from "lucide-react";
import { Modal } from "./ui";
import MissionStars from "./MissionStars";
import XpIcon from "./XpIcon";
import AvatarReaction from "./AvatarReaction";
import { levelReward, weekOneLevelGuides } from "@/lib/week-one-level-rules.js";

export function WeekOneStarGuideContent({ day, result }) {
  const [target, setTarget] = useState(3);
  const guide = weekOneLevelGuides[day],
    reward = levelReward(target, day);
  const goals = [
    [
      Compass,
      "Secure both discoveries",
      day === 5
        ? "Submit the fresh research mission and answer every quiz question. This earns your first star."
        : "Submit every required answer in both missions. This earns your first star.",
    ],
    ...(target >= 2
      ? [
          [
            Check,
            "Leave a clear evidence trail",
            "Write at least 12 words in every written answer, except the chat URL. Give different answers for each field; repeating the same note does not meet the effort check.",
          ],
          [Sparkles, "Meet your mission challenge", guide.extra],
        ]
      : []),
    ...(target === 3
      ? [
          [
            Clock3,
            "Transmit before time runs out",
            "Meet the effort checks above and submit both missions within their own saved timers. Starting later levels does not restart an earlier timer.",
          ],
        ]
      : []),
  ];
  return (
    <div className="week-star-briefing">
      <aside>
        <span>FLIGHT / LEVEL 0{day}</span>
        <img
          src="/images/pip/pip-guiding.webp"
          alt="Kiko guiding your star hunt"
          width="220"
          height="220"
        />
        <p>
          “Explorer, here’s your route to three gold stars. Check your evidence,
          then bring it home!”
        </p>
        <small>
          Automatic effort checks support the game. MC or CC can review and
          change the result.
        </small>
      </aside>
      <main>
        <span className="week-star-eyebrow">YOUR STAR HUNT</span>
        <h2>{guide.title}</h2>
        <p>{guide.objective}</p>
        <div className="week-star-targets" aria-label="Choose a star target">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={target === n}
              onClick={() => setTarget(n)}
            >
              <MissionStars stars={n} />
              <strong>{levelReward(n, day).trophies} trophies</strong>
              <small>{levelReward(n, day).xp} XP</small>
            </button>
          ))}
        </div>
        <ol className="week-star-objectives">
          {goals.map(([Icon, title, text]) => (
            <li key={title}>
              <Icon size={20} />
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="week-star-prize">
          <Trophy size={20} />
          <strong>{reward.trophies} trophies</strong>
          <XpIcon size={20} />
          <strong>{reward.xp} XP</strong>
        </div>
        {result && (
          <p className="week-star-feedback" role="status">
            Your latest result: {result.stars}/3 stars. {result.reason}
          </p>
        )}
        <small>
          These checks measure evidence structure and effort, not factual
          accuracy or originality. Late work can earn up to 2 stars. An
          authorised replay keeps your previous best reward and only credits an
          improvement.
        </small>
      </main>
    </div>
  );
}
export default function WeekOneStarGuide({ day, result }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="week-star-guide-button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={15} />
        How to earn 3 stars
      </button>
      {open && (
        <Modal
          title={`Level ${day} · Star hunt`}
          kicker="KIKO’S FLIGHT BRIEFING"
          variant="star-guide"
          portal
          wide
          close={() => setOpen(false)}
        >
          <WeekOneStarGuideContent day={day} result={result} />
        </Modal>
      )}
    </>
  );
}
export function FlightLevelRewards({ data, day, compact = false }) {
  const row = data.weekOneProgram.levelResults?.find(
      (r) => r.userId === data.user._id && r.day === day,
    ),
    result = row?.result;
  return (
    <section
      className={`week-level-rewards ${compact ? "is-compact" : ""}`}
      aria-label={`Level ${day} stars and rewards`}
    >
      <div>
        <span className="week-star-eyebrow">
          {result?.completed
            ? `LEVEL ${day} SECURED`
            : `LEVEL ${day} / STAR HUNT`}
        </span>
        <MissionStars stars={result?.completed ? result.stars : 0} />
      </div>
      <div>
        {result?.completed ? (
          <>
            <Trophy size={17} />
            <strong>{row.creditedTrophies} trophies</strong>
            <XpIcon size={17} />
            <strong>{row.creditedXp} XP</strong>
          </>
        ) : (
          <span>
            Earn 15–30 trophies · {levelReward(1, day).xp}–
            {levelReward(3, day).xp} XP · {day}× flight XP
          </span>
        )}
      </div>
      <WeekOneStarGuide day={day} result={result} />
      {result?.completed && !compact && (
        <AvatarReaction
          player={data.user}
          mood="celebrate"
          caption={`Level ${day} secured!`}
          compact
        />
      )}
      {!compact && result && (
        <p>
          {result.reason}
          {row.practice && " Replay keeps your best completion and rewards."}
        </p>
      )}
    </section>
  );
}
