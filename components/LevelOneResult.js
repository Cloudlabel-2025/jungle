import { Trophy, ShieldCheck } from "lucide-react";
import XpIcon from "./XpIcon";
import LevelOneReview from "./LevelOneReview";
import MissionStars from "./MissionStars";
import { levelOneReward } from "@/lib/level-one-rules.js";
import AvatarReaction from "./AvatarReaction";
import { resultSticker } from "@/lib/avatar-stickers";

export default function LevelOneResult({ level, compact = false }) {
  if (!level) return null;
  const result = level.result;
  const stars = result?.stars || 0;
  return (
    <section
      className={`level-one-result${compact ? " is-compact" : ""}`}
      aria-label="Level 1 result"
    >
      {resultSticker(result) && (
        <AvatarReaction mood={resultSticker(result)} compact={compact} />
      )}
      <MissionStars stars={stars} size="result" />
      <h4>
        {level.practice
          ? `Replay · attempt ${level.attempt}`
          : result?.completed
            ? "Level 1 complete!"
            : result
              ? result.status === "REVIEW_REQUIRED"
                ? "Your chat needs another read"
                : "Your discovery needs a correction"
              : "Your discovery rewards"}
      </h4>
      {!compact && (
        <p>
          {level.playerRetry ? "Your earlier rewards are saved. Beat your best stars for +3 trophies; completed retries earn 25% XP." : result?.reason ||
            (level.practice
              ? "Your previous rewards are safe. An improved result awards only the difference."
              : `Complete your research mission to earn up to 3 stars, ${levelOneReward(3).trophies} trophies and ${levelOneReward(3).xp} XP.`)}
        </p>
      )}
      {!result && !level.practice && (
        <small>
          1 star: readable mission chat · 2 stars: follow-ups, comparison and
          sources · 3 stars: those checks plus on-time submission.
        </small>
      )}
      {level.practice && level.bestResult && (
        <small>
          Previous best: {level.bestResult.stars} stars. Your earned completion
          is retained during replay.
        </small>
      )}
      <div className="button-row">
        <span>
          <Trophy size={16} /> {level.creditedTrophies || 0} trophies
        </span>
        <span>
          <XpIcon size={18} /> {level.creditedXp || 0} XP
        </span>
      </div>
      {result && !compact && (
        <small>
          <ShieldCheck size={13} />{" "}
          {result.source === "SYSTEM"
            ? "Automatic evidence checks"
            : `Result set by ${result.source === "CENTRE_COMMAND" ? "CC" : "MC"}`}{" "}
          ·{" "}
          {result.elapsedSeconds != null
            ? `${Math.ceil(result.elapsedSeconds / 60)} min research`
            : "Staff decision"}
        </small>
      )}
      {result && compact && <LevelOneReview level={level} />}
      {result?.completed && (
        <small>
          {compact
            ? "Check the flight map for your next mission."
            : "Continue your journey from the flight map."}
        </small>
      )}
      {!!level.history?.length && (
        <details>
          <summary>Previous attempts ({level.history.length})</summary>
          {level.history.map((h) => (
            <div key={h.attempt}>
              <strong>
                Attempt {h.attempt} · {h.result?.stars || 0} stars
              </strong>
              <p>{h.reason}</p>
              {h.submissions?.map((s) => (
                <div key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    Open saved research chat
                  </a>
                  {s.transcript && (
                    <details>
                      <summary>Saved conversation evidence</summary>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          maxHeight: 200,
                          overflow: "auto",
                        }}
                      >
                        {s.transcript}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
