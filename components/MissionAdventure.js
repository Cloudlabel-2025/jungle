"use client";
import Link from "next/link";
import { Compass, Check, Flag, ArrowRight } from "lucide-react";
import AvatarPortrait from "./AvatarPortrait";
export default function MissionAdventure({
  chapter,
  title,
  brief,
  player,
  progress,
  objectives,
  onContinue,
  art,
}) {
  return (
    <section
      className="mission-adventure"
      aria-label={`${title} mission progress`}
    >
      {art && <img className="mission-adventure-scenery" src={art} alt="" />}
      <div className="mission-adventure-copy">
        <span className="mission-adventure-kicker">
          <Compass size={16} />
          {chapter}
        </span>
        <h2>{title}</h2>
        {brief && <p>{brief}</p>}
        <div className="mission-adventure-meter">
          <progress
            value={progress.completed}
            max={Math.max(1, progress.total)}
            aria-label="Approved mission progress"
          />
          <strong>
            {progress.completed}/{progress.total} checkpoints
          </strong>
        </div>
        {objectives && (
          <ol className="mission-adventure-trail">
            {objectives.map((o, i) => (
              <li
                key={o.label}
                className={
                  o.done
                    ? "is-complete"
                    : i === objectives.findIndex((x) => !x.done)
                      ? "is-current"
                      : ""
                }
              >
                {o.done ? <Check size={15} /> : <span>{i + 1}</span>}
                <span>{o.label}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="mission-adventure-next">
          <Flag size={19} />
          <p>{progress.next}</p>
        </div>
        <div className="mission-adventure-actions">
          {onContinue && progress.nextTask && (
            <button
              type="button"
              className="btn primary"
              onClick={() => onContinue(progress.nextTask)}
            >
              Open my next mission <ArrowRight size={16} />
            </button>
          )}
          <Link className="btn" href="/gamer/ide">
            Enter Code Lab
          </Link>
          <Link className="btn" href="/gamer/week-one-ask-mc">
            Call your Guide
          </Link>
        </div>
      </div>
      {player?.avatar && !player.characterHidden && (
        <AvatarPortrait
          className="mission-adventure-player"
          avatar={player.avatar}
          fullBody
          mood={progress.cleared ? "celebrate" : "determined"}
          alt={`${player.name}, ready for the next mission`}
        />
      )}
    </section>
  );
}
