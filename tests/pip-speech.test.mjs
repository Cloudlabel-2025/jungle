import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build, transform } from "esbuild";

const source = readFileSync("components/PipSpeech.js", "utf8")
  .replace(/^import .*;\r?$/gm, "")
  .replace("export default function", "function");
const { code } = await transform(source + "\nreturn PipSpeech;", {
  loader: "jsx",
  jsx: "transform",
});
function harness(initial, reduce = false) {
  let state,
    dependencies,
    effect,
    cleanup,
    tick,
    text = initial;
  const Speech = new Function(
    "React",
    "useState",
    "useEffect",
    "window",
    "setInterval",
    "clearInterval",
    code,
  )(
    React,
    (initialState) => [
      (state ||= initialState),
      (value) => {
        state = value;
      },
    ],
    (nextEffect, deps) => {
      if (dependencies?.[0] !== deps[0]) {
        dependencies = deps;
        effect = nextEffect;
      }
    },
    { matchMedia: () => ({ matches: reduce }) },
    (callback) => {
      tick = callback;
      return 1;
    },
    () => {
      tick = null;
    },
  );
  function render() {
    let tree = Speech({ text });
    if (effect) {
      cleanup?.();
      const run = effect;
      effect = null;
      cleanup = run();
      tree = Speech({ text });
    }
    return tree;
  }
  return {
    render,
    advance: (count) => {
      for (let i = 0; i < count && tick; i++) tick();
      return render();
    },
    replace: (value) => {
      text = value;
      return render();
    },
    unmount: () => cleanup?.(),
    hasTimer: () => !!tick,
  };
}
const visible = (tree) => tree.props.children[2].props.children[0];
test("Pip reveals dialogue gradually and stops the timer at the end", () => {
  const h = harness("Hey, explorer!");
  assert.equal(visible(h.render()), "");
  assert.equal(visible(h.advance(4)), "Hey,");
  const finished = h.advance(100);
  assert.equal(visible(finished), "Hey, explorer!");
  assert.equal(finished.props["data-speaking"], false);
  assert.equal(h.hasTimer(), false);
});
test("new dialogue restarts cleanly; unmount clears the timer; Unicode stays intact", () => {
  const h = harness("Hello");
  h.render();
  h.advance(2);
  assert.equal(visible(h.replace("Go 🚁")), "");
  assert.equal(visible(h.advance(4)), "Go 🚁");
  h.replace("Longer dialogue");
  h.unmount();
  assert.equal(h.hasTimer(), false);
});
test("reduced motion reads immediately and screen readers receive the complete dialogue once", () => {
  const h = harness("Ready to fly?", true),
    tree = h.render();
  assert.equal(visible(tree), "Ready to fly?");
  assert.equal(h.hasTimer(), false);
  assert.equal(tree.props.children[0].props.role, "status");
  assert.equal(tree.props.children[0].props.children, "Ready to fly?");
  assert.equal(tree.props.children[2].props["aria-hidden"], "true");
});

test("arrival places Pip outside the clock-in panel and leaves Clock in enabled during speech", async () => {
  const result = await build({
    entryPoints: ["components/AttendancePrompt.js"],
    bundle: true,
    platform: "node",
    packages: "external",
    alias: { "@": resolve(".") },
    loader: { ".js": "jsx" },
    jsx: "automatic",
    format: "cjs",
    write: false,
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  const Prompt = module.exports.default;
  const data = {
    user: { _id: "me", role: "GAMER" },
    story: { flight: true },
    playSession: { state: "NOT_IN", available: true, day: "2026-11-14" },
  };
  const render = () =>
    renderToStaticMarkup(
      React.createElement(Prompt, {
        data,
        now: new Date(),
        act: () => {
          throw Error("Rendering must not clock in");
        },
        close: () => {},
      }),
    );
  let html = render();
  assert.ok(html.indexOf('class="modal-companion"') < html.indexOf("<section"));
  assert.ok(html.includes("I&#x27;m Pip, your flight buddy"));
  assert.equal((html.match(/aria-modal="true"/g) || []).length, 1);
  assert.match(html, /<button class="btn primary">Clock in<\/button>/);
  assert.ok(
    !html.includes("Welcome back. Clock in to start your play session."),
  );
  data.playSession.hasClockedIn = true;
  data.playSession.day = "2026-11-15";
  html = render();
  assert.ok(
    !html.includes("modal-companion-layout"),
    "a later day's clock-in must not repeat Pip's tutorial",
  );
  assert.ok(html.includes("Clock in to play"));
  data.playSession.hasClockedIn = false;
  data.playSession.state = "OUT";
  assert.ok(
    !render().includes("modal-companion-layout"),
    "same-day return must not repeat the tutorial",
  );
  data.playSession.state = "NOT_IN";
  data.story.flight = false;
  html = render();
  assert.ok(
    !html.includes("modal-companion-layout"),
    "other attendance dialogs retain their original layout",
  );
  data.story.flight = true;
  data.playSession.available = false;
  data.playSession.reason = "Day not released";
  html = render();
  assert.ok(html.includes("waiting for clearance"));
  assert.ok(!html.includes(">Clock in</button>"));
});
