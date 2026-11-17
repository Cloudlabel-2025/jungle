"use client";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Plus, X, Radio, Check, Play } from "lucide-react";
import { signalPathCheck } from "@/lib/level-three-missions.js";

export default function ComponentSequenceBoard({
  cards = [],
  value = [],
  onChange,
  readOnly = false,
  disabled = false,
}) {
  const [signal, setSignal] = useState(-1);
  const [ran, setRan] = useState(false);
  const placed = Array.isArray(value) ? value : [],
    locked = readOnly || disabled;
  const offered =
    cards.length === 6 ? [3, 0, 5, 1, 4, 2].map((i) => cards[i]) : cards;
  const check = signalPathCheck(cards, placed);
  const signature = JSON.stringify(placed);
  useEffect(() => {
    setSignal(-1);
    setRan(false);
  }, [signature]);
  useEffect(() => {
    if (signal < 0) return;
    const end = check.mismatch < 0 ? cards.length - 1 : check.mismatch;
    const timer = setTimeout(() => {
      if (signal >= end) {
        setSignal(-1);
        setRan(true);
      } else setSignal(signal + 1);
    }, 550);
    return () => clearTimeout(timer);
  }, [signal, check.mismatch, cards.length, signature]);
  const move = (index, delta) => {
    const next = [...placed],
      to = index + delta;
    if (locked || to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };
  return (
    <div className="l3-sequence-board" aria-label="Build the component journey">
      <div className="l3-component-bank" aria-label="Available components">
        <div className="l3-run-control">
          <button
            type="button"
            disabled={locked || !check.ready || signal >= 0}
            onClick={() => {
              setRan(false);
              setSignal(0);
            }}
          >
            <Play size={16} />{" "}
            {signal >= 0 ? "Signal travelling…" : "Send test signal"}
          </button>
          <small role="status">
            {ran
              ? check.mismatch < 0
                ? "Signal delivered! Now explain why this route works."
                : `Signal stopped at step ${check.mismatch + 1}. Check which component should come here.`
              : `Place all ${cards.length} components, then test your route. Testing does not submit your mission.`}
          </small>
        </div>
        {offered
          .filter((card) => !placed.includes(card))
          .map((card) => (
            <button
              type="button"
              key={card}
              aria-label={`Add ${card}`}
              disabled={locked}
              onClick={() => onChange([...placed, card])}
            >
              <Plus size={16} />
              <span>{card}</span>
            </button>
          ))}
        {placed.length === cards.length && (
          <span className="l3-bank-complete">
            <Check size={16} /> All components placed. Check their order.
          </span>
        )}
      </div>
      <ol className="l3-signal-path" aria-label="Your ordered components">
        {cards.map((_, index) => (
          <li
            key={index}
            className={`${placed[index] ? "is-connected" : "is-empty"} ${signal === index ? "is-signal-here" : ""}`}
          >
            <span className="l3-slot-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>
              {placed[index] ||
                (index === placed.length
                  ? "Choose the next component"
                  : "Waiting for a signal")}
            </strong>
            {placed[index] ? (
              <div className="l3-slot-tools">
                <button
                  type="button"
                  aria-label={`Move ${placed[index]} up`}
                  disabled={locked || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${placed[index]} down`}
                  disabled={locked || index === placed.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${placed[index]}`}
                  disabled={locked}
                  onClick={() => onChange(placed.filter((_, i) => i !== index))}
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <Radio size={17} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
