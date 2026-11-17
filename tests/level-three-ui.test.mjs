import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { validateDayContent } from "../lib/week-one-program-rules.js";
import {
  levelThreeComics,
  levelThreeScenarioComic,
} from "../lib/level-three-comics.js";
import { missionEvidenceState } from "../lib/level-two-missions.js";
import {
  missionAnswerPresent,
  signalPathCheck,
} from "../lib/level-three-missions.js";

const config = fixtureConfig(),
  pack = validateDayContent(3, starterFlightContent(3, config), config),
  now = new Date("2026-11-17T05:00:00Z");
async function load(file, name = "default") {
  const bundle = await build({
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
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  return module.exports[name];
}
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
const record = (activity = pack.activities[1], draft = {}) => ({
  _id: `saved:${activity.id}`,
  userId: "p",
  activityId: activity.id,
  day: 3,
  version: 9,
  data: {
    activity,
    variant: activity.variants[0],
    draft,
    submissions: [],
    startedAt: "2026-11-17T04:30:00Z",
    deadline: "2026-11-17T05:30:00Z",
    savedAt: "2026-11-17T04:59:00Z",
    extensions: [],
  },
});
const act = () =>
  assert.fail("Rendering must never start, save or submit a mission");

test("all eight Level 3 stories have four illustrated scenes and preserve edited or historical briefs", () => {
  assert.equal(levelThreeComics.length, 8);
  for (const activity of pack.activities)
    for (const variant of activity.variants) {
      const comic = levelThreeScenarioComic(activity.id, variant);
      assert.ok(comic, variant.name);
      assert.equal(comic.panels.length, 4);
      assert.ok(
        comic.panels.every((p) => p.dialogue && p.evidence && p.alt && p.clue),
      );
      const file = resolve(`public${comic.image}`);
      assert.ok(existsSync(file));
      assert.equal(readFileSync(file).subarray(8, 12).toString(), "WEBP");
      assert.equal(
        levelThreeScenarioComic(activity.id, {
          ...variant,
          brief: variant.brief + " Edited clue.",
        }),
        null,
      );
      assert.equal(
        levelThreeScenarioComic(activity.id, {
          ...variant,
          id: "custom-variant",
        }),
        null,
      );
    }
  const technical = pack.activities[1].variants[0];
  assert.equal(
    levelThreeScenarioComic("D3-G02", {
      ...technical,
      cards: [...technical.cards].reverse(),
    }),
    null,
  );
});

test("Level 3 has two illustrated mission cards, saved status, its own rewards and a protected lock state", async () => {
  const Scene = await load("components/LevelTwoMissionScene.js"),
    saved = record();
  const data = {
    user: { _id: "p" },
    weekOneProgram: {
      days: [{ day: 3, state: "OPEN", activities: pack.activities }],
      attempts: [saved],
      progression: {
        mode: "COMPLETION",
        levels: [{ day: 3, available: true }],
      },
    },
  };
  const html = render(Scene, { data, dayNumber: 3, now, act });
  const plain = html.replace(/<!--.*?-->/g, "");
  for (const text of [
    "Tell your STORY",
    "The Clue That Does Not Fit",
    "Follow That Click!",
    "Resume investigation",
    "225–450 XP",
    "unlock Level 4",
    "l3-mission-cover",
  ])
    assert.ok(plain.includes(text), text);
  assert.doesNotMatch(html, /<textarea|<select|<form/);
  data.weekOneProgram.progression.levels[0].available = false;
  const locked = render(Scene, { data, dayNumber: 3, now, act });
  assert.ok(locked.includes("Finish your previous discovery"));
  assert.ok(!locked.includes("Explore mission"));
});

test("a saved component order restores and advances to the first missing STORY note without resetting time", async () => {
  const Editor = await load(
      "components/LevelTwoMissionScene.js",
      "LevelTwoInvestigation",
    ),
    saved = record();
  saved.data.draft = {
    sequence: [...saved.data.variant.cards],
    scene: "A saved scene that must remain unchanged.",
  };
  const before = structuredClone(saved),
    html = render(Editor, {
      record: saved,
      ownerId: "p",
      dayOpen: true,
      now,
      act,
    });
  assert.equal(missionEvidenceState(saved, now).firstMissing, 2);
  assert.ok(html.includes("T · Tell the need"));
  assert.ok(html.includes("30:00"));
  assert.ok(html.includes("Saved notes restored"));
  assert.ok(!html.includes("Replay comic"));
  assert.ok(html.includes("Build your STORY"));
  assert.equal((html.match(/<textarea/g) || []).length, 1);
  assert.deepEqual(saved, before);
});

test("Level 3 evidence challenges inspect clues without replacing custom saved briefs or starting timers", async () => {
  const Board = await load(
    "components/LevelThreeChallenge.js",
    "EvidenceBoard",
  );
  const Launch = await load(
    "components/LevelThreeChallenge.js",
    "LevelThreeLaunch",
  );
  const variant = pack.activities[0].variants[0];
  const html = render(Board, { activityId: "D3-G01", variant });
  assert.equal((html.match(/aria-pressed=/g) || []).length, 3);
  assert.ok(html.includes("A garden discovery"));
  assert.ok(html.includes("A warmer day"));
  assert.ok(html.includes("NEXT LEAD"));
  assert.ok(html.includes("Original mission briefing"));
  const custom = render(Board, {
    activityId: "D3-G01",
    variant: {
      ...variant,
      brief: "A custom saved brief with different evidence.",
    },
  });
  assert.ok(custom.includes("A custom saved brief with different evidence."));
  assert.ok(!custom.includes("A warmer day"));
  const launch = render(Launch, {
    activityId: "D3-G01",
    variant,
    onBegin: act,
    disabled: true,
  });
  assert.ok(launch.includes("Launch challenge"));
  assert.ok(launch.includes("disabled"));
  assert.ok(!launch.includes("Next spread"));
});

test("signal rehearsal distinguishes an incomplete route, wrong order and successful delivery without changing the saved route", () => {
  const cards = pack.activities[1].variants[0].cards;
  assert.deepEqual(signalPathCheck(cards, cards.slice(0, 2)), {
    ready: false,
    mismatch: -1,
  });
  assert.deepEqual(signalPathCheck(cards, cards), {
    ready: true,
    mismatch: -1,
  });
  const wrong = [cards[1], cards[0], ...cards.slice(2)],
    before = [...wrong];
  assert.deepEqual(signalPathCheck(cards, wrong), { ready: true, mismatch: 0 });
  assert.deepEqual(wrong, before);
});

test("canonical investigation launch is an illustrated clue hunt with a visible launch action, while edited briefs retain their own evidence", async () => {
  const Launch = await load(
    "components/LevelThreeChallenge.js",
    "LevelThreeLaunch",
  );
  for (const variant of pack.activities[0].variants) {
    const before = structuredClone(variant);
    const html = render(Launch, {
      activityId: "D3-G01",
      variant,
      onBegin: act,
    });
    assert.ok(html.includes("l3-hunt-stage"));
    assert.ok(
      html.includes("xMidYMid meet"),
      "Full artwork is contained, not cropped",
    );
    assert.equal((html.match(/aria-label="Inspect clue /g) || []).length, 3);
    assert.ok(html.includes("1/3 clues found"));
    assert.ok(html.includes("/images/pip/pip-guiding.webp"));
    assert.ok(html.includes("Launch challenge"));
    assert.ok(!html.includes("l3-original-brief"));
    assert.deepEqual(variant, before);
  }
  const custom = render(Launch, {
    activityId: "D3-G01",
    variant: {
      ...pack.activities[0].variants[3],
      brief: "Saved custom traffic investigation.",
    },
    onBegin: act,
  });
  assert.ok(custom.includes("Saved custom traffic investigation."));
  assert.ok(!custom.includes("l3-hunt-stage"));
});

test("component journey uses valid complete permutations, touch buttons, reorder and read-only saved evidence", async () => {
  const Board = await load("components/ComponentSequenceBoard.js"),
    cards = pack.activities[1].variants[0].cards;
  assert.equal(missionAnswerPresent("sequence", cards, cards), true);
  assert.equal(
    missionAnswerPresent("sequence", [cards[0], cards[0]], cards),
    false,
  );
  const editable = render(Board, {
    cards,
    value: [cards[2], cards[0]],
    onChange: act,
  });
  assert.ok(editable.includes("Move Server validation and permissions down"));
  assert.ok(editable.includes("Remove Browser action"));
  assert.ok(editable.includes("API request"));
  const readOnly = render(Board, {
    cards,
    value: cards,
    readOnly: true,
    onChange: act,
  });
  assert.equal(
    (readOnly.match(/<button/g) || []).length,
    (readOnly.match(/disabled=""/g) || []).length,
  );
  const Editor = await load(
      "components/LevelTwoMissionScene.js",
      "LevelTwoInvestigation",
    ),
    saved = record(undefined, { sequence: [cards[2]] });
  saved.data.deadline = "2026-11-17T04:59:00Z";
  const html = render(Editor, {
    record: saved,
    ownerId: "p",
    dayOpen: true,
    now,
    act,
  });
  assert.ok(html.includes("Your timer ended"));
  assert.ok(html.includes("Server validation and permissions"));
});
