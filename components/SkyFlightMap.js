"use client";
import dynamic from "next/dynamic";
import ViewObjectivesLink from "./ViewObjectivesLink";
import FlightLevelRetry from "./FlightLevelRetry";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Headphones,
  LockKeyhole,
  Radio,
  Search,
  Tent,
  Footprints,
  ListChecks,
  Users,
  LifeBuoy,
  Trophy,
} from "lucide-react";
import { Modal, Busy } from "./ui";
import { skyDiscovery, skyLevels } from "@/lib/sky-journey.js";
import {
  createSkyFlight,
  skyStations as stations,
  skyStationArrival,
  skyAircraftRest,
} from "@/lib/sky-flight.js";
import useFlightMapNavigation from "./useFlightMapNavigation";
import PipGuide from "./PipGuide";
import MissionStars from "./MissionStars";
const missionLoading = () => <Busy label="Opening your mission…" />;
const FlightFinale = dynamic(() => import("./FlightFinale"), { loading: missionLoading });
const DiscoveryMission = dynamic(() => import("./DayOneFeatures").then(m => m.DiscoveryMission), { loading: missionLoading });
const Games = dynamic(() => import("./WeekOneLearner").then(m => m.Games), { loading: missionLoading });
const SkyMapPanels = dynamic(() => import("./SkyMapPanels"), { loading: missionLoading });
const LevelTwoMissionScene = dynamic(() => import("./LevelTwoMissionScene"), { loading: missionLoading });
const PipSignalLab = dynamic(() => import("./PipSignalLab"), { loading: missionLoading });

const mapWidth = 2800;

function MissionPane({ day, title, open, close, panelRef, children }) {
  if (day !== 1)
    return (
      <Modal title={title} kicker="FLIGHT MISSION" wide close={close}>
        {children}
      </Modal>
    );
  return (
    <section
      id="flight-discovery-panel"
      role="tabpanel"
      aria-labelledby="flight-discovery-tab"
      tabIndex={0}
      ref={panelRef}
      hidden={!open}
      className="flight-mission-window flight-mission-tab-content"
    >
      <h1 className="flight-tab-heading">{title}</h1>
      {children}
    </section>
  );
}

