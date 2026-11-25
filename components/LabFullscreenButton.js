"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
export default function LabFullscreenButton({ selector, label }) {
  const button = useRef(),
    [active, setActive] = useState(false);
  useEffect(() => {
    const update = () => {
      const target = button.current?.closest(selector);
      setActive(
        Boolean(
          target &&
          (document.fullscreenElement === target ||
            target.classList.contains("lab-expanded")),
        ),
      );
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".lab-expanded")
          .forEach((n) => n.classList.remove("lab-expanded"));
        window.dispatchEvent(new Event("vow:lab-fullscreen"));
      }
    };
    document.addEventListener("fullscreenchange", update);
    window.addEventListener("vow:lab-fullscreen", update);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      window.removeEventListener("vow:lab-fullscreen", update);
      window.removeEventListener("keydown", escape);
    };
  }, [selector]);
  async function toggle() {
    const target = button.current.closest(selector);
    if (active) {
      if (document.fullscreenElement === target)
        await document.exitFullscreen();
      target.classList.remove("lab-expanded");
    } else {
      document
        .querySelectorAll(".lab-expanded")
        .forEach((n) => n.classList.remove("lab-expanded"));
      try {
        if (!target.requestFullscreen) throw Error("Fullscreen unavailable");
        await target.requestFullscreen();
      } catch {
        target.classList.add("lab-expanded");
      }
    }
    window.dispatchEvent(new Event("vow:lab-fullscreen"));
  }
  return (
    <button
      ref={button}
      className="btn small"
      type="button"
      aria-label={active ? `Exit ${label} fullscreen` : `Expand ${label}`}
      aria-pressed={active}
      title={active ? "Exit fullscreen (Esc)" : `Fullscreen ${label}`}
      onClick={toggle}
    >
      {active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      <span>{active ? "Exit fullscreen" : "Fullscreen"}</span>
    </button>
  );
}
