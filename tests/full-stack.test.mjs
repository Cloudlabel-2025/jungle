import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  projectLevels,
  projectRecipients,
  attemptLevel,
} from "../lib/project-catalog.js";
import { fullStackLevel } from "../lib/full-stack-levels.js";
import { characters, disciplines, characterFor } from "../lib/characters.js";
import { validateLevel } from "../lib/level-definitions.js";
import { models, connect } from "../lib/db.js";
import { projectAction } from "../lib/projects.js";
import { chooseCharacter } from "../lib/character-actions.js";
import { levelAction } from "../lib/level-authoring.js";

const players = characters.map((c, i) => ({
  _id: `p${i}`,
  name: `Player ${i}`,
  email: `p${i}@test.invalid`,
  role: "GAMER",
  teamId: "a",
  characterKey: c.key,
  characterVariant: "male",
}));
test("ten full-stack projects assign five distinct end-to-end features and every layer to every player", () => {
  for (const base of projectLevels) {
    const level = fullStackLevel(base);
    const recipients = projectRecipients(level, players);
    assert.equal(recipients.length, 25);
    assert.equal(new Set(level.features.map((f) => f.key)).size, 5);
    for (const player of players) {
      const own = recipients.filter((t) => t.assigneeId === player._id);
      assert.deepEqual(
        own.map((t) => t.discipline),
        disciplines.map((d) => d.code),
      );
      assert.equal(new Set(own.map((t) => t.featureId)).size, 1);
    }
    assert.equal(
      validateLevel({ ...level, hazardKey: "vines", teamIds: ["a"] }).tasks
        .length,
      25,
    );
  }
  assert.throws(
    () => projectRecipients(fullStackLevel(projectLevels[0]), players.slice(1)),
    /five active/,
  );
  assert.throws(
    () =>
      projectRecipients(
        fullStackLevel(projectLevels[0]),
        players.map((p, i) => (i === 1 ? { ...p, characterKey: "blaze" } : p)),
      ),
    /one .* character/,
  );
  const malformed = fullStackLevel(projectLevels[0]);
  malformed.tasks[1] = malformed.tasks[0];
  assert.throws(
    () => validateLevel({ ...malformed, hazardKey: "vines", teamIds: ["a"] }),
    /Define one/,
  );
  assert.equal(
    characterFor({ ...players[0], characterVariant: "female" }).name,
    "Zara",
  );
  assert.equal(characterFor({role:"GAMER",assignment:"Frontend Specialist"}).name,"Jett");
});
test("legacy attempts resolve their original definition when the published curriculum changes", () => {
  const newer = fullStackLevel(projectLevels[0]);
  assert.equal(attemptLevel({ levelId: "project_1" }, [newer]).tasks.length, 5);
  assert.equal(
    attemptLevel({ levelId: "project_1", definitionSnapshot: newer }, [newer])
      .tasks.length,
    25,
  );
});
test(
  "MongoDB: 25 evidence-backed tasks, protected character choices, averaged exactly-once rewards and authored feature publication",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/full_stack_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    try {
      await models.Cohort.create({
        _id: "alpha",
        name: "Test",
        college: "Test",
        startDate: "2026-10-30",
      });
      await models.Team.create({ _id: "a", name: "A", code: "A" });
      await models.User.create([
        ...players,
        {
          _id: "guide",
          name: "Guide",
          email: "guide@test.invalid",
          role: "MISSION_COMMANDER",
        },
        {
          _id: "cc",
          name: "Council",
          email: "cc@test.invalid",
          role: "CENTRE_COMMAND",
        },
      ]);
      const guide = await models.User.findById("guide"),
        cc = await models.User.findById("cc");
      await assert.rejects(
        chooseCharacter(guide, { characterKey: "blaze", variant: "female" }),
        /Only an active player/,
      );
      await assert.rejects(
        chooseCharacter(players[0], { characterKey: "shade", variant: "male" }),
        /belongs to a teammate/,
      );
      await chooseCharacter(players[0], {
        characterKey: "blaze",
        variant: "female",
      });
      assert.equal(
        (await models.User.findById("p0")).characterVariant,
        "female",
      );
      await Promise.all([
        projectAction(players[0], "start", { levelId: "project_1" }),
        projectAction(players[1], "start", { levelId: "project_1" }),
      ]);
      const attempt =
        await models.ProjectAttempt.findById("a:project_1").lean();
      const tasks = await models.Task.find({ projectAttemptId: attempt._id });
      assert.equal(tasks.length, 25);
      assert.equal(attempt.definitionSnapshot.learningMode, "FULL_STACK");
      await assert.rejects(
        projectAction(players[1], "task", {
          taskId: tasks.find((t) => t.assigneeId === "p0")._id,
          status: "Review",
          submissionSummary: "Attempting someone else work",
          evidenceReferences: ["repo"],
        }),
        /assigned player/,
      );
      const submission = {
        submissionSummary:
          "Completed my feature contribution and verified behaviour.",
        evidenceReferences: ["repository/feature-test"],
      };
      for (const task of tasks)
        await projectAction(
          players.find((p) => p._id === task.assigneeId),
          "task",
          { taskId: task._id, status: "Review", ...submission },
        );
      await projectAction(players[0], "submit", {
        attemptId: attempt._id,
        ...submission,
      });
      const review = {
        attemptId: attempt._id,
        action: "approve",
        feedback:
          "Verified all five end-to-end features and their integration.",
        checks: attempt.definitionSnapshot.criteria.map(() => true),
      };
      await assert.rejects(projectAction(guide, "review", review), /All five/);
      for (const task of tasks) {
        const loss =
          disciplines.findIndex((d) => d.code === task.discipline) * 5;
        await projectAction(guide, "task", {
          taskId: task._id,
          action: "approve",
          feedback: "Verified this layer with the feature evidence.",
          scores: {
            quality: 40 - loss,
            verification: 25,
            timeliness: 20,
            collaboration: 15,
          },
        });
      }
      await Promise.all([
        projectAction(guide, "review", review),
        projectAction(guide, "review", review),
      ]);
      const cleared = await models.ProjectAttempt.findById(attempt._id).lean();
      assert.equal(cleared.stars, 3);
      assert.equal(cleared.rewards.length, 5);
      for (const reward of cleared.rewards) {
        assert.equal(reward.score, 90);
        assert.equal(reward.xp, 135);
        assert.equal(reward.trophies, 68);
      }
      assert.equal(await models.Experience.countDocuments(), 5);
      assert.equal(await models.Trophy.countDocuments(), 5);
      await projectAction(players[0], "start", { levelId: "project_2" });
      assert.equal(
        await models.Task.countDocuments({
          projectAttemptId: "a:project_2",
          assigneeId: "p0",
        }),
        5,
      );
      const definition = {
        ...fullStackLevel(projectLevels[0]),
        name: "Custom five-feature project",
        hazardKey: "mud",
        teamIds: ["a"],
      };
      const draft = await levelAction(cc, "save", { definition });
      const preview = await levelAction(cc, "preview", draft);
      assert.equal(preview.rows[0].recipients.length, 25);
      await levelAction(cc, "publish", {
        ...draft,
        previewToken: preview.token,
      });
      assert.equal(
        (await models.ProjectLevel.findById(draft.levelId)).published.tasks
          .length,
        25,
      );
    } finally {
      assert.match(mongoose.connection.name, /^full_stack_\d+$/);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      globalThis.__codewildMongo = null;
    }
  },
);
