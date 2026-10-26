import { createHash, randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import { planRecipients, playerRole, teamRoles } from "./team-roles.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
function cc(user) {
  if (user.role !== "CENTRE_COMMAND")
    fail("Only Centre Command can create or publish challenges.", 403);
}
function text(value, label, min = 1, max = 4000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function validateDefinitions(definitions, previous = []) {
  if (
    !Array.isArray(definitions) ||
    !definitions.length ||
    definitions.length > 20
  )
    fail("Add between 1 and 20 tasks to the challenge.");
  const seen = new Set();
  return definitions.map((d) => {
    if (!d || !teamRoles.some((r) => r.code === d.targetRole))
      fail("Select a valid team role for every task.");
    const dueAt = new Date(d.dueAt);
    if (
      typeof d.dueAt !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(d.dueAt) ||
      !Number.isFinite(+dueAt) ||
      dueAt <= new Date()
    )
      fail("Every deadline must be a future timestamp with a timezone.");
    const _id = d._id || randomUUID();
    if (d._id && !previous.some((p) => p._id === d._id))
      fail("Task definition does not belong to this draft.");
    if (seen.has(_id)) fail("Duplicate task definition.");
    seen.add(_id);
    if (!["MEDIUM", "HIGH", "CRITICAL"].includes(d.priority))
      fail("Choose a valid priority.");
    return {
      _id,
      title: text(d.title, "Task name", 3, 160),
      instructions: text(d.instructions, "Instructions", 10),
      acceptanceCriteria: text(d.acceptanceCriteria, "Acceptance criteria", 10),
      targetRole: d.targetRole,
      dueAt,
      priority: d.priority,
    };
  });
}
async function audit(challengeId, user, kind, details, session) {
  await models.ChallengeEvent.create(
    [
      {
        _id: randomUUID(),
        challengeId,
        actorId: user._id,
        kind,
        details,
        createdAt: new Date(),
      },
    ],
    { session },
  );
}
export async function taskAudit(task, user, kind, details, session) {
  if (!task.challengeId) return;
  await models.TaskEvent.create(
    [
      {
        _id: randomUUID(),
        taskId: task._id,
        challengeId: task.challengeId,
        teamId: task.teamId,
        actorId: user._id,
        kind,
        details,
        createdAt: new Date(),
      },
    ],
    { session },
  );
}
async function load(id, session) {
  if (typeof id !== "string") fail("Challenge ID is required.");
  const challenge = await models.Challenge.findOne({
    _id: id,
    cohortId: "alpha",
  }).session(session);
  if (!challenge) fail("Challenge not found.", 404);
  return challenge;
}
async function preview(challenge, session) {
  const teams = await models.Team.find()
    .sort({ _id: 1 })
    .session(session)
    .lean();
  const players = await models.User.find({ role: "GAMER" })
    .sort({ _id: 1 })
    .session(session)
    .lean();
  const plan = planRecipients(challenge.definitions, teams, players);
  for (const definition of challenge.definitions)
    if (definition.dueAt <= new Date())
      plan.errors.push(
        `${definition.title}: the deadline has passed. Edit the draft before publication.`,
      );
  plan.canPublish = plan.errors.length === 0;
  const token = createHash("sha256")
    .update(
      JSON.stringify({
        challengeId: challenge._id,
        version: challenge.version,
        teams: teams.map((t) => t._id),
        players: players.map((p) => [
          p._id,
          p.teamId,
          p.active !== false,
          playerRole(p),
          p.name,
        ]),
      }),
    )
    .digest("hex");
  return {
    challengeId: challenge._id,
    version: challenge.version,
    ...plan,
    token,
  };
}
export async function challengeAction(user, action, body) {
  cc(user);
  return transaction(async (session) => {
    if (action === "create") {
      const challengeId = text(body.challengeId, "Request ID", 36, 36);
      if (!/^[a-f0-9-]{36}$/i.test(challengeId))
        fail("Invalid challenge request ID.");
      if (await models.Challenge.exists({ _id: challengeId }).session(session))
        fail("This draft already exists. Refresh to open it.", 409);
      const record = {
        _id: challengeId,
        cohortId: "alpha",
        name: text(body.name, "Challenge name", 3, 160),
        description: text(body.description, "Challenge description", 10),
        status: "DRAFT",
        version: 1,
        createdBy: user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
        definitions: validateDefinitions(body.definitions),
      };
      await models.Challenge.create([record], { session });
      await audit(
        challengeId,
        user,
        "CREATED",
        { name: record.name, definitions: record.definitions },
        session,
      );
      return { challengeId };
    }
    const challenge = await load(body.challengeId, session);
    if (action === "publish" && challenge.status === "PUBLISHED")
      return { challengeId: challenge._id, alreadyPublished: true };
    if (challenge.status !== "DRAFT")
      fail(
        "Published challenges are sealed. Create a new challenge for new work.",
        409,
      );
    if (body.version !== challenge.version)
      fail("The draft changed. Refresh and preview the current version.", 409);
    if (action === "update") {
      const before = challenge.toObject();
      challenge.name = text(body.name, "Challenge name", 3, 160);
      challenge.description = text(
        body.description,
        "Challenge description",
        10,
      );
      challenge.definitions = validateDefinitions(
        body.definitions,
        challenge.definitions,
      );
      challenge.version += 1;
      challenge.updatedAt = new Date();
      await challenge.save({ session });
      await audit(
        challenge._id,
        user,
        "DRAFT_UPDATED",
        { before, after: challenge.toObject() },
        session,
      );
      return { challengeId: challenge._id };
    }
    if (action === "preview") return preview(challenge, session);
    if (action !== "publish") fail("Unknown challenge action.", 404);
    // Roster edits and publication write the same cohort document. A concurrent
    // edit causes a transaction retry and recipient-token revalidation.
    const lock = await models.Cohort.updateOne(
      { _id: "alpha" },
      { $inc: { rosterVersion: 1 } },
      { session },
    );
    if (!lock.matchedCount) fail("Cohort not found.", 404);
    const plan = await preview(challenge, session);
    if (!plan.canPublish) fail(plan.errors.join(" "), 409);
    if (body.previewToken !== plan.token)
      fail(
        "Recipients changed or the preview is missing. Preview again before publishing.",
        409,
      );
    const publishedAt = new Date();
    const tasks = plan.recipients.map((recipient) => {
      const definition = challenge.definitions.find(
        (d) => d._id === recipient.definitionId,
      );
      return {
        _id: randomUUID(),
        challengeId: challenge._id,
        definitionId: definition._id,
        challengeName: challenge.name,
        teamId: recipient.teamId,
        assigneeId: recipient.userId,
        originalAssigneeId: recipient.userId,
        targetRole: definition.targetRole,
        title: definition.title,
        description: definition.instructions,
        acceptanceCriteria: definition.acceptanceCriteria,
        dueAt: definition.dueAt,
        priority: definition.priority,
        status: "Backlog",
        releasedAt: publishedAt,
        xp: 10,
      };
    });
    await models.Task.create(tasks, { session, ordered: true });
    challenge.status = "PUBLISHED";
    challenge.publishedAt = publishedAt;
    challenge.publishedBy = user._id;
    challenge.updatedAt = publishedAt;
    await challenge.save({ session });
    await audit(
      challenge._id,
      user,
      "PUBLISHED",
      {
        publishedAt,
        recipients: plan.recipients,
        taskIds: tasks.map((t) => t._id),
      },
      session,
    );
    return { challengeId: challenge._id, assignedCount: tasks.length };
  });
}
export async function challengeSnapshot(user, tasks) {
  const ids = [...new Set(tasks.map((t) => t.challengeId).filter(Boolean))];
  const records = await models.Challenge.find(
    user.role === "CENTRE_COMMAND"
      ? { cohortId: "alpha" }
      : { _id: { $in: ids }, cohortId: "alpha", status: "PUBLISHED" },
  )
    .sort({ createdAt: -1 })
    .lean();
  return user.role === "GAMER"
    ? records.map((c) => ({
        _id: c._id,
        name: c.name,
        description: c.description,
        publishedAt: c.publishedAt,
        status: c.status,
      }))
    : records;
}
