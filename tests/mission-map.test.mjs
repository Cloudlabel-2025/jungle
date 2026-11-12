import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  defaultMapPoint,
  missionMapPoint,
  missionMapWidth,
  validateMapPositions,
  MAP_SPACING,
} from "../lib/mission-map.js";
import { previousLevel, validateLevel } from "../lib/level-definitions.js";
import { projectLevels } from "../lib/project-catalog.js";
import { fullStackLevel } from "../lib/full-stack-levels.js";
import { characters } from "../lib/characters.js";
import { teamRoles } from "../lib/team-roles.js";
import { models } from "../lib/db.js";
import { mapLayoutSnapshot, saveMapLayout } from "../lib/mission-map-store.js";
import { levelAction } from "../lib/level-authoring.js";
import { projectAction } from "../lib/projects.js";
import { publishedLevels } from "../lib/published-levels.js";
import { pilotFixture } from "./pilot-fixture.mjs";

test("map geometry spaces labels, expands for authored placements and preserves saved positions", () => {
  const levels = Array.from({ length: 105 }, (_, i) => ({ _id: `level-${i}` }));
  assert.equal(MAP_SPACING, 440);
  assert.equal(defaultMapPoint(1).x - defaultMapPoint(0).x, 440);
  const defaults = Object.fromEntries(
    levels.map((l, i) => [l._id, defaultMapPoint(i)]),
  );
  assert.equal(
    Object.keys(
      validateMapPositions(
        defaults,
        levels.map((l) => l._id),
      ),
    ).length,
    105,
  );
  const positions = { "level-0": { x: 2600, y: 40 } };
  const point = missionMapPoint(levels[0], positions, 0, 720);
  assert.equal(point.x, 2600);
  assert.equal(point.y, 364);
  assert.equal(missionMapWidth([levels[0]], positions), 2780);
});
test("map rejects foreign IDs, nonfinite values and coordinates outside the playable area", () => {
  for (const input of [
    [],
    { foreign: { x: 200, y: 30 } },
    { a: { x: Infinity, y: 30 } },
    { a: { x: 200, y: 101 } },
    { a: { x: -1, y: 30 } },
  ])
    assert.throws(
      () => validateMapPositions(input, ["a"]),
      (error) => error.status === 400,
    );
});
test("map missions have their own task progression without legacy mini-project prerequisites", () => {
  const a = { _id: "mission-a", number: 6, mapMission: true };
  const b = { _id: "mission-b", number: 7, mapMission: true };
  const levels = [...projectLevels, a, b].sort((a, b) => a.number - b.number);
  assert.equal(previousLevel(levels, a._id), null);
  assert.equal(previousLevel(levels, b._id)._id, a._id);
  assert.equal(previousLevel(levels, "project_07"), null); // Unknown IDs never infer a dependency.
  assert.equal(
    previousLevel(levels, projectLevels[6]._id)._id,
    projectLevels[5]._id,
  );
  const def = {
    ...fullStackLevel(projectLevels[0]),
    hazardKey: "vines",
    mapMission: true,
    teamIds: ["team"],
  };
  assert.equal(validateLevel(def).mapMission, true);
  assert.throws(() => validateLevel({ ...def, mapMission: "yes" }));
});
test(
  "CC map authoring persists safely and a full map mission assigns, reviews and unlocks actual work",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async (t) => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/mission_map_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    t.after(() => mongoose.disconnect());
    const { cc, cc2, mc, gamers, teams } = await pilotFixture(2);
    for (let i = 0; i < gamers.length; i++)
      await models.User.updateOne(
        { _id: gamers[i]._id },
        {
          $set: {
            teamRoleCode: teamRoles[i % 5].code,
            characterKey: characters[i % 5].key,
          },
        },
      );
    const g = gamers[0];
    assert.deepEqual(await mapLayoutSnapshot(g), {
      revision: 0,
      positions: {},
    });
    const placement = {
      revision: 0,
      positions: { "alumni-sprint-1": { x: 310, y: 60 } },
    };
    for (const actor of [g, mc])
      await assert.rejects(
        saveMapLayout(actor, placement),
        (error) => error.status === 403,
      );
    await models.User.updateOne(
      { _id: cc2._id },
      { $set: { permissions: ["reports:read"] } },
    );
    await assert.rejects(
      saveMapLayout(cc2, placement),
      (error) => error.status === 403,
    );
    await saveMapLayout(cc, placement);
    await assert.rejects(
      saveMapLayout(cc, placement),
      (error) => error.status === 409,
    );
    assert.equal(
      (await mapLayoutSnapshot(g)).positions["alumni-sprint-1"].x,
      310,
    );
    assert.deepEqual(await mapLayoutSnapshot({ cohortId: "other" }), {
      revision: 0,
      positions: {},
    });
    const definition = {
      ...fullStackLevel(projectLevels[0]),
      hazardKey: "vines",
      name: "Alumni mentoring mission",
      mapMission: true,
      teamIds: [teams[0].id],
    };
    let draft = await levelAction(cc, "save", { definition });
    assert.equal(
      (await publishedLevels(null, teams[0].id)).filter((l) => l.mapMission)
        .length,
      0,
    );
    await saveMapLayout(cc, {
      revision: 1,
      positions: {
        ...placement.positions,
        [draft.levelId]: { x: 2600, y: 45 },
      },
    });
    let preview = await levelAction(cc, "preview", draft);
    assert.equal(preview.level.number, 6);
    assert.equal(preview.rows[0].state, "STARTS_ON_PUBLISH");
    await levelAction(cc, "publish", { ...draft, previewToken: preview.token });
    const firstId = draft.levelId;
    const attempt = await models.ProjectAttempt.findOne({
      levelId: firstId,
    }).lean();
    assert.equal(attempt.status, "ACTIVE");
    const tasks = await models.Task.find({
      projectAttemptId: attempt._id,
    }).lean();
    assert.equal(tasks.length, 25);
    assert.equal(new Set(tasks.map((task) => task.assigneeId)).size, 5);
    assert.equal(
      (await publishedLevels(null, teams[1].id)).some((l) => l._id === firstId),
      false,
    );
    await assert.rejects(
      projectAction(gamers[5], "start", { levelId: firstId }),
      (error) => error.status === 404,
    );
    draft = await levelAction(cc, "save", {
      definition: { ...definition, name: "Alumni events mission" },
    });
    preview = await levelAction(cc, "preview", draft);
    assert.equal(preview.level.number, 7);
    assert.equal(preview.rows[0].state, "QUEUED");
    await levelAction(cc, "publish", { ...draft, previewToken: preview.token });
    const secondId = draft.levelId;
    await assert.rejects(
      projectAction(g, "start", { levelId: secondId }),
      /previous team project/,
    );
    const evidenceReferences = [
      "https://example.invalid/synthetic-map-evidence",
    ];
    for (const task of tasks) {
      const actor = gamers.find((p) => p._id === task.assigneeId);
      await projectAction(actor, "task", {
        taskId: task._id,
        status: "Review",
        submissionSummary:
          "Synthetic complete feature with verifiable evidence.",
        evidenceReferences,
      });
      await projectAction(mc, "task", {
        taskId: task._id,
        action: "approve",
        feedback:
          "Synthetic contribution reviewed against all acceptance criteria.",
        scores: {
          quality: 40,
          verification: 25,
          timeliness: 20,
          collaboration: 15,
        },
      });
    }
    await projectAction(g, "submit", {
      attemptId: attempt._id,
      submissionSummary:
        "Synthetic integrated Alumni mentoring portal mission.",
      evidenceReferences,
    });
    await assert.rejects(
      projectAction(g, "review", { attemptId: attempt._id, action: "approve" }),
      (error) => error.status === 403,
    );
    await projectAction(mc, "review", {
      attemptId: attempt._id,
      action: "approve",
      feedback: "Synthetic integrated review verified every requirement.",
      checks: definition.criteria.map(() => true),
    });
    assert.equal(
      (await models.ProjectAttempt.findById(attempt._id)).status,
      "CLEARED",
    );
    assert.equal(
      (await models.ProjectAttempt.findOne({ levelId: secondId })).status,
      "ACTIVE",
    );
    assert.equal((await mapLayoutSnapshot(g)).positions[firstId].x, 2600);
  },
);
