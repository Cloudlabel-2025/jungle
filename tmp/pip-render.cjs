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

// components/PipGuide.js
var PipGuide_exports = {};
__export(PipGuide_exports, {
  PipArrival: () => PipArrival,
  PipDrone: () => PipDrone,
  default: () => PipGuide
});
module.exports = __toCommonJS(PipGuide_exports);
var import_react3 = require("react");
var import_lucide_react2 = require("lucide-react");

// lib/pip-expressions.js
var pipExpressions = Object.freeze([
  "welcoming",
  "thinking",
  "guiding",
  "celebrating",
  "concerned"
]);
function pipExpression(stepId) {
  if (["clock-in", "boarding", "day-check-in", "map-start"].includes(stepId))
    return "welcoming";
  if (["submitted", "verified", "map-verified"].includes(stepId))
    return "celebrating";
  if ([
    "attendance-unavailable",
    "attendance-check",
    "closed",
    "expired",
    "correction"
  ].includes(stepId))
    return "concerned";
  if (["research", "map-submitted", "unreleased"].includes(stepId))
    return "thinking";
  return "guiding";
}
function pipImage(expression) {
  return `/images/pip/pip-${pipExpressions.includes(expression) ? expression : "welcoming"}.webp`;
}

// lib/attendance-policy.js
var RESPONSE_MS = 2 * 6e4;
var CONTINUE_MS = 30 * 6e4;
function needsClockInTutorial(session) {
  return session?.state === "NOT_IN" && !session.hasClockedIn && !session.clockAt && !session.clockOutAt;
}

