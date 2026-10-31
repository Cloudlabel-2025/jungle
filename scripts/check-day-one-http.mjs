// Use only with scripts/preview-day-one.mjs and its disposable database.
import assert from "node:assert/strict";
import { personas, navigation, prefix } from "../lib/catalog.js";
const base = "http://127.0.0.1:3101";
async function login(role) {
  const p = personas.find((p) => p.role === role);
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: p.email }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
for (const role of Object.keys(navigation)) {
  const cookie = await login(role);
  for (const [, screen] of navigation[role]) {
    const r = await fetch(`${base}/${prefix(role)}/${screen}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(r.status, 200, `${role}/${screen} retains its original route`);
  }
  const response = await fetch(`${base}/api/state`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(
    data.user &&
      data.teams &&
      data.projectLevels &&
      data.support &&
      data.dayOne,
    "The original state contract and the additive Day 1 data are present",
  );
  if (role !== "CENTRE_COMMAND") {
    assert.ok(!JSON.stringify(data.dayOne).includes("PRIVATE_PRIZE"));
    assert.equal(data.dayOne.champion, undefined);
    assert.ok(data.dayOne.records.every((r) => !r.assessment));
    const denied = await fetch(`${base}/api/day1/release`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ revision: 0, config: {} }),
    });
    assert.equal(denied.status, 403);
  }
  if (role === "GAMER") {
    assert.equal(data.dayOne.records.length, 1);
    assert.equal(data.user.weekOneEnergy, 5);
    assert.equal(data.user.energy, 5);
    const release = await fetch(`${base}/api/week1/state`, {
      headers: { cookie },
    });
    assert.equal(release.status, 200);
    const week = await release.json();
    assert.equal(week.days[0].state, "OPEN");
    assert.ok(week.days.slice(1).every((day) => day.state === "LOCKED"));
    assert.equal(week.events, undefined);
    assert.ok(!JSON.stringify(week).includes("PRIVATE_PRIZE"));
    const deniedRelease = await fetch(`${base}/api/week1/open`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ day: 2, revision: week.revision }),
    });
    assert.equal(deniedRelease.status, 403);
    const wrong = await fetch(`${base}/centre-command/setup`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(wrong.status, 307);
    assert.equal(wrong.headers.get("location"), "/gamer/dashboard");
  }
  console.log(
    `${role}: original pages, original state contract and Day 1 permissions verified`,
  );
}
