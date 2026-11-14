"use client";
import { useEffect, useRef, useState } from "react";
import {
  Compass,
  MapPin,
  Utensils,
  Gamepad2,
  Music,
  Clapperboard,
  Shirt,
  House,
  Cpu,
  Smartphone,
  Search,
  Dumbbell,
  Wallet,
  Briefcase,
  Trophy,
  Users,
  CalendarDays,
  Leaf,
  LockKeyhole,
  ArrowRight,
  Check,
} from "lucide-react";
import LegacyResearchGenrePicker from "./LegacyResearchGenrePicker";
import FlightResearchScene from "./FlightResearchScene";

const symbols = {
  travel: MapPin,
  food: Utensils,
  gaming: Gamepad2,
  music: Music,
  movies: Clapperboard,
  fashion: Shirt,
  "room-design": House,
  technology: Cpu,
  "social-media": Smartphone,
  mysteries: Search,
  fitness: Dumbbell,
  money: Wallet,
  business: Briefcase,
  sports: Trophy,
  relationships: Users,
  events: CalendarDays,
  sustainability: Leaf,
};
export default function ResearchGenrePicker(props) {
  return props.interactive ? (
    <ResearchChoiceGame {...props} />
  ) : (
    <LegacyResearchGenrePicker {...props} />
  );
}

