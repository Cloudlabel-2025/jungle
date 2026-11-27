import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { staffDashboardFixture } from "./staff-dashboard-fixture.mjs";

const output = await build({ entryPoints: ["components/Views.js"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".js": "jsx" }, alias: { "@": process.cwd() } });
const compiled = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { StaffView } = compiled.exports;
const render = role => renderToStaticMarkup(createElement(StaffView, { screen: "dashboard", data: staffDashboardFixture(role), now: new Date("2026-11-27T10:00:00Z"), act: async () => ({ success: true }) }));

test("MC dashboard has compact paginated sections and Guide-specific operations", () => {
  const html = render("MISSION_COMMANDER");
  assert.match(html, /Guide’s lookout/);
  for (const section of ["overview", "squads", "attention", "actions", "programme", "support"]) {
    assert.ok(html.includes(`id="mc-${section}"`));
    assert.ok(html.includes(`href="#mc-${section}"`));
  }
  assert.match(html, /1–6 of 8 squads/);
  assert.match(html, /1–4 of 6 blockers/);
  assert.match(html, /1–4 of 7 deadlines/);
  assert.match(html, /href="\/commander\/sprints\?board=programme"/);
  assert.match(html, /href="\/commander\/coaching"/);
  assert.match(html, /href="\/commander\/week-one-assessments"/);
  assert.match(html, /Review evidence/);
  assert.equal((html.match(/class="cc-quick-actions"/g) || []).length, 1);
  assert.match(html, /Search support tickets/);
  assert.match(html, /Knowledge Library/);
  assert.doesNotMatch(html, /Download PDF|\/api\/support\/export|\/centre-command\//);
  assert.doesNotMatch(html, /Need an owner|Set up a sprint|Prepare the flight/);
  assert.doesNotMatch(html, />Unassigned</);
});

test("MC programme shortcuts use the compact CC-style layout by default", async () => {
  const result = await build({ entryPoints: ["components/CommandMissionBoard.js"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".js": "jsx" }, alias: { "@": process.cwd() } });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const html = renderToStaticMarkup(createElement(module.exports.default, { data: staffDashboardFixture() }));
  assert.equal((html.match(/class="cc-quick-link"/g) || []).length, 3);
  assert.match(html, /Review results/);
  assert.match(html, /Open questions/);
  assert.match(html, /Review evidence/);
  assert.doesNotMatch(html, /Keep your crew moving|command-mission-board|Enter station/);
});

test("MC navigation omits unavailable programme shortcuts and support sections", () => {
  const data = staffDashboardFixture();
  delete data.weekOneProgram;
  delete data.support;
  const html = renderToStaticMarkup(createElement(StaffView, { screen: "dashboard", data, now: new Date("2026-11-27T10:00:00Z"), act: async () => ({ success: true }) }));
  assert.doesNotMatch(html, /href="#mc-actions"|href="#mc-support"/);
  assert.match(html, /id="mc-programme"/);
});

test("CC dashboard retains its administration tools and export", () => {
  const html = render("CENTRE_COMMAND");
  assert.match(html, /id="cc-overview"/);
  assert.match(html, /href="#cc-programme"/);
  assert.match(html, /Set up a sprint/);
  assert.match(html, /Download PDF/);
});