// lib/pip-tutorial.js
function pipTutorial(data, { missionOpen = false, travelling = false, now = /* @__PURE__ */ new Date() } = {}) {
  if (data.user?.role !== "GAMER" || !data.story?.flight) return null;
  const record = data.dayOne?.records?.find((r) => r.userId === data.user._id);
  const submission = record?.submissions?.at(-1);
  const assigned = Boolean(record?.researchAssignment || record?.genreId);
  const session = data.playSession;
  const step = (id, title, message, target, action = "show", label = "Show me") => ({
    id,
    title,
    message,
    target,
    action,
    label,
    expression: pipExpression(id)
  });
  if (session && session.state !== "ACTIVE") {
    if (!needsClockInTutorial(session)) return null;
    if (!session.available)
      return step(
        "attendance-unavailable",
        "Your progress is safe",
        session.reason || "Clock-in is not available yet. Command needs to open today's session.",
        null,
        null
      );
    return step(
      "clock-in",
      "Ready for take-off?",
      "I'm Pip, your flight companion. Clock in to start today's play session. Your saved mission stays with you.",
      "attendance",
      "attendance",
      "Find clock-in"
    );
  }
  if (session?.responseDeadline)
    return step(
      "attendance-check",
      "Still exploring?",
      "The day has ended. Open your clock and choose Still playing to continue, or clock out when you're done.",
      "attendance",
      "attendance",
      "Open my clock"
    );
  if (travelling)
    return step(
      "travelling",
      "Next stop: discovery",
      "We're on our way. Your mission opens when the helicopter reaches the checkpoint.",
      null,
      null
    );
  const release = data.dayOne?.state;
  if (!["OPEN", "CLOSED"].includes(release))
    return step(
      "unreleased",
      "Waiting for clearance",
      "Level 1 has not been released yet. Command opens the mission; your progress is safe.",
      null,
      null
    );
  if (!missionOpen) {
    if (record?.levelOne ? record.levelOne.result?.completed : submission && record.verification?.status === "VERIFIED") {
      const next = data.weekOneProgram?.days?.find((d) => d.day === 2);
      return step(
        "map-verified",
        "Discovery confirmed!",
        next?.state === "OPEN" ? "Your evidence is verified and Level 2 is open. Select its checkpoint and press Play." : "Your evidence is verified. The next level stays locked until Command releases it.",
        "level-two",
        next?.state === "OPEN" ? "next" : null,
        "Find Level 2"
      );
    }
    return step(
      submission ? "map-submitted" : assigned ? "map-resume" : "map-start",
      submission ? "Your discovery is saved" : assigned ? "Let's pick up your mission" : "Your first adventure",
      submission ? "Your chat has been received. Open Level 1 to see its review status." : "Select Level 1 and press Play. I'll help you through each checkpoint once we arrive.",
      "level-one-play",
      "mission",
      submission ? "View my mission" : "Find Level 1"
    );
  }
  if (!data.story.introComplete)
    return step(
      "boarding",
      "Welcome aboard, explorer",
      "I'm Pip. We'll choose a world, investigate a question and bring back an AI chat. Begin flight learning to get started.",
      "boarding"
    );
  if (release === "CLOSED")
    return step(
      "closed",
      "This mission is closed",
      "You can view your saved work. Command must reopen Day 1 before you can change or submit anything.",
      null,
      null
    );
  if (record?.levelOne?.result?.completed)
    return step(
      "verified",
      "Stars earned, explorer!",
      `Your result is saved: ${record.levelOne.result.stars} stars, ${record.levelOne.creditedTrophies} trophies and ${record.levelOne.creditedXp} XP. Let's check the next released level.`,
      null,
      "map",
      "Back to the flight map"
    );
  if (record?.levelOne?.result?.status === "REVIEW_REQUIRED" && submission)
    return step(
      "review",
      "Let's read your shared chat",
      record.levelOne.result.reason,
      ["INVALID_LINK", "UNSUPPORTED_LINK", "NOT_PUBLIC"].includes(
        record.levelOne.result.readCode
      ) ? "replace-chat" : "review-link"
    );
  if (record?.levelOne?.result && submission)
    return step(
      "correction",
      "Let's strengthen your discovery",
      record.levelOne.result.reason,
      "replace-chat"
    );
  if (!record)
    return step(
      "day-check-in",
      "Let's record your arrival",
      "Check in first. Then your seven worlds will be ready to explore.",
      "day-check-in"
    );
  if (!assigned && !record.researchSelection)
    return step(
      "genre",
      "Choose your world",
      "Explore the seven beacons. Pick a world, then Set course to lock it. You can change your mind before confirming.",
      "genres"
    );
  if (!assigned)
    return step(
      "question",
      "Find your mission",
      "Your world is saved. Read the three mission cards, choose one and Lock this mission. That choice is final.",
      "questions"
    );
  if (submission) {
    if (record.verification?.status === "INACCESSIBLE")
      return step(
        "correction",
        "Let's repair the signal",
        "Command couldn't access your chat. Check its sharing permissions, then Replace chat link and explain your correction.",
        "replace-chat"
      );
    if (record.verification?.status === "VERIFIED")
      return step(
        "verified",
        "Discovery confirmed!",
        "Command verified your AI chat. Return to the map to check the next released level. Your work stays saved.",
        null,
        "map",
        "Back to the flight map"
      );
    return step(
      "submitted",
      "Transmission received!",
      "Your AI chat is saved. Centre Command will verify it. Submitting does not unlock the next level; Command releases that separately.",
      "receipt"
    );
  }
  if (!record.acknowledgedAt)
    return step(
      "accept",
      "A mission with your name on it",
      "Read your objective, then Accept mission. Accepting saves your acknowledgement; it does not start the research timer.",
      "accept"
    );
  if (!record.startedAt)
    return step(
      "begin",
      "Ready to investigate?",
      "Begin research when you're ready. Your research timer starts then and keeps running if you leave the page.",
      "begin"
    );
  if (record.deadline && Date.parse(record.deadline) <= new Date(now).getTime())
    return step(
      "expired",
      "Time to contact your MC",
      "Your research window has ended. Your saved work remains here. Ask your Mission Commander for an extension if you need more time.",
      null,
      null
    );
  if (record.draft?.url)
    return step(
      "transmit",
      "Bring your discovery home",
      record.levelOne ? "Your chat link is saved. Transmit research chat when you're ready. I'll open the public conversation and check your research for stars, trophies and XP. No pasting needed!" : "Your chat link is saved as a draft. Press Transmit research chat to submit it for review. A draft alone is not a submission.",
      "transmit"
    );
  return step(
    "research",
    "Follow the evidence",
    record.levelOne ? "Investigate with your AI tool, ask follow-up questions and check sources. Use ChatGPT's Share button, then bring back the public conversation link. I'll read it automatically when you transmit." : "Use your AI tool to investigate the question. Ask follow-up questions and check the answers. Then share the conversation and paste its link here.",
    "chat"
  );
}
function pipScope(data) {
  const record = data.dayOne?.records?.find((r) => r.userId === data.user._id);
  const contentVersion = record?.config?.version || data.dayOne?.config?.version || 1;
  return `codewild:pip:v1:${data.user._id}:${data.user.cohortId || "alpha"}:${record?._id || data.dayOne?.config?.day || "arrival"}:${contentVersion}`;
}

