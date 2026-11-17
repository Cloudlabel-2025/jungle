import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { levelTwoComics, scenarioComic } from "../lib/level-two-comics.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { validateDayContent } from "../lib/week-one-program-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { companionText, sameCompanionBrief } from "../lib/companion-name.js";

test("Kiko's display name preserves old published brief matches without accepting changed evidence", () => {
  assert.equal(companionText("Pip and PIP are the flight companion."), "Kiko and KIKO are the flight companion.");
  const config=fixtureConfig(),pack=validateDayContent(2,starterFlightContent(2,config),config);
  for (const activity of pack.activities) for (const variant of activity.variants) {
    const legacy={...variant,brief:variant.brief.split("Kiko").join("Pip")};
    assert.equal(scenarioComic(activity.id,legacy)?.slug,scenarioComic(activity.id,variant)?.slug);
    assert.equal(sameCompanionBrief(variant.brief,legacy.brief),true);
    assert.equal(scenarioComic(activity.id,{...legacy,brief:legacy.brief+" Different evidence."}),null);
  }
});

async function component(
  name = "default",
  file = "components/ScenarioComic.js",
  harness,
) {
  const result = await build({
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
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", "window", "requestAnimationFrame", "cancelAnimationFrame", result.outputFiles[0].text)(
    (id) => id === "react" && harness ? harness.react : require(id),
    module,
    module.exports,
    harness?.window,
    harness?.requestAnimationFrame,
    harness?.cancelAnimationFrame,
  );
  return module.exports[name];
}
const render = (C, props) =>
  renderToStaticMarkup(React.createElement(C, props));

test("comic typing finishes within one second and cancels pending frames when a slide is replaced", async () => {
  const effects = [], counts = [], cancelled = [], frames = new Map();
  let id = 0, reduced = false;
  const harness = {
    react: { ...React, useState: () => [0, (n) => counts.push(n)], useEffect: (f) => effects.push(f) },
    window: { matchMedia: () => ({ matches: reduced }) },
    requestAnimationFrame: (f) => { frames.set(++id, f); return id; },
    cancelAnimationFrame: (n) => { cancelled.push(n); frames.delete(n); },
  };
  const Typed = await component("ComicTypedText", "components/ScenarioComic.js", harness);
  const text = "A fresh scene! ".repeat(20);
  Typed({ text });
  const cleanup = effects.pop()();
  const tick = (time) => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((f) => f(time)); };
  tick(0); tick(300);
  assert.ok(counts.at(-1) > 0 && counts.at(-1) < text.length);
  tick(1000);
  assert.equal(counts.at(-1), text.length);
  assert.equal(frames.size, 0);
  cleanup();
  Typed({ text: "Next scene" });
  const stop = effects.pop()();
  assert.equal(frames.size, 1);
  stop();
  assert.equal(frames.size, 0);
  assert.ok(cancelled.length > 0);
  reduced = true;
  Typed({ text: "Instant accessible dialogue" });
  effects.pop()();
  assert.equal(counts.at(-1), "Instant accessible dialogue".length);
  assert.equal(frames.size, 0);
});

