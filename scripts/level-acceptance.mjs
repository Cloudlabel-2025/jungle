import assert from "node:assert/strict";
import { projectLevels } from "../lib/project-catalog.js";

export async function levelAcceptance(request) {
  const council = "usr_cc01",
    guide = "usr_mc01",
    lead = "usr_g01",
    other = "usr_g06";
  const definition = {
    ...structuredClone(projectLevels[0]),
    name: "Acceptance camp directory",
    hazardKey: "animal",
    teamIds: ["team_01", "team_02"],
  };
  await request(guide, "levels/save", { definition }, 403);
  await request(lead, "levels/save", { definition }, 403);
  await request(
    council,
    "levels/save",
    { definition: { ...definition, hazardKey: "crocodile" } },
    400,
  );
  let draft = await request(council, "levels/save", { definition });
  let state = await request(lead, "state");
  assert.equal(state.projectLevels.length, 10);
  assert.equal(state.levelDrafts.length, 0);
  await request(lead, "projects/start", { levelId: draft.levelId }, 404);
  let preview = await request(council, "levels/preview", draft);
  assert.equal(
    preview.rows.find((r) => r.teamId === "team_01").state,
    "STARTS_ON_PUBLISH",
  );
  assert.equal(
    preview.rows.find((r) => r.teamId === "team_02").state,
    "QUEUED",
  );
  const published = await request(council, "levels/publish", {
    ...draft,
    previewToken: preview.token,
  });
  state = await request(lead, "state");
  assert.equal(state.projectLevels.length, 11);
  const attempt = state.projectAttempts.find(
    (a) => a.levelId === draft.levelId,
  );
  assert.equal(attempt.status, "ACTIVE");
  const tasks = state.tasks.filter((t) => t.projectAttemptId === attempt._id);
  assert.equal(tasks.length, 5);
  assert.equal(
    (await request(other, "state")).projectAttempts.some(
      (a) => a.levelId === draft.levelId,
    ),
    false,
  );
  draft = await request(council, "levels/save", {
    levelId: draft.levelId,
    version: published.version,
    definition: {
      ...definition,
      name: "Revised future camp directory",
      hazardKey: "viper",
    },
  });
  preview = await request(council, "levels/preview", draft);
  await request(council, "levels/publish", {
    ...draft,
    previewToken: preview.token,
  });
  state = await request(lead, "state");
  assert.equal(
    state.projectLevels.at(-1).hazardKey,
    "animal",
    "Started team retains original emblem",
  );
  assert.equal(
    (await request(other, "state")).projectLevels.at(-1).hazardKey,
    "viper",
  );
  const evidence = {
    submissionSummary:
      "Implemented and verified the complete required deliverable.",
    evidenceReferences: ["repository/pull-request"],
  };
  for (const task of tasks) {
    await request(task.assigneeId, "gamer/task-status", {
      taskId: task._id,
      status: "Review",
      ...evidence,
    });
    await request(guide, "commander/task", {
      taskId: task._id,
      action: "approve",
      feedback:
        "Verified the required role acceptance checks and submitted evidence.",
      scores: {
        quality: 40,
        verification: 25,
        timeliness: 20,
        collaboration: 15,
      },
    });
  }
  await request(lead, "projects/submit", {
    attemptId: attempt._id,
    ...evidence,
  });
  await request(guide, "projects/review", {
    attemptId: attempt._id,
    action: "approve",
    feedback: "All original integrated criteria were verified successfully.",
    checks: definition.criteria.map(() => true),
  });
  state = await request(lead, "state");
  const cleared = state.projectAttempts.find((a) => a._id === attempt._id);
  assert.equal(cleared.stars, 3);
  assert.equal(cleared.rewards.length, 5);
  assert.ok(cleared.rewards.every((r) => r.xp > 0 && r.trophies > 0));
  console.log(
    "PASS Council-only level drafts, emblem selection, team publishing, queued roles, immutable live definitions and custom-level stars/rewards",
  );
}
