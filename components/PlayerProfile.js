"use client";
import { useState } from "react";
import { Modal } from "./ui";
import PlayerHeader from "./PlayerHeader";
import TrophyLeague from "./TrophyLeague";
import PlayerWorkHistory from "./PlayerWorkHistory";
import { experienceProgress, experienceLevel } from "@/lib/rewards.js";
export default function PlayerProfile({ data, close, onChooseCharacter }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const player = data.user;
  const xp = Math.max(0, player.xp || 0);
  if (historyOpen)
    return (
      <PlayerWorkHistory
        ownerId={player._id}
        initialDate={
          data.playSession?.day || new Date().toISOString().slice(0, 10)
        }
        close={close}
        back={() => setHistoryOpen(false)}
      />
    );
  return (
    <Modal
      title="My player profile"
      kicker="YOUR JOURNEY / PERSONAL PROGRESS"
      close={close}
    >
      <div className="player-profile-card">
        <PlayerHeader player={player} />
        <TrophyLeague trophies={player.trophies}/>
        <button className="btn" onClick={() => setHistoryOpen(true)}>
          View work by date
        </button>
        <dl className="profile-stat-grid">
          <div>
            <dt>Experience level</dt>
            <dd>{experienceLevel(xp)}</dd>
          </div>
          <div>
            <dt>Total XP</dt>
            <dd>{xp}</dd>
          </div>
          <div>
            <dt>XP to next level</dt>
            <dd>{experienceProgress(xp).remaining}</dd>
          </div>
          <div>
            <dt>Week 1 trophies</dt>
            <dd>{player.weekOneTrophies ?? player.dayOneTrophies ?? 0}</dd>
          </div>
          <div>
            <dt>Expedition trophies</dt>
            <dd>{player.trophies || 0}</dd>
          </div>
          <div>
            <dt>Day streak</dt>
            <dd>{player.streak || 0}</dd>
          </div>
        </dl>
        <p className="muted">
          {data.cohort?.name || "Your cohort"} · Your progress belongs to your
          player account.
        </p>
        {player.characterHidden ? (
          <p className="profile-character-state">
            Character unknown.{" "}
            {data.story?.characterSelectionRequired
              ? "You can now create your personal avatar."
              : "Your character will be revealed later in the story."}
          </p>
        ) : (
          <p className="profile-character-state">
            Your personal avatar is part of your expedition identity.
          </p>
        )}
        {!data.story?.flight && (
          <button className="btn primary" onClick={onChooseCharacter}>
            Customize avatar
          </button>
        )}
      </div>
    </Modal>
  );
}
