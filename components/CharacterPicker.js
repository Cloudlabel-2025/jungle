"use client";
import { useState } from "react";
import { Modal, Badge } from "./ui";
import { characters, characterKey, characterFor } from "@/lib/characters";
import CharacterAbility from "./CharacterAbility";

export default function CharacterPicker({ data, act, close }) {
  const current = characterFor(data.user);
  const [selected, setSelected] = useState({
    key: current?.key || "blaze",
    variant: current?.variant || "male",
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      if (
        await act(
          "gamer/character",
          { characterKey: selected.key, variant: selected.variant },
          "Character saved. Your full-stack tasks and rewards are unchanged.",
        )
      )
        close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Choose your explorer"
      kicker="FIVE CHARACTERS · EVERY PLAYER BUILDS THE FULL STACK"
      wide
      close={close}
    >
      <p className="detail-copy">
        Choose a male or female version of your character. Every version has the
        same tasks, rewards and progression. Centre Command can swap character
        identities between teammates.
      </p>
      <div className="character-library">
        {characters.map((character) => {
          const holder = data.roster.find(
            (p) =>
              p.teamId === data.user.teamId &&
              p.active !== false &&
              p._id !== data.user._id &&
              characterKey(p) === character.key,
          );
          return (
            <fieldset
              key={character.key}
              style={{ "--character-color": character.color }}
            >
              <legend>
                {character.label}
                {holder && <small> · {holder.name}</small>}
              </legend>
              <div className="character-pair">
                {["male", "female"].map((variant) => (
                  <label
                    key={variant}
                    className={`${selected.key === character.key && selected.variant === variant ? "selected" : ""}${holder ? " is-taken" : ""}`}
                  >
                    <img
                      src={`/images/characters/${character.key}-${variant}.webp`}
                      alt={`${character[variant]}, ${character.label} ${variant} version`}
                      width={400}
                      height={400}
                    />
                    <span>
                      <input
                        type="radio"
                        name="character"
                        disabled={!!holder || busy}
                        checked={
                          selected.key === character.key &&
                          selected.variant === variant
                        }
                        onChange={() =>
                          setSelected({ key: character.key, variant })
                        }
                      />
                      <strong>{character[variant]}</strong>
                      <small>{variant}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p>{character.style}</p>
              <p className="character-ability-caption">
                <strong>{character.ability.name}</strong> ·{" "}
                {character.ability.summary}
              </p>
              {character.key === current?.key && <Badge>YOUR CHARACTER</Badge>}
            </fieldset>
          );
        })}
      </div>
      <CharacterAbility
        player={{
          characterKey: selected.key,
          characterVariant: selected.variant,
        }}
      />
      <div className="character-save">
        <button className="btn primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save character"}
        </button>
      </div>
    </Modal>
  );
}
