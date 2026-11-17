"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Play,
  RotateCcw,
  Search,
  Lightbulb,
  Monitor,
  Radio,
  ShieldCheck,
  Database,
  Reply,
  Eye,
} from "lucide-react";
import { reasoningModules, experimentOutcome } from "@/lib/signal-lab.js";
import { signalPathCheck } from "@/lib/level-three-missions.js";
import { levelThreeScenarioComic } from "@/lib/level-three-comics.js";
import { companionText } from "@/lib/companion-name.js";

const names = {
  "Browser action": "You click",
  "API request": "A request is sent",
  "Server validation and permissions": "The server checks it",
  "Database operation": "Records are found",
  "API response": "A reply comes back",
  "Browser rendering": "The screen updates",
};
const icons = [Monitor, Radio, ShieldCheck, Database, Reply, Eye];
export default function SimpleSignalChallenge({
  activityId,
  variant,
  sequence = [],
  labState = {},
  onSequence,
  onLabState,
  readOnly,
  disabled,
  stage = "build",
  onReady,
  onTeach,
  onTested,
}) {
  const general = activityId === "D3-G01",
    clues = general ? reasoningModules(variant) : null,
    cards = variant.cards || [];
  const technicalStory =
    !general && levelThreeScenarioComic(activityId, variant);
  const [result, setResult] = useState(null),
    [running, setRunning] = useState(false),
    [advanced, setAdvanced] = useState(
      Boolean(labState.fault && labState.fault !== "none"),
    );
  const signature = JSON.stringify([
    sequence,
    labState.prediction,
    labState.fault,
  ]);
  useEffect(() => {
    setResult(null);
    setRunning(false);
  }, [signature]);
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => {
      const route = general
        ? { ready: true, mismatch: -1 }
        : signalPathCheck(cards, sequence);
      setResult({
        route: route.ready && route.mismatch < 0,
        ...experimentOutcome(activityId, labState),
      });
      setRunning(false);
      onTested?.();
    }, 1400);
    return () => clearTimeout(timer);
  }, [running, signature]);
  const locked = readOnly || disabled || running,
    ready = general || (sequence.length === cards.length && cards.length > 0);
  const label = (card) => names[card] || card;
  if (stage === "read")
    return (
      <div className="simple-lab-read">
        <div className="simple-case-intro">
          <span className="simple-lab-kicker">
            STEP 1 / UNDERSTAND THE CASE
          </span>
          <h3>
            {general
              ? "What is the clue telling us?"
              : "What happens after the click?"}
          </h3>
          <p>
            {general
              ? "Read the claim and the clue. In the next step, decide what the evidence really supports."
              : "Read the situation. Next, put the actions in order to see how the request reaches the screen."}
          </p>
        </div>
        {clues || technicalStory ? (
          <div className="simple-clue-pair">
            <article>
              <Search />
              <span>{general ? "THE CLAIM" : "YOUR ACTION"}</span>
              <p>{clues ? clues[0].text : technicalStory.panels[0].dialogue}</p>
            </article>
            <article>
              <Lightbulb />
              <span>{general ? "THE CLUE" : "YOUR CHALLENGE"}</span>
              <p>
                {clues
                  ? clues[1].text
                  : "A click alone does not prove the work is done. Put the steps between the click and the result in order."}
              </p>
            </article>
          </div>
        ) : (
          <article className="simple-original-case">
            <span>YOUR CASE / {variant.name}</span>
            <p>{companionText(variant.brief)}</p>
          </article>
        )}
        <div className="simple-lab-next">
          <span>No answer to type yet. Just understand the situation.</span>
          <button className="lab-primary" disabled={disabled} onClick={onReady}>
            I’m ready to try <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  const predictions = general
    ? [
        ["proven", "The change caused the result."],
        ["uncertain", "Another factor could explain it."],
        ["unrelated", "The observation tells us nothing."],
      ]
    : [
        ["continues", "The screen receives the result."],
        ["blocked", "The request is rejected."],
        ["no-response", "The requested records do not return."],
      ];
  const correct = result?.route && result?.correct;
  return (
    <div className={`simple-lab-game ${running ? "is-testing" : ""}`}>
      <div className="simple-lab-challenge">
        <span className="simple-lab-kicker">
          STEP 2 / {general ? "MAKE YOUR CALL" : "BUILD THE JOURNEY"}
        </span>
        <h3>
          {general
            ? "Which conclusion fits the clue?"
            : ready
              ? "What do you expect to happen?"
              : "What happens next?"}
        </h3>
        {general ? (
          <div className="simple-clue-reminder">
            <Search size={20} />
            <p>{clues ? clues[1].text : companionText(variant.brief)}</p>
          </div>
        ) : (
          <>
            <ol className="simple-click-path" aria-label="Connected modules">
              {cards.map((card, i) => {
                const placed = sequence[i],
                  Icon = icons[cards.indexOf(placed)] || Monitor;
                return (
                  <li
                    key={i}
                    className={
                      placed
                        ? "is-placed"
                        : i === sequence.length
                          ? "is-next"
                          : ""
                    }
                  >
                    <span>{i + 1}</span>
                    {placed ? (
                      <>
                        <Icon size={20} />
                        <strong>{label(placed)}</strong>
                      </>
                    ) : (
                      <small>
                        {i === sequence.length
                          ? "Choose the next action"
                          : "Then…"}
                      </small>
                    )}
                  </li>
                );
              })}
            </ol>
            {!ready && (
              <div className="simple-action-tray" aria-label="Module tray">
                {(cards.length === 6
                  ? [cards[3], cards[0], cards[5], cards[1], cards[4], cards[2]]
                  : cards
                )
                  .filter((card) => !sequence.includes(card))
                  .map((card) => (
                    <button
                      key={card}
                      aria-label={`Add ${card}`}
                      disabled={locked}
                      onClick={() => onSequence([...sequence, card])}
                    >
                      <strong>{label(card)}</strong>
                      <small>{card}</small>
                      <ArrowRight size={16} />
                    </button>
                  ))}
              </div>
            )}
            <div className="simple-path-tools">
              <span>
                {sequence.length}/{cards.length} actions placed
              </span>
              <button
                disabled={locked || !sequence.length}
                onClick={() => onSequence(sequence.slice(0, -1))}
              >
                <ArrowLeft size={13} /> Undo last
              </button>
              <button
                disabled={locked || !sequence.length}
                onClick={() => onSequence([])}
              >
                <RotateCcw size={13} /> Start again
              </button>
            </div>
          </>
        )}
        {ready && (
          <>
            {!result && (
              <fieldset className="simple-predictions" disabled={locked}>
                <legend>
                  {general
                    ? "Choose the explanation you would investigate."
                    : "Make a prediction before sending the request."}
                </legend>
                {predictions.map(([id, text]) => (
                  <button
                    key={id}
                    aria-pressed={labState.prediction === id}
                    onClick={() => onLabState({ ...labState, prediction: id })}
                  >
                    <span>
                      {labState.prediction === id ? <Check size={16} /> : ""}
                    </span>
                    {text}
                  </button>
                ))}
              </fieldset>
            )}
            {!general && !result && (
              <div className="simple-extra-test">
                <button
                  aria-expanded={advanced}
                  onClick={() => setAdvanced(!advanced)}
                >
                  Try a different condition {advanced ? "−" : "+"}
                </button>
                {advanced && (
                  <fieldset disabled={locked}>
                    <legend>Practice condition</legend>
                    {[
                      ["none", "Everything works"],
                      ["permissions", "Permission is denied"],
                      ["database", "Database is offline"],
                    ].map(([id, text]) => (
                      <button
                        key={id}
                        aria-pressed={(labState.fault || "none") === id}
                        onClick={() =>
                          onLabState({ ...labState, fault: id, prediction: "" })
                        }
                      >
                        {text}
                      </button>
                    ))}
                  </fieldset>
                )}
              </div>
            )}
            <div className="simple-test-actions">
              <button
                className={correct ? "lab-secondary" : "lab-primary"}
                disabled={locked || !labState.prediction}
                onClick={() => (result ? setResult(null) : setRunning(true))}
              >
                <Play size={16} />
                {running
                  ? "Testing…"
                  : result
                    ? correct
                      ? "Change my answer"
                      : "Try another answer"
                    : "Test my answer"}
              </button>
              <span>
                {!labState.prediction
                  ? "Choose an answer above to test it."
                  : "This practice test does not submit your mission."}
              </span>
            </div>
          </>
        )}
        {result && (
          <div
            className={`simple-test-feedback ${correct ? "is-correct" : ""}`}
            role="status"
          >
            <strong>
              {!result.route
                ? "A step is out of order."
                : general && !clues
                  ? "Prediction recorded."
                  : correct
                    ? "That fits the evidence!"
                    : "Take another look."}
            </strong>
            <p>
              {!result.route
                ? "Use Undo last or Start again to change your path. Then test it again."
                : general
                  ? !clues
                    ? "Use your original case to justify your prediction. This practice test does not grade the facts in a custom briefing."
                    : correct
                      ? "The clue gives us another possible explanation. Tell Kiko why a fair comparison matters."
                      : "The clue changes what we can conclude. Consider an explanation that leaves room for another cause."
                  : correct
                    ? labState.fault === "permissions"
                      ? "The server checks permission before reading records."
                      : labState.fault === "database"
                        ? "The records are unavailable. The server may still send an error response."
                        : "The request gets checked, the records return and the screen updates."
                    : "Follow the path and your selected condition. Then try a different prediction."}
            </p>
          </div>
        )}
      </div>
      <aside className="simple-kiko-coach">
        <img
          src={`/images/pip/pip-${running ? "thinking" : result ? (correct ? "celebrating" : "concerned") : "guiding"}.webp`}
          alt="Kiko guides your challenge"
        />
        <p>
          {general
            ? "A confident claim is not enough. Use the clue to decide what you would check next."
            : "Choose one action at a time. The small labels show the technical names."}
        </p>
        {(result || readOnly) && (
          <button
            className={
              correct || readOnly || (general && !clues)
                ? "lab-primary"
                : "lab-secondary"
            }
            disabled={disabled || running}
            onClick={onTeach}
          >
            Explain it to Kiko <ArrowRight size={16} />
          </button>
        )}
      </aside>
    </div>
  );
}
