import { randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import { playerRole } from "./team-roles.js";
import { ist } from "./rules.js";
import {
  projectLevels,
  projectRecipients,
  addProjectHours,
  contributionScore,
  projectStars,
  projectReward,
} from "./project-catalog.js";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function text(value, label, min = 10, max = 4000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function evidence(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 10)
    fail("Provide 1–10 evidence references.");
  return values.map((v) => text(v, "Evidence reference", 3, 1000));
}
async function event(attempt, user, kind, details, session) {
  await models.ProjectEvent.create(
    [
      {
        _id: randomUUID(),
        attemptId: attempt._id,
        teamId: attempt.teamId,
        actorId: user._id,
        kind,
        details,
        createdAt: new Date(),
      },
    ],
    { session },
  );
}

export async function projectAction(actor, action, body) {
  return transaction(async (session) => {
    // Re-read permissions and membership inside the transaction.
    const user = await models.User.findById(actor._id).session(session);
    if (!user || user.active === false)
      fail("An active account is required.", 403);
    const staff = ["MISSION_COMMANDER", "CENTRE_COMMAND"].includes(user.role);
    const now = new Date();
    if (action === "start") {
      const teamId = staff ? body.teamId : user.teamId;
      if (
        !teamId ||
        !(await models.Team.exists({ _id: teamId }).session(session))
      )
        fail("Team not found.", 404);
      const level = projectLevels.find((l) => l._id === body.levelId);
      if (!level) fail("Project level not found.", 404);
      // Roster edits use the same write, forcing concurrent changes to retry.
      const lock = await models.Cohort.updateOne(
        { _id: "alpha" },
        { $inc: { rosterVersion: 1 } },
        { session },
      );
      if (!lock.matchedCount) fail("Cohort is not configured.");
      const existing = await models.ProjectAttempt.findOne({
        teamId,
        levelId: level._id,
      }).session(session);
      if (existing) return { attemptId: existing._id, alreadyStarted: true };
      if (
        level.number > 1 &&
        !(await models.ProjectAttempt.exists({
          teamId,
          levelId: projectLevels[level.number - 2]._id,
          status: "CLEARED",
          stars: { $gte: 1 },
        }).session(session))
      )
        fail(
          "Clear the previous team project with at least one star first.",
          409,
        );
      const players = await models.User.find({ teamId, role: "GAMER" })
        .session(session)
        .lean();
      const recipients = projectRecipients(level, players);
      const dueAt = addProjectHours(now, level.hours);
      const [attempt] = await models.ProjectAttempt.create(
        [
          {
            _id: `${teamId}:${level._id}`,
            teamId,
            levelId: level._id,
            number: level.number,
            status: "ACTIVE",
            startedAt: now,
            startedBy: user._id,
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
      await event(
        attempt,
        user,
        "STARTED",
        {
          levelId: level._id,
          dueAt,
          assignments: recipients.map((r) => ({
            role: r.targetRole,
            userId: r.assigneeId,
          })),
        },
        session,
      );
      return { attemptId: attempt._id };
    }

    const task =
      action === "task"
        ? await models.Task.findById(body.taskId).session(session)
        : null;
    const attempt = await models.ProjectAttempt.findById(
      task?.projectAttemptId || body.attemptId,
    ).session(session);
    if (!attempt || (action === "task" && !task?.projectAttemptId))
      fail("Project not found.", 404);
    if (!staff && (user.role !== "GAMER" || user.teamId !== attempt.teamId))
      fail("This project belongs to another team.", 403);
    // Serialise task reviews, final submissions and payouts on the shared attempt.
    await models.ProjectAttempt.updateOne(
      { _id: attempt._id },
      { $inc: { version: 1 } },
      { session },
    );
    if (attempt.status === "CLEARED") {
      if (action === "review" && body.action === "approve" && staff)
        return { alreadyCleared: true };
      fail("This project is cleared and sealed.", 409);
    }

    if (action === "task") {
      if (attempt.status !== "ACTIVE" && !staff)
        fail("The integrated project is awaiting review.", 409);
      if (staff) {
        if (body.action === "approve") {
          if (
            task.status !== "Review" ||
            !task.submittedAt ||
            !task.submissionSummary ||
            !task.evidenceReferences.length
          )
            fail("Review an evidence-backed submission first.", 409);
          task.performanceScore = contributionScore(body.scores);
          task.performanceScores = body.scores;
          task.reviewedBy = user._id;
          task.approvedAt = now;
          task.reviewFeedback = text(body.feedback, "Review rationale");
          task.status = "Done";
        } else if (body.action === "return" || body.action === "reopen") {
          if (
            task.status !== "Review" &&
            !(body.action === "reopen" && task.status === "Done")
          )
            fail("Only submitted tasks can be returned.", 409);
          task.reviewFeedback = text(body.feedback, "Feedback");
          task.status = "In Progress";
          task.performanceScore = undefined;
          task.performanceScores = undefined;
          task.approvedAt = undefined;
          attempt.status = "ACTIVE";
          attempt.feedback = `Contribution requires changes: ${task.reviewFeedback}`;
          await attempt.save({ session });
        } else if (body.action === "reassign") {
          if (task.status === "Done")
            fail("Approved contributions are sealed.", 409);
          const next = await models.User.findOne({
            _id: body.userId,
            teamId: attempt.teamId,
            role: "GAMER",
            active: { $ne: false },
          }).session(session);
          if (!next || playerRole(next) !== task.targetRole)
            fail(
              "Choose an active member of the same team with the matching role.",
            );
          const previous = task.assigneeId;
          task.assigneeId = next._id;
          task.status = "Backlog";
          task.submissionSummary = "";
          task.evidenceReferences = [];
          task.submittedAt = undefined;
          task.reviewFeedback = "";
          attempt.status = "ACTIVE";
          attempt.feedback =
            "A contribution was reassigned. Submit the integrated project again after the new owner finishes.";
          await attempt.save({ session });
          await event(
            attempt,
            user,
            "REASSIGNED",
            {
              taskId: task._id,
              previous,
              next: next._id,
              reason: text(body.reason, "Reassignment reason"),
            },
            session,
          );
        } else fail("Unknown task action.");
      } else {
        if (task.assigneeId !== user._id)
          fail("Only the assigned player can update this task.", 403);
        if (task.status === "Done" || task.status === "Review")
          fail("This contribution is sealed or awaiting review.", 409);
        if (body.preDeadlineStatus) {
          if (
            !["On Track", "At Risk", "Delayed", "Complete"].includes(
              body.preDeadlineStatus,
            )
          )
            fail("Invalid status report.");
          if (now >= task.dueAt)
            fail("The reporting deadline has passed.", 409);
          task.report = body.preDeadlineStatus;
          task.reportedAt = now;
        }
        if (body.status) {
          if (!["Backlog", "In Progress", "Review"].includes(body.status))
            fail("Submit for review; only a Guide can approve work.");
          if (body.status === "Review") {
            task.submissionSummary = text(
              body.submissionSummary,
              "Completion summary",
            );
            task.evidenceReferences = evidence(body.evidenceReferences);
            task.submittedAt = now;
            task.submissionVersion += 1;
            task.reviewFeedback = "";
          }
          task.status = body.status;
        } else if (!body.preDeadlineStatus) fail("Provide a task update.");
      }
      await task.save({ session });
      await event(
        attempt,
        user,
        "TASK_UPDATED",
        {
          taskId: task._id,
          action: body.action || body.status || "REPORT",
          status: task.status,
          submissionVersion: task.submissionVersion,
          summary: task.submissionSummary,
          evidence: task.evidenceReferences,
          feedback: task.reviewFeedback,
          scores: task.performanceScores,
        },
        session,
      );
      return { taskId: task._id };
    }

    const tasks = await models.Task.find({
      projectAttemptId: attempt._id,
    }).session(session);
    const level = projectLevels.find((l) => l._id === attempt.levelId);
    const allApproved =
      tasks.length === level.tasks.length &&
      level.tasks.every((definition) =>
        tasks.some(
          (t) =>
            t.targetRole === definition.targetRole &&
            t.status === "Done" &&
            t.performanceScore >= 1,
        ),
      );
    if (action === "submit") {
      if (staff) fail("A team member submits the integrated project.", 403);
      const allSubmitted =
        tasks.length === level.tasks.length &&
        tasks.every(
          (t) =>
            ["Review", "Done"].includes(t.status) &&
            t.submittedAt &&
            t.evidenceReferences.length,
        );
      if (attempt.status !== "ACTIVE" || !allSubmitted)
        fail(
          "Every role task must be submitted with evidence before submitting the integrated project.",
          409,
        );
      attempt.submissionSummary = text(
        body.submissionSummary,
        "Integrated project summary",
      );
      attempt.evidenceReferences = evidence(body.evidenceReferences);
      attempt.submittedAt = now;
      attempt.submissionVersion += 1;
      attempt.feedback = "";
      attempt.status = "REVIEW";
      await event(
        attempt,
        user,
        "SUBMITTED",
        {
          summary: attempt.submissionSummary,
          evidence: attempt.evidenceReferences,
          version: attempt.submissionVersion,
        },
        session,
      );
    } else if (action === "review") {
      if (!staff)
        fail("Only a Guide or Council member may review a project.", 403);
      if (attempt.status !== "REVIEW")
        fail("The project must be submitted for review first.", 409);
      attempt.feedback = text(body.feedback, "Integrated review feedback");
      attempt.reviewedBy = user._id;
      if (body.action === "return") {
        attempt.status = "ACTIVE";
        await event(
          attempt,
          user,
          "RETURNED",
          { feedback: attempt.feedback, version: attempt.submissionVersion },
          session,
        );
      } else if (body.action === "approve") {
        if (!allApproved)
          fail("All five role contributions must be approved.", 409);
        if (
          !Array.isArray(body.checks) ||
          body.checks.length !== level.criteria.length ||
          !body.checks.every((v) => v === true)
        )
          fail("Verify every integrated acceptance criterion before approval.");
        attempt.stars = projectStars(
          attempt.submittedAt,
          attempt.dueAt,
          attempt.lateUntil,
        );
        attempt.status = "CLEARED";
        attempt.clearedAt = now;
        attempt.rewards = [];
        for (const t of tasks) {
          const grant = projectReward(level, attempt.stars, t.performanceScore);
          const eventKey = `project:${attempt._id}:${t.assigneeId}`;
          // Completion rewards are separate from daily activity caps, once per level.
          await models.Experience.create(
            [
              {
                _id: randomUUID(),
                userId: t.assigneeId,
                amount: grant.xp,
                eventKey,
                day: ist(now).day,
                reason: `${level.name}: ${attempt.stars} stars, contribution ${t.performanceScore}/100`,
              },
            ],
            { session },
          );
          await models.Trophy.create(
            [
              {
                _id: randomUUID(),
                userId: t.assigneeId,
                amount: grant.trophies,
                eventKey,
                day: ist(now).day,
                reason: `${level.name}: ${attempt.stars} stars, contribution ${t.performanceScore}/100`,
              },
            ],
            { session },
          );
          await models.User.updateOne(
            { _id: t.assigneeId },
            { $inc: { xp: grant.xp, trophies: grant.trophies } },
            { session },
          );
          attempt.rewards.push({
            userId: t.assigneeId,
            score: t.performanceScore,
            ...grant,
          });
        }
        await event(
          attempt,
          user,
          "CLEARED",
          {
            stars: attempt.stars,
            rewards: attempt.rewards,
            feedback: attempt.feedback,
            checks: body.checks,
          },
          session,
        );
      } else fail("Choose approve or return.");
    } else fail("Unknown project action.", 404);
    await attempt.save({ session });
    return { attemptId: attempt._id, stars: attempt.stars };
  });
}
