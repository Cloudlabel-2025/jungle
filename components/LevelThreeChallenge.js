"use client";
import { companionText } from "@/lib/companion-name.js";
import { useState } from "react";
import {
  Search,
  Fingerprint,
  Lightbulb,
  Target,
  ArrowRight,
  Check,
} from "lucide-react";
import { levelThreeScenarioComic } from "@/lib/level-three-comics.js";
import { missionAnswerPresent } from "@/lib/level-three-missions.js";
import { ComicArtwork, ComicTypedText } from "./ScenarioComic";

export function EvidenceHunt({ source, variant, onBegin, busy, disabled }) {
  const [active, setActive] = useState(0);
  const [found, setFound] = useState([0]);
  const [briefOpen, setBriefOpen] = useState(false);
  const clues = source.panels.slice(0, 3);
  const inspect = (index) => {
    setActive(index);
    setFound((old) => (old.includes(index) ? old : [...old, index]));
  };
  return (
    <div className="l3-hunt" aria-label={`${variant.name} investigation scene`}>
      <div className="l3-hunt-stage">
        <div className="l3-hunt-picture">
          <div className="l3-hunt-atmosphere" aria-hidden="true">
            <ComicArtwork comic={source} index={active} />
          </div>
          <ComicArtwork
            key={active}
            comic={source}
            index={active}
            fit="meet"
            className="l3-hunt-art"
          />
          <div className="l3-hunt-location">
            <Fingerprint size={16} />
            <span>
              FIELD INVESTIGATION<strong>{variant.name}</strong>
            </span>
          </div>
          <div className="l3-hunt-counter" role="status">
            <Search size={15} />
            {found.length}/3 clues found
          </div>
          <nav className="l3-hunt-hotspots" aria-label="Inspect the scene">
            {clues.map((clue, index) => (
              <button
                type="button"
                key={clue.title}
                aria-label={`Inspect clue ${index + 1}: ${clue.title}`}
                aria-pressed={active === index}
                className={found.includes(index) ? "is-found" : ""}
                onClick={() => inspect(index)}
              >
                <b>
                  {found.includes(index) ? (
                    <Check size={18} />
                  ) : (
                    <Search size={18} />
                  )}
                </b>
                <span>
                  <small>CLUE 0{index + 1}</small>
                  <strong>{clue.title}</strong>
                </span>
              </button>
            ))}
          </nav>
        </div>
        <aside className="l3-hunt-discovery">
          <span className="l3-hunt-kicker">
            EVIDENCE DISCOVERED / 0{active + 1}
          </span>
          <h3>{clues[active].title}</h3>
          <p className="l3-hunt-dialogue" key={active}>
            <ComicTypedText text={clues[active].dialogue} />
          </p>
          <div className="l3-hunt-goal">
            <Target size={22} />
            <p>
              <strong>Your challenge</strong>Find what changes the explanation.
              Build your own STORY from the clues.
            </p>
          </div>
          <button
            type="button"
            className="l3-hunt-brief-toggle"
            aria-expanded={briefOpen}
            onClick={() => setBriefOpen(!briefOpen)}
          >
            {briefOpen ? "Close briefing" : "Read full briefing"}
          </button>
          {briefOpen && <p className="l3-hunt-full-brief">{companionText(variant.brief)}</p>}
        </aside>
      </div>
      <footer className="l3-hunt-footer">
        <img
          src="/images/pip/pip-guiding.webp"
          alt="Kiko, your flight companion"
        />
        <div className="l3-hunt-pip">
          <strong>
            KIKO <span>FLIGHT COMPANION</span>
          </strong>
          <p>
            {found.length === 3
              ? "All three clues uncovered! Now tell me what they mean together."
              : "Something doesn't add up. Tap the glowing clues and take a closer look!"}
          </p>
          <small>
            Launch starts your saved timer. Your explanation earns the stars.
          </small>
        </div>
        <button
          type="button"
          className="l2-primary"
          disabled={busy || disabled}
          onClick={onBegin}
        >
          {busy ? "Launching…" : "Launch challenge · 1 energy"}
          <ArrowRight size={18} />
        </button>
      </footer>
    </div>
  );
}

