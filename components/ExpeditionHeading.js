import {
  Compass,
  Radio,
  NotebookPen,
  Trophy,
  Flag,
  ShieldCheck,
} from "lucide-react";

const scenes = {
  G02: [
    "encounters",
    Compass,
    "THE WILD / SURVIVAL KNOWLEDGE",
    "Read the terrain. Prepare for every encounter.",
  ],
  G03: [
    "objectives",
    Flag,
    "THE CROSSING / SQUAD OBJECTIVES",
    "Every completed objective brings your party closer to safety.",
  ],
  G04: [
    "campfire",
    Radio,
    "BASE CAMP / PARTY FREQUENCY",
    "Keep the signal alive. No explorer gets left behind.",
  ],
  G05: [
    "journal",
    NotebookPen,
    "FIELD NOTES / YOUR EXPEDITION RECORD",
    "Record what you survived. Plan your next move.",
  ],
  G06: [
    "rewards",
    Trophy,
    "THE VAULT / EARNED HONOURS",
    "Your experience tells your story. Your trophies mark your victories.",
  ],
};

export default function ExpeditionHeading({ code, title, subtitle, action }) {
  const [scene, Icon, location, story] = scenes[code] || [
    "command",
    ShieldCheck,
    "EXPEDITION CONTROL / FIELD OPERATIONS",
    subtitle,
  ];
  return (
    <header className={`page-heading expedition-heading scene-${scene}`}>
      <div className="expedition-heading-copy">
        <span className="scene-location">
          <Icon size={16} /> {location}
        </span>
        <h1>{title}</h1>
        <p>{story}</p>
        {scenes[code] && (
          <small className="scene-instruction">{subtitle}</small>
        )}
      </div>
      {action && <div className="scene-action">{action}</div>}
      <span className="scene-reference" aria-hidden="true">
        {code} / CODEWILD EXPEDITION
      </span>
    </header>
  );
}
