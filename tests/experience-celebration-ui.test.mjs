import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";

test("promotion announces the new level without a dialog, controls or XP breakdown", async () => {
  const compiled = await build({ entryPoints: ["components/ExperienceCelebration.js"], bundle: true, packages: "external", platform: "node", format: "cjs", write: false, alias: { "@": resolve(".") }, loader: { ".js": "jsx" }, jsx: "automatic" });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.RankCelebration, { result: { to: 4, gained: 500 }, close() {} }));
  assert.match(html, /role="status"/);
  assert.match(html, /You reached Level 4/);
  assert.match(html, /LEVEL UP!/);
  assert.match(html, /--rank-duration:3000ms/);
  assert.doesNotMatch(html, /<button|role="dialog"|progressbar|XP earned|Keep exploring/);
});
