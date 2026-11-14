import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  buildDayOneSetup,
  scheduleInstant,
  suggestedResearchGroups,
  preparedSetupMatches,
} from "../lib/day-one-setup.js";
import { defaultSetup, validateSetup } from "../lib/day-one-rules.js";
import { researchConfig } from "../lib/research.js";
import { models, connect } from "../lib/db.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { publishFixtureRules } from "./week-one-program-fixture.mjs";

const roster = Array.from({ length: 25 }, (_, i) => ({
  _id: `setup-${i}`,
  name: `Player ${i}`,
  email: `setup-${i}@example.invalid`,
  role: "GAMER",
  cohortId: "alpha",
}));
const values = () => ({
  day: "2026-11-13",
  startTime: "09:00",
  endTime: "17:00",
  selectionMode: "research-2026-11-12",
  groups: suggestedResearchGroups(roster),
  roster,
  reviewed: true,
  preparing: true,
});

test("simple schedule uses the cohort zone, including fractional offsets and DST", () => {
  assert.equal(
    scheduleInstant("2026-11-13", "09:00", "Asia/Kolkata"),
    "2026-11-13T03:30:00.000Z",
  );
  assert.equal(
    scheduleInstant("2026-07-01", "09:00", "America/New_York"),
    "2026-07-01T13:00:00.000Z",
  );
  assert.equal(
    scheduleInstant("2026-11-13", "09:00", "UTC"),
    "2026-11-13T09:00:00.000Z",
  );
  assert.throws(() =>
    scheduleInstant("2026-03-08", "02:30", "America/New_York"),
  );
  assert.throws(() => scheduleInstant("2026-02-30", "09:00", "UTC"));
});
test("four launch inputs produce a complete server-valid research setup without changing assessment rules", () => {
  const base = {
    ...defaultSetup(),
    markingInstructions:
      "Keep these institution-specific marking instructions unchanged.",
    championPrompt:
      "Keep this private institution-specific verification prompt unchanged.",
  };
  const config = buildDayOneSetup(base, values());
  const validated = validateSetup(researchConfig(config));
  assert.equal(validated.genres.length, 51);
  assert.equal(config.clockCutoff, "2026-11-13T04:00:00.000Z");
  assert.equal(config.closingCutoff, "2026-11-13T11:30:00.000Z");
  assert.equal(config.markingInstructions, base.markingInstructions);
  assert.deepEqual(config.rubric, base.rubric);
  assert.equal(base.day, "");
  assert.equal(config.questionSelection, "PLAYER_CHOICE");
  assert.equal(config.researchGroups.length, 5);
});
test("preparation blocks short/reversed schedules, uneven groups, strangers and missing question approval", () => {
  assert.throws(
    () => buildDayOneSetup(defaultSetup(), { ...values(), endTime: "08:00" }),
    /Finish/,
  );
  assert.throws(
    () => buildDayOneSetup(defaultSetup(), { ...values(), endTime: "10:00" }),
    /90 minutes/,
  );
  const broken = values();
  broken.groups[0].members[0] = "outside";
  assert.throws(
    () => buildDayOneSetup(defaultSetup(), broken),
    /every active player/,
  );
  assert.throws(
    () => buildDayOneSetup(defaultSetup(), { ...values(), reviewed: false }),
    /Review all 51/,
  );
  assert.throws(
    () => buildDayOneSetup(defaultSetup(), { ...values(), day: "" }),
    /Choose the Day 1 date/,
  );
});
test("drafts can be incomplete and group suggestions retain an already configured roster", () => {
  const saved = suggestedResearchGroups(roster);
  saved[0].members.reverse();
  assert.deepEqual(suggestedResearchGroups(roster, saved), saved);
  const v = { ...values(), day: "", preparing: false, reviewed: false };
  v.groups[0].members.pop();
  const draft = buildDayOneSetup(defaultSetup(), v);
  assert.equal(draft.bankApproval, "");
  assert.equal(draft.officialStart, "");
  assert.equal(draft.researchGroups[0].members.length, 4);
});

test("saving changed draft inputs does not make an older prepared setup ready to open", () => {
  const config = researchConfig(buildDayOneSetup(defaultSetup(), values()));
  assert.equal(preparedSetupMatches(config, config), true);
  assert.equal(
    preparedSetupMatches({ ...config, day: "2026-11-14" }, config),
    false,
  );
  const other = structuredClone(config);
  other.researchGroups[0].members.reverse();
  assert.equal(preparedSetupMatches(other, config), false);
  assert.equal(preparedSetupMatches({ ...config, version: 2 }, config), true);
});
test("legacy questions and future recognition timing survive editing the schedule", () => {
  const base = {
    ...defaultSetup(),
    genres: defaultSetup().genres.map((g) => ({
      ...g,
      question:
        "Explain a research question using independently verifiable evidence.",
    })),
    revealAfter: "2026-12-01T12:00:00Z",
  };
  const config = buildDayOneSetup(base, {
    ...values(),
    selectionMode: "legacy",
  });
  assert.deepEqual(config.genres, base.genres);
  assert.equal(config.revealAfter, base.revealAfter);
  assert.equal(validateSetup(config).genres.length, 4);
});
test(
  "MongoDB simple setup: draft stays locked, prepare stays hidden, open enables seven-card research and blocks later replacement",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `simple_setup_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const m of Object.values(models)) await m.init();
    const cc = {
      _id: "setup-cc",
      name: "Setup CC",
      email: "setup-cc@example.invalid",
      role: "CENTRE_COMMAND",
      cohortId: "alpha",
    };
    const now = new Date("2026-11-13T03:35:00Z");
    try {
      await models.User.insertMany([...roster, cc]);
      const config = buildDayOneSetup(defaultSetup(), values());
      await dayOneAction(cc, "save-setup", { config, revision: 0 }, now);
      assert.equal((await dayOneSnapshot(roster[0], now)).state, "LOCKED");
      await dayOneAction(cc, "release", { config, revision: 1 }, now);
      assert.equal((await weekOneSnapshot(cc)).days[0].state, "PREPARED");
      const staffView = await dayOneSnapshot(cc, now);
      assert.equal(
        preparedSetupMatches(staffView.draft, staffView.preparedConfig),
        true,
      );
      assert.equal(staffView.preparedConfig.researchGroups.length, 5);
      assert.equal(
        (await dayOneSnapshot(roster[0], now)).preparedConfig,
        undefined,
      );
      assert.equal((await dayOneSnapshot(roster[0], now)).config, null);
      await assert.rejects(
        dayOneAction(roster[0], "release", { config, revision: 2 }, now),
        (e) => e.status === 403,
      );
      await publishFixtureRules(cc, now);
      await weekOneAction(
        cc,
        "open",
        { day: 1, revision: (await weekOneSnapshot(cc)).revision },
        now,
      );
      await dayOneAction(roster[0], "clock", {}, now);
      assert.equal(
        (await dayOneAction(roster[0], "genre-offer", {}, now)).genres.length,
        7,
      );
      await assert.rejects(
        dayOneAction(cc, "release", { config, revision: 2 }, now),
        (e) => e.status === 409,
      );
      assert.equal((await models.User.findById(roster[0]._id).lean()).hp, 5);
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
