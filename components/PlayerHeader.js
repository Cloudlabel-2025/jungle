import { Flame, Trophy } from "lucide-react";
import { XP_PER_LEVEL, experienceLevel } from "@/lib/rewards";
import PlayerVitals from "./PlayerVitals";
import { characterFor } from "@/lib/characters";
import { Avatar } from "./ui";

export default function PlayerHeader({ player, part = "identity", teamName }) {
  if (part === "rewards")
    return (
      <div className="player-honours" aria-label="Player achievements">
        <span className="player-team-name">
          {teamName || "Your expedition"}
        </span>
        <span className="player-trophy-count">
          <Trophy size={18} />
          <strong>
            {player.weekOneTrophies ??
              player.dayOneTrophies ??
              player.trophies ??
              0}
          </strong>
          <small>
            {player.weekOneTrophies != null
              ? "Week 1 trophies"
              : player.dayOneTrophies != null
                ? "Day 1 trophies"
                : "Trophies"}
          </small>
        </span>
        <span className="player-streak-count">
          <Flame size={17} />
          <strong>{player.streak || 0}</strong>
          <small>Day streak</small>
        </span>
      </div>
    );
  const progress = (player.xp || 0) % XP_PER_LEVEL;
  const character = characterFor(player);
  const role = character
    ? `${character.name} · ${character.label} · Full stack`
    : "Full-stack explorer";
  return (
    <section className="player-identity" aria-label="Player status">
      <div className="player-profile-heading">
        <Avatar player={player} />
        <div className="player-name-line">
          <strong>{player.name}</strong>
          <span>{role}</span>
        </div>
      </div>
      <div className="player-experience">
        <span>Level {experienceLevel(player.xp)}</span>
        <span
          className="player-xp-bar"
          role="progressbar"
          aria-label="Experience toward next level"
          aria-valuemin={0}
          aria-valuemax={XP_PER_LEVEL}
          aria-valuenow={progress}
        >
          <i style={{ width: `${(progress / XP_PER_LEVEL) * 100}%` }} />
        </span>
        <small>
          {progress} / {XP_PER_LEVEL} XP
        </small>
      </div>
      <PlayerVitals player={player} />
    </section>
  );
}
