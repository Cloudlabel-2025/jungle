// Only use with the disposable scripts/preview-week-one.mjs fixture.
import assert from "node:assert/strict";
import { personas, prefix, navigation, modules } from "../lib/catalog.js";
import { programmePath } from "../lib/workspace-navigation.js";
import { weekOneNavigation } from "../lib/week-one-catalog.js";
const base = "http://127.0.0.1:3103";
const recovery = process.argv.includes("--recovery");
for (const [role, views] of Object.entries(weekOneNavigation)) {
  const persona = personas.find((p) => p.role === role);
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: persona.email }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  for (const [, screen] of views) {
    const response = await fetch(`${base}${programmePath(role, screen)}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 200, `${role}/${screen}`);
  }
  for (const [, screen] of navigation[role]) {
    const response = await fetch(`${base}/${prefix(role)}/${screen}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(
      response.status,
      200,
      `Original page ${role}/${screen} remains available`,
    );
  }
  const response = await fetch(`${base}/api/state`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.weekOneProgram);
  assert.equal(data.user.weekOneEnergy, 5);
  assert.equal(data.weekOne.days[0].state, "CLOSED");
  assert.equal(data.weekOne.days[1].state, recovery ? "CLOSED" : "OPEN");
  if (role === "GAMER") {
    assert.equal(data.weekOneProgram.results.length, recovery ? 1 : 0);
    assert.equal(data.weekOneProgram.learners.length, 1);
    assert.equal(data.user.characterKey, "blaze");
    assert.ok(data.user.teamRoleCode, "Existing team role is preserved");
    assert.ok(
      data.weekOneProgram.attempts.every((a) => a.userId === undefined),
    );
    assert.ok(!JSON.stringify(data.weekOneProgram).includes('"reference":'));
    assert.ok(!JSON.stringify(data.weekOneProgram).includes('"correct":'));
    assert.ok(
      data.weekOneProgram.days.every((d) => d.day <= (recovery ? 5 : 2)),
    );
    if (recovery) {
      assert.equal(data.weekOneProgram.recovery.participants.length, 1);
      assert.equal(data.weekOneProgram.recovery.config.exams.length, 2);
      assert.deepEqual(data.weekOneProgram.publication.teams, []);
      assert.equal(data.weekOneProgram.settings.clearance, 60);
      assert.ok(
        !data.weekOneProgram.recovery.config.exams.some((e) =>
          e.variants.some((v) => v.question || v.reference),
        ),
      );
    } else
      assert.ok(
        data.weekOneProgram.notifications.some((n) => n.id === "recap:2:2"),
      );
    for (const [action, body] of [
      ["publish-rules", { text: "Unauthorised change" }],
      ["publish-results", {}],
      ["import-assessment", {}],
    ]) {
      const denied = await fetch(`${base}/api/week1/program/${action}`, {
        method: "POST",
        headers: { cookie, Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(denied.status, 403);
    }
    const bypass = await fetch(`${base}/api/gamer/modules`, {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId: modules[0]._id,
        answer: modules[0].answer,
      }),
    });
    assert.equal(
      bypass.status,
      200,
      "Existing Field Guide action remains usable during Week 1",
    );
  }
  console.log(
    `${role}: ${views.length} Week 1 views and authorised data projections verified`,
  );
}
