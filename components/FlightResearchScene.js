"use client";
import {
  Compass,
  Radio,
  LockKeyhole,
  ArrowRight,
  Check,
  Wind,
  Star,
  Sparkles,
  Flag,
  Heart,
  Headphones,
  Leaf,
  MapPin,
  Zap,
  Music,
  Coins,
  CalendarDays,
  Rocket,
  Coffee,
  ShoppingBag,
  Home,
  MessageCircle,
  Lightbulb,
  Plane,
  Ticket,
  Palette,
  TrendingUp,
  PartyPopper,
  Flower2,
} from "lucide-react";
import { missionImageFor } from "@/lib/mission-images";

const companions = {
  sports: [Flag, Star],
  gaming: [Zap, Sparkles],
  mysteries: [Lightbulb, Star],
  fitness: [Heart, Zap],
  travel: [Plane, MapPin],
  food: [Coffee, Sparkles],
  movies: [Ticket, Star],
  music: [Headphones, Music],
  fashion: [ShoppingBag, Sparkles],
  "room-design": [Palette, Home],
  technology: [Rocket, Zap],
  "social-media": [MessageCircle, Heart],
  money: [Coins, TrendingUp],
  business: [TrendingUp, Lightbulb],
  relationships: [Heart, MessageCircle],
  events: [CalendarDays, PartyPopper],
  sustainability: [Flower2, Leaf],
};

const positions = [
  [18, 25],
  [43, 25],
  [69, 25],
  [85, 63],
  [67, 82],
  [30, 82],
  [10, 64],
];
const clues = {
  travel: "Every destination has a story. Find the one worth the journey.",
  food: "Follow your curiosity. Discover what goes into a good choice.",
  gaming: "Look beyond the leaderboard. Discover what makes a game work.",
  music: "Tune into a new world. Find the story behind the sound.",
  movies: "Go beyond the screen. Investigate the stories that stay with us.",
  fashion: "Look past the trend. Discover the choices behind the style.",
  "room-design":
    "Imagine a space differently. Investigate how to bring it to life.",
  technology: "Question the next big thing. Find out what it can really do.",
  "social-media":
    "Look beyond the feed. Find the evidence behind the influence.",
  mysteries: "Follow the clues. Separate a convincing story from the facts.",
  fitness: "Put the claims to the test. Discover what holds up to scrutiny.",
  money: "Trace the possibilities. Make a choice you can explain.",
  business: "Find an opportunity. Investigate what it takes to make it work.",
  sports: "Go beyond the score. Find the decisions that change the game.",
  relationships:
    "Explore different perspectives. Find the reasoning behind a choice.",
  events:
    "Plan for the unexpected. Discover what makes an experience memorable.",
  sustainability: "Follow the impact. Find a better way forward.",
};

