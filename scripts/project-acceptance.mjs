import assert from "node:assert/strict";
import { models } from "../lib/db.js";
import { projectLevels } from "../lib/project-catalog.js";

export async function projectAcceptance(request) {
  const lead = "usr_g01",
    other = "usr_g06",
    guide = "usr_mc01",
    council = "usr_cc01";
  const submit = {
    submissionSummary: "Built and verified the required role deliverable",
    evidenceReferences: ["repository/pull-request", "repository/test-results"],
  };
  const review = {
    action: "approve",
    feedback: "Verified every required integrated behaviour against the demo.",
    checks: [true, true, true],
  };
  const initial = await request(lead, "state");
  const oldXp = initial.user.xp;
  assert.equal(initial.projectLevels.length, 10);
  await request(lead, "projects/start", { levelId: "project_2" }, 409);
  await Promise.all([
    request(lead, "projects/start", { levelId: "project_1" }),
    request("usr_g02", "projects/start", { levelId: "project_1" }),
  ]);
  const first = (await request(lead, "state")).projectAttempts[0];
  assert.equal(
    await models.Task.countDocuments({ projectAttemptId: first._id }),
    5,
  );
  const foreign = await request(other, "state");
  assert.ok(!foreign.projectAttempts.some((a) => a._id === first._id));
  await request(
    other,
    "projects/submit",
    { attemptId: first._id, ...submit },
    403,
  );
  await request(
    lead,
    "projects/review",
    { attemptId: first._id, ...review },
    403,
  );
  await request(
    lead,
    "projects/submit",
    { attemptId: first._id, ...submit },
    409,
  );
  let xpExpected = oldXp;
  for (const level of projectLevels) {
    if (level.number > 1)
      await request(lead, "projects/start", { levelId: level._id });
    let state = await request(lead, "state");
    const attempt = state.projectAttempts.find((a) => a.levelId === level._id);
    const tasks = state.tasks.filter((t) => t.projectAttemptId === attempt._id);
    for (const t of tasks) {
      assert.equal(
        state.roster.find((p) => p._id === t.assigneeId).teamRoleCode,
        t.targetRole,
      );
      await request(
        other,
        "gamer/task-status",
        { taskId: t._id, status: "In Progress" },
        403,
      );
      await request(t.assigneeId, "gamer/task-status", {
        taskId: t._id,
        status: "Review",
        preDeadlineStatus: "Complete",
        ...submit,
      });
    }
    // Submitting the integrated project must not wait for the Guide's task reviews.
    await request(lead, "projects/submit", {
      attemptId: attempt._id,
      ...submit,
    });
    await request(
      guide,
      "projects/review",
      { attemptId: attempt._id, ...review },
      409,
    );
    for (const t of tasks) {
      const scores = {
        quality: t.assigneeId === lead ? 40 : 20,
        verification: 25,
        timeliness: 20,
        collaboration: 15,
      };
      await request(guide, "commander/task", {
        taskId: t._id,
        action: "approve",
        scores,
        feedback: "Role evidence and implementation were verified.",
      });
    }
    if (level.number === 1) {
      await request(
        council,
        "centre-command/roster",
        { userId: lead, teamId: "team_02" },
        409,
      );
      await request(guide, "projects/review", {
        attemptId: attempt._id,
        action: "return",
        feedback: "Correct the integrated empty-state behaviour.",
      });
      const task = tasks.find((t) => t.assigneeId === lead);
      await request(guide, "commander/task", {
        taskId: task._id,
        action: "reopen",
        feedback: "Verify the complete save-and-refresh integration.",
      });
      await request(
        lead,
        "projects/submit",
        { attemptId: attempt._id, ...submit },
        409,
      );
      await request(lead, "gamer/task-status", {
        taskId: task._id,
        status: "Review",
        ...submit,
      });
      await request(lead, "projects/submit", {
        attemptId: attempt._id,
        ...submit,
      });
      await request(guide, "commander/task", {
        taskId: task._id,
        action: "approve",
        scores: {
          quality: 40,
          verification: 25,
          timeliness: 20,
          collaboration: 15,
        },
        feedback: "Corrected integration verified against requirements.",
      });
    }
    await request(
      guide,
      "projects/review",
      { attemptId: attempt._id, ...review, checks: [true, false, true] },
      400,
    );
    const before = await models.Experience.countDocuments({
      eventKey: { $regex: `^project:${attempt._id}:` },
    });
    assert.equal(before, 0);
    await Promise.all([
      request(guide, "projects/review", { attemptId: attempt._id, ...review }),
      request(council, "projects/review", {
        attemptId: attempt._id,
        ...review,
      }),
    ]);
    state = await request(lead, "state");
    const cleared = state.projectAttempts.find((a) => a._id === attempt._id);
    assert.equal(cleared.status, "CLEARED");
    assert.equal(cleared.stars, 3);
    assert.equal(cleared.rewards.length, 5);
    assert.equal(
      await models.Experience.countDocuments({
        eventKey: { $regex: `^project:${attempt._id}:` },
      }),
      5,
    );
    assert.equal(
      await models.ProjectEvent.countDocuments({
        attemptId: attempt._id,
        kind: "CLEARED",
      }),
      1,
    );
    xpExpected += Math.round(level.baseXp * 1.5);
    assert.equal(state.user.xp, xpExpected);
    assert.ok(
      cleared.rewards.find((r) => r.userId === lead).xp >
        cleared.rewards.find((r) => r.userId !== lead).xp,
    );
  }
  await request(other, "projects/start", { levelId: "project_2" }, 409);
  await request(other, "projects/start", { levelId: "project_1" });
  assert.equal((await request(other, "state")).projectAttempts.length, 1);
  await request(council, "centre-command/clearance", {
    userId: lead,
    competency: 5,
  });
  console.log(
    "PASS all ten team project levels, automatic role assignments, team isolation, submission/review corrections, concurrent exactly-once rewards and project-based clearance",
  );
}