// Only canonical, unchanged briefs get authored clues. Custom and saved briefs
// remain the source of truth instead of inheriting clues from another version.
export function EvidenceBoard({ activityId, variant }) {
  const [opened, setOpened] = useState(0);
  const source = levelThreeScenarioComic(activityId, variant);
  const clues = source?.panels.slice(0, 3);
  return (
    <section className="l3-evidence-board" aria-label="Evidence board">
      <header>
        <Fingerprint size={22} />
        <div>
          <small>INVESTIGATE BEFORE YOU EXPLAIN</small>
          <h3>{variant.name}</h3>
        </div>
      </header>
      {clues ? (
        <>
          <div className="l3-clue-cards" aria-label="Inspect the clues">
            {clues.map((clue, i) => (
              <button
                key={clue.title}
                type="button"
                aria-pressed={opened === i}
                onClick={() => setOpened(i)}
              >
                <span>
                  {i === 0 ? <Target /> : i === 1 ? <Search /> : <Lightbulb />}
                </span>
                <small>{i === 2 ? "NEXT LEAD" : `CLUE 0${i + 1}`}</small>
                <strong>{clue.title}</strong>
                <span>
                  {opened === i ? "Inspecting" : "Inspect clue"}{" "}
                  <ArrowRight size={13} />
                </span>
              </button>
            ))}
          </div>
          <div className="l3-clue-reveal" key={opened} role="status">
            <Search size={20} />
            <p>{clues[opened].dialogue}</p>
          </div>
          <details className="l3-original-brief">
            <summary>Original mission briefing</summary>
            <p>{companionText(variant.brief)}</p>
          </details>
        </>
      ) : (
        <p className="l3-clue-reveal">{companionText(variant.brief)}</p>
      )}
    </section>
  );
}

export function LevelThreeLaunch({
  activityId,
  variant,
  onBegin,
  busy,
  disabled,
}) {
  const source =
    activityId === "D3-G01" && levelThreeScenarioComic(activityId, variant);
  if (source)
    return (
      <EvidenceHunt
        key={variant.id}
        source={source}
        variant={variant}
        onBegin={onBegin}
        busy={busy}
        disabled={disabled}
      />
    );
  return (
    <div className="l3-launch">
      {activityId === "D3-G01" ? (
        <EvidenceBoard activityId={activityId} variant={variant} />
      ) : (
        <section className="l3-evidence-board">
          <header>
            <Target size={26} />
            <div>
              <small>REBUILD · RUN · EXPLAIN</small>
              <h3>{variant.name}</h3>
            </div>
          </header>
          <p className="l3-clue-reveal">{companionText(variant.brief)}</p>
          <div className="l3-launch-route">
            <span>YOUR CLICK</span>
            <ArrowRight />
            <span>HIDDEN SYSTEM</span>
            <ArrowRight />
            <span>VISIBLE RESULT</span>
          </div>
        </section>
      )}
      <div className="l3-launch-footer">
        <p>
          Kiko:{" "}
          {activityId === "D3-G01"
            ? "Find the clue that challenges the obvious answer. Then tell me why it matters."
            : "Build the route, send a signal, then tell me what each component does."}
          <small>
            Your saved timer starts when you launch. Explain in your own words
            to earn your stars.
          </small>
        </p>
        <button
          className="l2-primary"
          disabled={busy || disabled}
          onClick={onBegin}
        >
          {busy ? "Launching…" : "Launch challenge · 1 energy"}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function StoryTrail({
  fields,
  answers,
  cards = [],
  step,
  onStep,
  disabled,
}) {
  const story = ["scene", "need", "how", "concept", "takeaway"];
  return (
    <nav className="l3-story-trail" aria-label="Build your STORY">
      {fields.map((field, i) => {
        const n = story.indexOf(field),
          done = missionAnswerPresent(field, answers[field], cards);
        return (
          <button
            type="button"
            key={field}
            aria-label={`Note ${i + 1}: ${field}`}
            aria-current={step === i ? "step" : undefined}
            className={done ? "is-filled" : ""}
            disabled={disabled}
            onClick={() => onStep(i)}
          >
            <b>{done ? <Check size={16} /> : n >= 0 ? "STORY"[n] : i + 1}</b>
            <span>
              {n >= 0
                ? ["Scene", "The need", "Outline", "Relate", "Your takeaway"][n]
                : field}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
