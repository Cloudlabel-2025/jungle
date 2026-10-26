import assert from "node:assert/strict";
import { navigation, prefix, personas } from "../lib/catalog.js";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
let cookie = "";
async function req(path, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const set = response.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  return response;
}
assert.equal((await req("/api/state")).status, 401);
for (const role of Object.keys(navigation)) {
  const persona = personas.find((p) => p.role === role);
  const login = await req("/api/auth/login", {
    email: persona.email,
    accessCode: process.env.DEMO_ACCESS_CODE || "",
  });
  assert.equal(login.status, 200);
  const stateResponse = await req("/api/state");
  assert.equal(stateResponse.status, 200);
  const data = await stateResponse.json();
  assert.equal(data.roster.length, role === "GAMER" ? 5 : 25);
  assert.equal(data.teams.length, 5);
  assert.equal(data.modules.length, 10);
  assert.equal(data.perks.length, 13);
  assert.equal(data.user.role, role);
  assert.ok(data.modules.every((m) => !("answer" in m)));
  for (const [, screen] of navigation[role]) {
    const page = await req(`/${prefix(role)}/${screen}`);
    assert.equal(page.status, 200, screen);
    assert.match(await page.text(), /CODEWILD/);
    console.log(`PASS ${role} / ${screen}`);
  }
  if (role === "GAMER") {
    assert.equal((await req("/api/centre-command/setup", {})).status, 403);
    assert.equal((await req("/api/commander/rules", {})).status, 403);
    assert.equal(
      (
        await req("/api/gamer/task-status", {
          taskId: "quest_0_1",
          status: "Done",
        })
      ).status,
      403,
    );
  }
  if (role === "MISSION_COMMANDER")
    assert.equal((await req("/api/centre-command/approvals", {})).status, 403);
  console.log(`PASS ${role} data and authorization`);
}
const response = await req("/api/centre-command/reports?format=csv");
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type"), /text\/csv/);
await req("/api/auth/logout", {});
assert.equal((await req("/api/state")).status, 401);
console.log(
  "PASS CSV export and signed-session logout. All 16 screens passed.",
);
