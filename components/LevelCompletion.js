"use client";
import { useEffect, useRef, useState } from "react";
import { Star, Sparkles, Trophy, Zap, RotateCcw, Check } from "lucide-react";
import { Modal } from "./ui";
import { completionKey, pendingCompletions } from "@/lib/level-celebration";
import { teamRoles } from "@/lib/team-roles";
import { characterFor } from "@/lib/characters";

export function CompletionCelebration({ attempt, data, close }) {
  const [revealed, setRevealed] = useState(0);
  const [rewardsVisible, setRewardsVisible] = useState(false);
  const [run, setRun] = useState(0);
  const skipped = useRef(false);
  const level =
    attempt.definitionSnapshot ||
    data.projectLevels.find((l) => l._id === attempt.levelId);
  useEffect(() => {
    setRevealed(0);
    setRewardsVisible(false);
    skipped.current = false;
    const timers = Array.from({ length: attempt.stars }, (_, i) =>
      setTimeout(
        () => {
          if (!skipped.current) setRevealed(i + 1);
        },
        450 + i * 650,
      ),
    );
    timers.push(
      setTimeout(() => setRewardsVisible(true), 550 + attempt.stars * 650),
    );
    return () => timers.forEach(clearTimeout);
  }, [attempt._id, attempt.stars, run]);
  function finishReveal() {
    skipped.current = true;
    setRevealed(attempt.stars);
    setRewardsVisible(true);
  }
  return (
    <Modal
      title="Level complete!"
      kicker="EXPEDITION VICTORY · TEAM CLEARANCE"
      close={close}
      variant="level-completion"
    >
      <div className="completion-content">
        <p className="completion-level">
          LEVEL {String(attempt.number).padStart(2, "0")} ·{" "}
          {level?.name || "Team project"}
        </p>
        <div className="completion-stars" aria-hidden="true" key={run}>
          <Sparkles className="completion-spark" />
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`completion-star star-position-${n}${n <= revealed ? " is-revealed" : ""}`}
            >
              <Star />
            </span>
          ))}
          <Sparkles className="completion-spark" />
        </div>
        <p className="completion-announcement" role="status" aria-live="polite">
          {rewardsVisible
            ? `${attempt.stars} of 3 stars earned · Team rewards awarded`
            : `${revealed} of ${attempt.stars} earned stars revealed`}
        </p>
        {!rewardsVisible && (
          <button
            type="button"
            className="btn completion-skip"
            onClick={finishReveal}
          >
            Show all rewards
          </button>
        )}
        {rewardsVisible && (
          <section
            className="completion-rewards"
            aria-label="Individual level rewards"
          >
            <h3>
              <Trophy size={17} /> Your team's rewards
            </h3>
            <p>
              Recorded for this level · based on each player's reviewed
              contribution.
            </p>
            {attempt.rewards.map((reward) => {
              const player = data.roster.find((p) => p._id === reward.userId);
              const task = data.tasks.find(
                (t) =>
                  t.projectAttemptId === attempt._id &&
                  t.assigneeId === reward.userId,
              );
              const own = reward.userId === data.user._id;
              return (
                <article className={own ? "is-you" : ""} key={reward.userId}>
                  <div>
                    <strong>
                      {player?.name || "Team member"}
                      {own && <small>YOU</small>}
                    </strong>
                    <span>
                      {task?.featureName ||
                        characterFor(player)?.name ||
                        teamRoles.find((r) => r.code === task?.targetRole)
                          ?.label ||
                        player?.assignment ||
                        "Team contributor"}{" "}
                      · {reward.score}/100
                    </span>
                  </div>
                  <div className="completion-grants">
                    <span className="completion-xp">
                      <Zap size={15} />+{reward.xp} XP
                    </span>
                    <span
                      className="completion-trophies"
                      aria-label={`+${reward.trophies} trophies`}
                    >
                      <Trophy size={15} />+{reward.trophies}
                    </span>
                  </div>
                </article>
              );
            })}
            <p className="completion-saved">
              <Check size={14} /> Rewards have already been saved to player
              accounts.
            </p>
          </section>
        )}
        <div className="completion-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setRun((n) => n + 1)}
          >
            <RotateCcw size={15} />
            Replay
          </button>
          <button type="button" className="btn primary" onClick={close}>
            Continue expedition
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function TeamCompletionAnnouncements({ data }) {
  const [current, setCurrent] = useState(null);
  const dismissed = useRef(new Set());
  useEffect(() => {
    const next = pendingCompletions(data, (key) => {
      if (dismissed.current.has(key)) return true;
      try {
        return localStorage.getItem(key) === "seen";
      } catch {
        return false;
      }
    })[0];
    setCurrent((previous) =>
      previous?._id === next?._id ? previous : next || null,
    );
  }, [data]);
  if (
    !current ||
    data.user.role !== "GAMER" ||
    current.teamId !== data.user.teamId
  )
    return null;
  function dismiss() {
    const key = completionKey(data.user._id, current);
    dismissed.current.add(key);
    try {
      localStorage.setItem(key, "seen");
    } catch {
      /* Memory still prevents repeats this session. */
    }
    setCurrent(null);
  }
  return (
    <CompletionCelebration
      key={`${data.user._id}:${current._id}`}
      attempt={current}
      data={data}
      close={dismiss}
    />
  );
}