// components/PipSpeech.js
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function PipSpeech({ text }) {
  const [progress, setProgress] = (0, import_react.useState)({ text, count: 0 });
  const characters = Array.from(text);
  const count = progress.text === text ? progress.count : 0;
  (0, import_react.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "pip-speech", "data-speaking": count < characters.length, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sr-only", role: "status", children: text }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pip-speech-reserve", "aria-hidden": "true", children: text }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "pip-speech-typed", "aria-hidden": "true", children: [
      characters.slice(0, count).join(""),
      count < characters.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pip-speech-caret" })
    ] })
  ] });
}

// components/PipPointer.js
var import_react2 = require("react");
var import_react_dom = require("react-dom");
var import_lucide_react = require("lucide-react");

// lib/pip-pointer.js
var clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function pipPointerPosition(rect, viewport, showLabel = true) {
  const width = showLabel ? 126 : 40, height = showLabel ? 66 : 40, gap = 8;
  if (rect.bottom <= 0 || rect.top >= viewport.height || rect.right <= 0 || rect.left >= viewport.width)
    return null;
  const above = rect.top >= height + gap + 8;
  const center = (Math.max(0, rect.left) + Math.min(viewport.width, rect.right)) / 2;
  return {
    left: clamp(center - width / 2, 8, Math.max(8, viewport.width - width - 8)),
    top: above ? rect.top - height - gap : clamp(rect.bottom + gap, 8, Math.max(8, viewport.height - height - 8)),
    direction: above ? "down" : "up"
  };
}
function findPipTarget(document2, step) {
  const selectors = step.target === "genres" ? [
    '[data-pip-target="genre-confirm"]:not(:disabled)',
    '[data-pip-target="genres"] .flight-world-beacon:not(:disabled)'
  ] : step.target === "questions" ? [
    '[data-pip-target="question-confirm"]:not(:disabled)',
    '[data-pip-target="questions"] label:has(input:not(:disabled))'
  ] : [
    step.action === "attendance" ? ".attendance-trigger" : `[data-pip-target="${step.target}"]`
  ];
  for (const selector of selectors) {
    const target = Array.from(document2.querySelectorAll(selector)).find(
      (el) => el.getClientRects().length && !el.closest("[hidden]") && !el.matches(':disabled,[aria-disabled="true"]') && !(step.target === "transmit" && el.form?.querySelector(
        "input:invalid,textarea:invalid,select:invalid"
      ))
    );
    if (target) return target;
  }
  return null;
}

// components/PipPointer.js
var import_jsx_runtime2 = require("react/jsx-runtime");
function PipPointer({ target, dismiss, label = "Click here" }) {
  const [position, setPosition] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    function update() {
      if (!target.isConnected || target.closest("[hidden]") || target.matches(':disabled,[aria-disabled="true"]')) {
        dismiss();
        return;
      }
      const next = target.getClientRects().length ? pipPointerPosition(
        target.getBoundingClientRect(),
        {
          width: window.innerWidth,
          height: window.innerHeight
        },
        Boolean(label)
      ) : null;
      setPosition(
        (previous) => previous?.left === next?.left && previous?.top === next?.top && previous?.direction === next?.direction ? previous : next
      );
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timer = setInterval(update, 180);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target, dismiss, label]);
  if (!position || typeof document === "undefined") return null;
  const Arrow = position.direction === "down" ? import_lucide_react.ArrowDown : import_lucide_react.ArrowUp;
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        className: `pip-click-pointer ${label ? "has-label" : ""} points-${position.direction}`,
        style: { left: position.left, top: position.top },
        "aria-hidden": "true",
        children: [
          label && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.MousePointerClick, { size: 16 }),
            label
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Arrow, { className: "pip-click-arrow", size: 34, strokeWidth: 3 })
        ]
      }
    ),
    document.body
  );
}

