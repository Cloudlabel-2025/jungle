"use client";
import { useId } from "react";
import { Check } from "lucide-react";

// Native radios keep keyboard navigation, form reset and FormData semantics.
export default function GameChoices({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  disabled = false,
  required = false,
}) {
  const id = useId();
  return (
    <fieldset className="game-choices" disabled={disabled}>
      <legend>{label}</legend>
      <div className="game-choice-grid">
        {options.map((option) => (
          <label className="game-choice" key={option.value}>
            <input
              type="radio"
              name={name || id}
              value={option.value}
              {...(value !== undefined
                ? { checked: String(value) === String(option.value) }
                : {
                    defaultChecked:
                      String(defaultValue ?? options[0]?.value) ===
                      String(option.value),
                  })}
              onChange={(event) => onChange?.(event.target.value)}
              required={required}
            />
            <span className="game-choice-indicator" aria-hidden="true">
              <Check size={13} />
            </span>
            <span>
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
