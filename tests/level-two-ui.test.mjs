import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { missionEvidenceState } from "../lib/level-two-missions.js";
import { activities } from "../lib/week-one-catalog.js";

async function component(name = "default") {
  const bundle = await build({
    entryPoints: ["components/LevelTwoMissionScene.js"],
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
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  return module.exports[name];
}
const now = new Date("2026-11-14T10:00:00Z");
const missions = activities.filter((a) => a.day === 2);
const makeRecord = (activity = missions[0], draft = {}) => ({
  _id: `saved:${activity.id}`,
  activityId: activity.id,
  version: 7,
  data: {
    activity,
    variant: {
      id: "variant-1",
      name: "Saved scenario",
      brief: "Your pinned scenario and supplied clues remain unchanged.",
    },
    draft,
    submissions: [],
    startedAt: "2026-11-14T09:30:00Z",
    deadline: "2026-11-14T10:30:00Z",
    savedAt: "2026-11-14T09:55:00Z",
    extensions: [],
  },
});
const act = () => {
  throw Error("Rendering must never start or submit a mission");
};
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));

test("Level 2 opens with two game cards and saved mission status, without dropdowns or an exposed form", async () => {
  const Scene = await component();
  const saved = makeRecord(missions[1], { cause: "A saved cause" });
  const html = render(Scene, {
    data: {
      user: { _id: "p" },
      weekOneProgram: {
        days: [{ day: 2, state: "OPEN", activities: missions }],
        attempts: [saved],
      },
    },
    act,
    now,
  });
  assert.ok(html.includes("The Conflicting Instructions"));
  assert.ok(html.includes("The Lost Flight Signal"));
  assert.ok(html.includes("Explore mission"));
  assert.ok(html.includes("Resume investigation"));
  assert.ok(html.includes("art-signals"));
  assert.ok(html.includes("art-radar"));
  assert.ok(!/alumni|portal/i.test(html));
  assert.ok(!html.includes("<select"));
  assert.ok(!html.includes("<textarea"));
  assert.ok(!html.includes("<form"));
});

test("a saved investigation resumes at the first missing note and restores the pinned brief and timer", async () => {
  const Editor = await component("LevelTwoInvestigation");
  const record = makeRecord(missions[0], {
    finding1: "The organiser confirmed the venue.",
  });
  const html = render(Editor, {
    record,
    ownerId: "p",
    dayOpen: true,
    now,
    act,
  });
  assert.ok(html.includes("Spot the conflicting clue"));
  assert.ok(html.includes("Saved notes restored"));
  assert.ok(html.includes("30:00"));
  assert.ok(
    html.includes("Your pinned scenario and supplied clues remain unchanged."),
  );
  assert.equal((html.match(/<textarea/g) || []).length, 1);
  assert.ok(!html.includes("Launch investigation"));
  assert.equal(missionEvidenceState(record, now).firstMissing, 1);
});

test("expired investigations show only saved evidence and offer saved-note transmission", async () => {
  const Editor = await component("LevelTwoInvestigation");
  const draft = Object.fromEntries(
    missions[1].fields.map((key) => [key, `Saved ${key} evidence`]),
  );
  const record = makeRecord(missions[1], draft);
  record.data.deadline = "2026-11-14T09:59:00Z";
  const html = render(Editor, {
    record,
    ownerId: "p",
    dayOpen: true,
    now,
    act,
  });
  assert.ok(html.includes("Your timer ended"));
  assert.ok(html.includes("Transmit saved notes"));
  assert.ok(html.includes("Saved update evidence"));
  assert.ok(html.includes('readOnly=""') || html.includes('readonly=""'));
});

test("completed work shows a debrief, preserves review/revision tools and only offers the next level when unlocked", async () => {
  const Editor = await component("LevelTwoInvestigation");
  const record = makeRecord();
  record.data.submissions = [
    { id: "submitted", complete: true, at: now.toISOString(), answers: {} },
  ];
  let html = render(Editor, {
    record,
    ownerId: "p",
    dayOpen: true,
    now,
    act,
    levelComplete: false,
  });
  assert.ok(html.includes("DISCOVERY SECURED"));
  assert.ok(html.includes("Choose the other mission"));
  assert.ok(html.includes("Revise discovery"));
  assert.ok(!html.includes("<textarea"));
  assert.ok(!html.includes("Continue to Level 3"));
  html = render(Editor, {
    record,
    ownerId: "p",
    dayOpen: false,
    now,
    act,
    levelComplete: true,
    onNext: () => {},
  });
  assert.ok(html.includes("Continue to Level 3"));
  assert.ok(!html.includes("Revise discovery"));
});
