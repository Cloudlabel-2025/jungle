import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { models, connect, transaction } from "../lib/db.js";
import { playerBalance } from "../lib/rules.js";
import { campVitals } from "../lib/camp-team.js";
import { deduct } from "../lib/engine.js";
import { snapshot } from "../lib/snapshot.js";
import { dayOneSnapshot } from "../lib/day-one.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { initialDays } from "../lib/week-one-rules.js";

test("player defaults and zero balances never inherit historical programme overrides", () => {
  assert.deepEqual(playerBalance({}), { hp: 5, energy: 3 });
  assert.deepEqual(playerBalance(new models.User()), { hp: 5, energy: 3 });
  assert.deepEqual(
    playerBalance({ hp: 4, energy: 1, weekOneEnergy: 5, dayOneEnergy: 5 }),
    { hp: 4, energy: 1 },
  );
  assert.deepEqual(playerBalance({ hp: 0, energy: 3 }), { hp: 0, energy: 0 });
  assert.deepEqual(playerBalance({ hp: 4, energy: 0 }), { hp: 4, energy: 0 });
});

test("header and Day 1 rewards render the same current balance, including zero", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const output = root + ".data/player-balance-render.cjs";
  await mkdir(root + ".data", { recursive: true });
  await build({
    stdin: {
      contents:
        'export {default as Header} from "./components/PlayerHeader.js"; export {DayOneRewards} from "./components/DayOneFeatures.js";',
      resolveDir: root,
    },
    outfile: output,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    loader: { ".js": "jsx" },
    alias: { "@": root },
    logLevel: "silent",
  });
  const { Header, DayOneRewards } = createRequire(import.meta.url)(output);
  for (const [hp, energy] of [
    [5, 3],
    [4, 2],
    [0, 0],
    [4, 0],
  ]) {
    const user = {
      _id: "g",
      name: "QA Player",
      hp,
      energy,
      xp: 0,
      weekOneEnergy: 5,
      dayOneEnergy: 5,
    };
    const data = {
      user,
      dayOne: {
        records: [{ userId: "g", energy: 5, trophies: 0, ledger: [] }],
      },
    };
    for (const html of [
      renderToStaticMarkup(createElement(Header, { player: user })),
      renderToStaticMarkup(createElement(DayOneRewards, { data })),
    ]) {
      assert.match(html, new RegExp(`aria-label="${hp} of 5 lives"`));
      assert.match(html, new RegExp(`aria-label="${energy} of 3 energy"`));
      assert.doesNotMatch(html, /5 of 5 energy|ENERGY 5\/5/);
    }
  }
});

test(
  "MongoDB: map, Week 1, recovery and sprint snapshots share deductions, approvals and recovery",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/shared_player_balance_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    try {
      const { gamers, cc, cc2, mc, teams } = await pilotFixture(1);
      const gamer = gamers[0];
      const reason = "Verified evidence in a disposable balance test.";
      let now = new Date("2026-11-07T07:00:00Z");
      const call = (actor, action, body = {}) =>
        pilotAction(
          actor,
          action,
          { reason, requestId: randomUUID(), ...body },
          now,
        );
      const days = initialDays();
      days[0] = { ...days[0], state: "OPEN", content: fixtureConfig() };
      await models.WeekOneRelease.create({ _id: "alpha", days });
      await models.DayOneRecord.create({
        _id: `alpha:${gamer._id}`,
        cohortId: "alpha",
        userId: gamer._id,
        energy: 5,
        data: { config: fixtureConfig(), submissions: [], ledger: [] },
      });
      await models.User.updateOne(
        { _id: gamer._id },
        { $set: { hp: 4, energy: 1 } },
      );
      const checkViews = async (hp, energy) => {
        const account = await models.User.findById(gamer._id).lean();
        const main = await snapshot(gamer);
        const dayOne = await dayOneSnapshot(gamer);
        const pilot = await pilotSnapshot(gamer, now);
        for (const current of [
          account,
          main.user,
          dayOne.user,
          dayOne.records[0],
          pilot.player,
        ])
          assert.deepEqual(playerBalance(current), { hp, energy });
        assert.deepEqual(campVitals(main.user), {
          life: hp,
          energy,
          energyMax: 3,
        });
        assert.ok(!("weekOneEnergy" in main.user));
      };
      await checkViews(4, 1);
      await call(cc, "draft", { config: sprintConfig(teams, mc) });
      await call(cc, "approve");
      await call(cc, "load");
      now = new Date("2026-11-09T07:00:00Z");
      await call(mc, "kickoff", { teamId: teams[0].id, evidence: reason });
      await assert.rejects(
        call(cc, "settings", {
          policyVersion: "OLD",
          energy: { start: 5, max: 5, lives: 2, zeroMode: "RESET_IF_LIVES" },
        }),
        (error) => error.status === 400,
      );
      await call(cc, "settings", {
        policyVersion: "SHARED",
        energy: { start: 3, max: 3, lives: 5, zeroMode: "RESET_IF_LIVES" },
      });
      await checkViews(4, 1); // Loading/approving a stage cannot refill an account.
      await transaction((session) =>
        deduct(gamer._id, reason, 10, "shared:map-penalty", session),
      );
      await checkViews(3, 3);
      await call(mc, "energy-propose", {
        teamId: teams[0].id,
        userId: gamer._id,
        amount: -1,
      });
      const proposal = (await pilotSnapshot(cc, now)).ledgers.find(
        (row) => row.state === "ENERGY_PROPOSAL",
      );
      const decision = {
        requestId: randomUUID(),
        proposalId: proposal._id,
        decision: "APPROVE",
      };
      await call(cc2, "energy-decide", decision);
      await checkViews(3, 2);
      await call(cc2, "energy-decide", decision);
      await checkViews(3, 2); // A retry must not deduct twice.
      await models.User.updateOne(
        { _id: gamer._id },
        { $set: { hp: 1, energy: 1 } },
      );
      await transaction((session) =>
        deduct(gamer._id, reason, 10, "shared:zero", session),
      );
      await checkViews(0, 0);
      const task = (await pilotSnapshot(gamer, now)).tasks.find(
        (row) => row.userId === gamer._id && !row.data.depends.length,
      );
      await assert.rejects(
        call(gamer, "task", { taskId: task._id, next: "Working" }),
        (error) => error.status === 409,
      );
      await call(cc, "energy-recover", {
        teamId: teams[0].id,
        userId: gamer._id,
        lives: 2,
      });
      await checkViews(2, 3);
      assert.equal(
        await models.Rescue.countDocuments({
          userId: gamer._id,
          status: { $ne: "CLOSED" },
        }),
        0,
      );
      assert.equal(
        (await models.DayOneRecord.findById(`alpha:${gamer._id}`)).energy,
        5,
      ); // Historical evidence retained.
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
