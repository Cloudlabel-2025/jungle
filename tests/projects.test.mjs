import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  projectLevels,
  projectRecipients,
  addProjectHours,
  projectStars,
  contributionScore,
  projectReward,
} from "../lib/project-catalog.js";
import { teamRoles } from "../lib/team-roles.js";
import { models, connect } from "../lib/db.js";
import { projectAction } from "../lib/projects.js";

test("beginner projects cover five role deliverables at each incremental level", () => {
  assert.equal(projectLevels.length, 10);
  for (const [i, level] of projectLevels.entries()) {
    assert.equal(level.number, i + 1);
    assert.deepEqual(
      level.tasks.map((t) => t.targetRole),
      teamRoles.map((r) => r.code),
    );
    assert.ok(
      level.tasks.every(
        (t) =>
          t.instructions.length > 30 &&
          t.acceptanceCriteria.includes("evidence"),
      ),
    );
    assert.ok(level.criteria.length >= 3);
    if (i) assert.ok(level.hours >= projectLevels[i - 1].hours);
  }
});

test("role assignment rejects missing, inactive, and duplicate holders without assigning substitutes", () => {
  const players = teamRoles.map((r, i) => ({
    _id: `p${i}`,
    role: "GAMER",
    teamRoleCode: r.code,
  }));
  assert.deepEqual(
    projectRecipients(projectLevels[0], players).map((r) => r.assigneeId),
    players.map((p) => p._id),
  );
  assert.throws(
    () => projectRecipients(projectLevels[0], players.slice(1)),
    /exactly one/,
  );
  assert.throws(
    () =>
      projectRecipients(projectLevels[0], [
        ...players,
        { ...players[0], _id: "duplicate" },
      ]),
    /found 2/,
  );
  assert.throws(
    () =>
      projectRecipients(
        projectLevels[0],
        players.map((p, i) => (i === 0 ? { ...p, active: false } : p)),
      ),
    /found 0/,
  );
  assert.equal(
    projectRecipients(
      projectLevels[0],
      players.map((p, i) => ({
        ...p,
        teamRoleCode: undefined,
        assignment: teamRoles[i].label,
      })),
    ).length,
    5,
  );
});

test("eight-hour IST project days skip nights and weekends, including fractional budgets", () => {
  assert.equal(
    addProjectHours("2026-10-26T03:30:00Z", 8).toISOString(),
    "2026-10-26T11:30:00.000Z",
  );
  assert.equal(
    addProjectHours("2026-10-30T10:30:00Z", 2).toISOString(),
    "2026-11-02T04:30:00.000Z",
  );
  assert.equal(
    addProjectHours("2026-10-31T07:00:00Z", 1.5).toISOString(),
    "2026-11-02T05:00:00.000Z",
  );
  assert.throws(() => addProjectHours("bad", 2), /Invalid/);
});

test("stars use accepted submission time with inclusive deadlines and a one-star passing floor", () => {
  const due = "2026-10-26T10:00:00Z",
    late = "2026-10-26T12:00:00Z";
  assert.equal(projectStars(due, due, late), 3);
  assert.equal(projectStars("2026-10-26T10:00:01Z", due, late), 2);
  assert.equal(projectStars(late, due, late), 2);
  assert.equal(projectStars("2026-11-26T10:00:00Z", due, late), 1);
});

test("review rubric and rewards are bounded and reflect individual contribution and team stars", () => {
  assert.equal(
    contributionScore({
      quality: 35,
      verification: 20,
      timeliness: 20,
      collaboration: 15,
    }),
    90,
  );
  assert.throws(() =>
    contributionScore({
      quality: 41,
      verification: 25,
      timeliness: 20,
      collaboration: 15,
    }),
  );
  assert.throws(() =>
    contributionScore({
      quality: 0,
      verification: 0,
      timeliness: 0,
      collaboration: 0,
    }),
  );
  assert.throws(() =>
    contributionScore({
      quality: "40",
      verification: 25,
      timeliness: 20,
      collaboration: 15,
    }),
  );
  assert.deepEqual(projectReward(projectLevels[0], 3, 90), {
    xp: 135,
    trophies: 68,
  });
  assert.deepEqual(projectReward(projectLevels[0], 1, 100), {
    xp: 100,
    trophies: 50,
  });
  assert.throws(() => projectReward(projectLevels[0], 0, 100));
});

