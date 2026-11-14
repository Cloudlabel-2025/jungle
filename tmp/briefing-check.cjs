"use client";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// components/DayOneFeatures.js
var DayOneFeatures_exports = {};
__export(DayOneFeatures_exports, {
  DayOneCheckIn: () => DayOneCheckIn,
  DayOneCohort: () => DayOneCohort,
  DayOneDaily: () => DayOneDaily,
  DayOneGameSetup: () => DayOneSetup,
  DayOneRewards: () => DayOneRewards,
  DiscoveryMission: () => DiscoveryMission,
  isDayOne: () => isDayOne
});
module.exports = __toCommonJS(DayOneFeatures_exports);

// components/PlayerVitals.js
var import_lucide_react = require("lucide-react");

// lib/rules.js
var MAX_LIVES = 5;
var MAX_ENERGY = 3;
var playerLives = (player) => Math.max(0, Math.min(MAX_LIVES, player.hp ?? MAX_LIVES));
function playerEnergy(player) {
  return playerLives(player) <= 0 ? 0 : Math.min(MAX_ENERGY, Math.max(0, player.energy ?? MAX_ENERGY));
}
var playerBalance = (player) => ({
  hp: playerLives(player),
  energy: playerEnergy(player)
});

// components/PlayerVitals.js
function PlayerVitals({ player }) {
  const { hp, energy } = playerBalance(player);
  return /* @__PURE__ */ React.createElement("div", { className: "player-vitals", "aria-label": "Current player balance" }, /* @__PURE__ */ React.createElement("span", { className: "life-counter", "aria-label": `${hp} of ${MAX_LIVES} lives` }, /* @__PURE__ */ React.createElement("span", null, "Life"), Array.from({ length: MAX_LIVES }, (_, i) => /* @__PURE__ */ React.createElement(
    import_lucide_react.Heart,
    {
      "aria-hidden": "true",
      size: 13,
      key: i,
      className: i < hp ? "vital-filled" : "vital-empty"
    }
  )), /* @__PURE__ */ React.createElement("small", null, hp, "/", MAX_LIVES)), /* @__PURE__ */ React.createElement(
    "span",
    {
      className: "energy-counter",
      "aria-label": `${energy} of ${MAX_ENERGY} energy`,
      title: "Your current balance is shared across the expedition, Week 1, recovery and sprints."
    },
    /* @__PURE__ */ React.createElement("span", null, "Energy"),
    Array.from({ length: MAX_ENERGY }, (_, i) => /* @__PURE__ */ React.createElement(
      import_lucide_react.Zap,
      {
        "aria-hidden": "true",
        size: 13,
        key: i,
        className: i < energy ? "vital-filled" : "vital-empty"
      }
    )),
    /* @__PURE__ */ React.createElement("small", null, energy, "/", MAX_ENERGY)
  ));
}

// components/ResearchGenrePicker.js
var import_react2 = require("react");
var import_lucide_react3 = require("lucide-react");

// components/LegacyResearchGenrePicker.js
var import_react = require("react");
function ResearchGenrePicker({ act, recordId }) {
  const [genres, setGenres] = (0, import_react.useState)([]);
  const [error, setError] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const selecting = (0, import_react.useRef)(false);
  const [retry, setRetry] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      if (selecting.current) return;
      try {
        const response = await fetch("/api/day1/genre-offer", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load genres.");
        if (!disposed && !selecting.current && result.assignment) {
          selecting.current = true;
          try {
            await act("day1/genre", { genreId: result.assignment.genreId }, "");
          } finally {
            selecting.current = false;
          }
          return;
        }
        if (!disposed && !selecting.current) {
          setGenres(result.genres);
          setError("");
        }
      } catch (e) {
        if (!disposed) setError(e.message);
      }
    }
    load();
    const timer = setInterval(load, 8e3);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [recordId, retry]);
  return /* @__PURE__ */ React.createElement("section", { "aria-label": "Research genre choices" }, /* @__PURE__ */ React.createElement("p", null, "Choose one genre. Your question is assigned randomly after selection. Your choice is permanent for this research round; each genre can be used once in your five-person research group."), error && /* @__PURE__ */ React.createElement("p", { role: "alert" }, error), /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12
      }
    },
    genres.map((g) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: g.id,
        className: "btn",
        disabled: busy,
        onClick: async () => {
          if (selecting.current) return;
          selecting.current = true;
          setBusy(true);
          try {
            await act(
              "day1/genre",
              { genreId: g.id },
              "Research question assigned."
            );
          } finally {
            selecting.current = false;
            setBusy(false);
            setRetry((n) => n + 1);
          }
        }
      },
      g.name
    ))
  ), /* @__PURE__ */ React.createElement("p", { "aria-live": "polite" }, busy ? "Assigning your question\u2026" : !genres.length && !error ? "Loading available genres\u2026" : "Availability refreshes every eight seconds."), error && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn",
      disabled: busy,
      onClick: () => setRetry((n) => n + 1)
    },
    "Try again"
  ));
}

// components/FlightResearchScene.js
var import_lucide_react2 = require("lucide-react");

// lib/mission-images.js
var missionImageIds = Object.freeze([
  "travel-1",
  "travel-2",
  "travel-3",
  "food-1",
  "food-2",
  "food-3",
  "gaming-1",
  "gaming-2",
  "gaming-3",
  "music-1",
  "music-2",
  "music-3",
  "movies-1",
  "movies-2",
  "movies-3",
  "fashion-1",
  "fashion-2",
  "fashion-3",
  "room-design-1",
  "room-design-2",
  "room-design-3",
  "technology-1",
  "technology-2",
  "technology-3",
  "social-media-1",
  "social-media-2",
  "social-media-3",
  "mysteries-1",
  "mysteries-2",
  "mysteries-3",
  "fitness-1",
  "fitness-2",
  "fitness-3",
  "money-1",
  "money-2",
  "money-3",
  "business-1",
  "business-2",
  "business-3",
  "sports-1",
  "sports-2",
  "sports-3",
  "relationships-1",
  "relationships-2",
  "relationships-3",
  "events-1",
  "events-2",
  "events-3",
  "sustainability-1",
  "sustainability-2",
  "sustainability-3"
]);
var revisions = Object.freeze({
  "food-2": 2,
  "music-2": 2,
  "gaming-1": 2,
  "music-1": 2,
  "movies-2": 2,
  "fashion-2": 2,
  "movies-3": 2,
  "technology-1": 2,
  "room-design-2": 2,
  "fitness-2": 2,
  "money-2": 2,
  "relationships-2": 2,
  "business-2": 2
});
var known = new Set(missionImageIds);
function missionImageFor(questionId) {
  return known.has(questionId) ? `/images/research-missions/${questionId}${revisions[questionId] ? `-v${revisions[questionId]}` : ""}.webp` : null;
}

// components/FlightResearchScene.js
var companions = {
  sports: [import_lucide_react2.Flag, import_lucide_react2.Star],
  gaming: [import_lucide_react2.Zap, import_lucide_react2.Sparkles],
  mysteries: [import_lucide_react2.Lightbulb, import_lucide_react2.Star],
  fitness: [import_lucide_react2.Heart, import_lucide_react2.Zap],
  travel: [import_lucide_react2.Plane, import_lucide_react2.MapPin],
  food: [import_lucide_react2.Coffee, import_lucide_react2.Sparkles],
  movies: [import_lucide_react2.Ticket, import_lucide_react2.Star],
  music: [import_lucide_react2.Headphones, import_lucide_react2.Music],
  fashion: [import_lucide_react2.ShoppingBag, import_lucide_react2.Sparkles],
  "room-design": [import_lucide_react2.Palette, import_lucide_react2.Home],
  technology: [import_lucide_react2.Rocket, import_lucide_react2.Zap],
  "social-media": [import_lucide_react2.MessageCircle, import_lucide_react2.Heart],
  money: [import_lucide_react2.Coins, import_lucide_react2.TrendingUp],
  business: [import_lucide_react2.TrendingUp, import_lucide_react2.Lightbulb],
  relationships: [import_lucide_react2.Heart, import_lucide_react2.MessageCircle],
  events: [import_lucide_react2.CalendarDays, import_lucide_react2.PartyPopper],
  sustainability: [import_lucide_react2.Flower2, import_lucide_react2.Leaf]
};
var positions = [
  [18, 25],
  [43, 25],
  [69, 25],
  [85, 63],
  [67, 82],
  [30, 82],
  [10, 64]
];
var clues = {
  travel: "Every destination has a story. Find the one worth the journey.",
  food: "Follow your curiosity. Discover what goes into a good choice.",
  gaming: "Look beyond the leaderboard. Discover what makes a game work.",
  music: "Tune into a new world. Find the story behind the sound.",
  movies: "Go beyond the screen. Investigate the stories that stay with us.",
  fashion: "Look past the trend. Discover the choices behind the style.",
  "room-design": "Imagine a space differently. Investigate how to bring it to life.",
  technology: "Question the next big thing. Find out what it can really do.",
  "social-media": "Look beyond the feed. Find the evidence behind the influence.",
  mysteries: "Follow the clues. Separate a convincing story from the facts.",
  fitness: "Put the claims to the test. Discover what holds up to scrutiny.",
  money: "Trace the possibilities. Make a choice you can explain.",
  business: "Find an opportunity. Investigate what it takes to make it work.",
  sports: "Go beyond the score. Find the decisions that change the game.",
  relationships: "Explore different perspectives. Find the reasoning behind a choice.",
  events: "Plan for the unexpected. Discover what makes an experience memorable.",
  sustainability: "Follow the impact. Find a better way forward."
};
function FlightResearchScene({
  data,
  genre,
  question,
  setGenre,
  setQuestion,
  busy,
  error,
  symbols: symbols2,
  headingRef,
  recordId,
  commit,
  retry
}) {
  const selection = data?.selection;
  const chosen = data?.genres?.find((g) => g.id === genre);
  const chosenQuestion = selection?.questions.find((q) => q.id === question);
  const index = data?.genres?.findIndex((g) => g.id === genre) ?? -1;
  const target = index >= 0 ? positions[index] : [48, 49];
  const Icon = symbols2[selection?.genreId || chosen?.id] || import_lucide_react2.Compass;
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      className: `flight-research-scene ${selection ? "is-question-stage" : ""}`,
      "aria-label": "Research mission selection",
      "aria-busy": busy,
      "data-motion": "on"
    },
    /* @__PURE__ */ React.createElement("div", { className: "flight-world" }, /* @__PURE__ */ React.createElement("div", { className: "flight-scene-heading" }, /* @__PURE__ */ React.createElement("span", { className: "flight-overline" }, /* @__PURE__ */ React.createElement(import_lucide_react2.Wind, { size: 14 }), " ", selection ? "WORLD DISCOVERED" : "THE SKY IS FULL OF POSSIBILITIES"), /* @__PURE__ */ React.createElement("h3", { ref: headingRef, tabIndex: -1 }, selection ? "Choose your mission" : "Choose your world"), /* @__PURE__ */ React.createElement("p", null, selection ? `${selection.genreName} \xB7 Three signals. One discovery.` : "Select a genre to begin your discovery.")), !data ? /* @__PURE__ */ React.createElement("div", { className: "flight-signal-loading", role: "status" }, /* @__PURE__ */ React.createElement(import_lucide_react2.Compass, { size: 42 }), /* @__PURE__ */ React.createElement("p", null, "Discovering your seven worlds\u2026")) : selection ? /* @__PURE__ */ React.createElement("fieldset", { className: "flight-quest-choices", disabled: busy }, /* @__PURE__ */ React.createElement("legend", { className: "sr-only" }, "Choose one of three questions"), selection.questions.map((q, i) => {
      const background = missionImageFor(q.id);
      return /* @__PURE__ */ React.createElement(
        "label",
        {
          key: q.id,
          className: `flight-quest ${q.id === question ? "is-selected" : ""}`,
          style: background ? { "--mission-background": `url("${background}")` } : void 0
        },
        /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "radio",
            name: `research-question-${recordId}`,
            value: q.id,
            checked: question === q.id,
            "aria-label": `Mission ${i + 1}: ${q.title}`,
            "aria-describedby": `mission-prompt-${recordId}-${q.id}`,
            onChange: () => setQuestion(q.id)
          }
        ),
        /* @__PURE__ */ React.createElement(
          "span",
          {
            className: "flight-quest-art mission-image-window",
            "aria-hidden": "true"
          },
          /* @__PURE__ */ React.createElement("span", { className: "flight-quest-seal" }, "0", i + 1)
        ),
        /* @__PURE__ */ React.createElement("span", { className: "flight-quest-kicker" }, selection.genreName, " / MISSION 0", i + 1),
        /* @__PURE__ */ React.createElement("strong", null, q.title),
        /* @__PURE__ */ React.createElement(
          "span",
          {
            className: "flight-quest-prompt",
            id: `mission-prompt-${recordId}-${q.id}`
          },
          q.prompt
        ),
        /* @__PURE__ */ React.createElement("span", { className: "flight-quest-select" }, q.id === question ? "Mission selected" : "Select mission", " ", q.id === question ? /* @__PURE__ */ React.createElement(import_lucide_react2.Check, { size: 16 }) : /* @__PURE__ */ React.createElement(import_lucide_react2.ArrowRight, { size: 16 }))
      );
    })) : /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "flight-world-beacons",
        "aria-label": "Seven research genres"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flight-compass-rose", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", null, "N"), /* @__PURE__ */ React.createElement(import_lucide_react2.Compass, { size: 160, strokeWidth: 0.5 })),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "flight-scout",
          style: {
            left: `${48 + (target[0] - 48) * 0.28}%`,
            top: `${49 + (target[1] - 49) * 0.28}%`
          },
          "aria-hidden": "true"
        },
        /* @__PURE__ */ React.createElement("img", { src: "/images/flight-helicopter-right.png", alt: "" }),
        /* @__PURE__ */ React.createElement("span", null, "YOUR FLIGHT")
      ),
      data.genres.map((g, i) => {
        const Glyph = symbols2[g.id] || import_lucide_react2.Compass;
        const [Companion, Accent] = companions[g.id] || [import_lucide_react2.Sparkles, import_lucide_react2.Star];
        return /* @__PURE__ */ React.createElement(
          "button",
          {
            key: g.id,
            type: "button",
            "aria-label": `Explore ${g.name}`,
            "aria-pressed": genre === g.id,
            disabled: busy,
            className: `flight-world-beacon ${genre === g.id ? "is-selected" : ""}`,
            "data-genre": g.id,
            style: {
              left: `${positions[i][0]}%`,
              top: `${positions[i][1]}%`,
              "--beacon-delay": `${i * -0.65}s`
            },
            onClick: () => setGenre(g.id)
          },
          /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-ring" }, /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-symbol", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Glyph, { size: 34, strokeWidth: 1.7 })), /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-charm", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Companion, { size: 14, strokeWidth: 1.8 })), /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-accent", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Accent, { size: 13, strokeWidth: 1.8 })), genre === g.id && /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-check" }, /* @__PURE__ */ React.createElement(import_lucide_react2.Check, { size: 12 }))),
          /* @__PURE__ */ React.createElement("strong", null, g.name),
          /* @__PURE__ */ React.createElement("small", null, genre === g.id ? "COURSE SELECTED" : "EXPLORE WORLD")
        );
      })
    ), /* @__PURE__ */ React.createElement("div", { className: "flight-scene-footnote" }, /* @__PURE__ */ React.createElement(import_lucide_react2.Compass, { size: 15 }), /* @__PURE__ */ React.createElement("span", null, selection ? "Your genre is saved. Your research timer has not started." : "Seven worlds. One discovery. The choice is yours."))),
    /* @__PURE__ */ React.createElement("aside", { className: "flight-radio-panel", "aria-label": "Mission briefing" }, /* @__PURE__ */ React.createElement("div", { className: "flight-radio-channel" }, /* @__PURE__ */ React.createElement(import_lucide_react2.Radio, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "FLIGHT RADIO", /* @__PURE__ */ React.createElement("small", null, "MISSION BRIEFING")), /* @__PURE__ */ React.createElement("i", { "aria-hidden": "true" })), /* @__PURE__ */ React.createElement("div", { className: "flight-radio-emblem" }, /* @__PURE__ */ React.createElement(Icon, { size: 42, strokeWidth: 1.2 })), /* @__PURE__ */ React.createElement("span", { className: "flight-overline" }, selection ? "02 / CHOOSE YOUR MISSION" : "01 / CHART YOUR COURSE"), /* @__PURE__ */ React.createElement("h4", { "aria-live": "polite" }, selection ? chosenQuestion?.title || "Your next discovery" : chosen?.name || "A world of your own"), /* @__PURE__ */ React.createElement("p", { className: "flight-radio-copy" }, selection ? chosenQuestion ? "Mission selected. Lock it when you're ready to investigate." : "Choose a mission card, then lock your choice." : chosen ? clues[chosen.id] || "Follow your curiosity into a new world." : "Explorer, seven worlds are within reach. Select a beacon to find your research destination."), /* @__PURE__ */ React.createElement("div", { className: "flight-radio-rule" }, /* @__PURE__ */ React.createElement(import_lucide_react2.LockKeyhole, { size: 17 }), /* @__PURE__ */ React.createElement("p", null, selection ? "Confirming locks your question. Your 90-minute timer starts when you begin research." : chosen ? "Locking reserves this genre for you. You cannot switch afterward." : "Each explorer in your five-person group claims a different genre.")), error && /* @__PURE__ */ React.createElement("div", { className: "flight-radio-error", role: "alert" }, /* @__PURE__ */ React.createElement("p", null, error), /* @__PURE__ */ React.createElement("button", { className: "btn small", disabled: busy, onClick: retry }, "Reload saved choices")), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "flight-mission-action",
        disabled: busy || !data || (selection ? !question : !chosen),
        onClick: () => selection ? commit("question", { questionId: question }) : commit("genre", { genreId: genre })
      },
      /* @__PURE__ */ React.createElement("span", null, busy ? "Confirming\u2026" : selection ? "Lock this mission" : chosen ? `Set course for ${chosen.name}` : "Select a world"),
      /* @__PURE__ */ React.createElement(import_lucide_react2.ArrowRight, { size: 19 })
    ), /* @__PURE__ */ React.createElement("small", { className: "flight-radio-save" }, selection ? chosenQuestion ? "Selection ready \xB7 confirm to lock" : "Genre locked \xB7 choose your mission" : "Your choice locks only when you confirm."))
  );
}

