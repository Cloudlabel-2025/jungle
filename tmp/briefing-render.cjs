"use client";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// components/FlightMissionBriefing.js
var FlightMissionBriefing_exports = {};
__export(FlightMissionBriefing_exports, {
  default: () => FlightMissionBriefing
});
module.exports = __toCommonJS(FlightMissionBriefing_exports);
var import_react2 = require("react");
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

// components/ui.js
var import_lucide_react = require("lucide-react");
var import_react = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime = require("react/jsx-runtime");
function Modal({
  title,
  kicker,
  children,
  close,
  wide = false,
  variant,
  portal = false
}) {
  const root = (0, import_react.useRef)(null), closeRef = (0, import_react.useRef)(close);
  closeRef.current = close;
  (0, import_react.useEffect)(() => {
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
  const dialog = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: `modal-backdrop ${portal ? "priority-modal-backdrop" : ""} ${variant === "flight-mission" ? "flight-mission-backdrop" : ""} ${variant === "level-drawer" ? "level-drawer-backdrop" : ""} ${variant === "level-completion" ? "level-completion-backdrop" : ""}`,
      onClick: (e) => e.target === e.currentTarget && close(),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "section",
        {
          ref: root,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          className: `modal ${!variant ? "modal-dialog" : ""} ${wide ? "wide" : ""} ${variant === "flight-mission" ? "flight-mission-window" : ""} ${variant === "level-drawer" ? "level-drawer" : ""} ${variant === "level-completion" ? "level-completion-modal" : ""}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "panel-heading", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "eyebrow", children: kicker || "CODEWILD / FIELD CONSOLE" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  className: "icon-btn",
                  "aria-label": "Close dialog",
                  onClick: close,
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_lucide_react.X, { size: 20 })
                }
              )
            ] }),
            !variant ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "modal-content", children }) : children
          ]
        }
      )
    }
  );
  return (portal || variant === "flight-mission") && typeof document !== "undefined" ? (0, import_react_dom.createPortal)(dialog, document.body) : dialog;
}

// components/FlightMissionBriefing.js
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  const [showLog, setShowLog] = (0, import_react2.useState)(false);
  const [revise, setRevise] = (0, import_react2.useState)(false);
  const submission = r.submissions.at(-1);
  (0, import_react2.useEffect)(() => setRevise(false), [submission?.id]);
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "section",
    {
      className: "flight-research-scene flight-active-mission mission-briefing-scene",
      "data-phase": phase,
      "aria-label": "Your research mission",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flight-world flight-mission-objective", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flight-scene-heading", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "Your mission is waiting." })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "article",
            {
              className: "mission-briefing-board",
              "aria-label": "Mission briefing",
              style: cover ? { "--briefing-cover": `url("${cover}")` } : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mission-briefing-poster", "aria-hidden": "true", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "mission-poster-code", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Compass, { size: 15 }),
                    " FLIGHT / 01"
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mission-poster-caption", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: r.researchAssignment?.genreName || "Discovery" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: title })
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mission-briefing-copy", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "mission-briefing-kicker", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Target, { size: 15 }),
                    " YOUR OBJECTIVE"
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { children: "Follow your curiosity." }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mission-question", children: g.question }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                    "ul",
                    {
                      className: "mission-field-guide",
                      "aria-label": "Research field guide",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Compass, { size: 18 }),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Explore your options" })
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Search, { size: 18 }),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Check the claims" })
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Radio, { size: 18 }),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Bring back your chat" })
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "mission-contract-lock", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.LockKeyhole, { size: 12 }),
                    " Your question is locked and saved."
                  ] })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              className: "mission-route-progress",
              "aria-label": "Research mission progress",
              children: [
                ["Accept", Boolean(r.acknowledgedAt)],
                ["Research", Boolean(r.startedAt)],
                ["Transmit", Boolean(submission)]
              ].map(([label, done], i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "div",
                {
                  className: done ? "is-complete" : i === (r.startedAt ? 2 : r.acknowledgedAt ? 1 : 0) ? "is-current" : "",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: done ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Check, { size: 13 }) : i + 1 }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: label })
                  ]
                },
                label
              ))
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "aside",
          {
            className: "flight-radio-panel mission-launch-panel",
            "aria-label": "Mission control",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flight-radio-channel", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Radio, { size: 18 }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
                  "FLIGHT RADIO",
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: "MISSION CONTROL" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { "aria-hidden": "true" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mission-control-emblem", "aria-hidden": "true", children: verified ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ShieldCheck, { size: 34 }) : submission ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Check, { size: 34 }) : r.startedAt ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Search, { size: 34 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Compass, { size: 34 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "mission-phase-status", role: "status", children: status }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { children: verified ? "Discovery confirmed." : submission ? "Good work, explorer." : r.startedAt ? "Find your answers." : r.acknowledgedAt ? "Ready to explore?" : "Your adventure starts here." }),
              !submission && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "div",
                {
                  className: `mission-countdown ${r.startedAt ? "is-running" : ""}`,
                  role: r.startedAt ? "timer" : void 0,
                  "aria-label": r.startedAt ? "Research time remaining" : "Research window",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Clock3, { size: 18 }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: r.startedAt ? timer : "90:00" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: r.startedAt ? remaining > 0 ? "REMAINING" : "WINDOW ENDED" : "STARTS AT LAUNCH" })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mission-control-copy", children: verified ? "Command has verified your evidence. The next level opens when it is released." : submission ? "Your conversation is saved. Command will check your evidence." : r.startedAt ? "Investigate with your AI tool. Return with a shared conversation link." : r.acknowledgedAt ? "Launch when you are ready. The timer keeps running after you leave." : "Read the objective, then accept your mission. Your timer has not started." }),
              !r.acknowledgedAt && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "button",
                {
                  className: "flight-mission-action mission-launch-action",
                  disabled: busy,
                  onClick: () => onAction("acknowledge"),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: busy ? "Accepting\u2026" : "Accept mission" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ShieldCheck, { size: 18 })
                  ]
                }
              ),
              r.acknowledgedAt && !r.startedAt && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "button",
                {
                  className: "flight-mission-action mission-launch-action",
                  disabled: busy,
                  onClick: () => onAction("start"),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: busy ? "Launching\u2026" : "Begin research" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ArrowRight, { size: 18 })
                  ]
                }
              ),
              r.startedAt && !submission && children,
              error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "flight-radio-error", role: "alert", children: error }),
              submission && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mission-evidence-receipt", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("a", { href: submission.url, target: "_blank", rel: "noopener noreferrer", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ExternalLink, { size: 14 }),
                  " Open your research chat"
                ] }),
                r.verification?.reason && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: r.verification.reason }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "button",
                  {
                    className: "mission-log-trigger",
                    onClick: () => setRevise(true),
                    children: [
                      "Replace chat link ",
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ArrowRight, { size: 14 })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "button",
                  {
                    className: "mission-log-trigger",
                    onClick: () => setShowLog(true),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.History, { size: 14 }),
                      " Transmission log",
                      " ",
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: r.submissions.length })
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mission-control-footer", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { size: 12 }),
                submission ? "Evidence saved to your account" : "One mission. Your own discovery."
              ] })
            ]
          }
        ),
        showLog && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          Modal,
          {
            title: "Transmission log",
            kicker: "YOUR SAVED RESEARCH",
            close: () => setShowLog(false),
            children: [...r.submissions].reverse().map((s) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "history-entry", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", children: [
                "Open chat \xB7 ",
                formatDate(s.at)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: s.reason })
            ] }, s.id))
          }
        ),
        revise && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          Modal,
          {
            title: "Update your transmission",
            kicker: "RESEARCH EVIDENCE",
            close: () => setRevise(false),
            children
          }
        )
      ]
    }
  );
}
