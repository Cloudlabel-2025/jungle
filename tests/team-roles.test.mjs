import test from "node:test";
import assert from "node:assert/strict";
import { teamRoles, planRecipients, playerRole } from "../lib/team-roles.js";
import { teams, personas } from "../lib/catalog.js";
const gamers = personas.filter((p) => p.role === "GAMER");
test("each target role resolves exactly one matching player in every team", () => {
  for (const role of teamRoles) {
    const plan = planRecipients(
      [{ _id: role.code, title: "Role-specific work", targetRole: role.code }],
      teams,
      gamers,
    );
    assert.equal(plan.canPublish, true);
    assert.equal(plan.recipients.length, 5);
    assert.equal(new Set(plan.recipients.map((r) => r.teamId)).size, 5);
    assert.ok(
      plan.recipients.every(
        (r) => playerRole(gamers.find((p) => p._id === r.userId)) === role.code,
      ),
    );
  }
});
test("multiple definitions produce independent per-team assignments", () => {
  const plan = planRecipients(
    [
      { _id: "api", title: "API task", targetRole: "BACKEND" },
      { _id: "ui", title: "UI task", targetRole: "FRONTEND" },
    ],
    teams,
    gamers,
  );
  assert.equal(plan.recipients.length, 10);
  assert.equal(
    new Set(plan.recipients.map((r) => `${r.definitionId}:${r.teamId}`)).size,
    10,
  );
});
test("missing, inactive and duplicate role holders block all-team publication", () => {
  const definition = [{ _id: "api", title: "API task", targetRole: "BACKEND" }];
  assert.equal(planRecipients(definition, [], gamers).canPublish, false);
  const inactive = gamers.map((p) =>
    p._id === "usr_g03" ? { ...p, active: false } : p,
  );
  const missing = planRecipients(definition, teams, inactive);
  assert.equal(missing.canPublish, false);
  assert.match(missing.errors.join(" "), /Viper Syndicate.*found 0/);
  const duplicate = gamers.map((p) =>
    p._id === "usr_g01" ? { ...p, teamRoleCode: "BACKEND" } : p,
  );
  assert.match(
    planRecipients(definition, teams, duplicate).errors.join(" "),
    /Viper Syndicate.*found 2/,
  );
});
test("legacy role labels resolve without confusing application permission roles", () => {
  assert.equal(
    playerRole({ role: "GAMER", assignment: "Backend Architect" }),
    "BACKEND",
  );
  assert.equal(
    playerRole({ role: "MISSION_COMMANDER", assignment: "Mission Commander" }),
    null,
  );
  assert.equal(playerRole({ role: "GAMER", assignment: "Unknown" }), null);
});
