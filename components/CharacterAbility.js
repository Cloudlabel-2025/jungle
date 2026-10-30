import { Sparkles } from "lucide-react";
import { characterFor } from "@/lib/characters";
export default function CharacterAbility({ player, feature, tasks = [] }) {
  const character = characterFor(player);
  if (!character?.ability) return null;
  return (
    <details
      className="character-ability"
      style={{ "--ability-color": character.color }}
    >
      <summary>
        <Sparkles size={16} />
        <span>
          <small>STATIC SUPPORT ABILITY</small>
          <strong>{character.ability.name}</strong>
        </span>
      </summary>
      <div>
        <p>{character.ability.summary}</p>
        {feature && (
          <p>
            <strong>Your feature:</strong> {feature.name} ·{" "}
            {tasks.filter((t) => t.status === "Done").length}/5 tasks approved
          </p>
        )}
        <ol>
          {character.ability.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <small>
          Optional support guidance. Your tasks, deadlines, XP and trophies
          follow the same rules as every other character.
        </small>
      </div>
    </details>
  );
}
