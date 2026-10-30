import { Star, Sparkles, ShieldCheck, Clock3, Trophy } from "lucide-react";

const date = (value) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

export default function LevelStars({ attempt, level, compact = false }) {
  const earned = attempt?.status === "CLEARED" ? attempt.stars || 0 : 0;
  return (
    <section
      className={`level-star-award${compact ? " is-compact" : ""}`}
      aria-label={`Team rating: ${earned} of 3 stars earned`}
    >
      {!compact && <span className="level-star-kicker">TEAM STAR RATING</span>}
      <div className="level-star-crest" aria-hidden="true">
        {!compact && <Sparkles className="star-crest-spark" size={18} />}
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`star-medallion star-position-${n}${n <= earned ? " is-earned" : ""}`}
          >
            <Star />
          </span>
        ))}
        {!compact && <Sparkles className="star-crest-spark" size={18} />}
      </div>
      {!compact && (
        <>
          <strong className="level-star-caption">
            {earned
              ? `${earned} / 3 stars earned`
              : "Three stars await your team"}
          </strong>
          <p className="level-star-goal">
            Complete{" "}
            {level.learningMode === "FULL_STACK"
              ? "all 25 full-stack tasks"
              : "all five role tasks"}
            , pass every project check, and submit the finished project by the
            target deadline.
          </p>
          <details className="level-star-guide">
            <summary>
              <Trophy size={15} /> How to earn three stars
            </summary>
            <ol>
              <li>
                <ShieldCheck size={16} />
                <span>
                  <strong>Build it together</strong>Every member submits{" "}
                  {level.learningMode === "FULL_STACK"
                    ? "their five full-stack tasks"
                    : "their role task"}
                  with evidence. All contributions and every integrated project
                  check must receive Guide approval.
                </span>
              </li>
              <li>
                <Clock3 size={16} />
                <span>
                  <strong>Submit on time</strong>The team's final accepted
                  submission must be sent within {level.hours} working hours of
                  starting. Waiting for Guide review does not reduce stars. If
                  work is returned, the resubmission time counts.
                </span>
              </li>
            </ol>
            <dl className="level-star-tiers">
              <div>
                <dt>
                  ★★★ <span>3 stars</span>
                </dt>
                <dd>
                  Approved project submitted by the target deadline · 1.5×
                  reward multiplier.
                </dd>
              </div>
              <div>
                <dt>
                  ★★ <span>2 stars</span>
                </dt>
                <dd>
                  Approved project submitted after the target, within the next{" "}
                  {Math.max(2, level.hours / 4)} working hours · 1.25×
                  multiplier.
                </dd>
              </div>
              <div>
                <dt>
                  ★ <span>1 star</span>
                </dt>
                <dd>
                  Approved project submitted after the late window · 1×
                  multiplier. This still unlocks the next level.
                </dd>
              </div>
            </dl>
            {attempt?.dueAt && (
              <p className="level-star-deadline">
                <strong>Three-star deadline</strong> {date(attempt.dueAt)}
                <br />
                <strong>Two-star cutoff</strong> {date(attempt.lateUntil)}
              </p>
            )}
            <p className="level-star-note">
              Working time: Monday–Friday, 09:00–17:00 IST. Stars are awarded
              only after approval; incomplete work earns no stars. Each player's
              XP and trophies also depend on their reviewed contribution score
              {level.learningMode === "FULL_STACK"
                ? ", averaged across their five tasks"
                : ""}
              .
            </p>
          </details>
        </>
      )}
    </section>
  );
}
