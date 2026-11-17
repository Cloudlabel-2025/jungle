"use client";
import { companionText } from "@/lib/companion-name.js";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Search, Play, X } from "lucide-react";
import { scenarioComic } from "@/lib/level-two-comics.js";

export function ComicTypedText({ text }) {
  const letters = Array.from(text),
    [count, setCount] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(Array.from(text).length);
      return;
    }
    const length = Array.from(text).length;
    const duration = Math.min(1000, Math.max(220, length * 6));
    let frame, start;
    const type = (now) => {
      start ??= now;
      const next = Math.min(
        length,
        Math.floor(((now - start) / duration) * length),
      );
      setCount(next);
      if (next < length) frame = requestAnimationFrame(type);
    };
    frame = requestAnimationFrame(type);
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return (
    <span className="comic-typed-text" data-typing={count < letters.length}>
      <span className="comic-typed-accessible">{text}</span>
      <span className="comic-typed-reserve" aria-hidden="true">
        {text}
      </span>
      <span className="comic-typed-ink" aria-hidden="true">
        {letters.slice(0, count).join("")}
      </span>
    </span>
  );
}

export function ComicArtwork({
  comic,
  index = 0,
  className = "",
  fit = "slice",
  align = "xMidYMid",
}) {
  return (
    <div
      className={`l2-comic-art ${className}`}
      role="img"
      aria-label={comic.panels[index].alt}
    >
      <svg
        viewBox="0 0 768 512"
        preserveAspectRatio={`${align} ${fit}`}
        aria-hidden="true"
        focusable="false"
      >
        <svg
          viewBox={`${index % 2 ? 768 : 0} ${index > 1 ? 512 : 0} 768 512`}
          width="768"
          height="512"
          overflow="hidden"
        >
          <image href={comic.image} width="1536" height="1024" />
        </svg>
      </svg>
    </div>
  );
}
export function ScenarioComicFrame({
  comic,
  index,
  clueOpen,
  onClue,
  onPrevious,
  onNext,
  onSkip,
  onSelect,
  onBegin,
  onClose,
  readOnly,
  busy,
  disabled,
  timerCaption,
  headingRef,
}) {
  const start = Math.floor(index / 2) * 2,
    last = start + 2 >= comic.panels.length;
  return (
    <section
      className="l2-comic-reader is-game-story"
      aria-label={`${comic.name} comic`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && !last) {
          e.preventDefault();
          onNext();
        }
        if (e.key === "ArrowLeft" && start > 0) {
          e.preventDefault();
          onPrevious();
        }
      }}
    >
      <header className="l2-comic-top">
        <span>
          <BookOpen size={14} /> {comic.name}
        </span>
        <span>
          SCENES {start + 1}–{Math.min(start + 2, comic.panels.length)} /{" "}
          {comic.panels.length}
        </span>
        {!readOnly && !last && (
          <button type="button" onClick={onSkip}>
            Skip to your mission <ArrowRight size={13} />
          </button>
        )}
      </header>
      <div
        className="l2-comic-spread"
        aria-label={`Scenes ${start + 1}–${Math.min(start + 2, comic.panels.length)}`}
      >
        {comic.panels.slice(start, start + 2).map((current, offset) => {
          const sceneIndex = start + offset;
          const isClueOpen =
            clueOpen === sceneIndex ||
            (clueOpen === true && sceneIndex === start);
          return (
            <figure
              className="l2-comic-stage"
              key={`${comic.slug}-${sceneIndex}`}
              aria-label={`Scene ${sceneIndex + 1}: ${current.title}`}
            >
              <div
                className="l2-comic-illustration"
                style={{ "--comic-ambient-image": `url("${comic.image}")` }}
              >
                <ComicArtwork comic={comic} index={sceneIndex} fit="meet" />
              </div>
              <figcaption className="l2-comic-dialogue">
                <span className="l2-comic-caption-number">
                  Scene {sceneIndex + 1}
                </span>
                <div className="l2-comic-speaker">
                  {current.speaker === "Kiko" && (
                    <img src="/images/pip/pip-thinking.webp" alt="" />
                  )}
                  <span>{current.speaker.toUpperCase()} SAYS…</span>
                </div>
                <h3
                  ref={sceneIndex === start ? headingRef : undefined}
                  tabIndex={-1}
                >
                  <ComicTypedText
                    key={`${comic.slug}-${sceneIndex}-title`}
                    text={current.title}
                  />
                </h3>
                <p className="l2-comic-speech" key={sceneIndex} role="status">
                  <ComicTypedText
                    key={`${comic.slug}-${sceneIndex}-speech`}
                    text={`“${current.dialogue}”`}
                  />
                </p>
                <button
                  type="button"
                  className="l2-comic-clue"
                  title={current.clue}
                  aria-expanded={isClueOpen}
                  onClick={() => onClue?.(sceneIndex)}
                >
                  <Search size={17} />
                  <span className="l2-comic-clue-label">{current.clue}</span>
                  <span className="l2-comic-clue-toggle">
                    {isClueOpen ? "−" : "+"}
                  </span>
                </button>
                {isClueOpen && (
                  <div className="l2-comic-evidence" role="note">
                    <strong>CLUE FOUND</strong>
                    <p>{current.evidence}</p>
                  </div>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
      <footer className="l2-comic-navigation">
        <button
          type="button"
          className="l2-secondary"
          disabled={start === 0}
          onClick={onPrevious}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <nav className="l2-comic-scene-cards" aria-label="Story scenes">
          {[0, 2]
            .filter((i) => i < comic.panels.length)
            .map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Scenes ${i + 1}–${Math.min(i + 2, comic.panels.length)}`}
                className={
                  start === i ? "is-current" : i < start ? "is-read" : ""
                }
                aria-current={start === i ? "step" : undefined}
                onClick={() => onSelect?.(i)}
              >
                <ComicArtwork comic={comic} index={i} />
                <span>
                  {i + 1}–{Math.min(i + 2, comic.panels.length)}
                </span>
                <strong>
                  Scenes {i + 1}–{Math.min(i + 2, comic.panels.length)}
                </strong>
              </button>
            ))}
        </nav>
        <span className="l2-comic-timer">
          {timerCaption ||
            (readOnly
              ? "Your investigation continues"
              : "Timer has not started")}
        </span>
        {!last ? (
          <button type="button" className="l2-primary" onClick={onNext}>
            Next spread <ArrowRight size={17} />
          </button>
        ) : readOnly ? (
          <button type="button" className="l2-primary" onClick={onClose}>
            Back to investigation <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="l2-primary"
            disabled={busy || disabled}
            onClick={onBegin}
          >
            {busy ? "Starting…" : "Begin investigation"}
            <Play size={16} fill="currentColor" />
          </button>
        )}
      </footer>
    </section>
  );
}
export default function ScenarioComic({
  activityId,
  variant,
  onBegin,
  onClose,
  readOnly = false,
  busy = false,
  disabled = false,
  timerCaption,
}) {
  const comic = scenarioComic(activityId, variant),
    [index, setIndex] = useState(0),
    [clueOpen, setClueOpen] = useState(null),
    heading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index]);
  const go = (value) => {
    setIndex(Math.floor(value / 2) * 2);
    setClueOpen(null);
  };
  if (!comic)
    return (
      <section
        className="l2-comic-original"
        aria-label="Saved scenario briefing"
      >
        <BookOpen size={28} />
        <h3>{variant?.name}</h3>
        <p>{companionText(variant?.brief)}</p>
        <small>
          This saved briefing has its own clues. Its original text is preserved.
        </small>
        {!readOnly && (
          <button
            type="button"
            className="l2-primary"
            disabled={busy || disabled}
            onClick={onBegin}
          >
            {busy ? "Starting…" : "Begin investigation"}
            <Play size={16} />
          </button>
        )}
      </section>
    );
  return (
    <ScenarioComicFrame
      comic={comic}
      index={index}
      clueOpen={clueOpen}
      onClue={(scene) => setClueOpen(clueOpen === scene ? null : scene)}
      onPrevious={() => go(Math.max(0, index - 2))}
      onNext={() => go(Math.min(2, index + 2))}
      onSkip={() => go(2)}
      onSelect={go}
      onBegin={onBegin}
      onClose={onClose}
      readOnly={readOnly}
      busy={busy}
      disabled={disabled}
      timerCaption={timerCaption}
      headingRef={heading}
    />
  );
}
