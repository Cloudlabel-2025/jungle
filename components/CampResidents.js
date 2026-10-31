"use client";
import { useEffect, useId } from "react";
import { Heart, Zap, X } from "lucide-react";
import { campTeamMembers, campVitals } from "@/lib/camp-team";

export function CampResidents({ roster, user, selected, onSelect }) {
  return (
    <div className="camp-residents" aria-label="Your team at their tents">
      {campTeamMembers(roster, user).map(
        ({ player, character, tent }) =>
          character && (
            <button
              type="button"
              key={player._id}
              className={`camp-resident ${selected === player._id ? "is-selected" : ""}`}
              style={{
                left: `${(tent.x / 1672) * 100}%`,
                top: `${(tent.y / 941) * 100}%`,
                "--resident-color": character.color,
                zIndex: Math.round(tent.y),
              }}
              aria-label={`${player.name} as ${character.name}. View life and energy`}
              aria-expanded={selected === player._id}
              title="View player details"
              onClick={() => onSelect(player._id)}
            >
              <span className="camp-resident-shadow" aria-hidden="true" />
              <span
                className="camp-resident-art"
                aria-hidden="true"
                style={{
                  backgroundImage: `url('/images/characters/camp/${character.key}-${character.variant}.webp')`,
                }}
              />
              <span className="camp-resident-character">{character.name}</span>
            </button>
          ),
      )}
    </div>
  );
}

export function CampResidentInfo({ roster, user, selected, close }) {
  const id = useId();
  useEffect(() => {
    if (!selected) return;
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selected, close]);
  const member = campTeamMembers(roster, user).find(
    ({ player }) => player._id === selected,
  );
  if (!member?.character) return null;
  const { player, character } = member;
  const vitals = campVitals(
    player,
    user.weekOneEnergy != null || user.dayOneEnergy != null,
  );
  return (
    <section className="camp-resident-info" aria-labelledby={id}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Close player details"
        onClick={close}
      >
        <X size={17} />
      </button>
      <div className="camp-resident-info-heading">
        <img src={character.image} alt="" />
        <div>
          <span>YOUR TEAMMATE{player._id === user._id ? " · YOU" : ""}</span>
          <h2 id={id}>{player.name}</h2>
          <p>
            {character.name} · {character.label}
          </p>
        </div>
      </div>
      <div className="camp-resident-vitals" role="status" aria-live="polite">
        <div
          className="camp-resident-life"
          aria-label={`${vitals.life} of 5 lives`}
        >
          <span>Life</span>
          <div>
            {Array.from({ length: 5 }, (_, i) => (
              <Heart
                key={i}
                size={17}
                className={i < vitals.life ? "filled" : "empty"}
                aria-hidden="true"
              />
            ))}
          </div>
          <strong>{vitals.life}/5</strong>
        </div>
        <div
          className="camp-resident-energy"
          aria-label={`${vitals.energy} of ${vitals.energyMax} energy`}
        >
          <span>Energy</span>
          <div>
            {Array.from({ length: vitals.energyMax }, (_, i) => (
              <Zap
                key={i}
                size={17}
                className={i < vitals.energy ? "filled" : "empty"}
                aria-hidden="true"
              />
            ))}
          </div>
          <strong>
            {vitals.energy}/{vitals.energyMax}
          </strong>
        </div>
      </div>
    </section>
  );
}
