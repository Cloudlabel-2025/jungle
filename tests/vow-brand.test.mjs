import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import manifest from "../app/manifest.js";
import { brand } from "../lib/brand.js";
async function load(file, name = "default", runtime = {}) {
  const b = await build({
    entryPoints: [file],
    bundle: true,
    packages: "external",
    platform: "node",
    format: "cjs",
    write: false,
    alias: { "@": resolve(".") },
    loader: { ".js": "jsx" },
    jsx: "automatic",
  });
  const m = { exports: {} },
    require = createRequire(import.meta.url);
  new Function(
    "require",
    "module",
    "exports",
    "setTimeout",
    "clearTimeout",
    b.outputFiles[0].text,
  )(
    (id) => (id === "react" && runtime.react ? runtime.react : require(id)),
    m,
    m.exports,
    runtime.setTimeout || setTimeout,
    runtime.clearTimeout || clearTimeout,
  );
  return m.exports[name];
}
const render = (C, p) => renderToStaticMarkup(React.createElement(C, p));
test("VOW uses the supplied optimized emblem and correctly sized browser and home-screen icons", async () => {
  assert.equal(brand.name, "Voyage of Wilderness");
  const logo = await sharp(`public${brand.logo}`).metadata();
  assert.equal(logo.width, 1024);
  assert.equal(logo.height, 1024);
  assert.equal(logo.format, "webp");
  for (const size of [64, 180, 192, 512]) {
    const icon = await sharp(`public/brand/vow-icon-v2-${size}.png`).metadata();
    assert.equal(icon.width, size);
    assert.equal(icon.height, size);
  }
  const m = manifest();
  assert.equal(m.name, brand.name);
  assert.equal(m.short_name, "VOW");
  assert.equal(m.orientation, "landscape");
  assert.equal(m.icons.length, 2);
});
test("the loading screen shows VOW branding, real waiting text and an optional working exit", async () => {
  const Loader = await load("components/GameLoadingScreen.js"),
    html = render(Loader, { flight: true, onCancel: () => {} });
  for (const text of [
    brand.name,
    brand.logo,
    "Preparing your flight",
    "Back to sign-in",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("CODEWILD"));
  assert.ok(!html.includes('role="progressbar"'));
  assert.ok(!html.includes("100%"));
  const fallback = render(Loader, {});
  assert.ok(fallback.includes("Preparing your voyage"));
  assert.ok(!fallback.includes("Back to sign-in"));
  const Brand = await load("components/VowBrand.js");
  const wordmark = render(Brand, {});
  assert.ok(wordmark.includes("VOW"));
  assert.ok(wordmark.includes(brand.name));
});
test("entry loading ends as soon as data is ready and never repeats for background refreshes", async () => {
  let cursor = 0,
    slots = [],
    effects = [],
    timers = new Map(),
    next = 0;
  const react = {
    useRef(value) {
      const i = cursor++;
      return slots[i] ?? (slots[i] = { current: value });
    },
    useState(value) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof value === "function" ? value() : value;
      return [
        slots[i],
        (v) => (slots[i] = typeof v === "function" ? v(slots[i]) : v),
      ];
    },
    useEffect(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((d, n) => d !== old.deps[n])) {
        effects.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const hook = await load(
    "components/GameLoadingScreen.js",
    "useGameEntryLoading",
    {
      react,
      setTimeout: (fn) => {
        const id = ++next;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  const frame = (id, ready, error) => {
    cursor = 0;
    const result = hook(id, ready, error);
    const pending = effects;
    effects = [];
    pending.forEach((fn) => fn());
    return result;
  };
  assert.equal(frame("a", false, null), false);
  for (const fn of [...timers.values()]) fn();
  timers.clear();
  assert.equal(frame("a", false, null), true);
  assert.equal(frame("a", true, null), false);
  assert.equal(frame("a", false, null), false);
  assert.equal(timers.size, 0);
  assert.equal(frame("b", false, null), false);
  for (const fn of [...timers.values()]) fn();
  timers.clear();
  assert.equal(frame("b", false, null), true);
  assert.equal(frame("b", false, "Network unavailable"), false);
  assert.equal(frame(null, false, null), false);
});