// components/ResearchGenrePicker.js
var symbols = {
  travel: import_lucide_react3.MapPin,
  food: import_lucide_react3.Utensils,
  gaming: import_lucide_react3.Gamepad2,
  music: import_lucide_react3.Music,
  movies: import_lucide_react3.Clapperboard,
  fashion: import_lucide_react3.Shirt,
  "room-design": import_lucide_react3.House,
  technology: import_lucide_react3.Cpu,
  "social-media": import_lucide_react3.Smartphone,
  mysteries: import_lucide_react3.Search,
  fitness: import_lucide_react3.Dumbbell,
  money: import_lucide_react3.Wallet,
  business: import_lucide_react3.Briefcase,
  sports: import_lucide_react3.Trophy,
  relationships: import_lucide_react3.Users,
  events: import_lucide_react3.CalendarDays,
  sustainability: import_lucide_react3.Leaf
};
function ResearchGenrePicker2(props) {
  return props.interactive ? /* @__PURE__ */ React.createElement(ResearchChoiceGame, { ...props }) : /* @__PURE__ */ React.createElement(ResearchGenrePicker, { ...props });
}
function ResearchChoiceGame({ act, recordId, game = false }) {
  const [data, setData] = (0, import_react2.useState)(null);
  const [genre, setGenre] = (0, import_react2.useState)("");
  const [question, setQuestion] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)("");
  const [retry, setRetry] = (0, import_react2.useState)(0);
  const pending = (0, import_react2.useRef)(false);
  const actRef = (0, import_react2.useRef)(act);
  actRef.current = act;
  const sequence = (0, import_react2.useRef)(0);
  const selectionHeading = (0, import_react2.useRef)(null);
  const selection = data?.selection;
  (0, import_react2.useEffect)(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      if (pending.current) return;
      const request = ++sequence.current;
      try {
        const response = await fetch("/api/day1/genre-offer", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal
        });
        const result = await response.json();
        if (disposed || pending.current || request !== sequence.current) return;
        if (!response.ok)
          throw new Error(
            result.error || "Could not load your research choices."
          );
        if (result.assignment) {
          pending.current = true;
          try {
            await actRef.current(
              "day1/question",
              { questionId: result.assignment.questionId },
              ""
            );
          } finally {
            pending.current = false;
          }
          return;
        }
        setData(result);
        setError("");
        setGenre(
          (value) => result.genres.some((g) => g.id === value) ? value : ""
        );
      } catch (e) {
        if (!disposed && request === sequence.current) setError(e.message);
      }
    }
    load();
    const timer = setInterval(load, 8e3);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [recordId, retry]);
  (0, import_react2.useEffect)(() => {
    if (selection) selectionHeading.current?.focus();
  }, [selection?.genreId]);
  async function commit(action, body) {
    if (pending.current) return;
    pending.current = true;
    sequence.current++;
    setBusy(true);
    setError("");
    try {
      const result = await act(
        `day1/${action}`,
        body,
        action === "genre" ? "Genre locked. Choose your research question." : "Research question locked. Your mission is ready."
      );
      if (result) {
        setData(result);
        setGenre("");
        setQuestion("");
      } else {
        setError(
          "Your choice was not confirmed. Availability may have changed; review the current choices and try again."
        );
        setRetry((n) => n + 1);
      }
    } catch (e) {
      setError(
        e.message || "Your choice could not be confirmed. Retry to check its saved status."
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const chosenGenre = data?.genres.find((g) => g.id === genre);
  if (game)
    return /* @__PURE__ */ React.createElement(
      FlightResearchScene,
      {
        data,
        genre,
        question,
        setGenre,
        setQuestion,
        busy,
        error,
        symbols,
        headingRef: selectionHeading,
        recordId,
        commit,
        retry: () => {
          setError("");
          setRetry((n) => n + 1);
        }
      }
    );
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      className: "research-choice-game",
      "aria-label": "Research mission selection",
      "aria-busy": busy
    },
    !game && /* @__PURE__ */ React.createElement(
      "ol",
      {
        className: "research-progress",
        "aria-label": "Research selection progress"
      },
      /* @__PURE__ */ React.createElement("li", { className: !selection ? "is-current" : "is-complete" }, selection ? /* @__PURE__ */ React.createElement(import_lucide_react3.Check, { size: 15 }) : "01", /* @__PURE__ */ React.createElement("span", null, "Choose a genre")),
      /* @__PURE__ */ React.createElement("li", { className: selection ? "is-current" : "" }, "02", /* @__PURE__ */ React.createElement("span", null, "Choose a question")),
      /* @__PURE__ */ React.createElement("li", null, "03", /* @__PURE__ */ React.createElement("span", null, "Begin research"))
    ),
    error && /* @__PURE__ */ React.createElement("p", { className: "research-error", role: "alert" }, error),
    !data ? /* @__PURE__ */ React.createElement("div", { className: "research-loading", role: "status" }, "Preparing your seven research routes\u2026") : selection ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "research-selection-heading" }, /* @__PURE__ */ React.createElement("span", { className: "research-kicker" }, /* @__PURE__ */ React.createElement(import_lucide_react3.LockKeyhole, { size: 13 }), " GENRE LOCKED"), /* @__PURE__ */ React.createElement("h3", { tabIndex: -1, ref: selectionHeading }, selection.genreName, ": choose your question"), /* @__PURE__ */ React.createElement("p", null, "Read all three missions. Select one, then confirm your choice. Your confirmed question stays with you for this round and Friday\u2019s Fitness activity.")), /* @__PURE__ */ React.createElement("fieldset", { className: "research-question-list", disabled: busy }, /* @__PURE__ */ React.createElement("legend", { className: "research-field-legend" }, "Choose one of three questions"), selection.questions.map((q, index) => /* @__PURE__ */ React.createElement(
      "label",
      {
        className: `research-question-card ${question === q.id ? "is-selected" : ""}`,
        key: q.id
      },
      /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "radio",
          name: `research-question-${recordId}`,
          value: q.id,
          checked: question === q.id,
          onChange: () => setQuestion(q.id)
        }
      ),
      /* @__PURE__ */ React.createElement("span", { className: "research-question-copy" }, /* @__PURE__ */ React.createElement("span", { className: "research-kicker" }, "MISSION 0", index + 1), /* @__PURE__ */ React.createElement("strong", null, q.title), /* @__PURE__ */ React.createElement("span", null, q.prompt))
    ))), /* @__PURE__ */ React.createElement("div", { className: "research-lock-panel" }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement(import_lucide_react3.LockKeyhole, { size: 16 }), " Confirming locks this question. The research timer starts later, when you explicitly begin."), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "research-confirm",
        disabled: !question || busy,
        onClick: () => commit("question", { questionId: question })
      },
      busy ? "Confirming your question\u2026" : "Confirm and lock question",
      /* @__PURE__ */ React.createElement(import_lucide_react3.ArrowRight, { size: 18 })
    ))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "research-selection-heading" }, /* @__PURE__ */ React.createElement("span", { className: "research-kicker" }, "FLIGHT MISSION / PICK YOUR ROUTE"), /* @__PURE__ */ React.createElement("h3", null, "Which world will you investigate?"), /* @__PURE__ */ React.createElement("p", null, "Explore seven genres. Select a card, then lock your genre to reveal its three questions. Each genre belongs to one person in your five-person research group.")), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "research-genre-grid",
        "aria-label": "Seven research genres"
      },
      data.genres.map((g, index) => {
        const Icon = symbols[g.id] || import_lucide_react3.Compass;
        return /* @__PURE__ */ React.createElement(
          "button",
          {
            key: g.id,
            type: "button",
            className: `research-genre-card ${genre === g.id ? "is-selected" : ""}`,
            disabled: busy,
            "aria-pressed": genre === g.id,
            onClick: () => setGenre(g.id)
          },
          /* @__PURE__ */ React.createElement("span", { className: "research-route-number" }, "ROUTE 0", index + 1),
          /* @__PURE__ */ React.createElement(Icon, { size: 32, strokeWidth: 1.5 }),
          /* @__PURE__ */ React.createElement("strong", null, g.name),
          /* @__PURE__ */ React.createElement("span", { className: "research-card-action" }, genre === g.id ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(import_lucide_react3.Check, { size: 15 }), " Selected") : /* @__PURE__ */ React.createElement(React.Fragment, null, "Explore this route ", /* @__PURE__ */ React.createElement(import_lucide_react3.ArrowRight, { size: 15 })))
        );
      })
    ), /* @__PURE__ */ React.createElement("div", { className: "research-lock-panel" }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement(import_lucide_react3.LockKeyhole, { size: 16 }), chosenGenre ? `Ready for ${chosenGenre.name}? Locking it reserves this genre for you. You cannot switch afterward.` : "Choose a card to continue. Your genre only locks when you confirm below."), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "research-confirm",
        disabled: !chosenGenre || busy,
        onClick: () => commit("genre", { genreId: genre })
      },
      busy ? "Reserving your genre\u2026" : chosenGenre ? `Lock ${chosenGenre.name} and reveal questions` : "Select a genre first",
      /* @__PURE__ */ React.createElement(import_lucide_react3.ArrowRight, { size: 18 })
    )), /* @__PURE__ */ React.createElement("p", { className: "research-availability", "aria-live": "polite" }, "Your routes stay saved. Only a route claimed by a teammate is replaced.")),
    error && /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        disabled: busy,
        onClick: () => {
          setError("");
          setRetry((n) => n + 1);
        }
      },
      "Reload saved choices"
    )
  );
}

