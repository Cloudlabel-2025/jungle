"use client";
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
  Trophy
} from "lucide-react";
import { Modal } from "./ui";
import { DiscoveryMission } from "./DayOneFeatures";
import { Games } from "./WeekOneLearner";
import { skyDiscovery, skyLevels } from "@/lib/sky-journey.js";
import { createSkyFlight } from "@/lib/sky-flight.js";
import useFlightMapNavigation from "./useFlightMapNavigation";
import SkyMapPanels from "./SkyMapPanels";
const stations = [
  [220, 280],
  [800, 270],
  [1380, 290],
  [1960, 230],
  [2540, 310]
];
const mapWidth = 2800;
function MissionPane({ day, title, open, close, panelRef, children }) {
  if (day !== 1)
    return /* @__PURE__ */ React.createElement(Modal, { title, kicker: "FLIGHT MISSION", wide: true, close }, children);
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      id: "flight-discovery-panel",
      role: "tabpanel",
      "aria-labelledby": "flight-discovery-tab",
      tabIndex: 0,
      ref: panelRef,
      hidden: !open,
      className: "flight-mission-window flight-mission-tab-content"
    },
    /* @__PURE__ */ React.createElement("h1", { className: "flight-tab-heading" }, title),
    children
  );
}
export default function SkyFlightMap({ data, act, now = /* @__PURE__ */ new Date() }) {
  const levels = skyLevels(data), discovery = skyDiscovery(data);
  const active = levels.find((l) => l.open)?.day || 1;
  const [selectedDay, setSelectedDay] = useState(active);
  const [position, setPosition] = useState(() => ({
    x: Math.max(35, stations[active - 1][0] - 300),
    y: stations[active - 1][1] - 150
  }));
  const positionRef = useRef(position);
  const latestLevels = useRef(levels);
  latestLevels.current = levels;
  const [travelling, setTravelling] = useState(null);
  const [flightMessage, setFlightMessage] = useState("");
  const flightController = useRef(null);
  const flightTarget = useRef(null);
  const mounted = useRef(false);
  const stationButtons = useRef([]);
  if (!flightController.current)
    flightController.current = createSkyFlight({
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id)
    });
  const [mission, setMission] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [hasDiscoveryTab, setHasDiscoveryTab] = useState(false);
  const missionPanel = useRef(null);
  const mapTab = useRef(null), discoveryTab = useRef(null);
  useEffect(() => {
    if (mission === 1) discoveryTab.current?.focus({ preventScroll: true });
  }, [mission]);
  const viewport = useRef(null), [edges, setEdges] = useState({ left: true, right: false });
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
        right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
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
    if (flightTarget.current && !levels.find((l) => l.day === flightTarget.current)?.available)
      flightController.current.cancel("locked");
  }, [levels]);
  function flyTo(day) {
    if (flightTarget.current) return;
    const level = latestLevels.current.find((l) => l.day === day);
    if (!level?.available) {
      setFlightMessage(`Level ${day} is locked. Wait for its mission release.`);
      return;
    }
    navigation.stop();
    setEquipment(null);
    const from = positionRef.current;
    const to = { x: stations[day - 1][0] - 65, y: stations[day - 1][1] - 150 };
    const el = viewport.current;
    const cameraFrom = Math.max(
      0,
      Math.min(
        el.scrollWidth - el.clientWidth,
        from.x + 65 - el.clientWidth / 2
      )
    );
    const cameraTo = Math.max(
      0,
      Math.min(
        el.scrollWidth - el.clientWidth,
        stations[day - 1][0] - el.clientWidth / 2
      )
    );
    flightTarget.current = day;
    setTravelling(day);
    setFlightMessage(`Flying to Level ${day} \xB7 ${level.title}\u2026`);
    const started = flightController.current.start({
      from,
      to,
      reducedMotion: false,
      duration: Math.min(2800, 1400 + Math.abs(to.x - from.x) * 0.6),
      isAvailable: () => mounted.current && Boolean(latestLevels.current.find((l) => l.day === day)?.available),
      onFrame: (point, progress) => {
        positionRef.current = point;
        setPosition(point);
        el.scrollLeft = cameraFrom + (cameraTo - cameraFrom) * progress;
      },
      onArrive: () => {
        flightTarget.current = null;
        setTravelling(null);
        setSelectedDay(day);
        setFlightMessage(`Arrived at Level ${day} \xB7 ${level.title}.`);
        setMission(day);
        if (day === 1) setHasDiscoveryTab(true);
      },
      onCancel: (reason) => {
        flightTarget.current = null;
        if (!mounted.current) return;
        setTravelling(null);
        setFlightMessage(
          reason === "locked" ? "This mission is now locked. Your flight was cancelled." : "Flight cancelled. Select an available level when you\u2019re ready."
        );
      }
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
  function cancelFlight() {
    const day = flightTarget.current;
    flightController.current.cancel();
    requestAnimationFrame(() => stationButtons.current[day - 1]?.focus());
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
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `sky-journey has-flight-tabs ${mission === 1 ? "is-mission-tab" : ""} ${travelling ? "is-flying" : ""}`
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "flight-page-tabs",
        role: "tablist",
        "aria-label": "Flight views",
        onKeyDown: (e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const toMission = canResume && (e.key === "End" || e.key !== "Home" && mission !== 1);
          setMission(toMission ? 1 : null);
          (toMission ? discoveryTab : mapTab).current?.focus();
        }
      },
      /* @__PURE__ */ React.createElement(
        "button",
        {
          ref: mapTab,
          id: "flight-map-tab",
          type: "button",
          role: "tab",
          "aria-selected": mission !== 1,
          "aria-controls": "flight-map-panel",
          tabIndex: mission === 1 ? -1 : 0,
          disabled: Boolean(travelling),
          onClick: () => setMission(null)
        },
        /* @__PURE__ */ React.createElement(Compass, { size: 15 }),
        "Sky map"
      ),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          ref: discoveryTab,
          id: "flight-discovery-tab",
          type: "button",
          role: "tab",
          "aria-selected": mission === 1,
          "aria-controls": "flight-discovery-panel",
          tabIndex: mission === 1 ? 0 : -1,
          disabled: !canResume,
          onClick: () => setMission(1)
        },
        /* @__PURE__ */ React.createElement(Search, { size: 15 }),
        "Level 1 \xB7 First discovery"
      )
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        id: "flight-map-panel",
        className: "sky-map-tabpanel",
        role: "tabpanel",
        "aria-labelledby": "flight-map-tab",
        hidden: mission === 1
      },
      /* @__PURE__ */ React.createElement("header", { className: "sky-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "sky-eyebrow" }, "CHAPTER 01 / THE FLIGHT"), /* @__PURE__ */ React.createElement("h1", null, "Your flight"), /* @__PURE__ */ React.createElement("p", null, "Select a checkpoint to enter your mission.")), /* @__PURE__ */ React.createElement("div", { className: "sky-header-tools" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "sky-progress",
          disabled: Boolean(travelling),
          onClick: () => openEquipment("levels"),
          "aria-label": "Open flight levels"
        },
        /* @__PURE__ */ React.createElement(Compass, { size: 18 }),
        /* @__PURE__ */ React.createElement("span", null, levels.filter((l) => l.available).length, "/5", " ", /* @__PURE__ */ React.createElement("small", null, "RELEASED"))
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "sky-radio",
          disabled: Boolean(travelling),
          onClick: () => openEquipment("rewards"),
          "aria-label": "Open my rewards",
          title: "My rewards"
        },
        /* @__PURE__ */ React.createElement(Trophy, { size: 18 })
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          disabled: Boolean(travelling),
          onClick: () => openEquipment("help"),
          className: "sky-radio"
        },
        /* @__PURE__ */ React.createElement(Headphones, { size: 18 }),
        " Call your MC"
      ))),
      /* @__PURE__ */ React.createElement("section", { className: "sky-world", "aria-label": "Sky journey map" }, /* @__PURE__ */ React.createElement("div", { className: "sky-compass", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Compass, { size: 32 }), /* @__PURE__ */ React.createElement("span", null, "N")), /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "sky-map-viewport",
          ref: viewport,
          onScroll: measure,
          tabIndex: 0,
          "aria-label": "Flight map. Use arrow keys, Home or End, drag, or scroll to explore levels.",
          ...navigation.viewportProps
        },
        /* @__PURE__ */ React.createElement("div", { className: "sky-map-canvas", style: { width: mapWidth } }, /* @__PURE__ */ React.createElement("div", { className: "sky-sun", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "sky-cloudbank sky-cloudbank-back",
            "aria-hidden": "true"
          }
        ), /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "sky-cloudbank sky-cloudbank-front",
            "aria-hidden": "true"
          }
        ), /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "sky-aircraft-position",
            style: {
              left: `${position.x / mapWidth * 100}%`,
              top: `${position.y / 5.9}%`
            },
            "aria-hidden": "true"
          },
          /* @__PURE__ */ React.createElement(
            "img",
            {
              className: "sky-helicopter-sprite",
              src: "/images/flight-helicopter-right.png",
              alt: "",
              width: "1774",
              height: "887",
              draggable: "false"
            }
          )
        ), levels.map((level, i) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: level.day,
            ref: (el) => {
              stationButtons.current[i] = el;
            },
            className: `sky-station ${level.day === dockDay ? "is-active" : ""} ${!level.available ? "is-locked" : ""} ${i === 0 && discovery.verified ? "is-verified" : ""}`,
            style: {
              left: `${stations[i][0] / mapWidth * 100}%`,
              top: `${stations[i][1] / 5.9}%`
            },
            onClick: () => flyTo(level.day),
            disabled: Boolean(travelling),
            "aria-disabled": !level.available || Boolean(travelling),
            "aria-label": `Level ${level.day}: ${level.title}. ${level.status}`
          },
          /* @__PURE__ */ React.createElement("span", { className: "sky-station-ring" }, !level.available ? /* @__PURE__ */ React.createElement(LockKeyhole, { size: 23 }) : i === 0 && discovery.verified ? /* @__PURE__ */ React.createElement(Check, { size: 28 }) : /* @__PURE__ */ React.createElement("b", null, level.day.toString().padStart(2, "0"))),
          /* @__PURE__ */ React.createElement("span", { className: "sky-station-label" }, /* @__PURE__ */ React.createElement("small", null, "LEVEL ", level.day), /* @__PURE__ */ React.createElement("strong", null, level.title), /* @__PURE__ */ React.createElement("em", null, level.day === 1 ? discovery.submitted ? discovery.verified ? "Evidence verified" : "Awaiting verification" : `${discovery.completed}/3 checkpoints` : level.open ? "Enter mission" : level.available ? "View mission" : "Locked"))
        )))
      ), [-1, 1].map((direction) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: direction,
          className: `map-scroll-arrow sky-side-arrow ${direction < 0 ? "map-scroll-left" : "map-scroll-right"}`,
          disabled: Boolean(travelling) || (direction < 0 ? edges.left : edges.right),
          "aria-label": `Scroll map ${direction < 0 ? "left" : "right"}`,
          ...navigation.arrowProps(direction)
        },
        direction < 0 ? /* @__PURE__ */ React.createElement(ChevronLeft, null) : /* @__PURE__ */ React.createElement(ChevronRight, null)
      )), /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "game-action-rail sky-action-rail",
          "aria-label": "Flight map controls"
        },
        [
          ["checkin", Tent, "Check-in"],
          ["next", Footprints, "Next steps"],
          ["work", ListChecks, "My work"],
          ["showcase", Users, "Showcase"],
          ["help", LifeBuoy, "Help"]
        ].map(([panel, Icon, label]) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: panel,
            disabled: Boolean(travelling),
            "aria-label": `Open ${label.toLowerCase()}`,
            onClick: () => openEquipment(panel)
          },
          /* @__PURE__ */ React.createElement(Icon, { size: 21 }),
          /* @__PURE__ */ React.createElement("span", null, label)
        ))
      )),
      /* @__PURE__ */ React.createElement(
        "section",
        {
          className: "sky-mission-dock",
          "aria-label": "Current flight mission"
        },
        /* @__PURE__ */ React.createElement("div", { className: "sky-dock-icon" }, /* @__PURE__ */ React.createElement(Search, { size: 26 })),
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "sky-eyebrow" }, "LEVEL ", dockDay, " /", " ", dockDay === 1 ? `${discovery.completed} OF 3 CHECKPOINTS` : "FLIGHT MISSION"), /* @__PURE__ */ React.createElement("h2", null, current.title), /* @__PURE__ */ React.createElement("p", { role: "status", "aria-live": "polite" }, flightMessage || current.status)),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "sky-enter",
            disabled: Boolean(travelling) || !current.available,
            onClick: () => flyTo(dockDay)
          },
          travelling ? "In flight\u2026" : !current.available ? "Awaiting release" : dockDay === 1 && discovery.submitted ? "View your mission" : "Play",
          current.available ? /* @__PURE__ */ React.createElement(Play, { size: 19, fill: "currentColor" }) : /* @__PURE__ */ React.createElement(LockKeyhole, { size: 19 })
        ),
        travelling && /* @__PURE__ */ React.createElement("button", { className: "sky-cancel-flight", onClick: cancelFlight }, "Cancel flight")
      ),
      /* @__PURE__ */ React.createElement("div", { className: "sky-flight-note" }, /* @__PURE__ */ React.createElement(Radio, { size: 14 }), /* @__PURE__ */ React.createElement("p", null, "Choose your genre. Find your question. Bring back your research."), /* @__PURE__ */ React.createElement(
        "button",
        {
          disabled: Boolean(travelling),
          onClick: () => openEquipment("checkin")
        },
        "Briefing & check-in"
      ))
    ),
    /* @__PURE__ */ React.createElement(
      SkyMapPanels,
      {
        panel: equipment,
        close: () => setEquipment(null),
        open: setEquipment,
        data,
        act,
        now,
        levels,
        discovery,
        onFly: flyTo
      }
    ),
    (mission || hasDiscoveryTab) && /* @__PURE__ */ React.createElement(
      MissionPane,
      {
        day: displayedMission,
        title: `Level ${displayedMission} \xB7 ${levels[displayedMission - 1].title}`,
        open: mission === 1,
        panelRef: missionPanel,
        close: closeMission
      },
      /* @__PURE__ */ React.createElement("div", { className: "sky-mission" }, displayedMission === 1 && /* @__PURE__ */ React.createElement("ol", { className: "sky-checkpoints", "aria-label": "Level 1 checkpoints" }, discovery.steps.map((step, i) => /* @__PURE__ */ React.createElement(
        "li",
        {
          key: step.id,
          className: step.done ? "is-complete" : i === discovery.completed ? "is-current" : "",
          "aria-current": !step.done && i === discovery.completed ? "step" : void 0
        },
        step.done ? /* @__PURE__ */ React.createElement(Check, { size: 17 }) : /* @__PURE__ */ React.createElement("span", null, i + 1),
        /* @__PURE__ */ React.createElement("strong", null, step.title),
        /* @__PURE__ */ React.createElement("small", null, step.done ? "Complete" : i === discovery.completed ? "Current objective" : "Locked")
      ))), !data.story.introComplete ? /* @__PURE__ */ React.createElement("div", { className: "sky-onboarding" }, /* @__PURE__ */ React.createElement(Compass, { size: 36 }), /* @__PURE__ */ React.createElement("h3", null, "Welcome aboard, explorer."), /* @__PURE__ */ React.createElement("p", null, "Your first sky mission: claim a genre, choose a question, then investigate with AI and attach your researched chat. Your character is still unknown."), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "sky-enter",
          disabled: busy,
          onClick: async () => {
            setBusy(true);
            setError("");
            try {
              const result = await act(
                "story/flight-intro",
                {},
                "Welcome aboard. Your first sky mission is ready."
              );
              if (!result)
                setError(
                  "Could not save your boarding. Please try again."
                );
            } catch {
              setError(
                "Could not save your boarding. Please try again."
              );
            } finally {
              setBusy(false);
            }
          }
        },
        busy ? "Boarding\u2026" : "Begin flight learning",
        /* @__PURE__ */ React.createElement(ArrowRight, { size: 18 })
      ), error && /* @__PURE__ */ React.createElement("p", { role: "alert" }, error)) : !levels[displayedMission - 1].available ? /* @__PURE__ */ React.createElement("div", { className: "sky-onboarding" }, /* @__PURE__ */ React.createElement(LockKeyhole, { size: 32 }), /* @__PURE__ */ React.createElement("h3", null, "This part of the flight is still locked."), /* @__PURE__ */ React.createElement("p", null, "Your MC and CC release each day\u2019s mission. Continue your available mission or check your briefing."), /* @__PURE__ */ React.createElement(Link, { href: "/gamer/week-one", className: "text-link" }, "View daily briefing")) : displayedMission === 1 ? /* @__PURE__ */ React.createElement(DiscoveryMission, { data, act, now, game: true }) : /* @__PURE__ */ React.createElement(
        Games,
        {
          data: {
            ...data,
            weekOneProgram: {
              ...data.weekOneProgram,
              days: data.weekOneProgram.days.filter(
                (d) => d.day === displayedMission
              )
            }
          },
          act,
          now
        }
      ), displayedMission !== 1 && /* @__PURE__ */ React.createElement("button", { className: "sky-return", onClick: closeMission }, "Return to sky map ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 16 })))
    )
  );
}
