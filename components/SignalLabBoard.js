"use client";
import { companionText } from "@/lib/companion-name.js";
import { useEffect, useState } from "react";
import {
  Activity,
  Search,
  Lightbulb,
  Monitor,
  Radio,
  ShieldCheck,
  Database,
  Reply,
  Eye,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Play,
} from "lucide-react";
import {
  reasoningRoles,
  reasoningCheck,
  reasoningModules,
  experimentOutcome,
} from "@/lib/signal-lab.js";
import { signalPathCheck } from "@/lib/level-three-missions.js";

const roleIcons = { claim: Search, evidence: Activity, explanation: Lightbulb };
const systemIcons = [Monitor, Radio, ShieldCheck, Database, Reply, Eye];
const systemHints = {
  "Browser action":
    "The player clicks or types in the browser. That starts a request; it does not directly read the database.",
  "API request":
    "The API request carries the requested action and input to the server using an agreed interface.",
  "Server validation and permissions":
    "The server checks the input and whether this person may perform the action before accessing records.",
  "Database operation":
    "The database reads or updates stored records after the server authorizes the operation.",
  "API response":
    "The server returns data or an error through the API. A response is not always a successful result.",
  "Browser rendering":
    "The browser uses the response to update what the player sees on screen.",
};
export default function SignalLabBoard({
  activityId,
  variant,
  sequence = [],
  labState = {},
  onSequence,
  onLabState,
  readOnly,
  disabled,
  onTeach,
}) {
  const general = activityId === "D3-G01",
    authored = general && reasoningModules(variant);
  const cards = general ? reasoningRoles : variant.cards || [];
  const placed = general ? labState.circuit || [] : sequence;
  const [signal, setSignal] = useState(-1),
    [result, setResult] = useState(null),
    [focus, setFocus] = useState(null),
    [brief, setBrief] = useState(false);
  const route = general
    ? {
        ready: placed.length === 3,
        mismatch: reasoningCheck(placed)
          ? -1
          : placed.findIndex((id, i) => id !== reasoningRoles[i]),
      }
    : signalPathCheck(cards, placed);
  const faultIndex =
    general || labState.fault === "none" || !labState.fault
      ? -1
      : labState.fault === "permissions"
        ? 2
        : 3;
  const signature = JSON.stringify([
    placed,
    labState.fault,
    labState.prediction,
  ]);
  const locked = readOnly || disabled || signal >= 0;
  useEffect(() => {
    setSignal(-1);
    setResult(null);
  }, [signature]);
  useEffect(() => {
    if (signal < 0) return;
    const stop =
      route.mismatch >= 0
        ? route.mismatch
        : faultIndex >= 0
          ? faultIndex
          : cards.length - 1;
    const timer = setTimeout(() => {
      if (signal >= stop) {
        setSignal(-1);
        setResult({
          route: route.mismatch < 0,
          ...experimentOutcome(activityId, labState),
        });
      } else setSignal(signal + 1);
    }, 450);
    return () => clearTimeout(timer);
  }, [signal, signature, route.mismatch, faultIndex, cards.length]);
  const label = (id) =>
    general
      ? { claim: "Claim", evidence: "Evidence", explanation: "Explanation" }[id]
      : id;
  const IconFor = (id) =>
    general
      ? roleIcons[id] || Activity
      : systemIcons[cards.indexOf(id)] || Activity;
  const update = (next) =>
    general ? onLabState({ ...labState, circuit: next }) : onSequence(next);
  const move = (i, delta) => {
    const next = [...placed],
      to = i + delta;
    if (locked || to < 0 || to >= next.length) return;
    [next[i], next[to]] = [next[to], next[i]];
    update(next);
  };
  const predictions = general
    ? [
        ["proven", "The claim is proven"],
        ["uncertain", "We need a fair test"],
        ["unrelated", "Ignore the evidence"],
      ]
    : [
        ["continues", "Signal completes"],
        ["blocked", "Request is rejected"],
        ["no-response", "No data returns"],
      ];
  const hint = result
    ? !result.route
      ? "That connection broke the explanation. Rearrange the modules and run it again."
      : general && !authored
        ? "The circuit is connected. Use this custom case's original briefing to justify your conclusion; this practice model does not grade its facts."
        : general
          ? result.correct
            ? "Exactly! The evidence challenges the claim. Explain what a fair comparison would look like."
            : "A pattern is not proof. Think about the other explanation, then try another prediction."
          : result.correct
            ? labState.fault === "permissions"
              ? "Correct! The server rejects permission before reading records. Teach me why that check matters."
              : labState.fault === "database"
                ? "Correct! No requested records return from the offline database. The server may still send an error response."
                : "Correct! The response reaches the browser and updates the screen. Now teach me each component's job."
            : labState.fault === "permissions"
              ? "The server rejects the request before it reaches the database. Try predicting that outcome."
              : labState.fault === "database"
                ? "The database failed, so this model cannot return the requested records. Try again."
                : "With the correct route and no fault, the response reaches the browser. Try again."
    : focus && general && authored
      ? authored.find((c) => c.id === focus)?.text
      : focus && !general
        ? systemHints[focus] ||
          "Use the original briefing to explain this component's role."
        : general
          ? "Connect claim → evidence → explanation. Predict what the evidence tells us, then run your circuit."
          : "Build the route of a click. Choose a fault, predict the outcome and send a test signal.";
  return (
    <div className="signal-lab-play">
      <div className="signal-lab-workbench">
        <div className="signal-lab-board-title">
          <span>
            <Activity size={15} />{" "}
            {general ? "REASONING CIRCUIT" : "REQUEST CIRCUIT"}
          </span>
          <button
            type="button"
            onClick={() => setBrief(!brief)}
            aria-expanded={brief}
          >
            Mission briefing
          </button>
        </div>
        {brief && <div className="signal-lab-brief">{companionText(variant.brief)}</div>}
        {general && !authored && (
          <p className="signal-lab-custom">
            Use the original briefing to build your own explanation; this saved
            case has custom evidence.
          </p>
        )}
        <ol
          className={`signal-lab-sockets ${general ? "is-reasoning" : ""}`}
          aria-label="Connected modules"
        >
          {cards.map((_, i) => {
            const id = placed[i],
              Icon = IconFor(id);
            return (
              <li
                key={i}
                className={`${id ? "is-connected" : ""} ${signal === i ? "is-live" : ""} ${result && ((result.route === false && i === route.mismatch) || (result.route && faultIndex >= 0 && i === faultIndex)) ? "is-broken" : ""}`}
              >
                <small>
                  {String(i + 1).padStart(2, "0")} /{" "}
                  {general
                    ? ["OBSERVE", "CONNECT", "EXPLAIN"][i]
                    : "SIGNAL NODE"}
                </small>
                <button
                  type="button"
                  className="signal-lab-node"
                  aria-label={
                    id ? `Inspect ${label(id)}` : `Empty socket ${i + 1}`
                  }
                  disabled={!id}
                  onClick={() => {
                    setFocus(id);
                    setResult(null);
                  }}
                >
                  <Icon size={32} />
                  <strong>{id ? label(id) : "Connect a module"}</strong>
                </button>
                {id && (
                  <div className="signal-lab-node-tools">
                    <button
                      aria-label={`Move ${label(id)} up`}
                      disabled={locked || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      aria-label={`Remove ${label(id)}`}
                      disabled={locked}
                      onClick={() =>
                        update(placed.filter((_, index) => index !== i))
                      }
                    >
                      <X size={13} />
                    </button>
                    <button
                      aria-label={`Move ${label(id)} down`}
                      disabled={locked || i === placed.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="signal-lab-tray" aria-label="Module tray">
          <small>MODULE TRAY</small>
          {(general
            ? ["explanation", "claim", "evidence"]
            : cards.length === 6
              ? [cards[3], cards[0], cards[5], cards[1], cards[4], cards[2]]
              : cards
          )
            .filter((id) => !placed.includes(id))
            .map((id) => {
              const Icon = IconFor(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`Add ${label(id)}`}
                  disabled={locked}
                  onClick={() => {
                    update([...placed, id]);
                    setFocus(id);
                  }}
                >
                  <Icon size={18} />
                  <span>{label(id)}</span>
                  <Plus size={13} />
                </button>
              );
            })}
          {placed.length === cards.length && (
            <span>All modules connected. Test your prediction.</span>
          )}
        </div>
      </div>
      <aside className="signal-lab-pip">
        <img
          src={`/images/pip/pip-${signal >= 0 ? "thinking" : result ? (result.route && result.correct ? "celebrating" : "concerned") : "guiding"}.webp`}
          alt="Kiko, your lab companion"
        />
        <div className="signal-lab-speech" role="status">
          <small>
            KIKO /{" "}
            {signal >= 0
              ? "SIGNAL IN FLIGHT"
              : result
                ? "EXPERIMENT RESULT"
                : "LAB COMPANION"}
          </small>
          <p>
            {signal >= 0
              ? `Signal at node ${signal + 1}… Watch what happens next.`
              : hint}
          </p>
        </div>
        {!general && (
          <fieldset disabled={locked} className="signal-lab-faults">
            <legend>Simulate a fault</legend>
            {[
              ["none", "No fault"],
              ["permissions", "Permission denied"],
              ["database", "Database offline"],
            ].map(([id, text]) => (
              <button
                type="button"
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
        <fieldset className="signal-lab-predictions" disabled={locked}>
          <legend>
            {general ? "What can we conclude?" : "Predict the outcome"}
          </legend>
          {predictions.map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={labState.prediction === id}
              onClick={() => onLabState({ ...labState, prediction: id })}
            >
              {text}
            </button>
          ))}
        </fieldset>
        <div className="signal-lab-run">
          <button
            type="button"
            className="lab-primary"
            disabled={
              disabled || signal >= 0 || !route.ready || !labState.prediction
            }
            onClick={() => {
              setResult(null);
              setSignal(0);
            }}
          >
            <Play size={16} />
            {signal >= 0 ? "Testing…" : "Run experiment"}
          </button>
          <button
            type="button"
            className="lab-secondary"
            onClick={onTeach}
            disabled={disabled || signal >= 0}
          >
            Explain result <ArrowRight size={15} />
          </button>
        </div>
        <small className="signal-lab-rehearsal">
          A simulation teaches the concept. Submit your own explanation to earn
          rewards.
        </small>
      </aside>
    </div>
  );
}