// components/FlightMissionBriefing.js
var import_react4 = require("react");
var import_lucide_react5 = require("lucide-react");

// components/ui.js
var import_lucide_react4 = require("lucide-react");
var import_react3 = require("react");
var import_react_dom = require("react-dom");
function Badge({ children, tone = "" }) {
  return /* @__PURE__ */ React.createElement("span", { className: `badge ${tone}` }, children);
}
function Panel({ title, kicker, action, children, className = "" }) {
  return /* @__PURE__ */ React.createElement("section", { className: `panel ${className}` }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, kicker && /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, kicker), /* @__PURE__ */ React.createElement("h2", null, title)), action), children);
}
function Empty({ title = "All clear on this channel", children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "empty" }, /* @__PURE__ */ React.createElement(import_lucide_react4.Inbox, { size: 25 }), /* @__PURE__ */ React.createElement("h3", null, title), /* @__PURE__ */ React.createElement("div", { className: "empty-copy" }, children));
}
function Modal({
  title,
  kicker,
  children,
  close,
  wide = false,
  variant,
  portal = false
}) {
  const root = (0, import_react3.useRef)(null), closeRef = (0, import_react3.useRef)(close);
  closeRef.current = close;
  (0, import_react3.useEffect)(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(
      root.current.querySelectorAll(
        'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]'
      )
    ).filter((el) => el.getClientRects().length);
    controls()[0]?.focus();
    function onKey(e) {
      if (Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) !== root.current)
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const list = controls();
        const first = list[0], last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  const dialog = /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `modal-backdrop ${portal ? "priority-modal-backdrop" : ""} ${variant === "flight-mission" ? "flight-mission-backdrop" : ""} ${variant === "level-drawer" ? "level-drawer-backdrop" : ""} ${variant === "level-completion" ? "level-completion-backdrop" : ""}`,
      onClick: (e) => e.target === e.currentTarget && close()
    },
    /* @__PURE__ */ React.createElement(
      "section",
      {
        ref: root,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": title,
        className: `modal ${!variant ? "modal-dialog" : ""} ${wide ? "wide" : ""} ${variant === "flight-mission" ? "flight-mission-window" : ""} ${variant === "level-drawer" ? "level-drawer" : ""} ${variant === "level-completion" ? "level-completion-modal" : ""}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, kicker || "CODEWILD / FIELD CONSOLE"), /* @__PURE__ */ React.createElement("h2", null, title)), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "icon-btn",
          "aria-label": "Close dialog",
          onClick: close
        },
        /* @__PURE__ */ React.createElement(import_lucide_react4.X, { size: 20 })
      )),
      !variant ? /* @__PURE__ */ React.createElement("div", { className: "modal-content" }, children) : children
    )
  );
  return (portal || variant === "flight-mission") && typeof document !== "undefined" ? (0, import_react_dom.createPortal)(dialog, document.body) : dialog;
}
function Form({
  fields,
  onSubmit,
  submit = "Confirm",
  initial = {},
  children,
  onDraftChange
}) {
  const [submitting, setSubmitting] = (0, import_react3.useState)(false);
  const [feedback, setFeedback] = (0, import_react3.useState)(null);
  const pending = (0, import_react3.useRef)(false);
  return /* @__PURE__ */ React.createElement(
    "form",
    {
      onInput: onDraftChange ? (e) => onDraftChange(Object.fromEntries(new FormData(e.currentTarget))) : void 0,
      className: "field-form",
      "data-has-fields": fields.length > 0 ? "true" : "false",
      "data-feedback": feedback ? feedback.error ? "error" : "success" : void 0,
      "aria-busy": submitting,
      onSubmit: async (e) => {
        e.preventDefault();
        if (pending.current) return;
        pending.current = true;
        setSubmitting(true);
        setFeedback(null);
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        for (const field of fields)
          if (field.type === "number")
            data[field.name] = data[field.name] === "" && field.optional ? "" : Number(data[field.name]);
        try {
          const result = await onSubmit(data);
          if (result === false) {
            setFeedback({
              error: true,
              message: "This record wasn't saved. Your entries are still here. Check the error and try again."
            });
          } else {
            form.reset();
            setFeedback({ error: false, message: "Saved successfully." });
          }
        } catch (error) {
          setFeedback({
            error: true,
            message: error.message || "This record couldn't be saved. Your entries are still here."
          });
        } finally {
          pending.current = false;
          setSubmitting(false);
        }
      }
    },
    fields.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "form-field-mark", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "form-crest" }, /* @__PURE__ */ React.createElement(import_lucide_react4.Compass, { size: 25, strokeWidth: 2.5 })), /* @__PURE__ */ React.createElement("span", { className: "form-record-title" }, "Mission details"), /* @__PURE__ */ React.createElement("span", { className: "form-field-rule" }), /* @__PURE__ */ React.createElement("span", { className: "form-field-count" }, fields.length, " fields")),
    fields.map((f) => {
      const FieldIcon = f.options ? import_lucide_react4.ListChecks : f.type === "number" ? import_lucide_react4.Hash : ["date", "datetime-local", "time"].includes(f.type) ? import_lucide_react4.CalendarDays : f.type === "url" ? import_lucide_react4.Link2 : f.type === "email" ? import_lucide_react4.Mail : f.type === "password" ? import_lucide_react4.LockKeyhole : import_lucide_react4.PencilLine;
      return /* @__PURE__ */ React.createElement("label", { key: f.name, className: "expedition-field" }, /* @__PURE__ */ React.createElement("span", { className: "form-field-caption" }, /* @__PURE__ */ React.createElement("span", { className: "form-field-number", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(FieldIcon, { size: 17, strokeWidth: 2.6 })), /* @__PURE__ */ React.createElement("span", null, f.label), f.optional && /* @__PURE__ */ React.createElement("small", { "aria-hidden": "true" }, "Optional")), f.options ? /* @__PURE__ */ React.createElement(
        "select",
        {
          disabled: submitting,
          name: f.name,
          defaultValue: initial[f.name] ?? f.options[0]?.value,
          required: !f.optional && !f.options.some((o) => o.value === "")
        },
        f.options.map((o) => /* @__PURE__ */ React.createElement("option", { value: o.value, key: o.value }, o.label))
      ) : f.type === "textarea" ? /* @__PURE__ */ React.createElement(
        "textarea",
        {
          disabled: submitting,
          name: f.name,
          rows: f.rows || 3,
          minLength: f.min || 1,
          maxLength: f.maxLength || 4e3,
          defaultValue: initial[f.name] || "",
          required: !f.optional,
          placeholder: f.placeholder
        }
      ) : /* @__PURE__ */ React.createElement(
        "input",
        {
          disabled: submitting,
          name: f.name,
          type: f.type || "text",
          defaultValue: initial[f.name] ?? "",
          min: f.min,
          max: f.max,
          step: f.type === "number" ? f.step || "any" : void 0,
          minLength: f.type === "number" ? void 0 : f.min,
          required: !f.optional,
          placeholder: f.placeholder
        }
      ));
    }),
    children,
    feedback && /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `workflow-form-feedback ${feedback.error ? "is-error" : ""}`,
        role: feedback.error ? "alert" : "status"
      },
      /* @__PURE__ */ React.createElement("span", { className: "form-feedback-icon", "aria-hidden": "true" }, feedback.error ? /* @__PURE__ */ React.createElement(import_lucide_react4.AlertTriangle, { size: 19, strokeWidth: 2.5 }) : /* @__PURE__ */ React.createElement(import_lucide_react4.Check, { size: 20, strokeWidth: 3 })),
      /* @__PURE__ */ React.createElement("span", null, feedback.message)
    ),
    /* @__PURE__ */ React.createElement("button", { className: "btn primary", type: "submit", disabled: submitting }, /* @__PURE__ */ React.createElement("span", { className: "form-action-icon", "aria-hidden": "true" }, submitting ? /* @__PURE__ */ React.createElement(import_lucide_react4.LoaderCircle, { className: "spin", size: 16, "aria-hidden": "true" }) : /* @__PURE__ */ React.createElement(import_lucide_react4.Compass, { size: 21, strokeWidth: 2.6, "aria-hidden": "true" })), /* @__PURE__ */ React.createElement("span", null, submitting ? "Recording\u2026" : submit))
  );
}
function Receipt({ children }) {
  return /* @__PURE__ */ React.createElement("p", { className: "receipt" }, /* @__PURE__ */ React.createElement(import_lucide_react4.Check, { size: 14 }), children);
}

// components/FlightMissionBriefing.js
function FlightMissionBriefing({
  record: r,
  question: g,
  timer,
  remaining,
  busy,
  error,
  onAction,
  formatDate,
  children
}) {
  const [showLog, setShowLog] = (0, import_react4.useState)(false);
  const [revise, setRevise] = (0, import_react4.useState)(false);
  const submission = r.submissions.at(-1);
  (0, import_react4.useEffect)(() => setRevise(false), [submission?.id]);
  const verified = Boolean(submission && r.verification?.status === "VERIFIED");
  const phase = verified ? "verified" : submission ? "submitted" : r.startedAt ? "research" : r.acknowledgedAt ? "ready" : "briefing";
  const cover = missionImageFor(r.researchAssignment?.questionId || g.id);
  const title = g.name.split(" \xB7 ").at(-1);
  const status = {
    briefing: "Mission discovered",
    ready: "Ready for launch",
    research: "Investigation underway",
    submitted: "Signal received",
    verified: "Evidence verified"
  }[phase];
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      className: "flight-research-scene flight-active-mission mission-briefing-scene",
      "data-phase": phase,
      "aria-label": "Your research mission"
    },
    /* @__PURE__ */ React.createElement("div", { className: "flight-world flight-mission-objective" }, /* @__PURE__ */ React.createElement("div", { className: "flight-scene-heading" }, /* @__PURE__ */ React.createElement("h3", null, title), /* @__PURE__ */ React.createElement("p", null, "Your mission is waiting.")), /* @__PURE__ */ React.createElement(
      "article",
      {
        className: "mission-briefing-board",
        "aria-label": "Mission briefing",
        style: cover ? { "--briefing-cover": `url("${cover}")` } : void 0
      },
      /* @__PURE__ */ React.createElement("div", { className: "mission-briefing-poster", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "mission-poster-code" }, /* @__PURE__ */ React.createElement(import_lucide_react5.Compass, { size: 15 }), " FLIGHT / 01"), /* @__PURE__ */ React.createElement("div", { className: "mission-poster-caption" }, /* @__PURE__ */ React.createElement("span", null, r.researchAssignment?.genreName || "Discovery"), /* @__PURE__ */ React.createElement("strong", null, title))),
      /* @__PURE__ */ React.createElement("div", { className: "mission-briefing-copy" }, /* @__PURE__ */ React.createElement("span", { className: "mission-briefing-kicker" }, /* @__PURE__ */ React.createElement(import_lucide_react5.Target, { size: 15 }), " YOUR OBJECTIVE"), /* @__PURE__ */ React.createElement("h4", null, "Follow your curiosity."), /* @__PURE__ */ React.createElement("p", { className: "mission-question" }, g.question), /* @__PURE__ */ React.createElement(
        "ul",
        {
          className: "mission-field-guide",
          "aria-label": "Research field guide"
        },
        /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_lucide_react5.Compass, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "Explore your options")),
        /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_lucide_react5.Search, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "Check the claims")),
        /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_lucide_react5.Radio, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "Bring back your chat"))
      ), /* @__PURE__ */ React.createElement("span", { className: "mission-contract-lock" }, /* @__PURE__ */ React.createElement(import_lucide_react5.LockKeyhole, { size: 12 }), " Your question is locked and saved."))
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "mission-route-progress",
        "aria-label": "Research mission progress"
      },
      [
        ["Accept", Boolean(r.acknowledgedAt)],
        ["Research", Boolean(r.startedAt)],
        ["Transmit", Boolean(submission)]
      ].map(([label, done], i) => /* @__PURE__ */ React.createElement(
        "div",
        {
          key: label,
          className: done ? "is-complete" : i === (r.startedAt ? 2 : r.acknowledgedAt ? 1 : 0) ? "is-current" : ""
        },
        /* @__PURE__ */ React.createElement("span", null, done ? /* @__PURE__ */ React.createElement(import_lucide_react5.Check, { size: 13 }) : i + 1),
        /* @__PURE__ */ React.createElement("strong", null, label)
      ))
    )),
    /* @__PURE__ */ React.createElement(
      "aside",
      {
        className: "flight-radio-panel mission-launch-panel",
        "aria-label": "Mission control"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flight-radio-channel" }, /* @__PURE__ */ React.createElement(import_lucide_react5.Radio, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "FLIGHT RADIO", /* @__PURE__ */ React.createElement("small", null, "MISSION CONTROL")), /* @__PURE__ */ React.createElement("i", { "aria-hidden": "true" })),
      /* @__PURE__ */ React.createElement("div", { className: "mission-control-emblem", "aria-hidden": "true" }, verified ? /* @__PURE__ */ React.createElement(import_lucide_react5.ShieldCheck, { size: 34 }) : submission ? /* @__PURE__ */ React.createElement(import_lucide_react5.Check, { size: 34 }) : r.startedAt ? /* @__PURE__ */ React.createElement(import_lucide_react5.Search, { size: 34 }) : /* @__PURE__ */ React.createElement(import_lucide_react5.Compass, { size: 34 })),
      /* @__PURE__ */ React.createElement("span", { className: "mission-phase-status", role: "status" }, status),
      /* @__PURE__ */ React.createElement("h4", null, verified ? "Discovery confirmed." : submission ? "Good work, explorer." : r.startedAt ? "Find your answers." : r.acknowledgedAt ? "Ready to explore?" : "Your adventure starts here."),
      !submission && /* @__PURE__ */ React.createElement(
        "div",
        {
          className: `mission-countdown ${r.startedAt ? "is-running" : ""}`,
          role: r.startedAt ? "timer" : void 0,
          "aria-label": r.startedAt ? "Research time remaining" : "Research window"
        },
        /* @__PURE__ */ React.createElement(import_lucide_react5.Clock3, { size: 18 }),
        /* @__PURE__ */ React.createElement("strong", null, r.startedAt ? timer : "90:00"),
        /* @__PURE__ */ React.createElement("span", null, r.startedAt ? remaining > 0 ? "REMAINING" : "WINDOW ENDED" : "STARTS AT LAUNCH")
      ),
      /* @__PURE__ */ React.createElement("p", { className: "mission-control-copy" }, verified ? "Command has verified your evidence. The next level opens when it is released." : submission ? "Your conversation is saved. Command will check your evidence." : r.startedAt ? "Investigate with your AI tool. Return with a shared conversation link." : r.acknowledgedAt ? "Launch when you are ready. The timer keeps running after you leave." : "Read the objective, then accept your mission. Your timer has not started."),
      !r.acknowledgedAt && /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "flight-mission-action mission-launch-action",
          disabled: busy,
          onClick: () => onAction("acknowledge")
        },
        /* @__PURE__ */ React.createElement("span", null, busy ? "Accepting\u2026" : "Accept mission"),
        /* @__PURE__ */ React.createElement(import_lucide_react5.ShieldCheck, { size: 18 })
      ),
      r.acknowledgedAt && !r.startedAt && /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "flight-mission-action mission-launch-action",
          disabled: busy,
          onClick: () => onAction("start")
        },
        /* @__PURE__ */ React.createElement("span", null, busy ? "Launching\u2026" : "Begin research"),
        /* @__PURE__ */ React.createElement(import_lucide_react5.ArrowRight, { size: 18 })
      ),
      r.startedAt && !submission && children,
      error && /* @__PURE__ */ React.createElement("p", { className: "flight-radio-error", role: "alert" }, error),
      submission && /* @__PURE__ */ React.createElement("div", { className: "mission-evidence-receipt" }, /* @__PURE__ */ React.createElement("a", { href: submission.url, target: "_blank", rel: "noopener noreferrer" }, /* @__PURE__ */ React.createElement(import_lucide_react5.ExternalLink, { size: 14 }), " Open your research chat"), r.verification?.reason && /* @__PURE__ */ React.createElement("p", null, r.verification.reason), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "mission-log-trigger",
          onClick: () => setRevise(true)
        },
        "Replace chat link ",
        /* @__PURE__ */ React.createElement(import_lucide_react5.ArrowRight, { size: 14 })
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "mission-log-trigger",
          onClick: () => setShowLog(true)
        },
        /* @__PURE__ */ React.createElement(import_lucide_react5.History, { size: 14 }),
        " Transmission log",
        " ",
        /* @__PURE__ */ React.createElement("span", null, r.submissions.length)
      )),
      /* @__PURE__ */ React.createElement("div", { className: "mission-control-footer" }, /* @__PURE__ */ React.createElement(import_lucide_react5.Sparkles, { size: 12 }), submission ? "Evidence saved to your account" : "One mission. Your own discovery.")
    ),
    showLog && /* @__PURE__ */ React.createElement(
      Modal,
      {
        title: "Transmission log",
        kicker: "YOUR SAVED RESEARCH",
        close: () => setShowLog(false)
      },
      [...r.submissions].reverse().map((s) => /* @__PURE__ */ React.createElement("div", { className: "history-entry", key: s.id }, /* @__PURE__ */ React.createElement("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, "Open chat \xB7 ", formatDate(s.at)), /* @__PURE__ */ React.createElement("p", null, s.reason)))
    ),
    revise && /* @__PURE__ */ React.createElement(
      Modal,
      {
        title: "Update your transmission",
        kicker: "RESEARCH EVIDENCE",
        close: () => setRevise(false)
      },
      children
    )
  );
}

// components/SavedReflectionForm.js
var import_react6 = require("react");

// components/useSavedWork.js
var import_react5 = require("react");
var pendingWork = /* @__PURE__ */ new Map();
function useSavedWork({
  value,
  initialValue,
  initialVersion = 0,
  enabled,
  endpoint,
  ownerId,
  payload = {},
  buildBody,
  onSaved
}) {
  const [status, setStatus] = (0, import_react5.useState)("");
  const saved = (0, import_react5.useRef)(JSON.stringify(initialValue)), revision = (0, import_react5.useRef)(initialVersion);
  const queue = (0, import_react5.useRef)(Promise.resolve()), mounted = (0, import_react5.useRef)(true), latest = (0, import_react5.useRef)(null), flushRef = (0, import_react5.useRef)(null);
  const boundOwner = (0, import_react5.useRef)(ownerId);
  latest.current = {
    value,
    enabled: enabled && ownerId === boundOwner.current,
    endpoint,
    ownerId,
    payload,
    buildBody,
    onSaved
  };
  const flush = (override) => {
    const item = latest.current;
    if (!item.enabled) return queue.current.catch(() => {
    });
    const snapshot = structuredClone(override ?? item.value), key = JSON.stringify(snapshot);
    const pending = queue.current.catch(() => {
    }).then(async () => {
      if (key === saved.current) return;
      if (mounted.current) setStatus("Saving draft\u2026");
      const body = item.buildBody ? item.buildBody(snapshot, revision.current) : {
        ...item.payload,
        ...snapshot,
        ownerId: item.ownerId,
        draftVersion: revision.current
      };
      const response = await fetch(item.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Draft could not be saved.");
      if (result.expired)
        throw new Error(
          "The activity timer ended. Your last saved work is retained."
        );
      revision.current = result.draftVersion ?? result.attemptVersion ?? result.version ?? revision.current;
      saved.current = key;
      if (mounted.current) {
        setStatus("Draft saved to your account");
        item.onSaved?.(snapshot);
      }
    }).catch((error) => {
      if (mounted.current) setStatus(`Not saved: ${error.message}`);
      throw error;
    });
    queue.current = pending;
    pendingWork.set(pending, item.ownerId);
    pending.then(
      () => pendingWork.delete(pending),
      () => pendingWork.delete(pending)
    );
    return pending;
  };
  flushRef.current = flush;
  const changed = JSON.stringify(value);
  (0, import_react5.useEffect)(() => {
    if (!enabled || changed === saved.current) return;
    const timer = setTimeout(() => flushRef.current().catch(() => {
    }), 800);
    return () => clearTimeout(timer);
  }, [changed, enabled]);
  (0, import_react5.useEffect)(() => {
    mounted.current = true;
    const register = (e) => {
      if (e.detail.ownerId === boundOwner.current)
        e.detail.promises.push(flushRef.current());
    };
    const protect = (e) => {
      if (latest.current.enabled && JSON.stringify(latest.current.value) !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("codewild:flush-work", register);
    window.addEventListener("beforeunload", protect);
    return () => {
      mounted.current = false;
      window.removeEventListener("codewild:flush-work", register);
      window.removeEventListener("beforeunload", protect);
      flushRef.current().catch(() => {
      });
    };
  }, []);
  return {
    status,
    flush,
    restore: (next, version) => {
      saved.current = JSON.stringify(next);
      revision.current = version;
    },
    getVersion: () => revision.current,
    syncVersion: (version) => {
      if (JSON.stringify(latest.current.value) === saved.current)
        revision.current = version;
    }
  };
}

// components/SavedReflectionForm.js
function SavedReflectionForm({
  ownerId,
  draft,
  kind,
  day = 1,
  externalText,
  mode = "TEXT",
  onSubmit,
  ...props
}) {
  const initial = {
    text: draft?.text ?? draft?.value?.text ?? "",
    mode: draft?.mode || mode
  };
  const [value, setValue] = (0, import_react6.useState)(initial), [busy, setBusy] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)("");
  (0, import_react6.useEffect)(() => {
    if (externalText !== void 0 && externalText !== "")
      setValue((v) => ({ ...v, text: externalText, mode }));
  }, [externalText, mode]);
  const work = useSavedWork({
    value,
    initialValue: initial,
    initialVersion: draft?.revision || 0,
    enabled: !busy,
    ownerId,
    endpoint: day === 1 ? "/api/day1/reflection-draft" : "/api/week1/program/reflection-draft",
    payload: { kind, day }
  });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    Form,
    {
      ...props,
      key: externalText || kind,
      initial: { text: externalText || initial.text },
      onDraftChange: (v) => setValue({ text: v.text || "", mode }),
      onSubmit: async (v) => {
        setError("");
        try {
          await work.flush({ text: v.text || "", mode });
          setBusy(true);
          return await onSubmit(v);
        } catch (e) {
          setError(e.message);
          return false;
        } finally {
          setBusy(false);
        }
      }
    }
  ), /* @__PURE__ */ React.createElement("p", { className: "muted", role: "status" }, work.status || (draft ? "Saved draft restored" : "Your draft saves automatically."), " ", "\xB7 Drafts are not submitted work."), error && /* @__PURE__ */ React.createElement("p", { role: "alert" }, error));
}

// components/DayOneFeatures.js
var import_react8 = require("react");
var import_link2 = __toESM(require("next/link"), 1);
var import_lucide_react6 = require("lucide-react");

// components/DayOneSetup.js
var import_react7 = require("react");
var import_link = __toESM(require("next/link"), 1);

// lib/day-one-rules.js
var frozenRubric = [
  { key: "framing", name: "Problem framing", max: 6 },
  { key: "reasoning", name: "Investigation & reasoning", max: 7 },
  { key: "verification", name: "Experimentation & verification", max: 7 },
  { key: "communication", name: "Requirements communication", max: 8 },
  { key: "adaptability", name: "Initiative & adaptability", max: 5 }
];
function defaultSetup() {
  return {
    name: "Alpha Cohort 2026",
    timeZone: "Asia/Kolkata",
    day: "",
    startTime: "09:00",
    endTime: "17:00",
    availableAt: "",
    officialStart: "",
    clockCutoff: "",
    closingCutoff: "",
    revealAfter: "",
    weekdays: [1, 2, 3, 4, 5],
    holidays: [],
    durationMinutes: 90,
    genres: ["Automobiles", "Nature", "Economics", "Space"].map((name, i) => ({
      id: `genre-${i + 1}`,
      name,
      question: "",
      version: 1
    })),
    rubric: frozenRubric,
    rubricVersion: "wild6-day1-v2-33",
    rewardVersion: "day1-v1.2",
    markingInstructions: "",
    championPrompt: "",
    inaccessiblePolicy: "Allow a corrected link; retain every revision and reverify before assessment."
  };
}
function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(date)).map((p) => [p.type, p.value])
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: (/* @__PURE__ */ new Date(
      `${parts.year}-${parts.month}-${parts.day}T12:00:00Z`
    )).getUTCDay()
  };
}

// lib/day-one-setup.js
function scheduleInstant(day, time, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Choose a date and valid start and finish times.");
  const target = Date.parse(`${day}T${time}:00Z`);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = localParts(instant, zone);
    const difference = target - Date.parse(`${p.day}T${p.time}:00Z`);
    if (!difference && p.day === day && p.time === time)
      return new Date(instant).toISOString();
    instant += difference;
  }
  throw new Error(
    "That local time does not exist in your time zone. Choose another time."
  );
}
function suggestedResearchGroups(roster, saved = []) {
  const ids = roster.map((p) => p._id);
  const previous = saved.flatMap((g) => g.members || []);
  if (saved.length && saved.every((g) => g.members?.length === 5) && previous.length === ids.length && new Set(previous).size === ids.length && ids.every((id) => previous.includes(id)))
    return saved.map((g) => ({ members: [...g.members] }));
  return Array.from({ length: Math.ceil(ids.length / 5) }, (_, i) => ({
    members: ids.slice(i * 5, i * 5 + 5)
  }));
}
function preparedSetupMatches(draft, prepared) {
  if (!draft || !prepared) return false;
  const comparable = (c) => ({
    schedule: [
      c.day,
      c.timeZone,
      c.startTime,
      c.endTime,
      c.availableAt,
      c.officialStart,
      c.clockCutoff,
      c.closingCutoff,
      c.revealAfter
    ],
    calendar: [c.weekdays, c.holidays],
    mode: c.selectionMode || "legacy",
    questions: c.selectionMode === "research-2026-11-12" ? [
      c.questionSelection,
      c.bankApproval,
      (c.researchGroups || []).map((g) => g.members)
    ] : c.genres?.map((g) => [g.id, g.name, g.question])
  });
  return JSON.stringify(comparable(draft)) === JSON.stringify(comparable(prepared));
}
function buildDayOneSetup(base, values) {
  const defaults = defaultSetup();
  const zone = base.timeZone || "Asia/Kolkata";
  const complete = Boolean(values.day && values.startTime && values.endTime);
  if (!complete && values.preparing)
    throw new Error("Choose the Day 1 date, start time and finish time.");
  const start = complete ? scheduleInstant(values.day, values.startTime, zone) : "";
  const end = complete ? scheduleInstant(values.day, values.endTime, zone) : "";
  if (complete && Date.parse(start) >= Date.parse(end))
    throw new Error("Finish time must be after start time.");
  if (complete && Date.parse(end) - Date.parse(start) < 90 * 6e4)
    throw new Error("Allow at least 90 minutes for the research mission.");
  const weekday = complete ? localParts(start, zone).weekday : null;
  const config = {
    ...defaults,
    ...base,
    name: base.name || defaults.name,
    timeZone: zone,
    day: values.day,
    startTime: values.startTime,
    endTime: values.endTime,
    selectionMode: values.selectionMode,
    availableAt: start,
    officialStart: start,
    clockCutoff: complete ? new Date(Date.parse(start) + 30 * 6e4).toISOString() : "",
    closingCutoff: end,
    revealAfter: !complete ? "" : base.revealAfter && Date.parse(base.revealAfter) >= Date.parse(end) ? base.revealAfter : new Date(Date.parse(end) + 7 * 864e5).toISOString(),
    weekdays: [
      .../* @__PURE__ */ new Set([
        ...base.weekdays || defaults.weekdays,
        ...weekday == null ? [] : [weekday]
      ])
    ],
    holidays: (base.holidays || []).filter((day) => day !== values.day),
    rubric: defaults.rubric,
    rubricVersion: defaults.rubricVersion,
    rewardVersion: defaults.rewardVersion,
    markingInstructions: base.markingInstructions || "Rate all five observable criteria from zero to four using the submitted evidence. Explain each rating and verify claims. Human review is required before approval.",
    championPrompt: base.championPrompt || "Explain one verified research claim, demonstrate your reasoning without assistance, and describe one limitation and the independent evidence used.",
    inaccessiblePolicy: base.inaccessiblePolicy || defaults.inaccessiblePolicy
  };
  if (values.selectionMode === "research-2026-11-12") {
    const groups = values.groups || [];
    const members = groups.flatMap((g) => g.members);
    const ids = values.roster.map((p) => p._id);
    if (values.preparing && (!groups.length || groups.some((g) => g.members.length !== 5) || members.length !== ids.length || new Set(members).size !== ids.length || ids.some((id) => !members.includes(id))))
      throw new Error(
        "Put every active player into one research group of exactly five."
      );
    if (values.preparing && !values.reviewed)
      throw new Error(
        "Review all 51 questions and confirm the question bank before preparing Day 1."
      );
    config.researchGroups = groups.map((g) => ({ members: [...g.members] }));
    config.questionSelection = "PLAYER_CHOICE";
    config.bankApproval = values.reviewed ? base.bankApproval || "Centre Command confirmed review of all 51 supplied research questions, including Movies, Social Media and Relationships, for this cohort." : "";
  }
  return config;
}

// components/DayOneSetup.js
var RESEARCH = "research-2026-11-12";
function DayOneSetup({ data, act }) {
  const [feedback, setFeedback] = (0, import_react7.useState)(null);
  const [opening, setOpening] = (0, import_react7.useState)(false);
  const [dirty, setDirty] = (0, import_react7.useState)(false);
  const d = data.dayOne;
  if (!d?.draft) return null;
  return /* @__PURE__ */ React.createElement(
    Panel,
    {
      title: "Day 1 setup",
      kicker: "SCHEDULE / RESEARCH / READY TO PLAY",
      action: /* @__PURE__ */ React.createElement(Badge, null, d.state),
      className: "day-one-setup"
    },
    /* @__PURE__ */ React.createElement("div", { className: "day-setup-body" }, /* @__PURE__ */ React.createElement("p", { className: "day-setup-intro" }, "Set the schedule and check your research groups. The game handles the scoring rules and research timer."), feedback && /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `day-setup-feedback ${feedback.error ? "is-error" : ""}`,
        role: feedback.error ? "alert" : "status"
      },
      feedback.message
    ), d.state === "PREPARED" && (!dirty && preparedSetupMatches(d.draft, d.preparedConfig) ? /* @__PURE__ */ React.createElement("div", { className: "day-setup-launch" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Day 1 is prepared."), /* @__PURE__ */ React.createElement("p", null, "Open it when you want players to enter Level 1."), !data.weekOne.rulesVersion && /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement(import_link.default, { href: "/centre-command/week-one-rules-approvals" }, "Publish Game Rules"), " ", "before opening Day 1.")), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn primary",
        disabled: opening || !data.weekOne.rulesVersion,
        onClick: async () => {
          setOpening(true);
          try {
            const result = await act(
              "week1/open",
              { day: 1, revision: data.weekOne.revision },
              "Day 1 is live. Players can enter Level 1."
            );
            if (result) setFeedback(null);
            else
              setFeedback({
                error: true,
                message: "Day 1 could not open. Check the error and try again."
              });
          } catch (error) {
            setFeedback({
              error: true,
              message: error.message || "Day 1 could not open. Please try again."
            });
          } finally {
            setOpening(false);
          }
        }
      },
      opening ? "Opening\u2026" : "Open Day 1"
    )) : /* @__PURE__ */ React.createElement("p", { className: "day-setup-feedback" }, "Your changes need to be prepared before Day 1 can open. Use Prepare updated setup below.")), d.state === "OPEN" && /* @__PURE__ */ React.createElement("p", { className: "day-setup-feedback", role: "status" }, "Day 1 is live. Players can enter Level 1. The released schedule and questions are locked."), d.state === "CLOSED" && /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Day 1 is closed. Its released content is kept for review."), /* @__PURE__ */ React.createElement(
      SetupForm,
      {
        key: d.revision,
        data,
        act,
        report: (feedback2) => {
          setFeedback(feedback2);
          if (!feedback2) setDirty(true);
          else if (!feedback2.error) setDirty(false);
        }
      }
    ))
  );
}
function SetupForm({ data, act, report }) {
  const d = data.dayOne;
  const locked = ["OPEN", "CLOSED"].includes(d.state);
  const base = locked ? d.preparedConfig || d.config || d.draft : d.draft;
  const roster = d.roster || [];
  const [values, setValues] = (0, import_react7.useState)({
    day: base.day || "",
    startTime: base.startTime || "09:00",
    endTime: base.endTime || "17:00",
    selectionMode: base.selectionMode || (base.version ? "legacy" : RESEARCH)
  });
  const [groups, setGroups] = (0, import_react7.useState)(
    () => suggestedResearchGroups(roster, base.researchGroups)
  );
  const [reviewed, setReviewed] = (0, import_react7.useState)(Boolean(base.bankApproval));
  const [legacyQuestions, setLegacyQuestions] = (0, import_react7.useState)(
    () => base.genres?.length === 4 ? base.genres : defaultSetup().genres
  );
  const [editingGroups, setEditingGroups] = (0, import_react7.useState)(false);
  const [busy, setBusy] = (0, import_react7.useState)(false);
  const pending = (0, import_react7.useRef)(false);
  const research = values.selectionMode === RESEARCH;
  const change = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    report(null);
  };
  const nameOf = (id) => roster.find((p) => p._id === id)?.name || id;
  return /* @__PURE__ */ React.createElement(
    "form",
    {
      onSubmit: async (event) => {
        event.preventDefault();
        if (pending.current || locked) return;
        const preparing = event.nativeEvent.submitter?.value === "prepare";
        const fields = new FormData(event.currentTarget);
        const submitted = Object.fromEntries(
          ["day", "startTime", "endTime", "selectionMode"].map((key) => [
            key,
            String(fields.get(key) || "")
          ])
        );
        const submittedGroups = editingGroups ? groups.map((_, i) => ({
          members: roster.filter((p) => Number(fields.get(`group:${p._id}`)) === i).map((p) => p._id)
        })) : groups;
        const submittedLegacy = legacyQuestions.map((g, i) => ({
          ...g,
          name: String(fields.get(`genre:${i}`) ?? g.name),
          question: String(fields.get(`question:${i}`) ?? g.question)
        }));
        setValues(submitted);
        pending.current = true;
        setBusy(true);
        report(null);
        try {
          const config = buildDayOneSetup(
            submitted.selectionMode === RESEARCH ? base : { ...base, genres: submittedLegacy },
            {
              ...submitted,
              groups: submittedGroups,
              roster,
              reviewed: fields.get("reviewed") === "on",
              preparing
            }
          );
          const result = await act(
            `day1/${preparing ? "release" : "save-setup"}`,
            { config, revision: d.revision },
            preparing ? "Day 1 prepared. Open it when you are ready." : "Draft saved. Day 1 has not opened yet."
          );
          report(
            result ? {
              message: preparing ? "Prepared successfully. Use Open Day 1 above to let players in." : "Draft saved. Players cannot enter until you prepare and open Day 1."
            } : {
              error: true,
              message: "Not saved. Check the error and try again. Your entries are still here."
            }
          );
        } catch (error) {
          report({ error: true, message: error.message });
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }
    },
    /* @__PURE__ */ React.createElement("fieldset", { disabled: busy || locked }, /* @__PURE__ */ React.createElement("legend", { className: "sr-only" }, "Day 1 schedule and research"), /* @__PURE__ */ React.createElement("div", { className: "day-setup-schedule" }, /* @__PURE__ */ React.createElement("label", null, "Day 1 date", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        name: "day",
        required: true,
        defaultValue: values.day,
        onInput: (e) => change("day", e.target.value)
      }
    )), /* @__PURE__ */ React.createElement("label", null, "Start time", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "time",
        name: "startTime",
        required: true,
        defaultValue: values.startTime,
        onInput: (e) => change("startTime", e.target.value)
      }
    )), /* @__PURE__ */ React.createElement("label", null, "Finish time", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "time",
        name: "endTime",
        required: true,
        defaultValue: values.endTime,
        onInput: (e) => change("endTime", e.target.value)
      }
    ))), /* @__PURE__ */ React.createElement("p", { className: "day-setup-note" }, "Times use ", base.timeZone || "Asia/Kolkata", ". Clock-in closes 30 minutes after the start. Research lasts 90 minutes; submissions and reflections close at the finish time."), /* @__PURE__ */ React.createElement("label", { className: "day-setup-mode" }, "Research game", /* @__PURE__ */ React.createElement(
      "select",
      {
        name: "selectionMode",
        value: values.selectionMode,
        onChange: (e) => change("selectionMode", e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: RESEARCH }, "Seven genre cards \xB7 choose one of three questions"),
      /* @__PURE__ */ React.createElement("option", { value: "legacy" }, "Four configured questions \xB7 existing game")
    )), research ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "day-setup-group-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Five-person research groups"), /* @__PURE__ */ React.createElement("p", null, roster.length, " players \xB7 separate from final expedition teams")), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn small",
        "aria-expanded": editingGroups,
        onClick: () => setEditingGroups((v) => !v)
      },
      editingGroups ? "Done editing" : "Edit groups"
    )), /* @__PURE__ */ React.createElement("div", { className: "day-setup-groups" }, groups.map((g, i) => /* @__PURE__ */ React.createElement("section", { key: i, "aria-label": `Research group ${i + 1}` }, /* @__PURE__ */ React.createElement("h4", null, "Group ", i + 1, /* @__PURE__ */ React.createElement("span", { className: g.members.length === 5 ? "" : "is-error" }, g.members.length, "/5")), /* @__PURE__ */ React.createElement("p", null, g.members.map(nameOf).join(", ") || "No players yet")))), editingGroups && /* @__PURE__ */ React.createElement("div", { className: "day-setup-group-editor" }, roster.map((p) => /* @__PURE__ */ React.createElement("label", { key: p._id }, p.name, /* @__PURE__ */ React.createElement(
      "select",
      {
        name: `group:${p._id}`,
        "aria-label": `Research group for ${p.name}`,
        value: groups.findIndex((g) => g.members.includes(p._id)),
        onChange: (e) => {
          const target = Number(e.target.value);
          setGroups(
            (previous) => previous.map((g, i) => ({
              members: i === target ? [
                ...g.members.filter((id) => id !== p._id),
                p._id
              ] : g.members.filter((id) => id !== p._id)
            }))
          );
          report(null);
        }
      },
      groups.map((_, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, "Group ", i + 1))
    )))), /* @__PURE__ */ React.createElement("div", { className: "day-setup-bank" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn small",
        type: "button",
        onClick: async () => {
          const bank = await act(
            "day1/research-bank",
            {},
            "Question bank ready for review."
          );
          if (!bank) return;
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(bank, null, 2)], {
              type: "application/json"
            })
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "codewild-research-questions.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1e3);
        }
      },
      "Download questions to review"
    ), /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        name: "reviewed",
        checked: reviewed,
        onChange: (e) => {
          setReviewed(e.target.checked);
          report(null);
        }
      }
    ), "I have reviewed all 51 questions for this cohort."))) : /* @__PURE__ */ React.createElement("details", { className: "day-setup-legacy" }, /* @__PURE__ */ React.createElement("summary", null, "Edit the four existing questions"), /* @__PURE__ */ React.createElement("p", null, "The saved questions are retained. Use the seven-genre game for the new research flow."), legacyQuestions.map((g, i) => /* @__PURE__ */ React.createElement("div", { key: g.id }, /* @__PURE__ */ React.createElement("label", null, "Genre ", i + 1, /* @__PURE__ */ React.createElement(
      "input",
      {
        name: `genre:${i}`,
        value: g.name,
        onChange: (e) => {
          setLegacyQuestions(
            (q) => q.map(
              (x, j) => j === i ? { ...x, name: e.target.value } : x
            )
          );
          report(null);
        }
      }
    )), /* @__PURE__ */ React.createElement("label", null, "Question ", i + 1, /* @__PURE__ */ React.createElement(
      "textarea",
      {
        rows: 3,
        name: `question:${i}`,
        value: g.question,
        onChange: (e) => {
          setLegacyQuestions(
            (q) => q.map(
              (x, j) => j === i ? { ...x, question: e.target.value } : x
            )
          );
          report(null);
        }
      }
    ))))), !locked && /* @__PURE__ */ React.createElement("div", { className: "day-setup-actions" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        type: "submit",
        value: "draft",
        formNoValidate: true,
        disabled: busy
      },
      "Save draft"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn primary",
        type: "submit",
        value: "prepare",
        disabled: busy
      },
      busy ? "Saving\u2026" : d.state === "PREPARED" ? "Prepare updated setup" : "Prepare Day 1"
    ), /* @__PURE__ */ React.createElement("p", null, "Preparing checks the setup. Players enter only after you open Day 1."))),
    /* @__PURE__ */ React.createElement("p", { className: "day-setup-footer" }, /* @__PURE__ */ React.createElement(import_link.default, { href: "/centre-command/week-one" }, "Command Centre & day releases"), " ", "\xB7 Assessment rules and reward limits stay unchanged.")
  );
}

// components/DayOneFeatures.js
function Panel2({ children, bare = false, ...props }) {
  if (bare) return /* @__PURE__ */ React.createElement("div", { className: "sky-research-content" }, children);
  return /* @__PURE__ */ React.createElement(Panel, { ...props }, /* @__PURE__ */ React.createElement(
    "div",
    {
      style: { padding: "18px 22px", display: "grid", gap: 16, minWidth: 0 }
    },
    children
  ));
}
var fmt = (date, zone = "Asia/Kolkata") => {
  if (!date) return "Pending";
  try {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: zone,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return new Date(date).toISOString();
  }
};
var own = (data) => data.dayOne?.records.find((r) => r.userId === data.user._id);
var send = (act, action, record, values = {}) => act(`day1/${action}`, {
  ...values,
  ...record ? { version: record.version } : {}
});
function isDayOne(data, now = /* @__PURE__ */ new Date()) {
  return ["OPEN", "CLOSED"].includes(data.dayOne?.state) && !data.weekOne?.days.some((d) => d.day > 1 && d.state === "OPEN");
}
var textField = (name, label, min = 10) => ({
  name,
  label,
  type: "textarea",
  min
});
function DayOneCheckIn({ data, act, now }) {
  const r = own(data), c = r?.config || data.dayOne?.config;
  if (!c) return null;
  return /* @__PURE__ */ React.createElement(
    Panel2,
    {
      title: "Daily camp check-in",
      kicker: "DAY 1 / DISCOVERY MISSION",
      className: "punch-panel",
      action: /* @__PURE__ */ React.createElement(import_lucide_react6.Clock3, { size: 19 })
    },
    /* @__PURE__ */ React.createElement("div", { className: "punch-clock" }, new Date(now).toLocaleTimeString("en-GB", {
      timeZone: c.timeZone,
      hour: "2-digit",
      minute: "2-digit"
    }), /* @__PURE__ */ React.createElement("span", null, c.timeZone)),
    /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Clock-in cut-off: ", fmt(c.clockCutoff, c.timeZone), ". Your player balance is shared across all programme stages."),
    r?.clockAt ? /* @__PURE__ */ React.createElement(Receipt, null, "Clocked in ", fmt(r.clockAt, c.timeZone), ". ", r.trophies, "/20 Day 1 trophies.") : /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn primary full",
        disabled: data.dayOne?.state !== "OPEN",
        onClick: () => send(act, "clock", r)
      },
      "Check in at camp"
    )
  );
}
function DayOneRewards({ data }) {
  const r = own(data);
  if (!r) return null;
  const names = {
    clock: "On-time clock-in",
    sod: "Start-of-day plan",
    agenda: "Agenda acknowledged within 30 official minutes",
    acknowledge: "Challenge acknowledgement",
    submission: "Verified on-time AI thread",
    eod: "On-time EOD"
  };
  return /* @__PURE__ */ React.createElement(
    Panel2,
    {
      title: "Day 1 discovery rewards",
      kicker: "PERSONAL / SEPARATE FROM YOUR RESEARCH BASELINE",
      action: /* @__PURE__ */ React.createElement(Badge, { tone: "amber" }, r.trophies, "/20 TROPHIES")
    },
    /* @__PURE__ */ React.createElement("div", { className: "button-row" }, /* @__PURE__ */ React.createElement(PlayerVitals, { player: data.user }), /* @__PURE__ */ React.createElement(Badge, { tone: r.badge ? "lime" : "" }, "FIRST DISCOVERY \xB7 ", r.badge ? "EARNED" : "PENDING LINK VERIFICATION"), /* @__PURE__ */ React.createElement(Badge, null, /* @__PURE__ */ React.createElement(import_lucide_react6.LockKeyhole, { size: 12 }), " RESEARCH CHAMPION \xB7", " ", r.champion ? "AWARDED" : "WEEK 1 REVEAL")),
    r.champion && /* @__PURE__ */ React.createElement("div", { className: "journal-entry" }, /* @__PURE__ */ React.createElement("h3", null, "Your Research Champion verification prompt"), /* @__PURE__ */ React.createElement("p", null, r.champion.prompt)),
    /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "Trophy evidence and amendment history"), r.ledger.map((l) => /* @__PURE__ */ React.createElement("div", { className: "ledger-row", key: l.id }, /* @__PURE__ */ React.createElement(import_lucide_react6.Trophy, { size: 17 }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, names[l.rule]), /* @__PURE__ */ React.createElement("small", null, fmt(l.eventTime, r.config.timeZone), " \xB7 ", l.reason)), /* @__PURE__ */ React.createElement("b", { className: "lime-text" }, l.amount > 0 ? "+" : "", l.amount))), !r.ledger.length && /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Qualifying events appear here as your day progresses."))
  );
}
function DiscoveryMission({ data, act, now, game = false }) {
  const r = own(data), c = r?.config || data.dayOne?.config;
  if (!c)
    return /* @__PURE__ */ React.createElement(Empty, { title: "Discovery mission is being prepared" }, "Centre Command can configure and release Day 1 from the existing Expedition Setup page.");
  if (!r) return /* @__PURE__ */ React.createElement(DayOneCheckIn, { data, act, now });
  const g = c.genres.find((g2) => g2.id === r.genreId), s = r.submissions.at(-1);
  const remaining = r.startedAt ? Math.max(0, new Date(r.deadline) - new Date(now)) : 90 * 6e4;
  const timer = `${String(Math.floor(remaining / 6e4)).padStart(2, "0")}:${String(Math.floor(remaining / 1e3) % 60).padStart(2, "0")}`;
  if (game && c.selectionMode === "research-2026-11-12")
    return /* @__PURE__ */ React.createElement(
      "fieldset",
      {
        disabled: data.dayOne?.state !== "OPEN",
        className: "flight-discovery-fieldset"
      },
      !g ? data.dayOne?.state === "OPEN" ? /* @__PURE__ */ React.createElement(
        ResearchGenrePicker2,
        {
          act,
          recordId: r._id,
          interactive: c.questionSelection === "PLAYER_CHOICE",
          game: true
        }
      ) : /* @__PURE__ */ React.createElement("p", { className: "flight-closed-notice" }, "This mission is closed. Your saved work remains in your profile.") : /* @__PURE__ */ React.createElement(
        FlightResearchMission,
        {
          record: r,
          config: c,
          question: g,
          act,
          timer,
          remaining,
          open: data.dayOne?.state === "OPEN"
        }
      )
    );
  return /* @__PURE__ */ React.createElement(
    "fieldset",
    {
      disabled: data.dayOne?.state !== "OPEN",
      style: { border: 0, padding: 0, margin: 0, minWidth: 0 }
    },
    /* @__PURE__ */ React.createElement(
      Panel2,
      {
        bare: game && !g,
        title: game ? "Your discovery mission" : "Individual discovery mission",
        kicker: game ? "LEVEL 1 / RESEARCH CHECKPOINT" : "DAY 1 / EXTERNAL AI / 90 MINUTES",
        action: /* @__PURE__ */ React.createElement(Badge, { tone: "cyan" }, /* @__PURE__ */ React.createElement(import_lucide_react6.Clock3, { size: 14 }), timer)
      },
      !game && /* @__PURE__ */ React.createElement("p", { className: "muted" }, c.questionSelection === "PLAYER_CHOICE" ? "Choose a genre, select and lock one of its three questions, then acknowledge it and begin your research." : "Choose a genre, acknowledge the question, then begin your research.", " ", "Your timer persists after refresh and re-login."),
      c.selectionMode === "research-2026-11-12" && !r.researchAssignment && data.dayOne?.state === "OPEN" && /* @__PURE__ */ React.createElement(
        ResearchGenrePicker2,
        {
          act,
          recordId: r._id,
          interactive: c.questionSelection === "PLAYER_CHOICE",
          game
        }
      ),
      c.selectionMode !== "research-2026-11-12" && !r.acknowledgedAt && /* @__PURE__ */ React.createElement(
        Form,
        {
          key: `genre-${r.version}`,
          fields: [
            {
              name: "genreId",
              label: "Choose your research genre",
              options: c.genres.map((g2) => ({ value: g2.id, label: g2.name }))
            }
          ],
          initial: { genreId: r.genreId },
          submit: "Choose genre",
          onSubmit: (v) => send(act, "genre", r, v)
        }
      ),
      g && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "journal-entry" }, /* @__PURE__ */ React.createElement(Badge, null, "QUESTION V", g.version), c.questionSelection === "PLAYER_CHOICE" && r.researchAssignment && /* @__PURE__ */ React.createElement(Receipt, null, "Question locked", " ", fmt(r.researchAssignment.assignedAt, c.timeZone)), /* @__PURE__ */ React.createElement("h3", null, g.name), /* @__PURE__ */ React.createElement("p", null, g.question)), !r.acknowledgedAt ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Available ", fmt(r.availableAt, c.timeZone), ". Acknowledge within 30 working minutes for +5 trophies, or within 60 for +2."), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "btn primary",
          onClick: () => send(act, "acknowledge", r)
        },
        "Acknowledge challenge"
      )) : /* @__PURE__ */ React.createElement(Receipt, null, "Acknowledged ", fmt(r.acknowledgedAt, c.timeZone))),
      r.acknowledgedAt && !r.startedAt && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Find today's agenda in", " ", /* @__PURE__ */ React.createElement(import_link2.default, { href: "/gamer/daily-journal" }, "Meeting Announcements in your journal"), ". Acknowledge within 30 minutes of the official start for 4 trophies."), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "btn primary",
          onClick: () => send(act, "start", r)
        },
        "Begin 90-minute research"
      )),
      r.startedAt && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Receipt, null, "Research began ", fmt(r.startedAt, c.timeZone), ".", " ", remaining > 0 ? `${timer} remaining.` : "The 90-minute window has ended; late work can still earn First Discovery after verification."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Use an external AI tool and submit one shareable conversation-thread URL. Centre Command checks access and enters ratings manually."), /* @__PURE__ */ React.createElement(
        ResearchThreadForm,
        {
          key: s?.id || r._id,
          record: r,
          act,
          open: data.dayOne?.state === "OPEN"
        }
      )),
      s && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement(
        Badge,
        {
          tone: r.verification?.status === "VERIFIED" ? "lime" : "amber"
        },
        r.verification?.status
      ), " ", /* @__PURE__ */ React.createElement(
        "a",
        {
          className: "text-link",
          href: s.url,
          target: "_blank",
          rel: "noopener noreferrer"
        },
        "View submitted AI thread"
      )), r.verification?.reason && /* @__PURE__ */ React.createElement("p", { className: "muted" }, r.verification.reason), /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "Submission revision history"), [...r.submissions].reverse().map((s2) => /* @__PURE__ */ React.createElement("div", { className: "history-entry", key: s2.id }, /* @__PURE__ */ React.createElement("a", { href: s2.url, target: "_blank", rel: "noopener noreferrer" }, s2.url), /* @__PURE__ */ React.createElement("p", null, s2.reason), /* @__PURE__ */ React.createElement("small", null, fmt(s2.at, c.timeZone))))))
    ),
    !game && /* @__PURE__ */ React.createElement(DayOneRewards, { data }),
    /* @__PURE__ */ React.createElement("p", { className: "muted" }, /* @__PURE__ */ React.createElement(import_lucide_react6.LockKeyhole, { size: 13 }), " Your research baseline and ranking remain private. Trophies never change your research score.")
  );
}
function FlightResearchMission({
  record: r,
  config: c,
  question: g,
  act,
  timer,
  remaining,
  open
}) {
  const [busy, setBusy] = (0, import_react8.useState)(false), [error, setError] = (0, import_react8.useState)("");
  const submission = r.submissions.at(-1);
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      if (!await send(act, action, r))
        setError("Your action was not confirmed. Please try again.");
    } catch (e) {
      setError(e.message || "Could not save your mission. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ React.createElement(
    FlightMissionBriefing,
    {
      record: r,
      question: g,
      timer,
      remaining,
      busy,
      error,
      onAction: run,
      formatDate: (at) => fmt(at, c.timeZone)
    },
    r.startedAt && /* @__PURE__ */ React.createElement(
      ResearchThreadForm,
      {
        key: submission?.id || r._id,
        record: r,
        act,
        open,
        game: true
      }
    )
  );
}
function ResearchThreadForm({ record, act, open, game = false }) {
  const submission = record.submissions.at(-1);
  const initial = record.draft?.url ?? submission?.url ?? "";
  const [url, setUrl] = (0, import_react8.useState)(initial), [reason, setReason] = (0, import_react8.useState)("");
  const [status, setStatus] = (0, import_react8.useState)(record.draft ? "Draft restored" : "");
  const [submitting, setSubmitting] = (0, import_react8.useState)(false);
  const work = useSavedWork({
    value: { url },
    initialValue: { url: initial },
    initialVersion: record.draft?.revision || 0,
    enabled: open && !submitting,
    ownerId: record.userId,
    endpoint: "/api/day1/draft"
  });
  return /* @__PURE__ */ React.createElement(
    "form",
    {
      className: `field-form ${game ? "mission-transmission-form" : ""}`,
      "aria-busy": submitting,
      onSubmit: async (event) => {
        event.preventDefault();
        if (submitting) return;
        try {
          const pending = work.flush();
          setSubmitting(true);
          await pending;
          const confirmed = await send(act, "submit", record, {
            url,
            ...submission ? { reason } : {}
          });
          if (!confirmed)
            throw new Error(
              "Transmission was not confirmed. Your link is still here; please try again."
            );
        } catch (error) {
          setStatus(error.message);
        } finally {
          setSubmitting(false);
        }
      }
    },
    game && /* @__PURE__ */ React.createElement("div", { className: "mission-transmission-heading" }, /* @__PURE__ */ React.createElement(import_lucide_react6.Radio, { size: 15 }), " TRANSMISSION BAY"),
    /* @__PURE__ */ React.createElement("label", null, game ? /* @__PURE__ */ React.createElement("span", { className: "mission-link-label" }, /* @__PURE__ */ React.createElement(import_lucide_react6.Link2, { size: 14 }), " Shared AI conversation") : "External AI conversation-thread URL", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "url",
        required: true,
        minLength: 10,
        maxLength: 2e3,
        value: url,
        disabled: submitting || !open,
        placeholder: game ? "Paste your shared chat link" : void 0,
        onChange: (event) => {
          setStatus("");
          setUrl(event.target.value);
        }
      }
    )),
    submission && /* @__PURE__ */ React.createElement("label", null, "Reason for revising the link", /* @__PURE__ */ React.createElement(
      "textarea",
      {
        required: true,
        minLength: 10,
        maxLength: 2e3,
        value: reason,
        disabled: submitting || !open,
        onChange: (event) => setReason(event.target.value)
      }
    )),
    /* @__PURE__ */ React.createElement("small", { role: "status" }, status.startsWith("Draft") ? work.status || status : status || work.status),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn primary",
        disabled: submitting || !open,
        type: "submit"
      },
      submitting ? game ? "Transmitting\u2026" : "Saving\u2026" : submission ? "Save revised AI thread" : game ? "Transmit research chat" : "Submit AI thread",
      game && /* @__PURE__ */ React.createElement(import_lucide_react6.Send, { size: 16 })
    )
  );
}
function DayOneReflection({ data, act }) {
  const r = own(data), [transcript, setTranscript] = (0, import_react8.useState)(""), [voice, setVoice] = (0, import_react8.useState)(false), [listening, setListening] = (0, import_react8.useState)(false), [error, setError] = (0, import_react8.useState)("");
  const recognition = (0, import_react8.useRef)(null), root = (0, import_react8.useRef)(null);
  (0, import_react8.useEffect)(() => () => recognition.current?.abort(), []);
  function dictate() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setError(
        "Voice dictation is unavailable in this browser. Please type your reflection."
      );
      return;
    }
    const speech = new Speech();
    recognition.current = speech;
    speech.lang = "en-IN";
    speech.continuous = true;
    setTranscript(
      root.current?.querySelector('textarea[name="text"]')?.value || ""
    );
    speech.onresult = (e) => {
      let words = "";
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) words += e.results[i][0].transcript + " ";
      setTranscript((t) => `${t} ${words}`.trim());
      setVoice(true);
    };
    speech.onend = () => setListening(false);
    speech.onerror = (e) => {
      setError(`Voice dictation: ${e.error}. You can type instead.`);
      setListening(false);
    };
    setListening(true);
    setError("");
    try {
      speech.start();
    } catch {
      setListening(false);
      setError("Dictation could not start. Please use text.");
    }
  }
  return /* @__PURE__ */ React.createElement(
    Panel2,
    {
      title: "Day 1 EOD reflection",
      kicker: "TEXT OR REVIEWED VOICE TRANSCRIPT"
    },
    r.eod ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Receipt, null, "Saved ", fmt(r.eod.at, r.config.timeZone), " \xB7 ", r.eod.mode), /* @__PURE__ */ React.createElement("p", null, r.eod.text)) : /* @__PURE__ */ React.createElement("div", { ref: root }, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "What did you explore today? What surprised you? What did you verify? What would you investigate differently next time?"), /* @__PURE__ */ React.createElement("button", { className: "btn small", onClick: dictate }, /* @__PURE__ */ React.createElement(import_lucide_react6.Mic, { size: 14 }), listening ? "Stop dictation" : "Dictate reflection"), error && /* @__PURE__ */ React.createElement("p", { role: "alert", className: "danger-text" }, error), listening && /* @__PURE__ */ React.createElement("p", { role: "status" }, "Listening. Stop dictation, review the transcript, then save."), /* @__PURE__ */ React.createElement(
      SavedReflectionForm,
      {
        ownerId: data.user._id,
        draft: r.reflectionDrafts?.eod,
        kind: "eod",
        externalText: transcript,
        mode: voice ? "VOICE" : "TEXT",
        fields: [textField("text", "Day 1 reflection")],
        submit: "Save Day 1 EOD",
        onSubmit: (v) => listening ? false : send(act, "eod", r, { ...v, mode: voice ? "VOICE" : "TEXT" })
      }
    ))
  );
}
function DayOneDaily({ data, act, now }) {
  const r = own(data);
  if (!r) return /* @__PURE__ */ React.createElement(DayOneCheckIn, { data, act, now });
  return /* @__PURE__ */ React.createElement(
    "fieldset",
    {
      disabled: data.dayOne?.state !== "OPEN",
      style: { border: 0, padding: 0, margin: 0, minWidth: 0 }
    },
    /* @__PURE__ */ React.createElement(Panel2, { title: "Meeting Announcements", kicker: "DAY 1 AGENDA" }, data.dayOne.agenda ? /* @__PURE__ */ React.createElement(React.Fragment, null, !r.agendaViewedAt ? /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        onClick: () => send(act, "agenda-view", r)
      },
      "Open today's agenda"
    ) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { whiteSpace: "pre-wrap" } }, data.dayOne.agenda.text), r.agendaAcknowledgedAt ? /* @__PURE__ */ React.createElement(Receipt, null, "Agenda acknowledged", " ", fmt(r.agendaAcknowledgedAt, r.config.timeZone)) : /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn primary",
        onClick: () => send(act, "agenda-ack", r)
      },
      "I have read today's agenda"
    ))) : /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Today's agenda has not been published yet.")),
    /* @__PURE__ */ React.createElement("div", { className: "two-columns" }, /* @__PURE__ */ React.createElement(Panel2, { title: "Day 1 start-of-day plan", kicker: "YOUR RESEARCH PLAN" }, r.sod ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Receipt, null, "Saved ", fmt(r.sod.at, r.config.timeZone)), /* @__PURE__ */ React.createElement("p", null, r.sod.text)) : /* @__PURE__ */ React.createElement(
      SavedReflectionForm,
      {
        key: `${data.user._id}:${r._id}:sod`,
        ownerId: data.user._id,
        draft: r.reflectionDrafts?.sod,
        kind: "sod",
        fields: [textField("text", "What will you focus on today?")],
        submit: "Save Day 1 SOD",
        onSubmit: (v) => send(act, "sod", r, v)
      }
    )), /* @__PURE__ */ React.createElement(DayOneReflection, { data, act })),
    /* @__PURE__ */ React.createElement(Panel2, { title: "Class by MC", kicker: "CLASSROOM PLACEHOLDER" }, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Your Mission Commander delivers the class outside CODEWILD. This placeholder does not host lesson content."), r.classAt ? /* @__PURE__ */ React.createElement(Receipt, null, "Attendance recorded ", fmt(r.classAt, r.config.timeZone)) : /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => send(act, "class", r) }, "Record class attendance")),
    /* @__PURE__ */ React.createElement(
      Panel2,
      {
        title: "Workplace communication",
        kicker: "PROVISIONAL MARKER / MC REVIEW"
      },
      /* @__PURE__ */ React.createElement(
        Form,
        {
          fields: [textField("text", "Useful response and its context", 20)],
          submit: "Record workplace response",
          onSubmit: (v) => send(act, "response", r, v)
        }
      ),
      r.responses.map((x, i) => /* @__PURE__ */ React.createElement("div", { className: "history-entry", key: i }, /* @__PURE__ */ React.createElement("p", null, x.text), /* @__PURE__ */ React.createElement("small", null, fmt(x.at, r.config.timeZone))))
    ),
    /* @__PURE__ */ React.createElement(DayOneRewards, { data })
  );
}
function DayOneReview({ person, record: r, data, act }) {
  const cc = data.user.role === "CENTRE_COMMAND", s = r.submissions.at(-1);
  const review = (action, v) => send(act, action, r, { ...v, userId: r.userId });
  const ratings = r.config.rubric.flatMap((c, i) => [
    {
      name: `ai${i}`,
      label: `External AI: ${c.name} (0\u20134, max ${c.max} marks)`,
      type: "number",
      min: 0,
      max: 4
    },
    {
      name: `human${i}`,
      label: `Human: ${c.name} (0\u20134, max ${c.max} marks)`,
      type: "number",
      min: 0,
      max: 4
    }
  ]);
  return /* @__PURE__ */ React.createElement(
    Panel2,
    {
      title: `${person.name} \xB7 Day 1 review`,
      kicker: cc ? "PRIVATE EVIDENCE / 50-50 BASELINE" : "OPERATIONAL MARKERS / AUTHORISED REVIEW"
    },
    /* @__PURE__ */ React.createElement("div", { className: "button-row" }, /* @__PURE__ */ React.createElement(Badge, null, r.trophies, "/20 TROPHIES"), /* @__PURE__ */ React.createElement(Badge, { tone: r.badge ? "lime" : "amber" }, r.verification?.status || "NO SUBMISSION"), /* @__PURE__ */ React.createElement(PlayerVitals, { player: person })),
    /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Genre:", " ", r.config.genres.find((g) => g.id === r.genreId)?.name || (r.researchSelection ? `${r.researchSelection.genreName} \xB7 question not confirmed` : "Pending"), ". SOD: ", fmt(r.sod?.at, r.config.timeZone), ". EOD:", " ", fmt(r.eod?.at, r.config.timeZone), "."),
    /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "SOD, EOD and workplace evidence"), /* @__PURE__ */ React.createElement("p", null, r.sod?.text || "No SOD"), /* @__PURE__ */ React.createElement("p", null, r.eod?.text || "No EOD"), r.responses.map((x, i) => /* @__PURE__ */ React.createElement("p", { key: i }, x.text, " \xB7 ", fmt(x.at, r.config.timeZone)))),
    /* @__PURE__ */ React.createElement(
      Form,
      {
        key: `markers-${r.version}`,
        fields: [
          {
            name: "marker",
            label: "Behaviour marker",
            options: [
              { value: "sod", label: "Timely SOD" },
              { value: "eod", label: "Timely EOD" },
              { value: "acknowledged", label: "Challenge acknowledgement" },
              { value: "usefulResponse", label: "Useful workplace response" }
            ]
          },
          {
            name: "value",
            label: "Authorised decision",
            options: [
              { value: "true", label: "Observed / met" },
              { value: "false", label: "Not observed / not met" }
            ]
          },
          textField("reason", "Reason and supporting evidence")
        ],
        submit: "Save marker review",
        onSubmit: (v) => review("markers", { ...v, value: v.value === "true" })
      }
    ),
    r.startedAt && /* @__PURE__ */ React.createElement(
      Form,
      {
        fields: [
          {
            name: "deadline",
            label: "Authorised extension deadline (ISO with time-zone offset)"
          },
          textField("reason", "Extension evidence and reason")
        ],
        submit: "Extend the Day 1 research window",
        onSubmit: (values) => review("extend", values)
      }
    ),
    cc && s && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "a",
      {
        className: "btn",
        href: s.url,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "View submitted AI thread"
    ), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Submitted ", fmt(s.at, r.config.timeZone), ". Verify access manually before marking."), /* @__PURE__ */ React.createElement(
      Form,
      {
        key: `verify-${r.version}`,
        fields: [
          {
            name: "status",
            label: "Link access",
            options: [
              { value: "VERIFIED", label: "Accessible / verified" },
              {
                value: "INACCESSIBLE",
                label: "Inaccessible / correction needed"
              }
            ]
          },
          textField("reason", "Verification note")
        ],
        initial: { status: r.verification?.status },
        submit: "Save link verification",
        onSubmit: (v) => review("verify", { ...v, revisionId: s.id })
      }
    ), r.verification?.status === "VERIFIED" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "External-AI marking instructions"), /* @__PURE__ */ React.createElement("p", null, r.config.markingInstructions)), /* @__PURE__ */ React.createElement(
      Form,
      {
        key: `assessment-${r.version}`,
        fields: [
          ...ratings,
          textField("notes", "Assessment evidence and rationale")
        ],
        initial: {
          ...Object.fromEntries(
            r.config.rubric.flatMap((c, i) => [
              [`ai${i}`, r.assessment?.ai[i] ?? ""],
              [`human${i}`, r.assessment?.human[i] ?? ""]
            ])
          ),
          notes: r.assessment?.notes
        },
        submit: "Save private baseline ratings",
        onSubmit: (v) => review("assessment", {
          ai: r.config.rubric.map((_, i) => v[`ai${i}`]),
          human: r.config.rubric.map((_, i) => v[`human${i}`]),
          notes: v.notes
        })
      }
    )), r.assessment && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Receipt, null, "Private baseline ", r.assessment.total.toFixed(2), "/", r.assessment.max, ". Other eight criteria Not Assessed."), r.assessment.approvedAt ? /* @__PURE__ */ React.createElement(Badge, { tone: "lime" }, "BASELINE APPROVED") : /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn primary",
        onClick: () => review("approve", {})
      },
      "Approve private baseline"
    ))),
    /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "Submission revisions and reward audit"), r.submissions.map((s2) => /* @__PURE__ */ React.createElement("div", { className: "history-entry", key: s2.id }, /* @__PURE__ */ React.createElement("a", { href: s2.url, target: "_blank", rel: "noopener noreferrer" }, s2.url), /* @__PURE__ */ React.createElement("p", null, fmt(s2.at, r.config.timeZone), " \xB7 ", s2.reason))), r.ledger.map((l) => /* @__PURE__ */ React.createElement("div", { className: "ledger-row", key: l.id }, /* @__PURE__ */ React.createElement("span", null, l.rule, " \xB7 ", l.reason), /* @__PURE__ */ React.createElement("b", null, l.amount > 0 ? "+" : "", l.amount))))
  );
}
function DayOneCohort({ data, act, now }) {
  const d = data.dayOne, [selected, setSelected] = (0, import_react8.useState)(""), [search, setSearch] = (0, import_react8.useState)(""), [filter, setFilter] = (0, import_react8.useState)("all");
  if (!d?.config) return null;
  const cc = data.user.role === "CENTRE_COMMAND", people = d.roster.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => ({ ...p, r: d.records.find((r) => r.userId === p._id) })).filter(
    (p) => filter === "all" || filter === "missing" && !p.r?.submissions.length || filter === "eod" && !p.r?.eod || filter === "review" && p.r?.submissions.length && (!cc || !p.r.assessment?.approvedAt)
  );
  const person = d.roster.find((p) => p._id === selected), record = d.records.find((r) => r.userId === selected), champion = d.champion;
  const ranks = [...d.records].filter((r) => r.assessment?.approvedAt).sort((a, b) => b.assessment.total - a.assessment.total);
  return /* @__PURE__ */ React.createElement(
    Panel2,
    {
      title: "Day 1 discovery overview",
      kicker: cc ? "CENTRE COMMAND / PRIVATE BASELINE & RESULTS" : "MISSION COMMANDER / COHORT OPERATIONS",
      action: /* @__PURE__ */ React.createElement(Badge, null, d.roster.length, " GAMERS")
    },
    /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "Open Day 1 submissions, markers and reviews"), /* @__PURE__ */ React.createElement("div", { className: "filter-row" }, /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement(import_lucide_react6.Search, { size: 14 }), " Gamer name", /* @__PURE__ */ React.createElement(
      "input",
      {
        value: search,
        onChange: (e) => setSearch(e.target.value),
        placeholder: "Search cohort"
      }
    )), /* @__PURE__ */ React.createElement("label", null, "Status", /* @__PURE__ */ React.createElement("select", { value: filter, onChange: (e) => setFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Gamers"), /* @__PURE__ */ React.createElement("option", { value: "missing" }, "Missing submission"), /* @__PURE__ */ React.createElement("option", { value: "eod" }, "Missing EOD"), /* @__PURE__ */ React.createElement("option", { value: "review" }, "Review submissions")))), /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", null, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Gamer"), /* @__PURE__ */ React.createElement("th", null, "Clock-in"), /* @__PURE__ */ React.createElement("th", null, "SOD"), /* @__PURE__ */ React.createElement("th", null, "Genre"), /* @__PURE__ */ React.createElement("th", null, "Submission"), /* @__PURE__ */ React.createElement("th", null, "EOD"), /* @__PURE__ */ React.createElement("th", null, "Trophies"), cc && /* @__PURE__ */ React.createElement("th", null, "Private baseline"), /* @__PURE__ */ React.createElement("th", null, "Review"))), /* @__PURE__ */ React.createElement("tbody", null, people.map((p) => /* @__PURE__ */ React.createElement("tr", { key: p._id }, /* @__PURE__ */ React.createElement("td", null, p.name), /* @__PURE__ */ React.createElement("td", null, p.r?.clockAt ? "Yes" : "Pending"), /* @__PURE__ */ React.createElement("td", null, p.r?.markers.sod ? "Met" : "Review"), /* @__PURE__ */ React.createElement("td", null, p.r?.config.genres.find((g) => g.id === p.r.genreId)?.name || (p.r?.researchSelection ? `${p.r.researchSelection.genreName} \xB7 question not confirmed` : "Pending")), /* @__PURE__ */ React.createElement("td", null, p.r?.verification?.status || "Not submitted"), /* @__PURE__ */ React.createElement("td", null, p.r?.eod ? "Saved" : "Pending"), /* @__PURE__ */ React.createElement("td", null, p.r?.trophies || 0, "/20"), cc && /* @__PURE__ */ React.createElement("td", null, p.r?.assessment ? `${p.r.assessment.total.toFixed(2)}/${p.r.assessment.max}` : "Not assessed"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn small",
        onClick: () => setSelected(p._id),
        disabled: !p.r
      },
      "Review"
    ))))))), person && record && /* @__PURE__ */ React.createElement(
      DayOneReview,
      {
        key: record._id,
        person,
        record,
        data,
        act
      }
    ), cc && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Panel2, { title: "Approved baseline ranking", kicker: "PRIVATE / CC ONLY" }, ranks.map((r) => /* @__PURE__ */ React.createElement("div", { className: "ledger-row", key: r.userId }, /* @__PURE__ */ React.createElement("b", null, "#", ranks.findIndex(
      (x) => Math.abs(x.assessment.total - r.assessment.total) < 1e-9
    ) + 1), /* @__PURE__ */ React.createElement("span", null, d.roster.find((p) => p._id === r.userId)?.name), /* @__PURE__ */ React.createElement("strong", null, r.assessment.total.toFixed(2), "/", r.assessment.max))), !ranks.length && /* @__PURE__ */ React.createElement("p", { className: "muted" }, "No approved baselines yet.")), /* @__PURE__ */ React.createElement(
      Panel2,
      {
        title: "Research Champion",
        kicker: "PRIVATE DECISION / WEEK 1 RELEASE"
      },
      /* @__PURE__ */ React.createElement("p", { className: "muted" }, d.candidates.length > 1 ? "Top baselines are tied. Document the Centre Command selection; no automatic tie-break applies." : "Select only after Day 1 closes and all submitted links have been reviewed."),
      champion?.releasedAt ? /* @__PURE__ */ React.createElement(Receipt, null, "Badge and advanced verification prompt released together", " ", fmt(champion.releasedAt, d.config.timeZone), ".") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        Form,
        {
          fields: [
            {
              name: "userId",
              label: "Highest approved baseline candidate",
              options: [
                { value: "", label: "Choose a candidate" },
                ...d.roster.filter((p) => d.candidates.includes(p._id)).map((p) => ({ value: p._id, label: p.name }))
              ]
            },
            textField(
              "reason",
              "Documented Champion selection reason"
            )
          ],
          initial: {
            userId: champion?.userId,
            reason: champion?.reason
          },
          submit: "Save private Champion decision",
          onSubmit: (v) => act("day1/select-champion", v)
        }
      ), champion && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Earliest reveal:", " ", fmt(champion.revealAfter, d.config.timeZone), "."), new Date(now) >= new Date(champion.revealAfter) ? /* @__PURE__ */ React.createElement(
        Form,
        {
          fields: [
            textField(
              "reason",
              "Confirm Week 1 winner announcement"
            )
          ],
          submit: "Release Champion badge and prompt together",
          onSubmit: (v) => act("day1/reveal-champion", v)
        }
      ) : /* @__PURE__ */ React.createElement(Badge, null, /* @__PURE__ */ React.createElement(import_lucide_react6.LockKeyhole, { size: 12 }), " LOCKED UNTIL WEEK 1 CLOSE")))
    )), /* @__PURE__ */ React.createElement(
      Panel2,
      {
        title: "Day 1 decision audit",
        kicker: "ORIGINAL EVENTS / OLD & NEW VALUES / ACTOR & REASON"
      },
      d.events.slice(0, 40).map((e) => /* @__PURE__ */ React.createElement("details", { key: e._id }, /* @__PURE__ */ React.createElement("summary", null, e.kind, " \xB7", " ", d.roster.find((p) => p._id === e.userId)?.name || "Cohort", " \xB7", " ", fmt(e.createdAt, d.config.timeZone)), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Actor ", e.actorId, " \xB7 Event ", e._id), /* @__PURE__ */ React.createElement(
        "pre",
        {
          style: {
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 280,
            overflow: "auto"
          }
        },
        JSON.stringify(e.details, null, 2)
      )))
    ))
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DayOneCheckIn,
  DayOneCohort,
  DayOneDaily,
  DayOneGameSetup,
  DayOneRewards,
  DiscoveryMission,
  isDayOne
});
