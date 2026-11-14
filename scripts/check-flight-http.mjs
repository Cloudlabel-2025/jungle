// Run only with the disposable scripts/preview-day-one.mjs --research fixture.
import assert from "node:assert/strict";
import { personas } from "../lib/catalog.js";
const base = "http://127.0.0.1:3101";
async function login(person) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: person.email }),
  });
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    user: (await r.json()).user,
  };
}
async function post(cookie, path, body = {}) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
const players = personas.filter((p) => p.role === "GAMER");
const accounts = [];
for (const p of players) {
  const account = await login(p);
  assert.equal(account.user.characterHidden, true);
  assert.equal(account.user.characterKey, null);
  accounts.push(account);
}
const cookie = accounts[0].cookie;
const stateResponse = await fetch(`${base}/api/state`, { headers: { cookie } });
assert.equal(stateResponse.status, 200);
const state = await stateResponse.json();
assert.equal(state.story.flight, true);
assert.equal(state.user.characterKey, null);
assert.equal(state.user.teamRoleCode, null);
for (const key of [
  "modules",
  "projectLevels",
  "projectAttempts",
  "tasks",
  "teams",
  "roster",
  "perks",
])
  assert.deepEqual(state[key], [], key);
assert.equal(state.alumniMap, null);
if (!state.story.introComplete) {
  assert.equal((await post(cookie, "/api/day1/genre-offer")).status, 403);
  const page = await fetch(`${base}/gamer/week-one-games`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(page.status, 307);
  assert.equal(page.headers.get("location"), "/gamer/dashboard");
}
for (const page of [
  "sprint-board?board=programme",
  "ide",
  "before-you-board",
  "team-room",
  "rewards",
  "daily-journal",
]) {
  const r = await fetch(`${base}/gamer/${page}`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(r.status, 307, page);
  assert.equal(r.headers.get("location"), "/gamer/dashboard");
}
for (const [path, body] of [
  ["/api/gamer/character", { characterKey: "blaze", variant: "male" }],
  ["/api/projects/start", { levelId: "project_1" }],
  ["/api/gamer/modules", { moduleId: "module_1" }],
  ["/api/gamer/lab", { files: [] }],
  ["/api/pilot", { action: "kickoff", requestId: "forged-flight-kickoff" }],
  ["/api/pilot/storage", { action: "intent" }],
])
  assert.equal((await post(cookie, path, body)).status, 403, path);
for (const path of ["/api/pilot", "/api/pilot/files/nonexistent"]) {
  const r = await fetch(base + path, { headers: { cookie } });
  assert.equal(r.status, 403, path);
}
assert.equal(
  (await post(cookie, "/api/story/flight-intro", { stage: "EXPEDITION" }))
    .status,
  400,
);
for (let i = 0; i < 3; i++)
  assert.equal((await post(cookie, "/api/story/flight-intro")).status, 200);
assert.equal((await post(cookie, "/api/day1/clock")).status, 200);
const after = await fetch(`${base}/api/state`, { headers: { cookie } }).then(
  (r) => r.json(),
);
assert.equal(after.story.introComplete, true);
assert.equal(after.story.flight, true);
assert.equal(
  (
    await post(cookie, "/api/gamer/character", {
      characterKey: "blaze",
      variant: "male",
    })
  ).status,
  403,
);
const relogin = await login(players[0]);
assert.equal(relogin.user.story.introComplete, true);
const views = await Promise.all(
  accounts.map(async ({ cookie }) => {
    const r = await fetch(`${base}/api/state`, { headers: { cookie } });
    assert.equal(r.status, 200);
    return r.json();
  }),
);
for (let i = 0; i < views.length; i++) {
  assert.equal(views[i].user._id, players[i]._id);
  assert.equal(views[i].user.characterHidden, true);
  assert.equal(views[i].alumniMap, null);
  assert.deepEqual(views[i].tasks, []);
}
for (const role of ["MISSION_COMMANDER", "CENTRE_COMMAND"]) {
  const { cookie, user } = await login(personas.find((p) => p.role === role));
  assert.equal(user.story.flight, false);
  const prefix = role === "CENTRE_COMMAND" ? "centre-command" : "commander";
  const r = await fetch(
    `${base}/${prefix}/week-one${role === "CENTRE_COMMAND" ? "-setup" : "-assessments"}`,
    { headers: { cookie }, redirect: "manual" },
  );
  assert.equal(r.status, 200);
  const s = await fetch(`${base}/api/state`, { headers: { cookie } }).then(
    (r) => r.json(),
  );
  assert.equal(s.story.flight, false);
  assert.ok(s.modules.length > 0);
}
console.log(
  "PASS: 25 scoped flight accounts; unknown identities; persistent welcome; old URLs redirected; character/project/module/pilot/storage bypasses denied; Week 1 learning and MC/CC controls retained.",
);
