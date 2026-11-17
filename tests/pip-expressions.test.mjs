import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import {
  pipExpression,
  pipExpressions,
  pipImage,
} from "../lib/pip-expressions.js";
import { pipTutorial } from "../lib/pip-tutorial.js";

test("all five Kiko expressions are distinct optimized transparent game assets", async () => {
  const hashes = new Set();
  for (const expression of pipExpressions) {
    const file = new URL(`../public${pipImage(expression)}`, import.meta.url);
    const bytes = readFileSync(file);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 600);
    assert.equal(metadata.height, 400);
    assert.equal(metadata.hasAlpha, true);
    const alpha = await sharp(bytes).extractChannel("alpha").stats();
    assert.equal(alpha.channels[0].min, 0);
    assert.equal(alpha.channels[0].max, 255);
    assert.ok(
      bytes.length < 100 * 1024,
      `${expression} must stay small enough for mobile`,
    );
  }
  assert.equal(hashes.size, 5);
  assert.equal(pipImage("../../bad-file"), pipImage("welcoming"));
});

test("expressions follow saved progress, including review and correction states", () => {
  const data = {
    user: { _id: "me", role: "GAMER" },
    story: { flight: true, introComplete: true },
    playSession: { state: "ACTIVE" },
    dayOne: {
      state: "OPEN",
      records: [
        {
          userId: "me",
          submissions: [],
          genreId: "fitness-3",
          acknowledgedAt: "accepted",
          startedAt: "started",
        },
      ],
    },
  };
  const expression = () =>
    pipTutorial(JSON.parse(JSON.stringify(data)), { missionOpen: true })
      .expression;
  assert.equal(expression(), "thinking");
  const record = data.dayOne.records[0];
  record.draft = { url: "https://example.org/chat" };
  assert.equal(expression(), "guiding");
  record.submissions.push({ id: "one" });
  record.verification = { status: "PENDING" };
  assert.equal(expression(), "celebrating");
  record.verification.status = "INACCESSIBLE";
  assert.equal(expression(), "concerned");
  record.verification.status = "VERIFIED";
  assert.equal(expression(), "celebrating");
  assert.equal(pipExpression("boarding"), "welcoming");
  assert.equal(pipExpression("question"), "guiding");
  assert.equal(pipExpression("expired"), "concerned");
  assert.equal(pipExpression("map-submitted"), "thinking");
});

test("Kiko renders the real expression images in guidance and first arrival", async () => {
  const result = await build({
    entryPoints: ["components/PipGuide.js"],
    bundle: true,
    platform: "node",
    packages: "external",
    alias: { "@": resolve(".") },
    loader: { ".js": "jsx" },
    jsx: "automatic",
    format: "cjs",
    write: false,
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  const { PipDrone, PipArrival } = module.exports;
  for (const expression of pipExpressions) {
    const html = renderToStaticMarkup(
      React.createElement(PipDrone, { expression }),
    );
    assert.ok(html.includes(`src="${pipImage(expression)}"`));
    assert.ok(html.includes(`data-expression="${expression}"`));
    assert.ok(!html.includes("pip-shell"), "old CSS drawing must be replaced");
  }
  assert.ok(
    renderToStaticMarkup(React.createElement(PipArrival)).includes(
      pipImage("welcoming"),
    ),
  );
});