test(
  "MongoDB: team progression, permission boundaries, evidence, reviews and exactly-once differentiated payouts",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    const databaseName = `codewild_projects_test_${Date.now()}`;
    uri.pathname = `/${databaseName}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    try {
      await models.Cohort.create({
        _id: "alpha",
        name: "Test",
        college: "Test",
        startDate: "2026-10-26",
      });
      await models.Team.create([
        { _id: "a", name: "A", code: "A" },
        { _id: "b", name: "B", code: "B" },
      ]);
      const users = teamRoles.map((r, i) => ({
        _id: `a${i}`,
        name: `A${i}`,
        email: `a${i}@example.invalid`,
        role: "GAMER",
        teamId: "a",
        teamRoleCode: r.code,
      }));
      const other = {
        _id: "b0",
        name: "Other",
        email: "b@example.invalid",
        role: "GAMER",
        teamId: "b",
        teamRoleCode: "TEAM_LEAD",
      };
      const guide = {
        _id: "guide",
        name: "Guide",
        email: "guide@example.invalid",
        role: "MISSION_COMMANDER",
      };
      await models.User.create([...users, other, guide]);
      const lead = users[0];
      await assert.rejects(
        projectAction(lead, "start", { levelId: "project_2" }),
        /previous/,
      );
      await assert.rejects(
        projectAction(other, "start", { levelId: "project_1" }),
        /exactly one/,
      );
      assert.equal(await models.ProjectAttempt.countDocuments(), 0);
      await Promise.all(
        Array.from({ length: 3 }, () =>
          projectAction(lead, "start", { levelId: "project_1", teamId: "b" }),
        ),
      );
      const attemptId = "a:project_1";
      assert.equal(await models.ProjectAttempt.countDocuments(), 1);
      assert.equal(
        await models.Task.countDocuments({ projectAttemptId: attemptId }),
        5,
      );
      const task = await models.Task.findOne({
        projectAttemptId: attemptId,
        assigneeId: "a1",
      });
      await assert.rejects(
        projectAction(other, "task", {
          taskId: task._id,
          status: "In Progress",
        }),
        /another team/,
      );
      await assert.rejects(
        projectAction(lead, "task", {
          taskId: task._id,
          status: "In Progress",
        }),
        /assigned player/,
      );
      await assert.rejects(
        projectAction(lead, "submit", {
          attemptId,
          submissionSummary: "Complete project",
          evidenceReferences: ["repo"],
        }),
        /Every role/,
      );
      await assert.rejects(
        projectAction(users[1], "task", {
          taskId: task._id,
          status: "Review",
          submissionSummary: "Finished frontend",
          evidenceReferences: [],
        }),
        /evidence/,
      );
      const allTasks = await models.Task.find({ projectAttemptId: attemptId });
      const fullScores = {
        quality: 40,
        verification: 25,
        timeliness: 20,
        collaboration: 15,
      };
      for (const t of allTasks) {
        const owner = users.find((p) => p._id === t.assigneeId);
        await projectAction(owner, "task", {
          taskId: t._id,
          status: "Review",
          submissionSummary: "Implemented and verified my contribution",
          evidenceReferences: ["repository/test-results"],
        });
        await assert.rejects(
          projectAction(owner, "task", {
            taskId: t._id,
            status: "In Progress",
          }),
          /sealed or awaiting/,
        );
        if (t.assigneeId === "a1") {
          await projectAction(guide, "task", {
            taskId: t._id,
            action: "return",
            feedback: "Please demonstrate the invalid input case.",
          });
          await projectAction(owner, "task", {
            taskId: t._id,
            status: "Review",
            submissionSummary: "Added and verified the missing validation",
            evidenceReferences: ["repository/revision-2"],
          });
        }
        await assert.rejects(
          projectAction(guide, "task", {
            taskId: t._id,
            action: "approve",
            scores: { ...fullScores, quality: 99 },
            feedback: "Verified all contribution requirements.",
          }),
          /quality/,
        );
        await projectAction(guide, "task", {
          taskId: t._id,
          action: "approve",
          scores: { ...fullScores, quality: t.assigneeId === "a1" ? 20 : 40 },
          feedback: "Verified contribution with supplied evidence.",
        });
      }
      assert.equal(
        await models.Experience.countDocuments(),
        0,
        "task approval must not award completion rewards",
      );
      await projectAction(lead, "submit", {
        attemptId,
        submissionSummary: "Integrated save and refresh flow works",
        evidenceReferences: ["repository/demo"],
      });
      await assert.rejects(
        projectAction(lead, "review", {
          attemptId,
          action: "approve",
          feedback: "I approve my own work.",
          checks: [true, true, true],
        }),
        /Only a Guide/,
      );
      await assert.rejects(
        projectAction(guide, "review", {
          attemptId,
          action: "approve",
          feedback: "Verified integrated demo.",
          checks: [true, false, true],
        }),
        /every integrated/,
      );
      await projectAction(guide, "review", {
        attemptId,
        action: "return",
        feedback: "The integrated error state still needs a fix.",
      });
      await assert.rejects(
        projectAction(lead, "start", { levelId: "project_2" }),
        /previous/,
      );
      await projectAction(lead, "submit", {
        attemptId,
        submissionSummary: "Fixed integrated error state and verified",
        evidenceReferences: ["repository/demo-v2"],
      });
      // Review after the deadline must still grant three stars to an on-time submission.
      await models.ProjectAttempt.updateOne(
        { _id: attemptId },
        {
          $set: {
            submittedAt: new Date("2026-01-01T00:00:00Z"),
            dueAt: new Date("2026-01-01T01:00:00Z"),
            lateUntil: new Date("2026-01-01T03:00:00Z"),
          },
        },
      );
      const review = {
        attemptId,
        action: "approve",
        feedback: "All integrated criteria verified in the demo.",
        checks: [true, true, true],
      };
      await Promise.all(
        Array.from({ length: 3 }, () => projectAction(guide, "review", review)),
      );
      const cleared = await models.ProjectAttempt.findById(attemptId);
      assert.equal(cleared.status, "CLEARED");
      assert.equal(cleared.stars, 3);
      assert.equal(cleared.rewards.length, 5);
      assert.equal(await models.Experience.countDocuments(), 5);
      assert.equal(await models.Trophy.countDocuments(), 5);
      assert.equal((await models.User.findById("a0")).xp, 150);
      assert.equal((await models.User.findById("a1")).xp, 120);
      assert.equal(
        (await models.User.findById("a0")).trophies,
        75,
        "project rewards bypass the daily activity cap",
      );
      assert.equal((await models.User.findById("a0")).dailyTrophies, 0);
      assert.equal(
        await models.ProjectEvent.countDocuments({
          attemptId,
          kind: "CLEARED",
        }),
        1,
      );
      await projectAction(lead, "start", { levelId: "project_2" });
      assert.equal(
        await models.Task.countDocuments({ projectAttemptId: "a:project_2" }),
        5,
      );
      assert.equal(
        await models.ProjectAttempt.countDocuments({ teamId: "b" }),
        0,
      );
      // Exercise both late star outcomes through real approval/payout transactions.
      for (const [levelId, expectedStars, submittedAt] of [
        ["project_2", 2, "2026-01-01T02:00:00Z"],
        ["project_3", 1, "2026-01-01T04:00:00Z"],
      ]) {
        if (levelId === "project_3")
          await projectAction(lead, "start", { levelId });
        const id = `a:${levelId}`;
        const levelTasks = await models.Task.find({ projectAttemptId: id });
        for (const task of levelTasks)
          await projectAction(
            users.find((p) => p._id === task.assigneeId),
            "task",
            {
              taskId: task._id,
              status: "Review",
              submissionSummary:
                "Implemented and verified the role deliverable",
              evidenceReferences: ["repository/evidence"],
            },
          );
        await projectAction(lead, "submit", {
          attemptId: id,
          submissionSummary: "Verified all five roles and integrated project",
          evidenceReferences: ["repository/demo"],
        });
        await assert.rejects(
          projectAction(guide, "review", { ...review, attemptId: id }),
          /All five/,
        );
        for (const task of levelTasks)
          await projectAction(guide, "task", {
            taskId: task._id,
            action: "approve",
            scores: fullScores,
            feedback: "Verified all role requirements and evidence.",
          });
        await models.ProjectAttempt.updateOne(
          { _id: id },
          {
            $set: {
              submittedAt: new Date(submittedAt),
              dueAt: new Date("2026-01-01T01:00:00Z"),
              lateUntil: new Date("2026-01-01T03:00:00Z"),
            },
          },
        );
        await projectAction(guide, "review", { ...review, attemptId: id });
        assert.equal(
          (await models.ProjectAttempt.findById(id)).stars,
          expectedStars,
        );
      }
    } finally {
      assert.equal(mongoose.connection.name, databaseName);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
