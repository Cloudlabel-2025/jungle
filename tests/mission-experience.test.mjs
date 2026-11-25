import test from "node:test";
import assert from "node:assert/strict";
import {
  projectMissionProgress,
  sprintMissionProgress,
  sprintTrailLinks,
} from "../lib/mission-experience.js";

test("trail navigation uses released sprint IDs, preserves history and disables locked or missing trails", () => {
  const links = sprintTrailLinks(
    [
      { number: 1, sprintId: "old:release", canOpen: true, state: "CLEARED" },
      { number: 3, sprintId: "future", canOpen: false, state: "LOCKED" },
    ],
    { _id: "current:release", data: { number: 2 } },
  );
  assert.equal(
    links[0].href,
    "/gamer/sprint-board?board=programme&sprint=old%3Arelease",
  );
  assert.equal(
    links[1].href,
    "/gamer/sprint-board?board=programme&sprint=current%3Arelease",
  );
  assert.equal(links[1].current, true);
  assert.equal(links[2].href, null);
  assert.match(links[2].label, /Locked/);
  assert.equal(links[3].href, null);
  assert.match(links[3].label, /Awaiting release/);
});

test("project checkpoints require the complete task set and actual clearance", () => {
  const level = { learningMode: "FULL_STACK", tasks: Array(25).fill({}) };
  const partial = [{ assigneeId: "me", status: "Done" }];
  const p = projectMissionProgress(level, { status: "ACTIVE" }, partial, "me");
  assert.deepEqual(
    p.objectives.map((o) => o.done),
    [true, false, false, false],
  );
  const all = Array.from({ length: 25 }, (_, i) => ({
    assigneeId: i < 5 ? "me" : "other",
    status: "Done",
  }));
  const waiting = projectMissionProgress(
    level,
    { status: "REVIEW" },
    all,
    "me",
  );
  assert.equal(waiting.completed, 3);
  assert.equal(waiting.cleared, false);
  assert.match(waiting.next, /with your Guide/);
  assert.equal(
    projectMissionProgress(level, { status: "CLEARED" }, all, "me").cleared,
    true,
  );
});

test("project next action selects only the current player contribution", () => {
  const tasks = [
    { assigneeId: "other", status: "Ready" },
    { assigneeId: "me", status: "Review" },
    { assigneeId: "me", status: "Working", title: "Build search" },
  ];
  assert.equal(
    projectMissionProgress({ tasks }, { status: "ACTIVE" }, tasks, "me")
      .nextTask.title,
    "Build search",
  );
  assert.match(
    projectMissionProgress({ tasks }, null, [], "me").next,
    /Start the level/,
  );
});

test("sprint trail separates personal approvals from the team key and ignores other teams", () => {
  const tasks = [
    { _id: "one", teamId: "ours", userId: "me", state: "Accepted" },
    { _id: "foreign", teamId: "theirs", userId: "me", state: "Working" },
  ];
  const p = sprintMissionProgress({ data: {} }, tasks, "me", "ours");
  assert.equal(p.completed, 1);
  assert.equal(p.total, 1);
  assert.equal(p.cleared, false);
  assert.equal(p.nextTask, undefined);
  assert.match(p.next, /client acceptance/);
  assert.equal(
    sprintMissionProgress(
      { data: { acceptances: [{ teamId: "theirs", decision: "ACCEPTED" }] } },
      tasks,
      "me",
      "ours",
    ).cleared,
    false,
  );
  assert.equal(
    sprintMissionProgress(
      {
        data: {
          number: 1,
          acceptances: [{ teamId: "ours", decision: "ACCEPTED", key: "Key 1" }],
        },
      },
      tasks,
      "me",
      "ours",
    ).cleared,
    true,
  );
});

test("unstarted levels and mismatched acceptance keys never show clearance", () => {
  const unstarted = projectMissionProgress(
    { tasks: [{}] },
    null,
    [{ assigneeId: "me", status: "Done" }],
    "me",
  );
  assert.equal(unstarted.completed, 0);
  assert.equal(unstarted.nextTask, undefined);
  assert.equal(
    sprintMissionProgress(
      {
        data: {
          number: 2,
          acceptances: [{ teamId: "ours", decision: "ACCEPTED", key: "Key 1" }],
        },
      },
      [],
      "me",
      "ours",
    ).cleared,
    false,
  );
});

test("sprint next mission prefers rework, includes attributed helpers, and explains unreleased tasks", () => {
  const tasks = [
    { teamId: "ours", userId: "me", state: "Ready" },
    {
      _id: "fix",
      teamId: "ours",
      userId: "other",
      data: { coGamerId: "me" },
      state: "Rework",
    },
  ];
  assert.equal(
    sprintMissionProgress({}, tasks, "me", "ours").nextTask._id,
    "fix",
  );
  assert.match(sprintMissionProgress({}, [], "me", "ours").next, /kickoff/);
});