// components/PipStage.js
var import_react_dom2 = require("react-dom");
var import_jsx_runtime3 = require("react/jsx-runtime");
function PipStage({ children }) {
  const scene = /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pip-appearance", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "pip-appearance-shade", "aria-hidden": "true" }),
    children
  ] });
  return typeof document === "undefined" ? scene : (0, import_react_dom2.createPortal)(scene, document.body);
}

// components/PipGuide.js
var import_jsx_runtime4 = require("react/jsx-runtime");
function PipDrone({ expression = "welcoming" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "pip-drone", "data-expression": expression, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "img",
    {
      className: "pip-character-image",
      src: pipImage(expression),
      alt: "",
      width: 600,
      height: 400,
      decoding: "async",
      draggable: false
    },
    expression
  ) });
}
function PipArrival({ returning = false, available = true }) {
  const dialogue = !available ? "Hey, explorer! I'm Pip. Our flight is waiting for clearance. As soon as Command opens today's session, I'll help you get started." : returning ? "You're back! Your discoveries are safe. Hit Clock in when you're ready, and let's keep exploring together!" : "Hey, explorer! I'm Pip, your flight buddy. Ready for your first discovery? Hit Clock in, and we'll take off together!";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pip-arrival", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PipDrone, { expression: available ? "welcoming" : "thinking" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pip-arrival-dialogue", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
        "Pip ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Your flight buddy" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PipSpeech, { text: dialogue })
    ] })
  ] });
}
function PipGuide({
  data,
  missionOpen,
  travelling,
  now,
  onMission,
  onMap,
  onNext
}) {
  const step = pipTutorial(data, { missionOpen, travelling, now });
  const scope = pipScope(data);
  const [preference, setPreference] = (0, import_react3.useState)({ scope: "", dismissed: "" });
  const [details, setDetails] = (0, import_react3.useState)(false);
  const [notice, setNotice] = (0, import_react3.useState)("");
  const [dialogOpen, setDialogOpen] = (0, import_react3.useState)(false);
  const [pointer, setPointer] = (0, import_react3.useState)(null);
  const [following, setFollowing] = (0, import_react3.useState)(false);
  const pointedStep = (0, import_react3.useRef)("");
  const highlighted = (0, import_react3.useRef)(null);
  const highlightTimer = (0, import_react3.useRef)(null);
  const clearHighlight = (0, import_react3.useCallback)(() => {
    clearTimeout(highlightTimer.current);
    highlighted.current?.classList.remove("pip-spotlight");
    highlighted.current = null;
    setPointer(null);
  }, []);
  (0, import_react3.useEffect)(() => {
    let dismissed2 = "";
    let follow = false;
    try {
      dismissed2 = localStorage.getItem(scope) || "";
      follow = localStorage.getItem(`${scope}:follow`) === "true";
    } catch {
    }
    setPreference({ scope, dismissed: dismissed2 });
    setFollowing(follow);
    pointedStep.current = "";
  }, [scope]);
  (0, import_react3.useEffect)(() => {
    setDetails(false);
    setNotice("");
    clearHighlight();
    return () => {
      clearTimeout(highlightTimer.current);
      highlighted.current?.classList.remove("pip-spotlight");
    };
  }, [step?.id]);
  (0, import_react3.useEffect)(() => {
    const check = () => setDialogOpen(Boolean(document.querySelector('[aria-modal="true"]')));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal"]
    });
    return () => observer.disconnect();
  }, []);
  (0, import_react3.useEffect)(() => {
    if (!following || !step?.action || dialogOpen || pointedStep.current === step.id)
      return;
    function continueGuide() {
      if (pointedStep.current === step.id) return;
      const target = ["show", "mission"].includes(step.action) ? findPipTarget(document, step) : Array.from(document.querySelectorAll("[data-pip-action]")).find(
        (el) => el.getClientRects().length && !el.matches(":disabled")
      );
      if (!target) return;
      setNotice("");
      pointedStep.current = step.id;
      pointAt(target, false, true);
    }
    if (step.action === "mission") onMission();
    continueGuide();
    const observer = new MutationObserver(continueGuide);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden", "value", "data-pip-target"]
    });
    document.addEventListener("input", continueGuide, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("input", continueGuide, true);
    };
  }, [following, step?.id, dialogOpen]);
  (0, import_react3.useEffect)(() => {
    if (!pointer) return;
    function clicked(event) {
      const choices = ["genres", "questions"].includes(step?.target) && event.target.closest?.(`[data-pip-target="${step.target}"]`);
      if (choices) {
        remember(step.id);
        clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => {
          const next = findPipTarget(document, step);
          if (next) pointAt(next, false);
          else clearHighlight();
        }, 0);
      } else if (pointer.contains(event.target)) {
        clearHighlight();
        remember(step.id);
      }
    }
    document.addEventListener("click", clicked, true);
    return () => document.removeEventListener("click", clicked, true);
  }, [pointer, step?.id]);
  if (!step || dialogOpen) return null;
  const expression = notice ? "concerned" : details ? "guiding" : step.expression;
  const dismissed = preference.scope === scope && preference.dismissed === step.id;
  function remember(value) {
    setPreference({ scope, dismissed: value });
    try {
      if (value) localStorage.setItem(scope, value);
      else localStorage.removeItem(scope);
    } catch {
    }
  }
  function showTarget() {
    setNotice("");
    setFollowing(true);
    try {
      localStorage.setItem(`${scope}:follow`, "true");
    } catch {
    }
    if (step.action === "mission") {
      onMission();
    }
    if (step.action === "map") {
      onMap();
      return;
    }
    if (step.action === "next") {
      onNext();
      return;
    }
    const target = findPipTarget(document, step);
    if (!target) {
      setNotice(
        "That control is still loading. I'll point it out as soon as it's ready."
      );
      return;
    }
    if (step.action === "attendance") {
      target.click();
      return;
    }
    pointAt(target);
    pointedStep.current = step.id;
    remember(step.id);
  }
  function pointAt(target, focus = true, scroll = focus) {
    clearHighlight();
    highlighted.current = target;
    target.classList.add("pip-spotlight");
    const focusable = target.matches("button,input,a,textarea,[tabindex]") ? target : target.querySelector(
      'button:not(:disabled),input:not(:disabled),[tabindex="0"]'
    );
    if (focus) focusable?.focus({ preventScroll: true });
    if (scroll)
      target.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest"
      });
    setPointer(target);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    pointer && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      PipPointer,
      {
        target: pointer,
        dismiss: clearHighlight,
        label: [
          "chat",
          "transmit",
          "receipt",
          "replace-chat",
          "review-link"
        ].includes(step.target) ? "" : "Click here"
      }
    ),
    !dismissed && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PipStage, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "aside",
      {
        className: `pip-guide ${!missionOpen ? "is-on-map" : ""}`,
        "aria-label": "Pip tutorial companion",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PipDrone, { expression }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pip-message", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "PIP / FLIGHT COMPANION" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    clearHighlight();
                    setFollowing(false);
                    try {
                      localStorage.removeItem(`${scope}:follow`);
                    } catch {
                    }
                    remember(step.id);
                  },
                  "aria-label": "Minimize Pip guidance",
                  children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react2.X, { size: 15 })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: step.title }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PipSpeech, { text: step.message })
            ] }),
            details && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pip-sharing-tip", children: "In your AI tool, use Share to create a conversation link. Open it in a private browser window to check that others can read it. Paste that link here, then transmit it. Never include passwords or private information." }),
            notice && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "status", children: notice }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("footer", { children: [
              step.action && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  type: "button",
                  className: "pip-action",
                  "data-pip-action": "true",
                  onClick: showTarget,
                  children: [
                    step.label,
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react2.ArrowRight, { size: 15 })
                  ]
                }
              ),
              ["research", "transmit", "correction"].includes(step.id) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: "pip-tip",
                  "aria-expanded": details,
                  onClick: () => setDetails(!details),
                  children: details ? "Hide tip" : "How to share a chat?"
                }
              )
            ] })
          ] }, step.id)
        ]
      }
    ) })
  ] });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PipArrival,
  PipDrone
});
