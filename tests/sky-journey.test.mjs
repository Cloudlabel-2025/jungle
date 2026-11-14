import test from "node:test";
import assert from "node:assert/strict";
import { skyDiscovery, skyLevels } from "../lib/sky-journey.js";
import {
  skyAircraftRest,
  skyStationArrival,
  skyStations,
} from "../lib/sky-flight.js";
const fixture = (record = {}) => ({
  user: { _id: "me" },
  dayOne: {
    state: "OPEN",
    records: [
      { userId: "other", genreId: "other-question", submissions: [{}] },
      { userId: "me", ...record },
    ],
  },
  weekOneProgram: {
    days: [
      { day: 1, state: "OPEN" },
      { day: 2, state: "PREPARED" },
      { day: 3, state: "CLOSED" },
    ],
  },
});
test("sky checkpoints follow only the signed-in player's saved reservation, question and chat", () => {
  const empty = skyDiscovery(fixture());
  assert.equal(empty.completed, 0);
  assert.equal(
    skyDiscovery(fixture({ researchSelection: { genreId: "travel" } }))
      .completed,
    1,
  );
  assert.equal(
    skyDiscovery(
      fixture({
        genreId: "travel-2",
        researchAssignment: { questionId: "travel-2" },
      }),
    ).completed,
    2,
  );
  const pending = skyDiscovery(
    fixture({
      genreId: "travel-2",
      submissions: [{ id: "chat" }],
      verification: { status: "PENDING" },
    }),
  );
  assert.equal(pending.completed, 3);
  assert.equal(pending.verified, false);
  assert.match(pending.status, /awaiting verification/);
  assert.equal(
    skyDiscovery(
      fixture({ submissions: [{}], verification: { status: "VERIFIED" } }),
    ).verified,
    true,
  );
  assert.equal(
    skyDiscovery(fixture({ verification: { status: "VERIFIED" } })).verified,
    false,
  );
});
test("sky levels use actual releases; evidence submission never opens another day", () => {
  const data = fixture({
    genreId: "travel-2",
    submissions: [{}],
    verification: { status: "VERIFIED" },
  });
  const levels = skyLevels(data);
  assert.equal(levels.length, 5);
  assert.equal(levels[0].open, true);
  assert.equal(levels[1].available, false);
  assert.equal(levels[2].available, true);
  assert.equal(levels[2].open, false);
  assert.equal(levels[4].available, false);
  data.weekOneProgram.days[1].state = "OPEN";
  assert.equal(skyLevels(data)[1].open, true);
});

test("saved completion shows earned stars and places the aircraft past Level 1 without releasing Level 2", () => {
  const data = fixture({ levelOne: { result: { completed: true, stars: 1 } } });
  const levels = skyLevels(data);
  assert.equal(levels[0].completed, true);
  assert.equal(levels[0].stars, 1);
  assert.equal(levels[1].completed, false);
  assert.equal(levels[1].available, false);
  const point = skyAircraftRest(levels);
  assert.ok(point.x > skyStations[0][0]);
  assert.ok(point.x + 230 < skyStations[1][0]);
  assert.deepEqual(
    skyStationArrival(levels[0]),
    point,
    "viewing results keeps the aircraft beyond the completed station",
  );
  assert.deepEqual(skyAircraftRest(skyLevels(fixture())), { x: 35, y: 130 });
});

test("replay keeps earned progress and a staff reopen removes completion", () => {
  const data = fixture({
    levelOne: {
      practice: true,
      result: { completed: false, stars: 0 },
      bestResult: { completed: true, stars: 3 },
    },
  });
  assert.equal(skyLevels(data)[0].stars, 3);
  data.dayOne.records[1].levelOne = {
    result: { completed: false, stars: 0, status: "REOPENED" },
  };
  assert.equal(skyLevels(data)[0].completed, false);
  assert.equal(skyLevels(data)[0].stars, 0);
});
