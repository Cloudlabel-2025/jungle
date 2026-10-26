import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { models } from "../lib/db.js";
export async function challengeAcceptance(request) {
  const cc = "usr_cc01",
    mc = "usr_mc01",
    backend = "usr_g03",
    peer = "usr_g01",
    other = "usr_g08";
  const challengeId = randomUUID();
  const dueAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const body = {
    challengeId,
    name: "Reliable banking challenge",
    description:
      "Build and verify a role-specific banking deliverable in every team.",
    definitions: [
      {
        title: "Build the transaction API",
        instructions:
          "Implement validated transfers with safe atomic persistence.",
        acceptanceCriteria:
          "Reject invalid transfers and demonstrate duplicate prevention with tests.",
        targetRole: "BACKEND",
        priority: "HIGH",
        dueAt,
      },
      {
        title: "Build the transfer interface",
        instructions:
          "Build accessible transfer controls and clear error messages.",
        acceptanceCriteria:
          "Demonstrate keyboard operation and validation feedback.",
        targetRole: "FRONTEND",
        priority: "MEDIUM",
        dueAt,
      },
    ],
  };
  const post = (who, action, values, status = 200) =>
    request(who, `challenges/${action}`, values, status);
  await post(peer, "create", body, 403);
  await post(mc, "create", body, 403);
  await post(
    cc,
    "create",
    {
      ...body,
      challengeId: randomUUID(),
      definitions: [{ ...body.definitions[0], targetRole: "GAMER" }],
    },
    400,
  );
  await post(
    cc,
    "create",
    { ...body, challengeId: randomUUID(), definitions: [] },
    400,
  );
  await post(cc, "create", body);
  const preview = await post(cc, "preview", { challengeId, version: 1 });
  assert.equal(preview.canPublish, true);
  assert.equal(preview.recipients.length, 10);
  assert.equal(
    (await request(peer, "challenges")).challenges.some(
      (c) => c._id === challengeId,
    ),
    false,
  );
  await post(cc, "publish", { challengeId, version: 1 }, 409);
  assert.equal(await models.Task.countDocuments({ challengeId }), 0);
  await models.User.updateOne({ _id: backend }, { $set: { active: false } });
  const missing = await post(cc, "preview", { challengeId, version: 1 });
  assert.equal(missing.canPublish, false);
  await post(
    cc,
    "publish",
    { challengeId, version: 1, previewToken: preview.token },
    409,
  );
  assert.equal(await models.Task.countDocuments({ challengeId }), 0);
  await models.User.updateOne({ _id: backend }, { $set: { active: true } });
  await models.User.updateOne(
    { _id: peer },
    { $set: { teamRoleCode: "BACKEND" } },
  );
  assert.equal(
    (await post(cc, "preview", { challengeId, version: 1 })).canPublish,
    false,
  );
  await models.User.updateOne(
    { _id: peer },
    { $set: { teamRoleCode: "TEAM_LEAD" } },
  );
  // Save a modified draft: the old preview/version must not publish.
  const saved = await models.Challenge.findById(challengeId).lean();
  await post(cc, "update", {
    ...body,
    version: 1,
    definitions: saved.definitions.map((d) => ({
      ...d,
      dueAt: d.dueAt.toISOString(),
    })),
  });
  await post(
    cc,
    "publish",
    { challengeId, version: 1, previewToken: preview.token },
    409,
  );
  const nextPreview = await post(cc, "preview", { challengeId, version: 2 });
  // Roster changes invalidate the preview even if there remains exactly one recipient.
  await request(cc, "centre-command/roster", {
    userId: backend,
    teamId: "team_01",
    teamRoleCode: "TEAM_LEAD",
  });
  await request(cc, "centre-command/roster", {
    userId: peer,
    teamId: "team_01",
    teamRoleCode: "BACKEND",
  });
  await post(
    cc,
    "publish",
    { challengeId, version: 2, previewToken: nextPreview.token },
    409,
  );
  await request(cc, "centre-command/roster", {
    userId: backend,
    teamId: "team_01",
    teamRoleCode: "BACKEND",
  });
  await request(cc, "centre-command/roster", {
    userId: peer,
    teamId: "team_01",
    teamRoleCode: "TEAM_LEAD",
  });
  const ready = await post(cc, "preview", { challengeId, version: 2 });
  await Promise.all([
    post(cc, "publish", { challengeId, version: 2, previewToken: ready.token }),
    post(cc, "publish", { challengeId, version: 2, previewToken: ready.token }),
  ]);
  assert.equal(await models.Task.countDocuments({ challengeId }), 10);
  const assigned = await models.Task.find({ challengeId }).lean();
  assert.equal(
    new Set(assigned.map((t) => t.releasedAt.toISOString())).size,
    1,
  );
  assert.equal(
    new Set(assigned.map((t) => `${t.definitionId}:${t.teamId}`)).size,
    10,
  );
  assert.equal(
    await models.ChallengeEvent.countDocuments({
      challengeId,
      kind: "PUBLISHED",
    }),
    1,
  );
  await post(cc, "update", { ...body, version: 2 }, 409);
  const own = assigned.find((t) => t.assigneeId === backend),
    untouched = assigned.find((t) => t.assigneeId === other);
  assert.ok(own && untouched);
  await request(
    peer,
    "gamer/task-status",
    { taskId: own._id, status: "Review" },
    403,
  );
  await request(
    other,
    "gamer/task-status",
    { taskId: own._id, status: "In Progress" },
    403,
  );
  await request(
    backend,
    "gamer/task-status",
    { taskId: own._id, status: "Review" },
    400,
  );
  await request(
    cc,
    "centre-command/roster",
    { userId: backend, teamId: "team_02" },
    409,
  );
  const submission = {
    taskId: own._id,
    status: "Review",
    submissionSummary:
      "Implemented atomic transfers and verified stable event-key deduplication.",
    evidenceReferences: [
      "training/commits/verified-transfer",
      "training/tests/idempotency",
    ],
  };
  await request(backend, "gamer/task-status", submission);
  await request(
    backend,
    "gamer/task-status",
    { taskId: own._id, status: "Backlog" },
    409,
  );
  assert.equal(
    (await request(peer, "state")).tasks.find((t) => t._id === own._id)
      .submissionSummary,
    undefined,
  );
  assert.equal(
    (await request(other, "state")).tasks.some((t) => t._id === own._id),
    false,
  );
  const ownerView = await request(backend, "state");
  assert.equal(
    ownerView.challenges.find((c) => c._id === challengeId).definitions,
    undefined,
  );
  assert.equal(
    ownerView.tasks.find((t) => t._id === own._id).evidenceReferences.length,
    2,
  );
  await request(
    mc,
    "commander/task",
    { taskId: own._id, action: "return" },
    400,
  );
  await request(mc, "commander/task", {
    taskId: own._id,
    action: "return",
    feedback:
      "Add a test proving concurrent duplicate requests persist one operation.",
  });
  assert.match(
    (await request(backend, "state")).tasks.find((t) => t._id === own._id)
      .reviewFeedback,
    /concurrent/,
  );
  await request(backend, "gamer/task-status", {
    ...submission,
    submissionSummary:
      "Added a concurrent duplicate-request test and confirmed one operation.",
  });
  await request(mc, "commander/task", { taskId: own._id, action: "approve" });
  await request(
    mc,
    "commander/task",
    { taskId: own._id, action: "approve" },
    400,
  );
  assert.equal((await models.Task.findById(own._id)).status, "Done");
  assert.equal((await models.Task.findById(untouched._id)).status, "Backlog");
  assert.equal(
    await models.Experience.countDocuments({ eventKey: `quest:${own._id}` }),
    1,
  );
  assert.equal(
    await models.TaskEvent.countDocuments({
      taskId: own._id,
      kind: "SUBMITTED",
    }),
    2,
  );
  assert.equal(
    await models.TaskEvent.countDocuments({
      taskId: own._id,
      kind: "RETURNED",
    }),
    1,
  );
  // Rotating a role must not silently transfer existing challenge work.
  await request(cc, "centre-command/roster", {
    userId: other,
    teamId: "team_02",
    teamRoleCode: "TEAM_LEAD",
  });
  assert.equal((await models.Task.findById(untouched._id)).assigneeId, other);
  await request(cc, "centre-command/roster", {
    userId: other,
    teamId: "team_02",
    teamRoleCode: "BACKEND",
  });
  console.log(
    "PASS role challenges: recipient preview, roster validation, atomic concurrent publication, independent assignments, privacy, evidence, feedback and approval",
  );
}
