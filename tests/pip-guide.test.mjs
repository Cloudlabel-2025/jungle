import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import React from "react";
import { pipScope, pipTutorial } from "../lib/pip-tutorial.js";
import { findPipTarget } from "../lib/pip-pointer.js";
import { emptyPipProgress, mergePipProgress, pipAccountKey, completedPipSteps } from "../lib/pip-progress-rules.js";
import { legacyPipProgress } from "../lib/pip-progress-client.js";

// Run the real component's handlers with deterministic hooks and DOM controls.
// No game API or real player mutation is available to the companion.
const source = readFileSync(
  new URL("../components/PipGuide.js", import.meta.url),
  "utf8",
)
  .replace(/^import .*;\r?$/gm, "")
  .replaceAll("export default function", "function")
  .replaceAll("export function", "function");
const { code } = await transform(source + "\nreturn PipGuide;", {
  loader: "jsx",
  jsx: "transform",
});
const base = () => ({
  user: { _id: "me", role: "GAMER" },
  story: { flight: true, introComplete: true },
  playSession: { state: "ACTIVE" },
  dayOne: {
    state: "OPEN",
    records: [{ _id: "r", userId: "me", submissions: [] }],
  },
});
function nodes(node, type) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((n) => nodes(n, type));
  return [
    ...(node.type === type ? [node] : []),
    ...nodes(node.props?.children, type),
  ];
}
function text(node) {
  if (node == null) return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
function harness(data, storage = new Map(), initialProps = {}, accounts = storage) {
  let cursor = 0,
    dirty = false,
    effects = [],
    modal = initialProps.modalInitiallyOpen || false,
    controlsReady = true;
  const observers = new Set();
  const hooks = [],
    counts = {
      focus: 0,
      scroll: 0,
      click: 0,
      mission: 0,
      map: 0,
      next: 0,
      highlighted: false,
    };
  const target = {
    getClientRects: () => [{}],
    closest: () => null,
    matches: () => false,
    querySelector: () => ({ focus: () => counts.focus++ }),
    scrollIntoView: () => counts.scroll++,
    click: () => counts.click++,
    contains: (element) => element === target,
    classList: {
      add: () => (counts.highlighted = true),
      remove: () => (counts.highlighted = false),
    },
  };
  const listeners = new Map();
  const document = {
    body: {},
    querySelector: () => (modal ? {} : null),
    querySelectorAll: () => (controlsReady ? [target] : []),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  const useState = (initial) => {
    const i = cursor++;
    if (!(i in hooks)) hooks[i] = initial;
    return [
      hooks[i],
      (value) => {
        const next = typeof value === "function" ? value(hooks[i]) : value;
        if (!Object.is(next, hooks[i])) {
          hooks[i] = next;
          dirty = true;
        }
      },
    ];
  };
  const useRef = (initial) => {
    const i = cursor++;
    return (hooks[i] ||= { current: initial });
  };
  const useEffect = (effect, deps) => {
    const i = cursor++,
      previous = hooks[i];
    if (!previous || deps.some((d, n) => !Object.is(d, previous.deps[n]))) {
      effects.push(() => {
        previous?.cleanup?.();
        hooks[i] = { deps, cleanup: effect() };
      });
    }
  };
  const localStorage = {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const account = pipAccountKey(data), accountKey = `account:${account}`;
  const original = accounts.get(accountKey) || data.pipProgress || emptyPipProgress();
  accounts.set(accountKey, mergePipProgress(original, legacyPipProgress({ ...data, pipProgress: original }, localStorage)));
  function usePipProgress(current) {
    const previous = accounts.get(accountKey);
    const saved = mergePipProgress(previous, { completed: completedPipSteps(current) });
    accounts.set(accountKey, saved);
    return { ...saved, account, patch(update) {
      const old = accounts.get(accountKey), next = mergePipProgress(old, update);
      if (JSON.stringify(old) !== JSON.stringify(next)) {
        accounts.set(accountKey, { ...next, version: old.version + 1 });
        dirty = true;
      }
    } };
  }
  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.add(callback);
    }
    observe() {}
    disconnect() {
      observers.delete(this.callback);
    }
  }
  const Guide = new Function(
    "React",
    "useState",
    "useEffect",
    "useRef",
    "useCallback",
    "pipScope",
    "pipTutorial",
    "usePipProgress",
    "PipSpeech",
    "PipPointer",
    "PipStage",
    "findPipTarget",
    "ArrowRight",
    "HelpCircle",
    "X",
    "document",
    "localStorage",
    "MutationObserver",
    "setTimeout",
    "clearTimeout",
    code,
  )(
    React,
    useState,
    useEffect,
    useRef,
    (callback) => callback,
    pipScope,
    pipTutorial,
    usePipProgress,
    "pip-speech",
    "pip-pointer",
    "pip-stage",
    findPipTarget,
    "arrow",
    "help",
    "close",
    document,
    localStorage,
    Observer,
    () => 1,
    () => {},
  );
  let tree;
  const props = {
    data,
    missionOpen: true,
    now: new Date("2026-11-14T05:00:00Z"),
    onMission: () => counts.mission++,
    onMap: () => counts.map++,
    onNext: () => counts.next++,
    ...initialProps,
  };
  function render() {
    for (let n = 0; n < 10; n++) {
      cursor = 0;
      dirty = false;
      effects = [];
      tree = Guide(props);
      effects.forEach((effect) => effect());
      if (!dirty) return tree;
    }
    throw Error("Guide did not settle");
  }
  const button = (label) =>
    nodes(tree, "button").find(
      (b) => b.props["aria-label"] === label || text(b) === label,
    );
  render();
  return {
    render,
    props,
    counts,
    button,
    text: () => text(tree),
    pointer: () => nodes(tree, "pip-pointer")[0],
    setControlsReady: (value) => {
      controlsReady = value;
      observers.forEach((callback) => callback());
      render();
    },
    clickTarget: () => {
      listeners.get("click")?.({ target });
      render();
    },
    setModal: (value) => {
      modal = value;
      observers.forEach((callback) => callback());
      render();
    },
  };
}

test("Show me highlights and focuses a game control without clicking or advancing it", () => {
  const data = base(),
    before = structuredClone(data),
    h = harness(data);
  h.button("Show me").props.onClick();
  assert.equal(h.counts.focus, 1);
  assert.equal(h.counts.scroll, 1);
  assert.equal(h.counts.highlighted, true);
  assert.equal(h.counts.click, 0);
  h.render();
  assert.ok(
    h.pointer(),
    "Show me must display an animated pointer at the target",
  );
  assert.equal(
    h.button("Ask Kiko for help"),
    undefined,
    "Kiko leaves no floating launcher behind",
  );
  assert.deepEqual(data, before);
  h.clickTarget();
  assert.equal(
    h.pointer(),
    undefined,
    "pointer clears when the player clicks the control",
  );
});
test("dismissed Kiko disappears without a launcher and returns at the next saved checkpoint", () => {
  const data = base(),
    storage = new Map(),
    h = harness(data, storage);
  h.button("Minimize Kiko guidance").props.onClick();
  h.render();
  assert.equal(h.button("Ask Kiko for help"), undefined);
  assert.equal(h.button("Show me"), undefined);
  assert.equal(
    harness(data, storage).button("Show me"),
    undefined,
    "dismissal survives reload without a launcher",
  );
  data.dayOne.records[0].researchSelection = { genreId: "fitness" };
  h.render();
  assert.match(h.text(), /Find your mission/);
});
test("saved progress automatically points to the next checkpoint without another Show me", () => {
  const data = base(),
    h = harness(data);
  h.button("Show me").props.onClick();
  h.render();
  assert.ok(h.pointer());
  data.dayOne.records[0].researchSelection = { genreId: "fitness" };
  h.render();
  assert.ok(h.pointer());
  assert.match(h.text(), /Find your mission/);
});
test("automatic guidance waits for confirmed progress and for the next controls to load", () => {
  const data = base(),
    h = harness(data);
  h.button("Show me").props.onClick();
  h.render();
  h.clickTarget();
  assert.equal(h.pointer(), undefined);
  h.render();
  assert.equal(
    h.pointer(),
    undefined,
    "an unchanged or failed action must not advance guidance",
  );
  h.setControlsReady(false);
  data.dayOne.records[0].researchSelection = { genreId: "fitness" };
  h.render();
  assert.equal(h.pointer(), undefined, "wait for the actual question cards");
  h.setControlsReady(true);
  assert.ok(h.pointer(), "guide resumes automatically once controls mount");
  const record = data.dayOne.records[0];
  for (const saved of [
    { genreId: "fitness-3", researchAssignment: { questionId: "fitness-3" } },
    { acknowledgedAt: "accepted" },
    { startedAt: "started", deadline: "2026-11-14T06:00:00Z" },
    { draft: { url: "https://example.org/chat" } },
    { submissions: [{ id: "saved" }], verification: { status: "PENDING" } },
  ]) {
    h.clickTarget();
    Object.assign(record, saved);
    h.render();
    assert.ok(h.pointer());
  }
  assert.equal(
    h.counts.click,
    0,
    "automatic pointers never click game controls",
  );
  assert.equal(h.counts.mission + h.counts.map + h.counts.next, 0);
});
test("automatic guidance resumes on reload and can be dismissed", () => {
  const data = base(),
    storage = new Map(),
    h = harness(data, storage);
  h.button("Show me").props.onClick();
  h.render();
  const resumed = harness(JSON.parse(JSON.stringify(data)), storage);
  assert.equal(resumed.pointer(), undefined, "a previously shown step does not repeat on reload");
  resumed.props.data.dayOne.records[0].researchSelection = {
    genreId: "fitness",
  };
  resumed.render();
  resumed.button("Minimize Kiko guidance").props.onClick();
  resumed.render();
  resumed.props.data.dayOne.records[0].genreId = "fitness-3";
  resumed.render();
  assert.equal(
    resumed.pointer(),
    undefined,
    "manual dismissal stops the automatic arrows",
  );
});

test("a second browser reads account guidance history without browser storage", () => {
  const data = base(), accounts = new Map(), first = harness(data, new Map(), {}, accounts);
  first.button("Show me").props.onClick();
  first.render();
  const second = harness(structuredClone(data), new Map(), {}, accounts);
  assert.equal(second.button("Show me"), undefined);
  assert.equal(second.pointer(), undefined);
  data.dayOne.records[0].researchSelection = { genreId: "fitness" };
  const next = harness(data, new Map(), {}, accounts);
  assert.match(next.text(), /Find your mission/);
  assert.ok(next.pointer(), "automatic arrows carry over for the next unseen step");
  assert.equal(harness(data, new Map(), {}, accounts).button("Show me"), undefined);
});
test("Kiko yields to dialogs and returns when they close", () => {
  const h = harness(base());
  h.setModal(true);
  assert.equal(h.render(), null);
  h.setModal(false);
  assert.match(h.text(), /Choose your world/);
});

test("Kiko introduces helicopter travel once, even after another step, reload or record scope change", () => {
  const data = base(), storage = new Map(), h = harness(data, storage);
  h.props.travelling = true;
  h.render();
  assert.match(h.text(), /Next stop: discovery/);
  h.render();
  assert.match(h.text(), /Next stop: discovery/, "keep the first appearance visible during this journey");
  h.props.travelling = false;
  data.dayOne.records[0].researchSelection = { genreId: "fitness" };
  h.render();
  h.button("Minimize Kiko guidance").props.onClick();
  h.render();
  h.props.travelling = true;
  h.render();
  assert.equal(h.render(), null, "later travel should be silent");
  assert.equal(harness(data, storage, { travelling: true }).render(), null, "refresh must not repeat it");
  data.dayOne.records[0]._id = "new-record-scope";
  data.dayOne.records[0].config = { version: 2 };
  assert.equal(harness(data, storage, { travelling: true }).render(), null);
  const other = base();
  other.user._id = "another-player";
  other.dayOne.records[0].userId = "another-player";
  assert.match(harness(other, storage, { travelling: true }).text(), /Next stop: discovery/);
});

test("travel guidance hidden by a dialog is not consumed before it can be seen", () => {
  const h = harness(base());
  h.setModal(true);
  h.props.travelling = true;
  assert.equal(h.render(), null);
  h.setModal(false);
  assert.match(h.text(), /Next stop: discovery/);
});

test("a dialog already open on first arrival does not consume hidden guidance", () => {
  const accounts = new Map(), data = base();
  const h = harness(data, new Map(), { modalInitiallyOpen: true }, accounts);
  assert.equal(h.render(), null);
  assert.ok(![...accounts.values()][0].seen.includes("genre"));
  h.setModal(false);
  assert.match(h.text(), /Choose your world/);
});

test("an existing dismissed travel message stays dismissed after subsequent guidance", () => {
  const data = base(), storage = new Map([[pipScope(data), "travelling"]]);
  const h = harness(data, storage, { travelling: true });
  assert.equal(h.render(), null);
  h.props.travelling = false;
  h.render();
  h.button("Minimize Kiko guidance").props.onClick();
  h.render();
  assert.equal(harness(data, storage, { travelling: true }).render(), null);
});
test("chat submission hides the redundant Click here label while other steps retain it", () => {
  const data = base(),
    h = harness(data);
  h.button("Show me").props.onClick();
  h.render();
  assert.equal(h.pointer().props.label, "Click here");
  Object.assign(data.dayOne.records[0], {
    genreId: "fitness-3",
    acknowledgedAt: "accepted",
    startedAt: "started",
    deadline: "2026-11-14T06:00:00Z",
    draft: { url: "https://example.org/chat" },
  });
  h.render();
  assert.ok(h.pointer(), "keep the useful submission arrow");
  assert.equal(h.pointer().props.label, "");
});
test("Find Level 1 locates and points to Play without clicking it", () => {
  const data = base();
  data.playSession = { state: "NOT_IN", available: true };
  const h = harness(data);
  h.button("Find clock-in").props.onClick();
  assert.equal(h.counts.click, 1);
  data.playSession.state = "ACTIVE";
  h.props.missionOpen = false;
  h.render();
  h.button("Find Level 1").props.onClick();
  assert.ok(h.counts.mission >= 1, "select the Level 1 checkpoint in the dock");
  h.render();
  assert.ok(h.pointer(), "point at Play and wait for the player to click it");
  assert.equal(
    h.counts.click,
    1,
    "only the earlier clock-control click occurred",
  );
  assert.equal(h.counts.map + h.counts.next, 0);
});
