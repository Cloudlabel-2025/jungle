import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  validateLevel,
  levelsForTeam,
  previousLevel,
} from "../lib/level-definitions.js";
import { projectLevels } from "../lib/project-catalog.js";
import { teamRoles } from "../lib/team-roles.js";
import { terrainPosition } from "../lib/map-terrain.js";
import { models, connect } from "../lib/db.js";
import { levelAction } from "../lib/level-authoring.js";
import { projectAction } from "../lib/projects.js";
import { publishedLevels } from "../lib/published-levels.js";

const definition = () => ({
  ...structuredClone(projectLevels[0]),
  name: "Forest team directory",
  hazardKey: "animal",
  imageKey: "mud",
  teamIds: ["a", "b"],
});
test("level definitions require five distinct role tasks, a real emblem, time budget and team audience", () => {
  assert.equal(validateLevel(definition()).tasks.length, 5);
  for (const mutate of [
    (d) => d.tasks.pop(),
    (d) => (d.tasks[1].targetRole = d.tasks[0].targetRole),
    (d) => (d.hazardKey = "crocodile"),
    (d) => (d.hours = 0),
    (d) => (d.hours = Infinity),
    (d) => (d.criteria = []),
    (d) => (d.teamIds = []),
    (d) => (d.tasks[0].instructions = "short"),
  ]) {
    const draft = definition();
    mutate(draft);
    assert.throws(() => validateLevel(draft));
  }
});
test("team-specific sequences skip untargeted levels, while extended map chapters stay ordered", () => {
  const levels = [
    ...projectLevels,
    { _id: "eleven", number: 11, teamIds: ["a"] },
    { _id: "twelve", number: 12, teamIds: ["b"] },
  ];
  const b = levelsForTeam(levels, "b");
  assert.equal(previousLevel(b, "twelve")._id, "project_10");
  const points = Array.from({ length: 30 }, (_, i) =>
    terrainPosition(
      { number: i + 1 },
      { width: 18000, height: 600, chapters: 3 },
    ),
  );
  assert.ok(
    points.every(
      (p, i) => p.x > 0 && p.x < 18000 && (!i || p.x > points[i - 1].x),
    ),
  );
});
test(
  "MongoDB: Council drafts, permissions, previews, publishing, role assignments and pinned live versions",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/level_authoring_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const model of Object.values(models)) await model.init();
    try {
      await models.Cohort.create({
        _id: "alpha",
        name: "Test",
        college: "Test",
        startDate: "2026-10-01",
      });
      for (const id of ["a", "b", "outside"])
        await models.Team.create({ _id: id, name: id, code: id });
      const cc = await models.User.create({
        _id: "cc",
        name: "Council",
        email: "cc@example.invalid",
        role: "CENTRE_COMMAND",
      });
      const mc = await models.User.create({
        _id: "mc",
        name: "Guide",
        email: "mc@example.invalid",
        role: "MISSION_COMMANDER",
      });
      for (const teamId of ["a", "b", "outside"])
        for (const role of teamRoles)
          await models.User.create({
            _id: `${teamId}_${role.code}`,
            name: role.label,
            email: `${teamId}_${role.code}@example.invalid`,
            role: "GAMER",
            teamId,
            teamRoleCode: role.code,
          });
      const player = await models.User.findById("a_TEAM_LEAD");
      await assert.rejects(
        levelAction(mc, "save", { definition: definition() }),
        /Only Centre Command/,
      );
      await assert.rejects(
        levelAction(player, "save", { definition: definition() }),
        /Only Centre Command/,
      );
      let draft = await levelAction(cc, "save", { definition: definition() });
      assert.equal(
        (await publishedLevels(null, "a")).length,
        10,
        "Drafts stay private",
      );
      let preview = await levelAction(cc, "preview", {
        ...draft,
        version: draft.version,
      });
      assert.ok(preview.canPublish);
      assert.equal(preview.rows[0].state, "QUEUED");
      await assert.rejects(
        projectAction(player, "start", { levelId: draft.levelId }),
        /not found/,
      );
      await models.ProjectAttempt.create({
        _id: "a:project_10",
        teamId: "a",
        levelId: "project_10",
        number: 10,
        status: "CLEARED",
        stars: 3,
      });
      await assert.rejects(
        levelAction(cc, "publish", { ...draft, previewToken: preview.token }),
        /Preview this level again/i,
      );
      preview = await levelAction(cc, "preview", draft);
      const publications = await Promise.allSettled(
        Array.from({ length: 2 }, () =>
          levelAction(cc, "publish", { ...draft, previewToken: preview.token }),
        ),
      );
      assert.equal(
        publications.filter((p) => p.status === "fulfilled").length,
        1,
      );
      const published = publications.find(
        (p) => p.status === "fulfilled",
      ).value;
      const first = await models.ProjectAttempt.findOne({
        teamId: "a",
        levelId: draft.levelId,
      }).lean();
      assert.equal(first.definitionSnapshot.hazardKey, "animal");
      assert.equal(first.definitionSnapshot.imageKey, "mud");
      assert.equal(
        await models.Task.countDocuments({ projectAttemptId: first._id }),
        5,
      );
      assert.equal(
        await models.ProjectAttempt.countDocuments({
          teamId: "b",
          levelId: draft.levelId,
        }),
        0,
      );
      assert.equal((await publishedLevels(null, "outside")).length, 10);
      const outside = await models.User.findById("outside_TEAM_LEAD");
      await assert.rejects(
        projectAction(outside, "start", { levelId: draft.levelId }),
        /not found/,
      );
      await assert.rejects(
        levelAction(cc, "publish", { ...draft, previewToken: preview.token }),
        /changed/,
      );
      const edited = {
        ...definition(),
        name: "Updated forest directory",
        hazardKey: "viper",
        imageKey: "bridge",
      };
      edited.tasks[0].instructions =
        "New instructions apply only to future attempts.";
      draft = await levelAction(cc, "save", {
        levelId: draft.levelId,
        version: published.version,
        definition: edited,
      });
      preview = await levelAction(cc, "preview", draft);
      assert.equal(preview.rows[0].state, "PRESERVED");
      await levelAction(cc, "publish", {
        ...draft,
        previewToken: preview.token,
      });
      assert.equal(
        (await models.ProjectAttempt.findById(first._id)).definitionSnapshot
          .name,
        "Forest team directory",
      );
      // Clear B's preceding project through the real review path, causing automatic assignment.
      const last = projectLevels.at(-1),
        now = new Date();
      await models.ProjectAttempt.create({
        _id: "b:project_10",
        teamId: "b",
        levelId: last._id,
        number: 10,
        definitionSnapshot: last,
        status: "REVIEW",
        submittedAt: now,
        dueAt: new Date(+now + 3600000),
        lateUntil: new Date(+now + 7200000),
      });
      for (const task of last.tasks)
        await models.Task.create({
          _id: `b10_${task.targetRole}`,
          teamId: "b",
          assigneeId: `b_${task.targetRole}`,
          title: task.title,
          targetRole: task.targetRole,
          projectAttemptId: "b:project_10",
          projectLevelId: last._id,
          status: "Done",
          performanceScore: 100,
          dueAt: now,
        });
      await projectAction(mc, "review", {
        attemptId: "b:project_10",
        action: "approve",
        feedback: "All integration checks were verified successfully.",
        checks: last.criteria.map(() => true),
      });
      const second = await models.ProjectAttempt.findOne({
        teamId: "b",
        levelId: draft.levelId,
      });
      assert.equal(second.definitionSnapshot.name, "Updated forest directory");
      assert.equal(second.definitionSnapshot.hazardKey, "viper");
      assert.equal(second.definitionSnapshot.imageKey, "bridge");
      assert.equal(
        (await models.ProjectAttempt.findById(first._id)).definitionSnapshot
          .imageKey,
        "mud",
      );
      assert.equal(
        await models.Task.countDocuments({ projectAttemptId: second._id }),
        5,
      );
      assert.ok(second.dueAt > now);
      await projectAction(mc, "review", {
        attemptId: "b:project_10",
        action: "approve",
      });
      assert.equal(
        await models.Task.countDocuments({ projectAttemptId: second._id }),
        5,
        "Repeated clearance must not duplicate assignments",
      );
      // Missing role blocks the entire publication, including other healthy teams.
      await models.User.updateOne(
        { _id: "b_DEVOPS" },
        { $set: { active: false } },
      );
      const blocked = await levelAction(cc, "save", {
        definition: definition(),
      });
      const invalid = await levelAction(cc, "preview", blocked);
      assert.equal(invalid.canPublish, false);
      await assert.rejects(
        levelAction(cc, "publish", { ...blocked, previewToken: invalid.token }),
        /missing or duplicate/,
      );
      assert.equal(
        await models.ProjectAttempt.countDocuments({
          levelId: blocked.levelId,
        }),
        0,
      );
      assert.ok(
        (await models.ProjectLevelEvent.countDocuments({
          kind: "PUBLISHED",
        })) === 2,
      );
    } finally {
      assert.match(mongoose.connection.name, /^level_authoring_\d+$/);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      globalThis.__codewildMongo = null;
    }
  },
);
