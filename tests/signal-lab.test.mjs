import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { validateDayContent } from "../lib/week-one-program-rules.js";
import {
  labStateFor,
  reasoningCheck,
  reasoningModules,
  experimentOutcome,
} from "../lib/signal-lab.js";
const config = fixtureConfig(),
  pack = validateDayContent(3, starterFlightContent(3, config), config),
  now = new Date("2026-11-17T05:00:00Z");
const noAction = () => assert.fail("Rendering must not start or submit a lab");
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
  const m = { exports: {} };
  new Function("require", "module", "exports", b.outputFiles[0].text)(
    createRequire(import.meta.url),
    m,
    m.exports,
  );
  return m.exports[name];
}
const render = (C, p) => renderToStaticMarkup(React.createElement(C, p));
const record = (index = 0, draft = {}, labState) => ({
  _id: `lab:${index}`,
  day: 3,
  activityId: pack.activities[index].id,
  version: 4,
  data: {
    activity: pack.activities[index],
    variant: pack.activities[index].variants[0],
    draft,
    labState,
    submissions: [],
    startedAt: "2026-11-17T04:30:00Z",
    deadline: "2026-11-17T05:30:00Z",
    savedAt: "2026-11-17T04:59:00Z",
    extensions: [],
  },
});
const data = {
  user: { _id: "p" },
  weekOneProgram: {
    days: [{ ...pack, state: "OPEN" }],
    attempts: [],
    levelResults: [],
    progression: { mode: "COMPLETION", levels: [{ day: 3, available: true }] },
  },
};
test("lab states are bounded, scoped and do not accept duplicate modules or forged predictions", () => {
  const raw = {
    circuit: ["evidence", "claim"],
    fault: "none",
    prediction: "uncertain",
  };
  assert.deepEqual(labStateFor("D3-G01", raw), raw);
  assert.throws(() => labStateFor("D2-G01", raw));
  assert.throws(() => labStateFor("D3-G01", { circuit: ["claim", "claim"] }));
  assert.throws(() => labStateFor("D3-G02", { fault: "other" }));
  assert.throws(() => labStateFor("D3-G02", { prediction: "uncertain" }));
  assert.throws(() => labStateFor("D3-G01", { prediction: "blocked" }));
  assert.equal(reasoningCheck(["claim", "evidence", "explanation"]), true);
  assert.equal(reasoningCheck(["evidence", "claim", "explanation"]), false);
  assert.equal(
    experimentOutcome("D3-G02", {
      fault: "database",
      prediction: "no-response",
    }).correct,
    true,
  );
  assert.equal(
    experimentOutcome("D3-G02", {
      fault: "permissions",
      prediction: "continues",
    }).correct,
    false,
  );
  assert.equal(
    experimentOutcome("D3-G01", { prediction: "proven" }).correct,
    false,
  );
  for (const v of pack.activities[0].variants) {
    assert.equal(reasoningModules(v).length, 3);
    assert.equal(reasoningModules({ ...v, brief: v.brief + " Changed" }), null);
  }
});
test("Level 3 has its own lab layout, mission bays and case selection, with the backend lock respected", async () => {
  const Scene = await load("components/PipSignalLab.js"),
    html = render(Scene, { data, act: noAction, now });
  for (const text of [
    "pip-signal-lab",
    "Help Kiko understand.",
    "Lab missions",
    "Read the case",
    "Play mission",
    "Explain a clue",
    "Follow a click",
    "How to earn 3 stars",
    "View objectives",
    "/gamer/objectives?level=3",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /l2-comic|l2-mission-card|<textarea|<select/);
  const locked = structuredClone(data);
  locked.weekOneProgram.progression.levels[0].available = false;
  const lock = render(Scene, { data: locked, act: noAction, now });
  assert.ok(lock.includes("Finish Level 2"));
  assert.ok(!lock.includes("Play mission"));
});

test("Level 3 objective explains both bays, submission and timer behavior without starting or changing an attempt", async () => {
  const Objective = await load("components/LevelThreeObjective.js");
  const fresh = render(Objective, { onContinue: noAction });
  for (const text of [
    "Build an explanation",
    "Follow a click",
    "Power up lab",
    "Run experiment",
    "Teach Kiko",
    "Transmit discovery",
    "unlock Level 4",
    "timer continues",
    "Enter lab",
  ])
    assert.ok(fresh.includes(text), text);
  assert.equal((fresh.match(/<article/g) || []).length, 2);
  const resumed = render(Objective, {
    onContinue: noAction,
    hasSavedProgress: true,
  });
  assert.ok(resumed.includes("Return to lab"));
  assert.ok(!resumed.includes("<textarea"));
});
test("saved reasoning and technical circuits render in the lab with their original timer and predictions", async () => {
  const Attempt = await load("components/PipSignalLab.js", "LabAttempt");
  for (const r of [
    record(
      0,
      {},
      {
        circuit: ["evidence", "claim"],
        fault: "none",
        prediction: "uncertain",
      },
    ),
    record(
      1,
      { sequence: pack.activities[1].variants[0].cards.slice(0, 2) },
      { circuit: [], fault: "database", prediction: "no-response" },
    ),
  ]) {
    const before = structuredClone(r),
      html = render(Attempt, {
        record: r,
        ownerId: "p",
        now,
        dayOpen: true,
        act: noAction,
        data,
      });
    assert.ok(html.includes("30:00"));
    assert.ok(html.includes("Saved lab restored"));
    assert.ok(html.includes("Read the case"));
    if (r.activityId === "D3-G02") {
      assert.ok(html.includes("Module tray"));
      assert.ok(html.includes("You click"));
      assert.ok(html.includes("Undo last"));
    } else {
      assert.ok(html.includes("Which conclusion fits the clue?"));
      assert.ok(html.includes('aria-pressed="true"'));
    }
    assert.ok(!html.includes("Replay comic"));
    assert.deepEqual(r, before);
  }
});
test("historical STORY answers resume at their first missing field and expired work stays read-only", async () => {
  const Attempt = await load("components/PipSignalLab.js", "LabAttempt"),
    r = record(0, { scene: "My existing scene is safely saved." });
  const html = render(Attempt, {
    record: r,
    ownerId: "p",
    now,
    dayOpen: true,
    act: noAction,
    data,
  });
  assert.ok(html.includes("T · Tell the need"));
  assert.ok(html.includes("Kiko, here’s what I learned"));
  r.data.deadline = "2026-11-17T04:59:00Z";
  const expired = render(Attempt, {
    record: r,
    ownerId: "p",
    now,
    dayOpen: true,
    act: noAction,
    data,
  });
  assert.ok(expired.includes("Your timer ended"));
  assert.ok(expired.includes('readOnly=""') || expired.includes('readonly=""'));
});

test("a fresh attempt shows one reading task and one primary action; explanation is gated until the challenge is tried", async () => {
  const Attempt = await load("components/PipSignalLab.js", "LabAttempt"),
    html = render(Attempt, {
      record: record(0),
      ownerId: "p",
      now,
      dayOpen: true,
      act: noAction,
      data,
    });
  assert.match(html, /THE CLAIM/);
  assert.match(html, /THE CLUE/);
  assert.match(html, /I’m ready to try/);
  assert.doesNotMatch(
    html,
    /<textarea|Module tray|Simulate a fault|signal-lab-node-tools/,
  );
  assert.equal((html.match(/class="lab-primary"/g) || []).length, 1);
  assert.match(html, /disabled=""><span>3<\/span>Explain it/);
});

test("historical technical notes without a finished path return to the path builder without corrupting the sequence", async () => {
  const Attempt = await load("components/PipSignalLab.js", "LabAttempt"),
    r = record(1, {
      scene: "A saved explanation remains in the account.",
      sequence: pack.activities[1].variants[0].cards.slice(0, 2),
    });
  const before = structuredClone(r),
    html = render(Attempt, {
      record: r,
      ownerId: "p",
      now,
      dayOpen: true,
      act: noAction,
      data,
    });
  assert.match(html, /What happens next/);
  assert.match(html, /Undo last/);
  assert.doesNotMatch(html, /<textarea/);
  assert.deepEqual(r, before);
});

test("reopening Level 3 resumes the most recently worked unfinished mission", async () => {
  const Scene = await load("components/PipSignalLab.js"),
    first = record(0, { scene: "Existing general notes." }),
    second = record(1, {
      sequence: pack.activities[1].variants[0].cards.slice(0, 1),
    });
  first.data.savedAt = "2026-11-17T04:40:00Z";
  second.data.savedAt = "2026-11-17T04:50:00Z";
  const input = {
    ...data,
    weekOneProgram: { ...data.weekOneProgram, attempts: [first, second] },
  };
  const html = render(Scene, { data: input, act: noAction, now });
  assert.match(html, /Follow a click/);
  assert.match(html, /What happens next/);
  assert.doesNotMatch(html, /Existing general notes/);
  assert.equal(first.data.draft.scene, "Existing general notes.");
});
