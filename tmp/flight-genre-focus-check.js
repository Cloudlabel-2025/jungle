"use client";
import {
  Compass,
  Radio,
  LockKeyhole,
  ArrowRight,
  Check,
  Wind,
  Star,
  Sparkles,
  Flag,
  Heart,
  Headphones,
  Leaf,
  MapPin,
  Zap,
  Music,
  Coins,
  CalendarDays,
  Rocket,
  Coffee,
  ShoppingBag,
  Home,
  MessageCircle,
  Lightbulb,
  Plane,
  Ticket,
  Palette,
  TrendingUp,
  PartyPopper,
  Flower2
} from "lucide-react";
const companions = {
  sports: [Flag, Star],
  gaming: [Zap, Sparkles],
  mysteries: [Lightbulb, Star],
  fitness: [Heart, Zap],
  travel: [Plane, MapPin],
  food: [Coffee, Sparkles],
  movies: [Ticket, Star],
  music: [Headphones, Music],
  fashion: [ShoppingBag, Sparkles],
  "room-design": [Palette, Home],
  technology: [Rocket, Zap],
  "social-media": [MessageCircle, Heart],
  money: [Coins, TrendingUp],
  business: [TrendingUp, Lightbulb],
  relationships: [Heart, MessageCircle],
  events: [CalendarDays, PartyPopper],
  sustainability: [Flower2, Leaf]
};
const positions = [
  [18, 25],
  [43, 25],
  [69, 25],
  [85, 63],
  [67, 82],
  [30, 82],
  [10, 64]
];
const clues = {
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
export default function FlightResearchScene({
  data,
  genre,
  question,
  setGenre,
  setQuestion,
  busy,
  error,
  symbols,
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
  const Icon = symbols[selection?.genreId || chosen?.id] || Compass;
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      className: `flight-research-scene ${selection ? "is-question-stage" : ""}`,
      "aria-label": "Research mission selection",
      "aria-busy": busy,
      "data-motion": "on"
    },
    /* @__PURE__ */ React.createElement("div", { className: "flight-world" }, /* @__PURE__ */ React.createElement("div", { className: "flight-scene-heading" }, /* @__PURE__ */ React.createElement("span", { className: "flight-overline" }, /* @__PURE__ */ React.createElement(Wind, { size: 14 }), " ", selection ? "WORLD DISCOVERED" : "THE SKY IS FULL OF POSSIBILITIES"), /* @__PURE__ */ React.createElement("h3", { ref: headingRef, tabIndex: -1 }, selection ? `Explore ${selection.genreName}.` : "Choose your world"), /* @__PURE__ */ React.createElement("p", null, selection ? "Three missions await. Choose the question you want to investigate." : "Select a genre to begin your discovery.")), !data ? /* @__PURE__ */ React.createElement("div", { className: "flight-signal-loading", role: "status" }, /* @__PURE__ */ React.createElement(Compass, { size: 42 }), /* @__PURE__ */ React.createElement("p", null, "Discovering your seven worlds\u2026")) : selection ? /* @__PURE__ */ React.createElement("fieldset", { className: "flight-quest-choices", disabled: busy }, /* @__PURE__ */ React.createElement("legend", { className: "sr-only" }, "Choose one of three questions"), selection.questions.map((q, i) => /* @__PURE__ */ React.createElement(
      "label",
      {
        key: q.id,
        className: `flight-quest ${q.id === question ? "is-selected" : ""}`
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
      /* @__PURE__ */ React.createElement("span", { className: "flight-quest-seal", "aria-hidden": "true" }, q.id === question ? /* @__PURE__ */ React.createElement(Check, { size: 24 }) : `0${i + 1}`),
      /* @__PURE__ */ React.createElement("span", { className: "flight-overline" }, "MISSION 0", i + 1),
      /* @__PURE__ */ React.createElement("strong", null, q.title),
      /* @__PURE__ */ React.createElement("span", { className: "flight-quest-prompt" }, q.prompt),
      /* @__PURE__ */ React.createElement("span", { className: "flight-quest-select" }, q.id === question ? "Mission selected" : "Choose this mission", " ", /* @__PURE__ */ React.createElement(ArrowRight, { size: 16 }))
    ))) : /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "flight-world-beacons",
        "aria-label": "Seven research genres"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flight-compass-rose", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", null, "N"), /* @__PURE__ */ React.createElement(Compass, { size: 160, strokeWidth: 0.5 })),
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
        const Glyph = symbols[g.id] || Compass;
        const [Companion, Accent] = companions[g.id] || [Sparkles, Star];
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
          /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-ring" }, /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-symbol", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Glyph, { size: 34, strokeWidth: 1.7 })), /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-charm", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Companion, { size: 14, strokeWidth: 1.8 })), /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-accent", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Accent, { size: 13, strokeWidth: 1.8 })), genre === g.id && /* @__PURE__ */ React.createElement("span", { className: "flight-beacon-check" }, /* @__PURE__ */ React.createElement(Check, { size: 12 }))),
          /* @__PURE__ */ React.createElement("strong", null, g.name),
          /* @__PURE__ */ React.createElement("small", null, genre === g.id ? "COURSE SELECTED" : "EXPLORE WORLD")
        );
      })
    ), /* @__PURE__ */ React.createElement("div", { className: "flight-scene-footnote" }, /* @__PURE__ */ React.createElement(Compass, { size: 15 }), /* @__PURE__ */ React.createElement("span", null, selection ? "Your genre is saved. Your research timer has not started." : "Seven worlds. One discovery. The choice is yours."))),
    /* @__PURE__ */ React.createElement("aside", { className: "flight-radio-panel", "aria-label": "Mission briefing" }, /* @__PURE__ */ React.createElement("div", { className: "flight-radio-channel" }, /* @__PURE__ */ React.createElement(Radio, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "FLIGHT RADIO", /* @__PURE__ */ React.createElement("small", null, "MISSION BRIEFING")), /* @__PURE__ */ React.createElement("i", { "aria-hidden": "true" })), /* @__PURE__ */ React.createElement("div", { className: "flight-radio-emblem" }, /* @__PURE__ */ React.createElement(Icon, { size: 42, strokeWidth: 1.2 })), /* @__PURE__ */ React.createElement("span", { className: "flight-overline" }, selection ? "02 / CHOOSE YOUR MISSION" : "01 / CHART YOUR COURSE"), /* @__PURE__ */ React.createElement("h4", { "aria-live": "polite" }, selection ? chosenQuestion?.title || "Your next discovery" : chosen?.name || "A world of your own"), /* @__PURE__ */ React.createElement("p", { className: "flight-radio-copy" }, selection ? chosenQuestion ? "This is your mission. Bring your curiosity, question the answers, and find evidence you can trust." : "Read the three questions. Pick the one that makes you curious." : chosen ? clues[chosen.id] || "Follow your curiosity into a new world." : "Explorer, seven worlds are within reach. Select a beacon to find your research destination."), /* @__PURE__ */ React.createElement("div", { className: "flight-radio-rule" }, /* @__PURE__ */ React.createElement(LockKeyhole, { size: 17 }), /* @__PURE__ */ React.createElement("p", null, selection ? "Confirming locks your question for this round. Your 90-minute timer starts only when you begin research." : chosen ? "Locking reserves this genre for you. You cannot switch afterward." : "Each explorer in your five-person group claims a different genre.")), error && /* @__PURE__ */ React.createElement("div", { className: "flight-radio-error", role: "alert" }, /* @__PURE__ */ React.createElement("p", null, error), /* @__PURE__ */ React.createElement("button", { className: "btn small", disabled: busy, onClick: retry }, "Reload saved choices")), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "flight-mission-action",
        disabled: busy || !data || (selection ? !question : !chosen),
        onClick: () => selection ? commit("question", { questionId: question }) : commit("genre", { genreId: genre })
      },
      /* @__PURE__ */ React.createElement("span", null, busy ? "Confirming\u2026" : selection ? "Lock this mission" : chosen ? `Set course for ${chosen.name}` : "Select a world"),
      /* @__PURE__ */ React.createElement(ArrowRight, { size: 19 })
    ), /* @__PURE__ */ React.createElement("small", { className: "flight-radio-save" }, selection ? "Genre locked \xB7 question awaits your choice" : "Your choice locks only when you confirm."))
  );
}
