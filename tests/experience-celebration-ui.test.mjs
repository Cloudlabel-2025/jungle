import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";

test("level-up appears over the live page as an automatic animation without controls", async () => {
  const compiled = await build({ entryPoints: ["components/ExperienceCelebration.js"], bundle: true, packages: "external", platform: "node", format: "cjs", write: false, alias: { "@": resolve(".") }, loader: { ".js": "jsx" }, jsx: "automatic" });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.RankCelebration, { result: { to: 4, gained: 500 }, close() {} }));
  assert.match(html, /role="status"/);
  assert.match(html, /You reached Level 4/);
  assert.match(html, /LEVEL UP!/);
  assert.match(html, /--rank-duration:1500ms/);
  assert.match(html, /reward-celebration-backdrop/);
  assert.match(html, /reward-celebration-window/);
  assert.doesNotMatch(html, /<button|role="dialog"|aria-modal|Close dialog|progressbar|XP earned|Keep exploring/);
});
