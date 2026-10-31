import test from "node:test";
import assert from "node:assert/strict";
import {
  initialDays,
  prepareDay,
  transitionDay,
  releaseProjection,
  publishAgenda,
  staffOnly,
} from "../lib/week-one-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

test("day release requires preparation, sequential manual opening and explicit closure", () => {
  const release = { revision: 0, days: initialDays() };
  const config = { ...fixtureConfig(), version: 1 };
  const before = new Date("2026-11-02T03:00:00Z");
  assert.throws(() => transitionDay(release, 1, "open", "mc", before));
  prepareDay(release, 1, config, "cc", before.toISOString());
  prepareDay(release, 2, config, "cc", before.toISOString());
  assert.throws(() => transitionDay(release, 2, "open", "mc", before));
  transitionDay(release, 1, "open", "mc", before);
  assert.throws(() =>
    prepareDay(release, 1, config, "cc", before.toISOString()),
  );
  assert.throws(() => transitionDay(release, 1, "close", "mc", before));
  transitionDay(release, 1, "close", "mc", new Date(config.closingCutoff));
  transitionDay(release, 2, "open", "cc", new Date(config.closingCutoff));
  assert.equal(release.days[0].closedBy, "mc");
  assert.equal(release.days[1].openedBy, "cc");
  assert.throws(() => transitionDay(release, 1, "open", "cc", before));
});
test("prepared questions and schedules are hidden from Gamers; staff receive no private content in release summaries", () => {
  const release = { days: initialDays() };
  prepareDay(release, 1, { ...fixtureConfig(), version: 1 }, "cc", "now");
  const gamer = releaseProjection(release, "GAMER");
  assert.equal(gamer.days[0].state, "LOCKED");
  assert.equal(gamer.days[0].officialStart, undefined);
  assert.ok(!JSON.stringify(gamer).includes("PRIVATE_PRIZE"));
  assert.ok(
    !JSON.stringify(releaseProjection(release, "MISSION_COMMANDER")).includes(
      "PRIVATE_PRIZE",
    ),
  );
  assert.throws(
    () => staffOnly({ role: "GAMER" }),
    (e) => e.status === 403,
  );
});
test("agenda publication requires an open day and its official start; publication is explicit and immutable", () => {
  const release = { days: initialDays() },
    config = { ...fixtureConfig(), version: 1 };
  prepareDay(release, 1, config, "cc", "now");
  const day = release.days[0],
    start = new Date(config.officialStart);
  assert.throws(() =>
    publishAgenda(day, "Today's published agenda", "mc", start),
  );
  transitionDay(release, 1, "open", "cc", start);
  assert.throws(() =>
    publishAgenda(
      day,
      "Today's published agenda",
      "mc",
      new Date(start.getTime() - 1),
    ),
  );
  publishAgenda(day, "Today's published agenda", "mc", start);
  assert.equal(day.agenda.publishedBy, "mc");
  assert.throws(() =>
    publishAgenda(day, "Replace the agenda silently", "mc", start),
  );
});