// Scene presentation only. Reservations and question locks still use the Day 1 API.
export default function FlightResearchScene({
  data,
  genre,
  question,
  setGenre,
  setQuestion,
  busy,
  error,
  symbols,
  headingRef,
  recordId,
  commit,
  retry,
}) {
  const selection = data?.selection;
  const chosen = data?.genres?.find((g) => g.id === genre);
  const chosenQuestion = selection?.questions.find((q) => q.id === question);
  const index = data?.genres?.findIndex((g) => g.id === genre) ?? -1;
  const target = index >= 0 ? positions[index] : [48, 49];
  const Icon = symbols[selection?.genreId || chosen?.id] || Compass;
  return (
    <section
      className={`flight-research-scene ${selection ? "is-question-stage" : ""}`}
      aria-label="Research mission selection"
      aria-busy={busy}
      data-motion="on"
    >
      <div className="flight-world">
        <div className="flight-scene-heading">
          <span className="flight-overline">
            <Wind size={14} />{" "}
            {selection
              ? "WORLD DISCOVERED"
              : "THE SKY IS FULL OF POSSIBILITIES"}
          </span>
          <h3 ref={headingRef} tabIndex={-1}>
            {selection ? "Choose your mission" : "Choose your world"}
          </h3>
          <p>
            {selection
              ? `${selection.genreName} · Three signals. One discovery.`
              : "Select a genre to begin your discovery."}
          </p>
        </div>
        {!data ? (
          <div className="flight-signal-loading" role="status">
            <Compass size={42} />
            <p>Discovering your seven worlds…</p>
          </div>
        ) : selection ? (
          <fieldset
            className="flight-quest-choices"
            data-pip-target="questions"
            disabled={busy}
          >
            <legend className="sr-only">Choose one of three questions</legend>
            {selection.questions.map((q, i) => {
              const background = missionImageFor(q.id);
              return (
                <label
                  key={q.id}
                  className={`flight-quest ${q.id === question ? "is-selected" : ""}`}
                  style={
                    background
                      ? { "--mission-background": `url("${background}")` }
                      : undefined
                  }
                >
                  <input
                    type="radio"
                    name={`research-question-${recordId}`}
                    value={q.id}
                    checked={question === q.id}
                    aria-label={`Mission ${i + 1}: ${q.title}`}
                    aria-describedby={`mission-prompt-${recordId}-${q.id}`}
                    onChange={() => setQuestion(q.id)}
                  />
                  <span
                    className="flight-quest-art mission-image-window"
                    aria-hidden="true"
                  >
                    <span className="flight-quest-seal">0{i + 1}</span>
                  </span>
                  <span className="flight-quest-kicker">
                    {selection.genreName} / MISSION 0{i + 1}
                  </span>
                  <strong>{q.title}</strong>
                  <span
                    className="flight-quest-prompt"
                    id={`mission-prompt-${recordId}-${q.id}`}
                  >
                    {q.prompt}
                  </span>
                  <span className="flight-quest-select">
                    {q.id === question ? "Mission selected" : "Select mission"}{" "}
                    {q.id === question ? (
                      <Check size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div
            className="flight-world-beacons"
            data-pip-target="genres"
            aria-label="Seven research genres"
          >
            <div className="flight-compass-rose" aria-hidden="true">
              <span>N</span>
              <Compass size={160} strokeWidth={0.5} />
            </div>
            <div
              className={`flight-scout ${index >= 0 ? "is-above-genre" : ""}`}
              style={{
                left: `${target[0]}%`,
                top: `${target[1]}%`,
              }}
              aria-hidden="true"
            >
              <img src="/images/flight-helicopter-right.png" alt="" />
              <span>YOUR FLIGHT</span>
            </div>
            {data.genres.map((g, i) => {
              const Glyph = symbols[g.id] || Compass;
              const [Companion, Accent] = companions[g.id] || [Sparkles, Star];
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-label={`Explore ${g.name}`}
                  aria-pressed={genre === g.id}
                  disabled={busy}
                  className={`flight-world-beacon ${genre === g.id ? "is-selected" : ""}`}
                  data-genre={g.id}
                  style={{
                    left: `${positions[i][0]}%`,
                    top: `${positions[i][1]}%`,
                    "--beacon-delay": `${i * -0.65}s`,
                  }}
                  onClick={() => setGenre(g.id)}
                >
                  <span className="flight-beacon-ring">
                    <span className="flight-beacon-symbol" aria-hidden="true">
                      <Glyph size={34} strokeWidth={1.7} />
                    </span>
                    <span className="flight-beacon-charm" aria-hidden="true">
                      <Companion size={14} strokeWidth={1.8} />
                    </span>
                    <span className="flight-beacon-accent" aria-hidden="true">
                      <Accent size={13} strokeWidth={1.8} />
                    </span>
                    {genre === g.id && (
                      <span className="flight-beacon-check">
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <strong>{g.name}</strong>
                  <small>
                    {genre === g.id ? "COURSE SELECTED" : "EXPLORE WORLD"}
                  </small>
                </button>
              );
            })}
          </div>
        )}
        <div className="flight-scene-footnote">
          <Compass size={15} />
          <span>
            {selection
              ? "Your genre is saved. Your research timer has not started."
              : "Seven worlds. One discovery. The choice is yours."}
          </span>
        </div>
      </div>
      <aside className="flight-radio-panel" aria-label="Mission briefing">
        <div className="flight-radio-channel">
          <Radio size={18} />
          <span>
            FLIGHT RADIO<small>MISSION BRIEFING</small>
          </span>
          <i aria-hidden="true" />
        </div>
        <div className="flight-radio-emblem">
          <Icon size={42} strokeWidth={1.2} />
        </div>
        <span className="flight-overline">
          {selection ? "02 / CHOOSE YOUR MISSION" : "01 / CHART YOUR COURSE"}
        </span>
        <h4 aria-live="polite">
          {selection
            ? chosenQuestion?.title || "Your next discovery"
            : chosen?.name || "A world of your own"}
        </h4>
        <p className="flight-radio-copy">
          {selection
            ? chosenQuestion
              ? "Mission selected. Lock it when you're ready to investigate."
              : "Choose a mission card, then lock your choice."
            : chosen
              ? clues[chosen.id] || "Follow your curiosity into a new world."
              : "Explorer, seven worlds are within reach. Select a beacon to find your research destination."}
        </p>
        <div className="flight-radio-rule">
          <LockKeyhole size={17} />
          <p>
            {selection
              ? "Confirming locks your question. Your 90-minute timer starts when you begin research."
              : chosen
                ? "Locking reserves this genre for you. You cannot switch afterward."
                : "Each explorer in your five-person group claims a different genre."}
          </p>
        </div>
        {error && (
          <div className="flight-radio-error" role="alert">
            <p>{error}</p>
            <button className="btn small" disabled={busy} onClick={retry}>
              Reload saved choices
            </button>
          </div>
        )}
        <button
          className="flight-mission-action"
          data-pip-target={selection ? "question-confirm" : "genre-confirm"}
          disabled={busy || !data || (selection ? !question : !chosen)}
          onClick={() =>
            selection
              ? commit("question", { questionId: question })
              : commit("genre", { genreId: genre })
          }
        >
          <span>
            {busy
              ? "Confirming…"
              : selection
                ? "Lock this mission"
                : chosen
                  ? `Set course for ${chosen.name}`
                  : "Select a world"}
          </span>
          <ArrowRight size={19} />
        </button>
        <small className="flight-radio-save">
          {selection
            ? chosenQuestion
              ? "Selection ready · confirm to lock"
              : "Genre locked · choose your mission"
            : "Your choice locks only when you confirm."}
        </small>
      </aside>
    </section>
  );
}
