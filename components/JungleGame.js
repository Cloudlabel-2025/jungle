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
  LifeBuoy,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { projectState, starsLabel } from "./Projects";
import LevelBriefing from "./LevelBriefing";
import { Modal, Receipt } from "./ui";
import LevelEmblem from "./LevelEmblem";
import { terrainPosition } from "@/lib/map-terrain.js";

export default function JungleGame({
  data,
  act,
  camp,
  party,
  onQuest,
  support,
  discovery,
}) {
  const [panel, setPanel] = useState(null),
    [selected, setSelected] = useState(null);
  const [mapSize, setMapSize] = useState({ width: 6000, height: 2000 / 3 });
  const viewport = useRef(null),
    drag = useRef(null);
  const campControl = useRef(null);
  const campTrigger = useRef(null);
  const hold = useRef({
    frame: null,
    direction: 0,
    started: 0,
    previous: 0,
    moved: false,
  });
  const [edges, setEdges] = useState({ left: true, right: false });
  const chapters = Math.max(
    1,
    Math.ceil(Math.max(...data.projectLevels.map((l) => l.number), 1) / 10),
  );
  const measureEdges = () => {
    const el = viewport.current;
    if (el)
      setEdges({
        left: el.scrollLeft <= 1,
        right: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1,
      });
  };
  function stopHold() {
    hold.current.direction = 0;
    cancelAnimationFrame(hold.current.frame);
  }
  function startHold(event, direction) {
    if (event.button !== 0) return;
    stopHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.current = {
      frame: null,
      direction,
      started: performance.now(),
      previous: performance.now(),
      moved: false,
    };
    const tick = (now) => {
      const state = hold.current;
      if (!state.direction) return;
      if (now - state.started > 280) {
        viewport.current?.scrollBy({
          left: state.direction * Math.min(now - state.previous, 40) * 0.65,
          behavior: "instant",
        });
        state.moved = true;
      }
      state.previous = now;
      state.frame = requestAnimationFrame(tick);
    };
    hold.current.frame = requestAnimationFrame(tick);
  }
  useEffect(() => () => stopHold(), []);
  useEffect(() => {
    const world = viewport.current?.firstElementChild;
    if (!world) return;
    const measure = () =>
      setMapSize((previous) => {
        const width = world.clientWidth,
          height = world.clientHeight;
        return previous.width === width && previous.height === height
          ? previous
          : { width, height };
      });
    measure();
    measureEdges();
    const observer = new ResizeObserver(() => {
      measure();
      measureEdges();
    });
    observer.observe(world);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [chapters]);
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
  const modules = data.projectLevels;
  const completed = data.projectAttempts
    .filter((p) => p.teamId === data.user.teamId && p.status === "CLEARED")
    .map((p) => p.levelId);
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
    const stop = terrainPosition(next || modules.at(-1), {
      ...mapSize,
      chapters,
    });
    const el = viewport.current;
    if (!el || !stop) return;
    el.scrollTo({
      left: stop.x - el.clientWidth / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useEffect(() => {
    const frame = requestAnimationFrame(locate);
    return () => cancelAnimationFrame(frame);
  }, [data.user._id, next?._id, mapSize.width, mapSize.height]);
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
    encounters: "Team project levels",
    leaderboard: "Trophy leaderboard",
    support: "Help Desk & growth",
    discovery: "Day 1 discovery mission",
  };
  return (
    <section className="jungle-game" aria-label="Expedition game map">
      <div
        className="game-map-window"
        ref={viewport}
        onScroll={measureEdges}
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
        <div
          className="game-world"
          style={
            chapters > 1
              ? { width: `max(${6000 * chapters}px, ${900 * chapters}cqh)` }
              : undefined
          }
        >
          {Array.from({ length: chapters }, (_, chapter) =>
            ["west", "valley", "east"].map((region, index) => (
              <div
                className={`game-region region-${region}`}
                aria-hidden="true"
                key={`${chapter}-${region}`}
                style={{
                  left: `${((chapter * 3 + index) / (chapters * 3)) * 100}%`,
                  width: `${100 / (chapters * 3)}%`,
                }}
              />
            )),
          )}
          {modules.map((m) => {
            const e = terrainPosition(m, { ...mapSize, chapters }),
              clear = completed.includes(m._id),
              active = next?._id === m._id;
            const { attempt, state } = projectState(data, m);
            return (
              <button
                key={m._id}
                className={`game-stop ${clear ? "cleared" : ""} ${active ? "current" : ""} ${state === "LOCKED" ? "project-locked" : ""}`}
                style={{
                  left: `${e.x}px`,
                  top: `${e.y}px`,
                }}
                data-label-placement={e.labelPlacement}
                title={`Level ${m.number} · ${m.name}`}
                onClick={() => setSelected(m)}
                aria-label={`Level ${m.number}: ${m.name}, ${state}, ${attempt?.stars || 0} stars`}
              >
                <span className="game-stop-marker hazard-marker">
                  <LevelEmblem level={m} />
                  <span className="hazard-level-number">
                    {String(m.number).padStart(2, "0")}
                  </span>
                  {clear && (
                    <span className="hazard-clear-seal">
                      <Check size={13} />
                    </span>
                  )}
                </span>
                <span className="game-stop-label">
                  <span className="hazard-level-caption">
                    LEVEL {String(m.number).padStart(2, "0")}
                  </span>
                  <span className="hazard-title">{m.name}</span>
                  <small>
                    {clear
                      ? starsLabel(attempt.stars)
                      : active
                        ? state === "AVAILABLE"
                          ? "START TEAM PROJECT"
                          : state === "REVIEW"
                            ? "AWAITING REVIEW"
                            : "TEAM PROJECT ACTIVE"
                        : "LOCKED"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="game-vignette" aria-hidden="true" />
      {[-1, 1].map((direction) => (
        <button
          key={direction}
          className={`map-scroll-arrow ${direction < 0 ? "map-scroll-left" : "map-scroll-right"}`}
          aria-label={`Scroll map ${direction < 0 ? "left" : "right"}`}
          disabled={direction < 0 ? edges.left : edges.right}
          onPointerDown={(e) => startHold(e, direction)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
          onBlur={stopHold}
          onClick={(e) => {
            if (e.detail === 0 || !hold.current.moved) pan(direction);
            hold.current.moved = false;
          }}
        >
          {direction < 0 ? <ChevronLeft /> : <ChevronRight />}
        </button>
      ))}
      <header className="game-map-heading">
        <span className="game-location">
          <Compass size={20} />
          <span>
            <small>CHAPTER I · TEAM MINI PROJECTS</small>
            <h1>The Verdant Wilds</h1>
          </span>
        </span>
        <button
          className="game-progress"
          onClick={() => setPanel("encounters")}
          aria-label="Open team project levels"
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
          ...(discovery ? [["discovery", Compass, "Discovery"]] : []),
          ["party", Users, "Party"],
          ["leaderboard", Trophy, "Ranks"],
          ["objectives", ListChecks, "Objectives"],
          ["extraction", Flag, "Clearance"],
          ["support", LifeBuoy, "Help Desk"],
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
          {next ? `Open team level ${next.number}` : "Review clearance"}
        </button>
        <span>
          {next
            ? next.name
            : ready
              ? "Your personal clearance is complete"
              : "All team projects cleared"}
        </span>
      </div>
      {selected && (
        <LevelBriefing
          key={selected._id}
          level={selected}
          data={data}
          act={act}
          close={() => setSelected(null)}
          onQuest={onQuest}
        />
      )}
      {panel && panel !== "camp" && (
        <Modal
          title={panels[panel]}
          kicker="EXPEDITION / FIELD EQUIPMENT"
          close={() => setPanel(null)}
        >
          {panel === "party" && party}
          {panel === "support" && support}
          {panel === "discovery" && discovery}
          {panel === "leaderboard" && (
            <div className="game-objective-list">
              <p className="muted">
                {data.rankingPaused
                  ? "Week 1 discovery is descriptive. Student rankings are paused."
                  : "Ranked by earned trophies within your team. XP tracks your personal experience level."}
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
                        {t.status} ·{" "}
                        {t.projectAttemptId
                          ? "Rewarded at team level completion"
                          : `+${t.xp * 3} XP · +${t.xp * 2} trophies on approval`}
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
                  <LevelEmblem level={m} className="level-list-emblem" />
                  <span>
                    <strong>
                      {String(m.number).padStart(2, "0")} · {m.name}
                    </strong>
                    <small>
                      {completed.includes(m._id)
                        ? starsLabel(projectState(data, m).attempt.stars)
                        : projectState(data, m).state}
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
                Programme clearance requires all ten team projects cleared,
                approved objectives, positive health, and no open rescue case.
              </p>
              <div className="extraction-checks">
                <p>
                  Team projects
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
