import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
async function load(file, name = "default") {
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
  const module = { exports: {} };
  new Function("require", "module", "exports", b.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  return module.exports[name];
}
const render = (C, p) => renderToStaticMarkup(React.createElement(C, p));
test("each Level 2–5 game guide publishes its actual star requirements and reward ladder", async () => {
  const Guide = await load(
    "components/WeekOneStarGuide.js",
    "WeekOneStarGuideContent",
  );
  for (const day of [2, 3, 4, 5]) {
    const html = render(Guide, { day });
    for (const phrase of [
      "12 words",
      "both missions",
      "15 trophies",
      "25 trophies",
      "30 trophies",
      "75 XP",
      "125 XP",
      "150 XP",
      "saved timers",
      "Factual accuracy",
    ]) {
      if (phrase === "Factual accuracy") assert.match(html, /factual accuracy/);
      else assert.ok(html.includes(phrase), `${day}: ${phrase}`);
    }
    if (day === 3) assert.ok(html.includes("correct order"));
    if (day === 5) assert.ok(html.includes("80%"));
  }
});
test("reward card renders saved stars and credits; staff controls are hidden from players", async () => {
  const Rewards = await load(
      "components/WeekOneStarGuide.js",
      "FlightLevelRewards",
    ),
    Controls = await load("components/WeekOneLevelControls.js");
  const data = {
    user: { _id: "p", role: "GAMER" },
    weekOneProgram: {
      levelResults: [
        {
          userId: "p",
          day: 2,
          result: { completed: true, stars: 2, reason: "Published checks met" },
          creditedTrophies: 25,
          creditedXp: 125,
        },
      ],
      levelTargets: { members: [], teams: [] },
    },
  };
  const html = render(Rewards, { data, day: 2 });
  for (const text of [
    "2 of 3 stars earned",
    "25 trophies",
    "125",
    "How to earn 3 stars",
  ])
    assert.ok(html.includes(text));
  assert.equal(render(Controls, { data, act() {} }), "");
  data.user.role = "MISSION_COMMANDER";
  const staff = render(Controls, { data, act() {} });
  for (const text of ["Levels 2–5", "Allow replay", "Reopen", "Level 5"])
    assert.ok(staff.includes(text));
});
