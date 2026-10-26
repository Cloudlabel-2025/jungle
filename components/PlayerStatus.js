import { Heart, Flame, Trophy, Sparkles } from "lucide-react";
import { XP_PER_LEVEL } from "@/lib/rewards";

export default function PlayerStatus({ player }) {
  return (
    <dl className="player-status" aria-label="Explorer status">
      <div className={`stat-health ${player.hp <= 1 ? "health-low" : ""}`}>
        <dt>
          <Heart size={16} />
          <span>Health</span>
        </dt>
        <dd key={player.hp}>
          {player.hp}
          <small>/5 HP</small>
        </dd>
      </div>
      <div className="stat-experience">
        <dt>
          <Sparkles size={16} />
          <span>Experience</span>
        </dt>
        <dd key={player.xp}>
          {player.xp}
          <small>
            XP <b className="stat-level">LV {player.level}</b>
          </small>
        </dd>
        <span
          className="stat-xp-track"
          role="meter"
          aria-label="Experience toward next level"
          aria-valuemin={0}
          aria-valuemax={XP_PER_LEVEL}
          aria-valuenow={player.xp % XP_PER_LEVEL}
        >
          <span
            style={{
              width: `${((player.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%`,
            }}
          />
        </span>
      </div>
      <div className="stat-trophies">
        <dt>
          <Trophy size={16} />
          <span>Trophies</span>
        </dt>
        <dd key={player.trophies}>
          {player.trophies}
          <small>trophies</small>
        </dd>
      </div>
      <div className="stat-streak">
        <dt>
          <Flame size={16} />
          <span>Streak</span>
        </dt>
        <dd key={player.streak}>
          {player.streak}
          <small>days</small>
        </dd>
      </div>
    </dl>
  );
}
