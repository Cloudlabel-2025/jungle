"use client";
import { useEffect, useState } from "react";

// Type only presentation text. Game actions never wait for dialogue to finish.
export default function PipSpeech({ text }) {
  const [progress, setProgress] = useState({ text, count: 0 });
  const characters = Array.from(text);
  const count = progress.text === text ? progress.count : 0;
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setProgress({ text, count: Array.from(text).length });
      return;
    }
    setProgress({ text, count: 0 });
    const length = Array.from(text).length;
    let revealed = 0;
    const timer = setInterval(() => {
      revealed = Math.min(length, revealed + 1);
      setProgress({ text, count: revealed });
      if (revealed === length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [text]);
  return (
    <p className="pip-speech" data-speaking={count < characters.length}>
      <span className="sr-only" role="status">
        {text}
      </span>
      <span className="pip-speech-reserve" aria-hidden="true">
        {text}
      </span>
      <span className="pip-speech-typed" aria-hidden="true">
        {characters.slice(0, count).join("")}
        {count < characters.length && <span className="pip-speech-caret" />}
      </span>
    </p>
  );
}
