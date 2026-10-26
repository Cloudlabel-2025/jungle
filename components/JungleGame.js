"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Tent,
  Users,
  Flag,
  Compass,
  Check,
  Footprints,
  SquareTerminal,
  ListChecks,
  Trophy,
  X,
} from "lucide-react";
import { encounters } from "@/lib/expedition";
import { EncounterDialog } from "./Expedition";
import { Modal, Receipt } from "./ui";

const stops = encounters.map((encounter, index) => ({
  ...encounter,
  x: 7 + index * (83 / 9),
  y: [68, 28, 72, 32, 68, 25, 72, 30, 68, 37][index],
}));

export default function JungleGame({ data, act, camp, party, onQuest }) {
  const [panel, setPanel] = useState(null),
    [selected, setSelected] = useState(null);
  const viewport = useRef(null),
    drag = useRef(null);
  const campControl = useRef(null);
  const campTrigger = useRef(null);
  useEffect(() => {
    if (panel !== "camp") return;
    function dismiss(event) {
      if (!campControl.current?.contains(event.target)) setPanel(null);
    }
    function escape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPanel(null);
      campTrigger.current?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);
  const modules = data.modules;
  const completed = data.progress
    .filter((p) => p.userId === data.user._id)
    .map((p) => p.moduleId);
  const next = modules.find((m) => !completed.includes(m._id));
  const tasks = data.tasks.filter((t) => t.assigneeId === data.user._id);
  const rescue = data.rescues.some(
    (r) => r.userId === data.user._id && r.status !== "CLOSED",
  );
  const ready =
    completed.length === modules.length &&
    tasks.every((t) => t.status === "Done") &&
    data.user.hp > 0 &&
    !rescue;
  function locate() {
    const stop = stops[(next?.number || modules.length) - 1];
    const el = viewport.current;
    if (!el || !stop) return;
    const world = el.firstElementChild;
    el.scrollTo({
      left: (world.clientWidth * stop.x) / 100 - el.clientWidth / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useEffect(() => {
    const frame = requestAnimationFrame(locate);
    return () => cancelAnimationFrame(frame);
  }, [data.user._id, next?._id]);
  useEffect(() => {
    const el = viewport.current;
    function wheel(event) {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY))
        return;
      const max = el.scrollWidth - el.clientWidth;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el.clientWidth
            : 1);
      if (
        (delta < 0 && el.scrollLeft > 0) ||
        (delta > 0 && el.scrollLeft < max)
      ) {
        event.preventDefault();
        el.scrollLeft += delta;
      }
    }
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  function pan(direction) {
    const el = viewport.current;
    el.scrollBy({
      left: el.clientWidth * 0.7 * direction,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const panels = {
    camp: "Base camp",
    party: "Your expedition party",
    objectives: "Your objectives",
    extraction: "Expedition clearance",
    encounters: "Choose an encounter",
    leaderboard: "Trophy leaderboard",
  };
  return (
    <section className="jungle-game" aria-label="Expedition game map">
      <div
        className="game-map-window"
        ref={viewport}
        tabIndex={0}
        aria-label="Uncharted jungle. Use left and right arrow keys, drag, or scroll to explore the forest."
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            pan(e.key === "ArrowRight" ? 1 : -1);
          }
          if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            e.currentTarget.scrollTo({
              left: e.key === "Home" ? 0 : e.currentTarget.scrollWidth,
            });
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || e.target.closest("button")) return;
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.classList.add("is-dragging");
        }}
        onPointerMove={(e) => {
          if (drag.current)
            e.currentTarget.scrollLeft =
              drag.current.left + drag.current.x - e.clientX;
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.classList.remove("is-dragging");
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          drag.current = null;
          e.currentTarget.classList.remove("is-dragging");
        }}
      >
        <div className="game-world">
          <div className="game-region region-west" aria-hidden="true" />
          <div className="game-region region-valley" aria-hidden="true" />
          <div className="game-region region-east" aria-hidden="true" />
          {modules.map((m) => {
            const e = stops[m.number - 1],
              clear = completed.includes(m._id),
              active = next?._id === m._id;
            return (
              <button
                key={m._id}
                className={`game-stop ${clear ? "cleared" : ""} ${active ? "current" : ""}`}
                style={{
                  left: `${e.x}%`,
                  top: `${e.y}%`,
                }}
                onClick={() => setSelected(m)}
                aria-label={`Encounter ${m.number}: ${e.name}, ${clear ? "cleared" : active ? "next encounter" : "available"}`}
              >
                <span className="game-stop-marker">
                  {clear ? (
                    <Check size={25} />
                  ) : (
                    String(m.number).padStart(2, "0")
                  )}
                </span>
                <span className="game-stop-label">
                  {e.name}
                  <small>
                    {clear
                      ? "CLEARED"
                      : active
                        ? "YOUR NEXT ENCOUNTER"
                        : "+15 XP · +10 TROPHIES"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="game-vignette" aria-hidden="true" />
      <header className="game-map-heading">
        <span className="game-location">
          <Compass size={20} />
          <span>
            <small>CHAPTER I · THE LOST EXPEDITION</small>
            <h1>The Verdant Wilds</h1>
          </span>
        </span>
        <button
          className="game-progress"
          onClick={() => setPanel("encounters")}
          aria-label="Open encounter list"
        >
          <Footprints size={18} />
          <span>
            {completed.length}
            <small> / {modules.length} CLEARED</small>
          </span>
        </button>
      </header>
      <div className="game-action-rail" aria-label="Expedition controls">
        <div className="camp-control" ref={campControl}>
          <button
            ref={campTrigger}
            className="game-camp-trigger"
            onClick={() => setPanel(panel === "camp" ? null : "camp")}
            aria-label="Open camp"
            aria-expanded={panel === "camp"}
            aria-controls="map-camp-panel"
            title="Camp"
          >
            <Tent size={21} />
            <span>Camp</span>
          </button>
          {panel === "camp" && (
            <section
              className="camp-popover"
              id="map-camp-panel"
              aria-label="Camp"
            >
              <header>
                <span>
                  <Tent size={17} /> Camp
                </span>
                <button
                  className="icon-btn"
                  aria-label="Close camp"
                  onClick={() => {
                    setPanel(null);
                    campTrigger.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              </header>
              {camp}
            </section>
          )}
        </div>
        {[
          ["party", Users, "Party"],
          ["leaderboard", Trophy, "Ranks"],
          ["objectives", ListChecks, "Objectives"],
          ["extraction", Flag, "Clearance"],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setPanel(key)}
            aria-label={`Open ${label.toLowerCase()}`}
            title={label}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
        <Link
          href="/gamer/ide"
          title="Field workshop"
          aria-label="Open field workshop"
        >
          <SquareTerminal size={21} />
          <span>Code Lab</span>
        </Link>
      </div>
      <div className="game-next">
        <button
          className="btn primary"
          onClick={() => (next ? setSelected(next) : setPanel("extraction"))}
        >
          {next ? `Enter encounter ${next.number}` : "Review clearance"}
        </button>
        <span>
          {next
            ? encounters[next.number - 1].name
            : ready
              ? "Your personal clearance is complete"
              : "All knowledge encounters cleared"}
        </span>
      </div>
      {selected && (
        <EncounterDialog
          module={selected}
          data={data}
          act={act}
          close={() => setSelected(null)}
        />
      )}
      {panel && panel !== "camp" && (
        <Modal
          title={panels[panel]}
          kicker="EXPEDITION / FIELD EQUIPMENT"
          close={() => setPanel(null)}
        >
          {panel === "party" && party}
          {panel === "leaderboard" && (
            <div className="game-objective-list">
              <p className="muted">
                Ranked by earned trophies. XP tracks your personal experience
                level.
              </p>
              <ol className="trophy-rankings">
                {data.leaderboard.map((person) => (
                  <li
                    key={person._id}
                    className={person._id === data.user._id ? "is-you" : ""}
                  >
                    <span className="rank">{person.rank}</span>
                    <span>{person.name}</span>
                    <strong>
                      {person.trophies}
                      <small> trophies</small>
                    </strong>
                  </li>
                ))}
              </ol>
              <Link href="/gamer/rewards" className="btn">
                View trophies & perks
              </Link>
            </div>
          )}
          {panel === "objectives" && (
            <div className="game-objective-list">
              {tasks.length ? (
                tasks.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => {
                      setPanel(null);
                      onQuest(t);
                    }}
                  >
                    <span>
                      <strong>{t.title}</strong>
                      <small>
                        {t.status} · +{t.xp * 3} XP · +{t.xp * 2} trophies on
                        approval
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="lesson-copy">
                  No objectives assigned. Your Guide will brief you at camp.
                </p>
              )}
              <Link href="/gamer/sprint-board" className="btn">
                Open squad objectives
              </Link>
            </div>
          )}
          {panel === "encounters" && (
            <div className="game-objective-list">
              {modules.map((m) => (
                <button
                  key={m._id}
                  onClick={() => {
                    setPanel(null);
                    setSelected(m);
                  }}
                >
                  <span>
                    <strong>
                      {String(m.number).padStart(2, "0")} ·{" "}
                      {encounters[m.number - 1].name}
                    </strong>
                    <small>
                      {completed.includes(m._id) ? "Cleared" : "Available"}
                    </small>
                  </span>
                  {completed.includes(m._id) && <Check size={17} />}
                </button>
              ))}
            </div>
          )}
          {panel === "extraction" && (
            <>
              <p className="lesson-copy">
                Explore the jungle freely. Programme clearance requires all
                knowledge encounters, approved objectives, positive health, and
                no open rescue case.
              </p>
              <div className="extraction-checks">
                <p>
                  Knowledge encounters
                  <strong>
                    {completed.length}/{modules.length} cleared
                  </strong>
                </p>
                <p>
                  Assigned objectives
                  <strong>
                    {tasks.filter((t) => t.status === "Done").length}/
                    {tasks.length} approved
                  </strong>
                </p>
                <p>
                  Health<strong>{data.user.hp}/5 HP</strong>
                </p>
                <p>
                  Rescue case
                  <strong>
                    {rescue ? "Support in progress" : "No open case"}
                  </strong>
                </p>
              </div>
              {ready && (
                <Receipt>
                  Your personal extraction requirements are met.
                </Receipt>
              )}
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
