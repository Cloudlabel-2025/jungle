import { models } from "./db.js";
import { randomUUID } from "node:crypto";
import { projectRecipients, addProjectHours } from "./project-catalog.js";
import { previousLevel } from "./level-definitions.js";

export async function startTeamProject(actor, teamId, level, levels, session) {
  const existing = await models.ProjectAttempt.findOne({
    teamId,
    levelId: level._id,
  }).session(session);
  if (existing) return { attemptId: existing._id, alreadyStarted: true };
  const previous = previousLevel(levels, level._id);
  if (
    previous &&
    !(await models.ProjectAttempt.exists({
      teamId,
      levelId: previous._id,
      status: "CLEARED",
      stars: { $gte: 1 },
    }).session(session))
  )
    throw Object.assign(
      new Error(
        "Clear the previous team project with at least one star first.",
      ),
      { status: 409 },
    );
  const players = await models.User.find({ teamId, role: "GAMER" })
    .session(session)
    .lean();
  const recipients = projectRecipients(level, players);
  const now = new Date();
  const dueAt = addProjectHours(now, level.hours);
  const [attempt] = await models.ProjectAttempt.create(
    [
      {
        _id: `${teamId}:${level._id}`,
        teamId,
        levelId: level._id,
        number: level.number,
        definitionSnapshot: level,
        status: "ACTIVE",
        startedAt: now,
        startedBy: actor._id,
        dueAt,
        lateUntil: addProjectHours(dueAt, Math.max(2, level.hours / 4)),
      },
    ],
    { session },
  );
  await models.Task.create(
    recipients.map((task) => ({
      _id: `${attempt._id}:${task.targetRole}`,
      teamId,
      assigneeId: task.assigneeId,
      originalAssigneeId: task.assigneeId,
      title: task.title,
      description: task.instructions,
      acceptanceCriteria: task.acceptanceCriteria,
      targetRole: task.targetRole,
      targetCharacter: task.targetCharacter,
      featureId: task.featureId,
      featureName: task.featureName,
      discipline: task.discipline,
      projectAttemptId: attempt._id,
      projectLevelId: level._id,
      status: "Backlog",
      dueAt,
      releasedAt: now,
      priority: "MEDIUM",
      xp: 0,
    })),
    { session, ordered: true },
  );
  await models.ProjectEvent.create(
    [
      {
        _id: randomUUID(),
        attemptId: attempt._id,
        teamId,
        actorId: actor._id,
        kind: "STARTED",
        details: {
          levelId: level._id,
          dueAt,
          assignments: recipients.map((r) => ({
            role: r.targetRole,
            userId: r.assigneeId,
          })),
        },
        createdAt: now,
      },
    ],
    { session },
  );
  return { attemptId: attempt._id };
}