export default function SkyFlightMap({ data, act, now = new Date() }) {
  const levels = skyLevels(data),
    discovery = skyDiscovery(data);
  const active =
    levels.find((l) => l.open)?.day ||
    levels.findLast((l) => l.completed && l.available)?.day ||
    1;
  const [selectedDay, setSelectedDay] = useState(active);
  const [position, setPosition] = useState(() => skyAircraftRest(levels));
  const positionRef = useRef(position);
  const latestLevels = useRef(levels);
  latestLevels.current = levels;
  const [travelling, setTravelling] = useState(null);
  const [flightMessage, setFlightMessage] = useState("");
  const flightController = useRef(null);
  const flightTarget = useRef(null);
  const completionSeen = useRef(discovery.verified);
  const mounted = useRef(false);
  const stationButtons = useRef([]);
  if (!flightController.current)
    flightController.current = createSkyFlight({
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
    });
  const [mission, setMission] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [hasDiscoveryTab, setHasDiscoveryTab] = useState(false);
  const missionPanel = useRef(null);
  const mapTab = useRef(null),
    discoveryTab = useRef(null);
  useEffect(() => {
    if (mission === 1) discoveryTab.current?.focus({ preventScroll: true });
  }, [mission]);
  const viewport = useRef(null),
    [edges, setEdges] = useState({ left: true, right: false });
  const navigation = useFlightMapNavigation(viewport, Boolean(travelling));
  const [equipment, setEquipment] = useState(null);
  function openEquipment(panel) {
    if (!flightTarget.current) setEquipment(panel);
  }
  const measure = () => {
    const el = viewport.current;
    if (el)
      setEdges({
        left: el.scrollLeft < 2,
        right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flightController.current.cancel();
    };
  }, []);
  useEffect(() => {
    if (
      flightTarget.current &&
      !(flightTarget.current === "completion"
        ? discovery.verified
        : levels.find((l) => l.day === flightTarget.current)?.available)
    )
      flightController.current.cancel("locked");
  }, [levels]);
  useEffect(() => {
    if (!discovery.verified) {
      completionSeen.current = false;
      return;
    }
    if (completionSeen.current || flightTarget.current) return;
    completionSeen.current = true;
    const from = positionRef.current,
      to = skyStationArrival(levels[0]);
    if (from.x >= to.x) return;
    navigation.stop();
    flightTarget.current = "completion";
    setTravelling(1);
    setFlightMessage("Level 1 completed! Flying past your first discovery…");
    flightController.current.start({
      from,
      to,
      duration: 1600,
      reducedMotion: false,
      isAvailable: () => mounted.current && latestLevels.current[0].completed,
      onFrame: (point) => {
        positionRef.current = point;
        setPosition(point);
      },
      onArrive: () => {
        flightTarget.current = null;
        setTravelling(null);
        setFlightMessage(
          "Level 1 completed. Check the map for your next mission.",
        );
      },
      onCancel: () => {
        flightTarget.current = null;
        if (mounted.current) {
          setTravelling(null);
          setFlightMessage("");
        }
      },
    });
  }, [discovery.verified, travelling]);
  function flyTo(day) {
    if (flightTarget.current) return;
    const level = latestLevels.current.find((l) => l.day === day);
    if (!level?.available) {
      setFlightMessage(
        `Level ${day} is locked. ${level?.status || "Complete the previous level first."}`,
      );
      return;
    }
    navigation.stop();
    setEquipment(null);
    const from = positionRef.current;
    const to = skyStationArrival(level);
    const el = viewport.current;
    // Start at the aircraft even if the player explored a distant checkpoint.
    const cameraFrom = Math.max(
      0,
      Math.min(
        el.scrollWidth - el.clientWidth,
        from.x + 65 - el.clientWidth / 2,
      ),
    );
    const cameraTo = Math.max(
      0,
      Math.min(
        el.scrollWidth - el.clientWidth,
        stations[day - 1][0] - el.clientWidth / 2,
      ),
    );
    flightTarget.current = day;
    setTravelling(day);
    setFlightMessage(`Flying to Level ${day} · ${level.title}…`);
    const started = flightController.current.start({
      from,
      to,
      reducedMotion: false,
      duration: Math.min(2800, 1400 + Math.abs(to.x - from.x) * 0.6),
      isAvailable: () =>
        mounted.current &&
        Boolean(latestLevels.current.find((l) => l.day === day)?.available),
      onFrame: (point, progress) => {
        positionRef.current = point;
        setPosition(point);
        el.scrollLeft = cameraFrom + (cameraTo - cameraFrom) * progress;
      },
      onArrive: () => {
        flightTarget.current = null;
        setTravelling(null);
        setSelectedDay(day);
        setFlightMessage(`Arrived at Level ${day} · ${level.title}.`);
        setMission(day);
        if (day === 1) setHasDiscoveryTab(true);
      },
      onCancel: (reason) => {
        flightTarget.current = null;
        if (!mounted.current) return;
        setTravelling(null);
        setFlightMessage(
          reason === "locked"
            ? "This mission is now locked. Your flight was cancelled."
            : "Flight cancelled. Select an available level when you’re ready.",
        );
      },
    });
    if (!started) {
      flightTarget.current = null;
      setTravelling(null);
    }
  }
  function closeMission() {
    const day = mission;
    setMission(null);
    requestAnimationFrame(() => stationButtons.current[day - 1]?.focus());
  }
  function continueTo(day) {
    if (!latestLevels.current.find((l) => l.day === day)?.available) return;
    setMission(null);
    requestAnimationFrame(() => {
      if (mounted.current) flyTo(day);
    });
  }
  function cancelFlight() {
    const day = flightTarget.current;
    flightController.current.cancel();
    requestAnimationFrame(() =>
      stationButtons.current[day === "completion" ? 0 : day - 1]?.focus(),
    );
  }
  useEffect(() => {
    const el = viewport.current;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.scrollLeft = Math.max(0, stations[active - 1][0] - el.clientWidth / 2);
    measure();
    return () => observer.disconnect();
  }, []);
  const dockDay = travelling || selectedDay;
  const current = levels[dockDay - 1];
  const displayedMission = mission || 1;
  const canResume = hasDiscoveryTab && levels[0].available && !travelling;
  return (
    <div
      className={`sky-journey ${mission === 1 ? "has-flight-tabs is-mission-tab" : ""} ${[2, 3].includes(mission) ? "is-level-two-mission" : ""} ${travelling ? "is-flying" : ""}`}
    >
      {mission === 1 && (
        <div
          className="flight-page-tabs"
          role="tablist"
          aria-label="Flight views"
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            const toMission =
              canResume &&
              (e.key === "Home" || (e.key !== "End" && mission !== 1));
            if (toMission) {
              setMission(1);
              discoveryTab.current?.focus();
            } else closeMission();
          }}
        >
          <button
            ref={discoveryTab}
            id="flight-discovery-tab"
            type="button"
            role="tab"
            aria-selected={mission === 1}
            aria-controls="flight-discovery-panel"
            tabIndex={mission === 1 ? 0 : -1}
            disabled={!canResume}
            onClick={() => setMission(1)}
          >
            <Search size={15} />
            Level 1 · First discovery
          </button>
          <button
            ref={mapTab}
            id="flight-map-tab"
            type="button"
            role="tab"
            aria-selected={mission !== 1}
            aria-controls="flight-map-panel"
            tabIndex={mission === 1 ? -1 : 0}
            disabled={Boolean(travelling)}
            onClick={closeMission}
          >
            <Compass size={15} />
            Sky map <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div
        id="flight-map-panel"
        className="sky-map-tabpanel"
        role="region"
        aria-label="Flight map"
        hidden={[1, 2, 3, 4, 5].includes(mission)}
      >
        <header className="sky-heading">
          <ViewObjectivesLink level={mission || 1} ownerId={data.user._id} />
          <div>
            <span className="sky-eyebrow">CHAPTER 01 / THE FLIGHT</span>
            <h1>Your flight</h1>
            <p>Choose a checkpoint. First attempts are free; retrying a level costs 1 energy.</p>
            {(data.user.hp === 0 || data.user.energy === 0) && (
              <p role="status">You can keep playing. <Link href="/gamer/week-one-ask-mc">Ask Help Desk</Link> to review your energy balance.</p>
            )}
          </div>
          <div className="sky-header-tools">
            <ViewObjectivesLink level={selectedDay || 1} ownerId={data.user._id} />
            <button
              className="sky-progress"
              disabled={Boolean(travelling)}
              onClick={() => openEquipment("levels")}
              aria-label="Open flight levels"
            >
              <Compass size={18} />
              <span>
                {levels.filter((l) => l.available).length}/5{" "}
                <small>
                  {data.weekOneProgram?.progression?.mode === "COMPLETION"
                    ? "UNLOCKED"
                    : "RELEASED"}
                </small>
              </span>
            </button>
            <button
              className="sky-radio"
              disabled={Boolean(travelling)}
              onClick={() => openEquipment("rewards")}
              aria-label="Open my rewards"
              title="My rewards"
            >
              <Trophy size={18} />
            </button>
            <button
              disabled={Boolean(travelling)}
              onClick={() => openEquipment("help")}
              className="sky-radio"
            >
              <Headphones size={18} /> Call your MC
            </button>
          </div>
        </header>
        <section className="sky-world" aria-label="Sky journey map">
          <div className="sky-compass" aria-hidden="true">
            <Compass size={32} />
            <span>N</span>
          </div>
          <div
            className="sky-map-viewport"
            ref={viewport}
            onScroll={measure}
            tabIndex={0}
            aria-label="Flight map. Use arrow keys, Home or End, drag, or scroll to explore levels."
            {...navigation.viewportProps}
          >
            <div className="sky-map-canvas" style={{ width: mapWidth }}>
              <div className="sky-sun" aria-hidden="true" />
              <div
                className="sky-cloudbank sky-cloudbank-back"
                aria-hidden="true"
              />
              <div
                className="sky-cloudbank sky-cloudbank-front"
                aria-hidden="true"
              />
              <div
                className="sky-aircraft-position"
                style={{
                  left: `${(position.x / mapWidth) * 100}%`,
                  top: `${position.y / 5.9}%`,
                }}
                aria-hidden="true"
              >
                <img
                  className="sky-helicopter-sprite"
                  src="/images/flight-helicopter-right.png"
                  alt=""
                  width="1774"
                  height="887"
                  draggable="false"
                />
              </div>
              {levels.map((level, i) => (
                <button
                  key={level.day}
                  ref={(el) => {
                    stationButtons.current[i] = el;
                  }}
                  className={`sky-station ${level.day === dockDay ? "is-active" : ""} ${!level.available ? "is-locked" : ""} ${level.completed ? "is-verified is-completed" : ""}`}
                  style={{
                    left: `${(stations[i][0] / mapWidth) * 100}%`,
                    top: `${stations[i][1] / 5.9}%`,
                  }}
                  onClick={() => flyTo(level.day)}
                  disabled={Boolean(travelling)}
                  aria-disabled={!level.available || Boolean(travelling)}
                  aria-label={`Level ${level.day}: ${level.title}. ${level.status}`}
                  data-pip-target={
                    level.day === 1
                      ? "level-one"
                      : level.day === 2
                        ? "level-two"
                        : undefined
                  }
                >
                  <span className="sky-station-ring">
                    {!level.available ? (
                      <LockKeyhole size={23} />
                    ) : level.completed ? (
                      <Check size={28} />
                    ) : (
                      <b>{level.day.toString().padStart(2, "0")}</b>
                    )}
                  </span>
                  <span className="sky-station-label">
                    <small>LEVEL {level.day}</small>
                    <strong>{level.title}</strong>
                    <em>
                      {level.day === 1
                        ? discovery.submitted
                          ? discovery.verified
                            ? "Completed"
                            : "Awaiting verification"
                          : `${discovery.completed}/${discovery.steps.length} checkpoints`
                        : level.completed
                          ? "Completed"
                          : level.open
                            ? "Enter mission"
                            : level.available
                              ? "View mission"
                              : "Locked"}
                    </em>
                  </span>
                  {level.completed && level.stars > 0 && (
                    <MissionStars stars={level.stars} />
                  )}
                </button>
              ))}
            </div>
          </div>
          {[-1, 1].map((direction) => (
            <button
              key={direction}
              className={`map-scroll-arrow sky-side-arrow ${direction < 0 ? "map-scroll-left" : "map-scroll-right"}`}
              disabled={
                Boolean(travelling) ||
                (direction < 0 ? edges.left : edges.right)
              }
              aria-label={`Scroll map ${direction < 0 ? "left" : "right"}`}
              {...navigation.arrowProps(direction)}
            >
              {direction < 0 ? <ChevronLeft /> : <ChevronRight />}
            </button>
          ))}
          <div
            className="game-action-rail sky-action-rail"
            aria-label="Flight map controls"
          >
            {[
              ["checkin", Tent, "Check-in"],
              ["next", Footprints, "Next steps"],
              ["work", ListChecks, "My work"],
              ["showcase", Users, "Showcase"],
              ["help", LifeBuoy, "Help"],
            ].map(([panel, Icon, label]) => (
              <button
                key={panel}
                disabled={Boolean(travelling)}
                aria-label={`Open ${label.toLowerCase()}`}
                onClick={() => openEquipment(panel)}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
        <section
          className="sky-mission-dock"
          aria-label="Current flight mission"
        >
          <div className="sky-dock-icon">
            <Search size={26} />
          </div>
          <div>
            <span className="sky-eyebrow">
              LEVEL {dockDay} /{" "}
              {dockDay === 1
                ? `${discovery.completed} OF ${discovery.steps.length} CHECKPOINTS`
                : "FLIGHT MISSION"}
            </span>
            <h2>{current.title}</h2>
            <p role="status" aria-live="polite">
              {flightMessage || current.status}
            </p>
            {levels.every(level => level.completed) && <Link className="text-link" href="/gamer/week-one-results">Check results &amp; next chapter</Link>}
          </div>
          <button
            className="sky-enter"
            data-pip-target={dockDay === 1 ? "level-one-play" : undefined}
            disabled={Boolean(travelling) || !current.available}
            onClick={() => flyTo(dockDay)}
          >
            {travelling
              ? "In flight…"
              : !current.available
                ? "Level locked"
                : current.completed
                  ? "View result"
                  : dockDay === 1 && discovery.submitted
                    ? "View your mission"
                    : "Play"}
            {current.available ? (
              <Play size={19} fill="currentColor" />
            ) : (
              <LockKeyhole size={19} />
            )}
          </button>
          {travelling && (
            <button className="sky-cancel-flight" onClick={cancelFlight}>
              Cancel flight
            </button>
          )}
        </section>
        <div className="sky-flight-note">
          <Radio size={14} />
          <p>
            Choose your genre. Find your question. Bring back your research.
          </p>
          <button
            disabled={Boolean(travelling)}
            onClick={() => openEquipment("checkin")}
          >
            Briefing & check-in
          </button>
        </div>
      </div>
      {equipment && <SkyMapPanels
        panel={equipment}
        close={() => setEquipment(null)}
        open={setEquipment}
        data={data}
        act={act}
        now={now}
        levels={levels}
        discovery={discovery}
        onFly={flyTo}
      />}
      {[4,5].includes(mission) && <FlightFinale key={`finale:${mission}:${data.user._id}`} dayNumber={mission} data={data} act={act} now={now} onMap={closeMission} onNext={()=>continueTo(5)} nextLevel={levels[mission]}/>}
      {mission === 3 && <PipSignalLab key={`signal-lab:${data.user._id}`} data={data} act={act} now={now} onMap={closeMission} onNext={()=>continueTo(4)} nextLevel={levels[3]}/>}
      {mission === 2 && (
        <LevelTwoMissionScene
          key={`flight-mission:${mission}:${data.user._id}`}
          dayNumber={mission}
          data={data}
          act={act}
          now={now}
          onMap={closeMission}
          onNext={() => continueTo(mission + 1)}
          nextLevel={levels[mission]}
        />
      )}
      {![2, 3, 4, 5].includes(mission) && (mission || hasDiscoveryTab) && (
        <MissionPane
          day={displayedMission}
          title={`Level ${displayedMission} · ${levels[displayedMission - 1].title}`}
          open={mission === 1}
          panelRef={missionPanel}
          close={closeMission}
        >
          <div className="sky-mission">
            <FlightLevelRetry data={data} act={act} day={displayedMission} now={now}/>
            {displayedMission === 1 && (
              <ol className="sky-checkpoints" aria-label="Level 1 checkpoints">
                {discovery.steps.map((step, i) => (
                  <li
                    key={step.id}
                    className={
                      step.done
                        ? "is-complete"
                        : i === discovery.completed
                          ? "is-current"
                          : ""
                    }
                    aria-current={
                      !step.done && i === discovery.completed
                        ? "step"
                        : undefined
                    }
                  >
                    {step.done ? <Check size={17} /> : <span>{i + 1}</span>}
                    <strong>{step.title}</strong>
                    <small>
                      {step.done
                        ? "Complete"
                        : i === discovery.completed
                          ? "Current objective"
                          : "Locked"}
                    </small>
                  </li>
                ))}
              </ol>
            )}
            {!data.story.introComplete ? (
              <div className="sky-onboarding">
                <Compass size={36} />
                <h3>Welcome aboard, explorer.</h3>
                <p>
                  Your first sky mission: claim a genre, choose a question, then
                  investigate with AI and attach your researched chat. Your
                  character is still unknown.
                </p>
                <button
                  className="sky-enter"
                  data-pip-target="boarding"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const result = await act(
                        "story/flight-intro",
                        {},
                        "Welcome aboard. Your first sky mission is ready.",
                      );
                      if (!result)
                        setError(
                          "Could not save your boarding. Please try again.",
                        );
                    } catch {
                      setError(
                        "Could not save your boarding. Please try again.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Boarding…" : "Begin flight learning"}
                  <ArrowRight size={18} />
                </button>
                {error && <p role="alert">{error}</p>}
              </div>
            ) : !levels[displayedMission - 1].available ? (
              <div className="sky-onboarding">
                <LockKeyhole size={32} />
                <h3>This part of the flight is still locked.</h3>
                <p>
                  Complete your previous level first. Continue your available
                  mission or check your briefing.
                </p>
                <Link href="/gamer/week-one" className="text-link">
                  View daily briefing
                </Link>
              </div>
            ) : displayedMission === 1 ? (
              <DiscoveryMission
                data={data}
                act={act}
                now={now}
                game
                nextLevel={levels[1]}
                onContinue={() => continueTo(2)}
              />
            ) : (
              <Games
                data={{
                  ...data,
                  weekOneProgram: {
                    ...data.weekOneProgram,
                    days: data.weekOneProgram.days.filter(
                      (d) => d.day === displayedMission,
                    ),
                  },
                }}
                act={act}
                now={now}
              />
            )}
            {displayedMission !== 1 && (
              <p className="sky-level-continuation-note">
                {levels[displayedMission - 1].completed
                  ? displayedMission < 5
                    ? `Level ${displayedMission} completed. Level ${displayedMission + 1} is now available.`
                    : "Flight missions completed. Final clearance and team approval follow separately."
                  : displayedMission < 5
                    ? `Complete both missions to unlock Level ${displayedMission + 1} automatically. Your work is saved as you play.`
                    : "Complete both missions to finish your flight learning. Your work is saved as you play."}
              </p>
            )}
            {displayedMission !== 1 && (
              <div className="button-row">
                {levels[displayedMission - 1].completed &&
                  levels[displayedMission]?.available && (
                    <button
                      className="sky-enter"
                      onClick={() => continueTo(displayedMission + 1)}
                    >
                      Continue to Level {displayedMission + 1}
                      <ArrowRight size={16} />
                    </button>
                  )}
                <button className="sky-return" onClick={closeMission}>
                  Return to sky map <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </MissionPane>
      )}
      <PipGuide
        key={data.user._id}
        data={data}
        missionOpen={mission === 1}
        travelling={Boolean(travelling)}
        now={now}
        onMission={() => setSelectedDay(1)}
        onMap={closeMission}
        onNext={() => {
          setSelectedDay(2);
          if (viewport.current)
            viewport.current.scrollLeft = Math.max(
              0,
              stations[1][0] - viewport.current.clientWidth / 2,
            );
          stationButtons.current[1]?.focus({ preventScroll: true });
        }}
      />
    </div>
  );
}
