import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { characters } from "../lib/characters.js";
import { models } from "../lib/db.js";

export async function teamManagementAcceptance(request) {
  const council = "usr_cc01",
    guide = "usr_mc01",
    existing = "usr_g01";
  const password = randomBytes(24).toString("hex");
  const members = characters.map((character, i) => ({
    name: `Trail explorer ${i + 1}`,
    username: `trail_explorer_${i + 1}`,
    password,
    characterKey: character.key,
    variant: i % 2 ? "male" : "female",
  }));
  const definition = { name: "Acceptance new party", members: [members[0]] };
  await request(guide, "centre-command/teams/create", definition, 403);
  await request(existing, "centre-command/teams/create", definition, 403);
  const created = await request(
    council,
    "centre-command/teams/create",
    definition,
  );
  assert.equal(created.memberCount, 1);
  assert.ok(!JSON.stringify(created).includes(password));
  assert.ok(!JSON.stringify(created).includes("passwordHash"));
  const player = created.members[0]._id;
  await request(
    player,
    "auth/login",
    { username: members[0].username, password: "wrong-password" },
    401,
  );
  const login = await request(player, "auth/login", {
    username: members[0].username.toUpperCase(),
    password,
  });
  assert.equal(login.user.role, "GAMER");
  assert.equal(login.user.characterVariant, "female");
  assert.equal(login.user.username, members[0].username);
  await request(
    player,
    "auth/login",
    { email: login.user.email, accessCode: process.env.DEMO_ACCESS_CODE },
    403,
  );
  const state = await request(player, "state");
  assert.equal(state.user.teamId, created.teamId);
  assert.equal(state.roster.length, 1);
  assert.ok(!JSON.stringify(state).includes(password));
  assert.ok(!JSON.stringify(state).includes("passwordHash"));
  await request(player, "projects/start", { levelId: "project_1" }, 400);
  await request(council, "centre-command/teams/add-members", {
    teamId: created.teamId,
    members: members.slice(1),
  });
  const ready = await request(player, "state");
  assert.equal(ready.roster.length, 5);
  await request(
    council,
    "centre-command/teams/add-members",
    {
      teamId: created.teamId,
      members: [{ ...members[0], username: "sixth_candidate" }],
    },
    409,
  );
  await request(
    council,
    "centre-command/roster",
    { userId: existing, teamId: created.teamId },
    409,
  );
  const rows = await models.User.find({ teamId: created.teamId }).lean();
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map((p) => p.username)).size, 5);
  await request(player, "projects/start", { levelId: "project_1" });
  const attemptId = `${created.teamId}:project_1`;
  assert.equal(
    await models.Task.countDocuments({ projectAttemptId: attemptId }),
    25,
  );
  console.log(
    "PASS Centre Command teams: username/password login, demo bypass rejection, private credentials, forming teams, five-member capacity and full-stack assignments",
  );
}