test("all eight released scenarios have four ordered illustrated scenes; edited or historical briefs keep their original clues", () => {
  const original = fixtureConfig(),
    pack = validateDayContent(2, starterFlightContent(2, original), original);
  assert.equal(levelTwoComics.length, 8);
  for (const activity of pack.activities)
    for (const variant of activity.variants) {
      const comic = scenarioComic(activity.id, variant);
      assert.ok(comic, variant.name);
      assert.equal(comic.panels.length, 4);
      assert.equal(new Set(comic.panels.map((p) => p.title)).size, 4);
      assert.ok(
        comic.panels.every((p) => p.dialogue && p.evidence && p.clue && p.alt),
      );
      assert.equal(
        scenarioComic(activity.id, {
          ...variant,
          brief: variant.brief + " An updated clue.",
        }),
        null,
      );
      assert.equal(
        scenarioComic(activity.id, { ...variant, id: "custom" }),
        null,
      );
    }
  const college = levelTwoComics[0].panels
    .map((p) => p.dialogue + " " + p.evidence)
    .join(" ");
  for (const clue of [
    "10:00",
    "Hall A",
    "11:00",
    "Hall B",
    "10:30",
    "hasn’t confirmed",
  ])
    assert.ok(college.includes(clue));
  const beacon = levelTwoComics
    .find((c) => c.slug === "navigation-beacon")
    .panels.map((p) => p.evidence)
    .join(" ");
  for (const clue of ["B7", "09:12", "09:05", "second screen"])
    assert.ok(beacon.includes(clue));
});
test("comic spreads show scenes 1–2 then 3–4; clues are independent and only the final spread offers Begin investigation", async () => {
  const Frame = await component("ScenarioComicFrame"),
    comic = levelTwoComics[0];
  for (const index of [0, 2]) {
    const html = render(Frame, { comic, index, clueOpen: false });
    assert.ok(html.includes(comic.panels[index].dialogue.replaceAll("’", "’")));
    assert.ok(html.includes(comic.panels[index + 1].dialogue));
    assert.equal((html.match(/<figure /g) || []).length, 2);
    assert.equal((html.match(/preserveAspectRatio="xMidYMid meet"/g) || []).length, 2);
    assert.ok(html.includes("Timer has not started"));
    assert.ok(html.includes(`<figcaption class="l2-comic-dialogue"><span class="l2-comic-caption-number">Scene ${index + 1}</span>`));
    const illustration = html.slice(html.indexOf('<div class="l2-comic-illustration"'), html.indexOf('<figcaption'));
    assert.ok(illustration.includes('preserveAspectRatio="xMidYMid meet"'), "The main scene must fit in full without cropping or stretching characters");
    assert.ok(!illustration.includes('slice'), "Only thumbnails may use a cropped cover fit");
    assert.ok(html.includes('class="comic-typed-reserve" aria-hidden="true"'), "Typing reserves the full line height to prevent caption jumps");
    assert.ok(html.includes('class="comic-typed-accessible"'), "The full sentence is available without character-by-character announcements");
    assert.ok(html.indexOf('</svg></div></div><figcaption') > 0, "Caption follows the complete illustration");
    assert.equal(html.includes("Begin investigation"), index === 2);
    assert.ok(html.includes('aria-label="Story scenes"'));
    assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
    for (const scene of [0, 2])
      assert.ok(html.includes(`aria-label="Scenes ${scene + 1}–${scene + 2}"`));
    assert.ok(!html.includes(comic.panels[index].evidence));
    const inspected = render(Frame, { comic, index, clueOpen: true });
    assert.ok(inspected.includes("CLUE FOUND"));
    assert.ok(inspected.includes(comic.panels[index].evidence));
    assert.ok(!inspected.includes(comic.panels[index + 1].evidence));
    const secondClue = render(Frame, { comic, index, clueOpen: index + 1 });
    assert.ok(secondClue.includes(comic.panels[index + 1].evidence));
    assert.ok(!secondClue.includes(comic.panels[index].evidence));
    const replay = render(Frame, {
      comic,
      index,
      readOnly: true,
      clueOpen: true,
      timerCaption: "35:00 remaining",
    });
    assert.ok(!replay.includes("Begin investigation"));
    assert.ok(replay.includes("35:00 remaining"));
    if (index === 2) assert.ok(replay.includes("Back to investigation"));
  }
  const disabled = render(Frame, { comic, index: 3, disabled: true });
  assert.match(disabled, /<button[^>]*disabled=""[^>]*>Begin investigation/);
});
test("a saved investigation reopens its matching comic without replacing notes or restarting the saved timer", async () => {
  const Editor = await component(
    "LevelTwoInvestigation",
    "components/LevelTwoMissionScene.js",
  );
  const original = fixtureConfig(),
    pack = validateDayContent(2, starterFlightContent(2, original), original),
    activity = pack.activities[0];
  const html = render(Editor, {
    record: {
      _id: "saved",
      activityId: activity.id,
      version: 4,
      data: {
        activity,
        variant: activity.variants[0],
        draft: { finding1: "My saved finding" },
        submissions: [],
        startedAt: "2026-11-16T09:00:00Z",
        deadline: "2026-11-16T10:00:00Z",
        savedAt: "2026-11-16T09:20:00Z",
        extensions: [],
      },
    },
    ownerId: "p",
    now: new Date("2026-11-16T09:30:00Z"),
    dayOpen: true,
    act() {
      throw Error("Rendering must not call the API");
    },
  });
  assert.ok(html.includes("Replay comic"));
  assert.ok(html.includes("30:00"));
  assert.ok(html.includes("Saved notes restored"));
  assert.ok(html.includes("Spot the conflicting clue"));
  assert.ok(!html.includes("Begin investigation"));
});
test("every comic artwork is a local image with a valid WebP signature", () => {
  for (const comic of levelTwoComics) {
    const path = resolve("public" + comic.image);
    assert.ok(existsSync(path), comic.image);
    const bytes = readFileSync(path);
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
  }
});
