import test from "node:test";
import assert from "node:assert/strict";
import { workflowGuidance } from "../lib/workflow-guidance.js";
import { navigation } from "../lib/catalog.js";
import { validProgrammeScreen } from "../lib/workspace-navigation.js";

const fixture = (role = "GAMER") => ({
  user: { _id: "self", role },
  tasks: [],
  weekOneProgram: { days: [], learners: [], attempts: [], rules: [] },
});

test("guidance does not infer release or team publication from scores or draft teams", () => {
  const data = fixture();
  data.weekOneProgram.days = [{ day: 2, state: "DRAFT" }];
  data.weekOneProgram.results = [{ userId: "self", total: 100 }];
  data.weekOneProgram.recovery = { team: [{ members: ["self"] }] };
  const view = workflowGuidance(data);
  assert.equal(view.stage, "Expedition workspace");
  assert.ok(
    !view.actions.some((action) => /published|today/.test(action.title)),
  );
});

test("a running attempt takes precedence until its server deadline", () => {
  const data = fixture();
  data.weekOneProgram.days = [{ day: 2, state: "OPEN" }];
  data.weekOneProgram.attempts = [
    {
      data: {
        startedAt: "2026-11-11T04:00:00Z",
        deadline: "2026-11-11T05:00:00Z",
      },
    },
  ];
  assert.equal(
    workflowGuidance(data, new Date("2026-11-11T04:30:00Z")).actions[0].title,
    "Continue timed activity",
  );
  assert.notEqual(
    workflowGuidance(data, new Date("2026-11-11T05:00:00Z")).actions[0].title,
    "Continue timed activity",
  );
});

test("Gamer objective counts exclude teammates and completed or submitted tasks", () => {
  const data = fixture();
  data.tasks = [
    { assigneeId: "self", status: "Backlog" },
    { assigneeId: "self", status: "Review" },
    { assigneeId: "self", status: "Done" },
    { assigneeId: "other", status: "Backlog" },
  ];
  assert.equal(workflowGuidance(data).actions[0].count, 1);
});

test("current rules acknowledgement removes the corresponding next action", () => {
  const data = fixture();
  data.weekOneProgram.rules = [{ version: 3 }];
  assert.equal(
    workflowGuidance(data).actions[0].title,
    "Read and acknowledge rules",
  );
  data.weekOneProgram.learners = [
    { userId: "self", data: { ruleAcks: { 3: { at: "saved" } } } },
  ];
  assert.ok(
    !workflowGuidance(data).actions.some((action) =>
      /acknowledge/.test(action.title),
    ),
  );
});

test("all role guidance links resolve within that role's existing workspace", () => {
  for (const role of Object.keys(navigation)) {
    const data = fixture(role);
    data.weekOneProgram.days = [{ day: 1, state: "OPEN" }];
    data.weekOneProgram.overdueReviews = [{}];
    data.tasks = [{ assigneeId: "self", status: "Review" }];
    for (const action of workflowGuidance(data).actions) {
      const url = new URL(action.href, "https://codewild.invalid");
      const screen = url.pathname.split("/")[2];
      assert.ok(
        navigation[role].some((entry) => entry[1] === screen) ||
          validProgrammeScreen(role, screen),
        `${role}: ${action.href}`,
      );
    }
  }
});

test("recovery follow-up remains private and cannot show another learner's status", () => {
  const data = fixture();
  data.weekOneProgram.recovery = {
    participants: [{ userId: "other", state: "RECOVERY_REQUIRED" }],
  };
  assert.ok(
    !workflowGuidance(data).actions.some((action) =>
      /recovery/.test(action.title),
    ),
  );
  data.weekOneProgram.recovery.participants.push({
    userId: "self",
    state: "INSTITUTION_PENDING",
  });
  assert.equal(
    workflowGuidance(data).actions[0].title,
    "Check recovery status",
  );
});
