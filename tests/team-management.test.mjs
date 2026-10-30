import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { teamAction, validateMembers } from "../lib/team-management.js";
import { characters, characterFor } from "../lib/characters.js";
import { checkPassword } from "../lib/password.js";
import { projectAction } from "../lib/projects.js";
import { planRecipients } from "../lib/team-roles.js";

const member = (i) => ({
  name: `New player ${i}`,
  username: `new_player_${i}`,
  password: "QA-only-Password-42",
  characterKey: characters[i % 5].key,
  variant: i % 2 ? "female" : "male",
});
test("team member input limits, normalized unique usernames and distinct character slots are enforced", () => {
  assert.equal(
    validateMembers([{ ...member(0), username: "Player.ONE" }])[0].username,
    "player.one",
  );
  for (const rows of [
    [],
    Array.from({ length: 6 }, (_, i) => member(i)),
    [member(0), { ...member(1), username: member(0).username.toUpperCase() }],
    [member(0), { ...member(1), characterKey: "blaze" }],
    [{ ...member(0), password: "short" }],
    [{ ...member(0), username: "bad user" }],
    [{ ...member(0), variant: "unknown" }],
  ])
    assert.throws(() => validateMembers(rows));
});
test("each character has a distinct fixed support ability, identical across versions", () => {
  assert.equal(new Set(characters.map((c) => c.ability.name)).size, 5);
  for (const character of characters) {
    assert.deepEqual(
      characterFor({ characterKey: character.key, characterVariant: "male" })
        .ability,
      characterFor({ characterKey: character.key, characterVariant: "female" })
        .ability,
    );
    assert.equal(character.ability.steps.length, 4);
  }
  const teams = Array.from({ length: 7 }, (_, i) => ({
    _id: `t${i}`,
    name: `Team ${i}`,
  }));
  const players = teams.map((team) => ({
    _id: `p${team._id}`,
    role: "GAMER",
    teamId: team._id,
    teamRoleCode: "BACKEND",
  }));
  const plan = planRecipients(
    [{ _id: "task", title: "Backend task", targetRole: "BACKEND" }],
    teams,
    players,
  );
  assert.equal(plan.canPublish, true);
  assert.equal(plan.recipients.length, 7);
});
test(
  "MongoDB: Council creates credentialed teams atomically, adds up to five, rejects collisions and concurrent sixth members",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/team_management_${Date.now()}`;
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
      await models.User.create([
        {
          _id: "cc",
          name: "Council",
          email: "cc@test.invalid",
          role: "CENTRE_COMMAND",
        },
        {
          _id: "mc",
          name: "Guide",
          email: "mc@test.invalid",
          role: "MISSION_COMMANDER",
        },
      ]);
      await assert.rejects(
        teamAction({ _id: "mc" }, "create", {
          name: "No permission",
          members: [member(0)],
        }),
        /Only Centre Command/,
      );
      assert.equal(await models.Team.countDocuments(), 0);
      const result = await teamAction({ _id: "cc" }, "create", {
        name: "Fresh explorers",
        members: [member(0)],
      });
      assert.equal(result.memberCount, 1);
      assert.ok(!JSON.stringify(result).includes(member(0).password));
      assert.ok(!JSON.stringify(result).includes("passwordHash"));
      const user = await models.User.findById(result.members[0]._id).lean();
      assert.equal(user.username, "new_player_0");
      assert.equal(user.role, "GAMER");
      assert.equal(user.xp, 0);
      assert.equal(user.trophies, 0);
      const credential = await models.Credential.findById(user._id).lean();
      assert.notEqual(credential.passwordHash, member(0).password);
      assert.equal(
        await checkPassword(member(0).password, credential.passwordHash),
        true,
      );
      assert.equal(
        await checkPassword("wrong", credential.passwordHash),
        false,
      );
      await assert.rejects(
        teamAction({ _id: "cc" }, "create", {
          name: "Failed duplicate accounts",
          members: [member(0)],
        }),
        /usernames.*in use/,
      );
      assert.equal(
        await models.Team.countDocuments(),
        1,
        "failed account creation must roll back the team",
      );
      await assert.rejects(
        teamAction({ _id: "cc" }, "add-members", {
          teamId: result.teamId,
          members: [{ ...member(1), characterKey: "blaze" }],
        }),
        /already belongs/,
      );
      await teamAction({ _id: "cc" }, "add-members", {
        teamId: result.teamId,
        members: [member(1), member(2), member(3)],
      });
      const parallel = await Promise.allSettled([
        teamAction({ _id: "cc" }, "add-members", {
          teamId: result.teamId,
          members: [member(4)],
        }),
        teamAction({ _id: "cc" }, "add-members", {
          teamId: result.teamId,
          members: [{ ...member(4), username: "other_candidate" }],
        }),
      ]);
      assert.equal(parallel.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await models.User.countDocuments({ teamId: result.teamId }),
        5,
      );
      assert.equal(await models.Credential.countDocuments(), 5);
      await assert.rejects(
        teamAction({ _id: "cc" }, "add-members", {
          teamId: result.teamId,
          members: [{ ...member(0), username: "sixth_player" }],
        }),
        /at most five/,
      );
      await assert.rejects(
        teamAction({ _id: "cc" }, "create", {
          name: "fresh EXPLORERS",
          members: [{ ...member(0), username: "different_player" }],
        }),
        /name already exists/,
      );
      const ready = await models.User.findOne({
        teamId: result.teamId,
        characterKey: "blaze",
      }).lean();
      await projectAction(ready, "start", { levelId: "project_1" });
      assert.equal(
        await models.Task.countDocuments({
          projectAttemptId: `${result.teamId}:project_1`,
        }),
        25,
      );
    } finally {
      assert.match(mongoose.connection.name, /^team_management_\d+$/);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      globalThis.__codewildMongo = null;
    }
  },
);
