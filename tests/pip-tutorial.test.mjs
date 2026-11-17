import test from "node:test";
import assert from "node:assert/strict";
import { pipScope, pipTutorial } from "../lib/pip-tutorial.js";

const now = new Date("2026-11-14T05:00:00Z");
function fixture(record = {}, overrides = {}) {
  return {
    user: { _id: "me", role: "GAMER", cohortId: "alpha" },
    story: { flight: true, introComplete: true },
    playSession: { state: "ACTIVE", available: true },
    dayOne: {
      state: "OPEN",
      records: [{ _id: "record-me", userId: "me", submissions: [], ...record }],
    },
    weekOneProgram: { days: [{ day: 2, state: "DRAFT" }] },
    ...overrides,
  };
}
const mission = (data) => pipTutorial(data, { missionOpen: true, now });
const assigned = {
  genreId: "fitness-3",
  researchAssignment: { questionId: "fitness-3" },
};
const running = {
  ...assigned,
  acknowledgedAt: "accepted",
  startedAt: "started",
  deadline: "2026-11-14T06:00:00Z",
};
const submitted = {
  ...running,
  submissions: [{ id: "chat" }],
  verification: { status: "PENDING" },
};
test("Kiko continues saved mission guidance during extra play and explains the end-of-day choice", () => {
  const extra = fixture(assigned, { playSession: { state: "EXTRA", available: false, hasClockedIn: true } });
  assert.equal(mission(extra).id, mission(fixture(assigned)).id);
  const choice = mission(fixture(assigned, { playSession: { state: "CHOICE", responseDeadline: "deadline" } }));
  assert.equal(choice.id, "attendance-check");
  assert.match(choice.message, /separate extra session/);
});

test("Kiko starts with current attendance, even when the player has saved research", () => {
  assert.equal(
    mission(
      fixture(submitted, { playSession: { state: "NOT_IN", available: true } }),
    ).id,
    "clock-in",
  );
  const unavailable = mission(
    fixture(
      {},
      {
        playSession: {
          state: "NOT_IN",
          available: false,
          reason: "Wrong date",
        },
      },
    ),
  );
  assert.equal(unavailable.action, null);
  assert.equal(unavailable.message, "Wrong date");
  assert.equal(
    mission(
      fixture(
        {},
        { playSession: { state: "ACTIVE", responseDeadline: "deadline" } },
      ),
    ).id,
    "attendance-check",
  );
});
test("clock-in tutorial never repeats after a saved first clock-in", () => {
  for (const session of [
    { state: "NOT_IN", hasClockedIn: true },
    { state: "OUT" },
    { state: "NOT_IN", clockAt: "saved-clock-in" },
    { state: "NOT_IN", clockOutAt: "saved-clock-out" },
  ])
    assert.equal(
      mission(fixture({}, { playSession: { available: true, ...session } })),
      null,
    );
});
test("first boarding and missing day record have distinct guidance", () => {
  assert.equal(
    mission(fixture({}, { story: { flight: true, introComplete: false } })).id,
    "boarding",
  );
  assert.equal(
    mission(fixture({}, { dayOne: { state: "OPEN", records: [] } })).id,
    "day-check-in",
  );
});
test("saved selections resume at the exact checkpoint after reload", () => {
  for (const [record, id] of [
    [{}, "genre"],
    [{ researchSelection: { genreId: "fitness" } }, "question"],
    [assigned, "accept"],
    [{ ...assigned, acknowledgedAt: "accepted" }, "begin"],
    [running, "research"],
    [{ ...running, draft: { url: "https://example.org/chat" } }, "transmit"],
    [submitted, "submitted"],
    [{ ...submitted, verification: { status: "INACCESSIBLE" } }, "correction"],
    [{ ...submitted, verification: { status: "VERIFIED" } }, "verified"],
  ]) {
    const data = fixture(record);
    const before = structuredClone(data);
    assert.equal(mission(JSON.parse(JSON.stringify(data))).id, id);
    assert.deepEqual(data, before, "guidance must not change saved progress");
  }
});
test("Kiko ignores other players' progress and false verification without a submission", () => {
  const data = fixture({ verification: { status: "VERIFIED" } });
  data.dayOne.records.unshift({ userId: "other", ...submitted });
  assert.equal(mission(data).id, "genre");
  assert.equal(
    mission(fixture({ ...running, verification: { status: "VERIFIED" } })).id,
    "research",
  );
});
test("closed, unreleased and expired missions do not offer advancement", () => {
  for (const state of ["DRAFT", "PREPARED", "CLOSED"]) {
    const data = fixture(running);
    data.dayOne.state = state;
    assert.equal(mission(data).action, null);
  }
  const expired = mission(fixture({ ...running, deadline: now.toISOString() }));
  assert.equal(expired.id, "expired");
  assert.equal(expired.action, null);
  assert.equal(
    mission(fixture({ ...submitted, deadline: now.toISOString() })).id,
    "submitted",
  );
});
test("map guidance respects travel and separate day releases", () => {
  assert.equal(pipTutorial(fixture(), { travelling: true }).action, null);
  assert.equal(pipTutorial(fixture(assigned)).id, "map-resume");
  assert.equal(pipTutorial(fixture(submitted)).id, "map-submitted");
  const data = fixture({ ...submitted, verification: { status: "VERIFIED" } });
  assert.equal(pipTutorial(data).action, null);
  data.weekOneProgram.days[0].state = "OPEN";
  assert.equal(pipTutorial(data).action, "next");
  data.weekOneProgram.days[0].state = "CLOSED";
  assert.equal(pipTutorial(data).action, null);
});
test("tutorial is limited to flight players and UI preferences stay isolated", () => {
  assert.equal(
    mission(fixture({}, { user: { role: "CENTRE_COMMAND" } })),
    null,
  );
  assert.equal(mission(fixture({}, { story: { flight: false } })), null);
  assert.notEqual(
    pipScope(fixture()),
    pipScope(fixture({}, { user: { _id: "other" } })),
  );
  assert.notEqual(
    pipScope(fixture()),
    pipScope(fixture({ _id: "reset-record" })),
  );
});
