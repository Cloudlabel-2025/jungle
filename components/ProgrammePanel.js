"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Compass } from "lucide-react";
import dynamic from "next/dynamic";
import { Busy } from "./ui";
const PilotWorkspace = dynamic(() => import("./PilotWorkspace"), {
  loading: () => <Busy label="Opening programme work…" />,
});

export default function ProgrammePanel({ user, mode, title, description, defaultOpen = false }) {
  const params = useSearchParams();
  const requested = params.get("programme") === mode;
  const [open, setOpen] = useState(requested || defaultOpen);
  const [visited, setVisited] = useState(requested || defaultOpen);
  const panel = useRef(null);
  useEffect(() => {
    setOpen(requested || defaultOpen);
    if (!requested) return;
    setVisited(true);
    // The workspace view is loaded dynamically, after Next's initial hash
    // scrolling. Bring the requested section into view once it actually mounts.
    const frame = requestAnimationFrame(() => {
      panel.current?.scrollIntoView({ block: "start" });
      panel.current?.querySelector("button")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [requested, defaultOpen]);
  return (
    <section ref={panel} className="programme-panel" id={`programme-${mode}`}>
      <button
        type="button"
        className="programme-panel-toggle"
        onClick={() => {
          setOpen(!open);
          setVisited(true);
        }}
        aria-expanded={open}
        aria-controls={`programme-content-${mode}`}
      >
        <Compass size={20} aria-hidden="true" />
        <span>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <ChevronDown
          size={20}
          className={open ? "is-open" : ""}
          aria-hidden="true"
        />
      </button>
      <div
        id={`programme-content-${mode}`}
        hidden={!open}
        className="programme-panel-content"
      >
        {(open || visited) && (
          <PilotWorkspace key={user._id} user={user} mode={mode} />
        )}
      </div>
    </section>
  );
}
