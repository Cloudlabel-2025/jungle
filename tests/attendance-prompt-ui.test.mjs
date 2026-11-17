import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const bundle = await build({
  entryPoints: ["components/AttendancePrompt.js"],
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
const Prompt = module.exports.default;
const render = (session, open = false) =>
  renderToStaticMarkup(
    React.createElement(Prompt, {
      data: {
        user: { _id: "p", role: "GAMER" },
        story: { flight: false },
        playSession: {
          day: "2026-11-16",
          timeZone: "Asia/Kolkata",
          hasClockedIn: true,
          responseMinutes: 2,
          ...session,
        },
      },
      act: async () => true,
      now: new Date("2026-11-16T11:31:00Z"),
      open,
      close: () => {},
    }),
  );

test("UAT access is clearly identified and does not claim official attendance", () => {
  const html = render(
    { state: "EXTRA", extraSession: { purpose: "UAT" } },
    true,
  );
  assert.match(html, /UAT play session/);
  assert.match(html, /does not count towards official attendance/);
  assert.match(html, /End UAT session/);
});

test("end-of-day choice says attendance is closed and offers separate extra play", () => {
  const html = render({
    state: "CHOICE",
    clockOutAt: "2026-11-16T11:30:00Z",
    responseDeadline: "2026-11-16T11:32:00Z",
  });
  assert.match(html, /Your working day has ended/);
  assert.match(html, /official attendance is closed/);
  assert.match(html, /Continue playing/);
  assert.match(html, /Finish for today/);
  assert.doesNotMatch(html, /30 minutes|Still playing|keeps you clocked in/);
});
test("saved extra-session state does not reopen prompts; manual session controls clearly identify extra play", () => {
  const extra = {
    state: "EXTRA",
    clockOutAt: "2026-11-16T11:30:00Z",
    endDecision: "CONTINUED",
    extraSession: { startAt: "2026-11-16T11:31:00Z" },
  };
  assert.equal(render(extra), "");
  const html = render(extra, true);
  assert.match(html, /Extra play session/);
  assert.match(html, /End extra session/);
  assert.match(html, /next daily start/);
  assert.doesNotMatch(html, /Time left to answer|Clock in<|30 minutes/);
});
test("players see official duration and full/half-day requirements separately from extra play", () => {
  const html = render(
    {
      state: "EXTRA",
      officialAttendance: {
        day: "2026-11-16",
        status: "HALF_DAY",
        minutes: 255,
        fullDayMinutes: 360,
        halfDayMinutes: 240,
      },
    },
    true,
  );
  assert.match(html, /Your official attendance/);
  assert.match(html, /Half day/);
  assert.match(html, /4 h 15 m official time/);
  assert.match(html, /Extra play is excluded/);
});