function ResearchChoiceGame({ act, recordId, game = false }) {
  const [data, setData] = useState(null);
  const [genre, setGenre] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const actRef = useRef(act);
  actRef.current = act;
  const sequence = useRef(0);
  const selectionHeading = useRef(null);
  const selection = data?.selection;
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      if (pending.current) return;
      const request = ++sequence.current;
      try {
        const response = await fetch("/api/day1/genre-offer", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
        });
        const result = await response.json();
        if (disposed || pending.current || request !== sequence.current) return;
        if (!response.ok)
          throw new Error(
            result.error || "Could not load your research choices.",
          );
        if (result.assignment) {
          pending.current = true;
          try {
            await actRef.current(
              "day1/question",
              { questionId: result.assignment.questionId },
              "",
            );
          } finally {
            pending.current = false;
          }
          return;
        }
        setData(result);
        setError("");
        setGenre((value) =>
          result.genres.some((g) => g.id === value) ? value : "",
        );
      } catch (e) {
        if (!disposed && request === sequence.current) setError(e.message);
      }
    }
    load();
    const timer = setInterval(load, 8000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [recordId, retry]);
  useEffect(() => {
    if (selection) selectionHeading.current?.focus();
  }, [selection?.genreId]);
  async function commit(action, body) {
    if (pending.current) return;
    pending.current = true;
    sequence.current++;
    setBusy(true);
    setError("");
    try {
      const result = await act(
        `day1/${action}`,
        body,
        action === "genre"
          ? "Genre locked. Choose your research question."
          : "Research question locked. Your mission is ready.",
      );
      if (result) {
        setData(result);
        setGenre("");
        setQuestion("");
      } else {
        setError(
          "Your choice was not confirmed. Availability may have changed; review the current choices and try again.",
        );
        setRetry((n) => n + 1);
      }
    } catch (e) {
      setError(
        e.message ||
          "Your choice could not be confirmed. Retry to check its saved status.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const chosenGenre = data?.genres.find((g) => g.id === genre);
  if (game)
    return (
      <FlightResearchScene
        data={data}
        genre={genre}
        question={question}
        setGenre={setGenre}
        setQuestion={setQuestion}
        busy={busy}
        error={error}
        symbols={symbols}
        headingRef={selectionHeading}
        recordId={recordId}
        commit={commit}
        retry={() => {
          setError("");
          setRetry((n) => n + 1);
        }}
      />
    );
  return (
    <section
      className="research-choice-game"
      aria-label="Research mission selection"
      aria-busy={busy}
    >
      {!game && (
        <ol
          className="research-progress"
          aria-label="Research selection progress"
        >
          <li className={!selection ? "is-current" : "is-complete"}>
            {selection ? <Check size={15} /> : "01"}
            <span>Choose a genre</span>
          </li>
          <li className={selection ? "is-current" : ""}>
            02<span>Choose a question</span>
          </li>
          <li>
            03<span>Begin research</span>
          </li>
        </ol>
      )}
      {error && (
        <p className="research-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <div className="research-loading" role="status">
          Preparing your seven research routes…
        </div>
      ) : selection ? (
        <>
          <div className="research-selection-heading">
            <span className="research-kicker">
              <LockKeyhole size={13} /> GENRE LOCKED
            </span>
            <h3 tabIndex={-1} ref={selectionHeading}>
              {selection.genreName}: choose your question
            </h3>
            <p>
              Read all three missions. Select one, then confirm your choice.
              Your confirmed question stays with you for this round and Friday’s
              Fitness activity.
            </p>
          </div>
          <fieldset className="research-question-list" disabled={busy}>
            <legend className="research-field-legend">
              Choose one of three questions
            </legend>
            {selection.questions.map((q, index) => (
              <label
                className={`research-question-card ${question === q.id ? "is-selected" : ""}`}
                key={q.id}
              >
                <input
                  type="radio"
                  name={`research-question-${recordId}`}
                  value={q.id}
                  checked={question === q.id}
                  onChange={() => setQuestion(q.id)}
                />
                <span className="research-question-copy">
                  <span className="research-kicker">MISSION 0{index + 1}</span>
                  <strong>{q.title}</strong>
                  <span>{q.prompt}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="research-lock-panel">
            <p>
              <LockKeyhole size={16} /> Confirming locks this question. The
              research timer starts later, when you explicitly begin.
            </p>
            <button
              className="research-confirm"
              disabled={!question || busy}
              onClick={() => commit("question", { questionId: question })}
            >
              {busy ? "Confirming your question…" : "Confirm and lock question"}
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="research-selection-heading">
            <span className="research-kicker">
              FLIGHT MISSION / PICK YOUR ROUTE
            </span>
            <h3>Which world will you investigate?</h3>
            <p>
              Explore seven genres. Select a card, then lock your genre to
              reveal its three questions. Each genre belongs to one person in
              your five-person research group.
            </p>
          </div>
          <div
            className="research-genre-grid"
            aria-label="Seven research genres"
          >
            {data.genres.map((g, index) => {
              const Icon = symbols[g.id] || Compass;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`research-genre-card ${genre === g.id ? "is-selected" : ""}`}
                  disabled={busy}
                  aria-pressed={genre === g.id}
                  onClick={() => setGenre(g.id)}
                >
                  <span className="research-route-number">
                    ROUTE 0{index + 1}
                  </span>
                  <Icon size={32} strokeWidth={1.5} />
                  <strong>{g.name}</strong>
                  <span className="research-card-action">
                    {genre === g.id ? (
                      <>
                        <Check size={15} /> Selected
                      </>
                    ) : (
                      <>
                        Explore this route <ArrowRight size={15} />
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="research-lock-panel">
            <p>
              <LockKeyhole size={16} />
              {chosenGenre
                ? `Ready for ${chosenGenre.name}? Locking it reserves this genre for you. You cannot switch afterward.`
                : "Choose a card to continue. Your genre only locks when you confirm below."}
            </p>
            <button
              className="research-confirm"
              disabled={!chosenGenre || busy}
              onClick={() => commit("genre", { genreId: genre })}
            >
              {busy
                ? "Reserving your genre…"
                : chosenGenre
                  ? `Lock ${chosenGenre.name} and reveal questions`
                  : "Select a genre first"}
              <ArrowRight size={18} />
            </button>
          </div>
          <p className="research-availability" aria-live="polite">
            Your routes stay saved. Only a route claimed by a teammate is
            replaced.
          </p>
        </>
      )}
      {error && (
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setError("");
            setRetry((n) => n + 1);
          }}
        >
          Reload saved choices
        </button>
      )}
    </section>
  );
}
