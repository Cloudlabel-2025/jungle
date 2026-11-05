import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const base = "http://127.0.0.1:3105",
  config = JSON.parse(
    await readFile(".data/pilot-staging/accounts.json", "utf8"),
  ),
  results = [];
const request = (path, cookie, body, origin = base) =>
  fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined
        ? {}
        : { Origin: origin, "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
assert.equal((await request("/api/pilot")).status, 401);
assert.equal((await request("/api/health")).status, 200);
const cookies = new Map();
for (const a of config.accounts) {
  const r = await request("/api/auth/login", null, {
    username: a.username,
    password: a.password,
  });
  assert.equal(r.status, 200, `Login failed for ${a.id}`);
  cookies.set(a.id, r.headers.get("set-cookie").split(";")[0]);
}
for (const role of ["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"]) {
  const a = config.accounts.find((a) => a.role === role),
    cookie = cookies.get(a.id),
    r = await request("/api/pilot", cookie),
    s = await r.json();
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.equal(s.tasks.length, role === "GAMER" ? 20 : 100);
  if (role === "GAMER") {
    assert.equal(s.setup, null);
    assert.equal(s.teams.length, 1);
  }
  const legacy = await request("/api/state", cookie);
  assert.equal(legacy.status, 200);
  results.push({ role, tasks: s.tasks.length, oldState: legacy.status });
  for (const path of role === "GAMER"
    ? [
        "/gamer/dashboard",
        "/gamer/sprint-board",
        "/gamer/team-room",
        "/gamer/ide",
      ]
    : role === "MISSION_COMMANDER"
      ? ["/commander/dashboard", "/commander/sprints"]
      : ["/centre-command/dashboard", "/centre-command/setup"])
    assert.equal((await request(path, cookie)).status, 200);
}
const g = config.accounts.find((a) => a.role === "GAMER"),
  cookie = cookies.get(g.id),
  state = await (await request("/api/pilot", cookie)).json(),
  team = state.teams[0];
assert.ok(config.accounts.some((a) => a.id === team.leaderId));
results.push({ role: "TEAM_LEAD", resolvedFromLiveAssignment: true });
assert.equal(
  (
    await request(
      "/api/pilot",
      cookie,
      { action: "sync", requestId: randomUUID() },
      "https://untrusted.invalid",
    )
  ).status,
  403,
);
assert.equal(
  (
    await request("/api/pilot", cookie, {
      action: "settings",
      requestId: randomUUID(),
    })
  ).status,
  403,
);
assert.equal(
  (
    await request("/api/pilot", cookie, {
      action: "task",
      taskId: { $ne: null },
      requestId: randomUUID(),
    })
  ).status,
  400,
);
assert.equal(
  (
    await request("/api/pilot", cookie, {
      action: "daily",
      teamId: team.teamId,
      kind: "JOURNAL",
      note: "X".repeat(400001),
      requestId: randomUUID(),
    })
  ).status,
  413,
);
assert.equal(
  (
    await request("/api/pilot/storage", cookie, {
      action: "intent",
      filename: "evidence.pdf",
      taskId: state.tasks[0]._id,
      requestId: randomUUID(),
    })
  ).status,
  503,
);
assert.equal((await request("/api/pilot/cron")).status, 401);
if (config.cronSecret) {
  const response = await fetch(base + "/api/pilot/cron", {
    headers: { Authorization: `Bearer ${config.cronSecret}` },
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).every((r) => r.processed === true));
  results.push({ role: "SCHEDULER", authenticatedProcessing: "PASS" });
}
const begin = Date.now();
await Promise.all(
  config.accounts
    .filter((a) => a.role === "GAMER")
    .map(async (a) => {
      const c = cookies.get(a.id),
        s = await (await request("/api/pilot", c)).json(),
        r = await request("/api/pilot", c, {
          action: "daily",
          kind: "JOURNAL",
          teamId: s.teams[0].teamId,
          note: "Synthetic isolated HTTP concurrency evidence, not a competency result.",
          requestId: randomUUID(),
        });
      assert.equal(r.status, 200);
    }),
);
const report = {
  at: new Date().toISOString(),
  synthetic: true,
  results,
  simultaneousGamerWrites: 25,
  elapsedMs: Date.now() - begin,
  guards:
    "Unauthenticated, role, origin, injection, request size, scheduler and missing private storage checked.",
  externalBlobRoundtrip: "NOT RUN: credentials are not configured.",
};
await writeFile(
  "artifacts/pilot-http-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
if (process.argv.includes("--prepare-review")) {
  const cc = config.accounts.find((a) => a.role === "CENTRE_COMMAND"),
    state = await (await request("/api/pilot", cookies.get(cc.id))).json(),
    team = state.teams[0],
    card = state.tasks.find(
      (c) =>
        c.teamId === team.teamId &&
        c.userId !== team.leaderId &&
        !c.data.depends.length &&
        ["Ready", "Working"].includes(c.state),
    );
  assert.ok(
    card,
    "A live independent task is required for the browser review fixture.",
  );
  const command = async (body) => {
    const r = await request("/api/pilot", cookies.get(card.userId), {
      requestId: randomUUID(),
      ...body,
    });
    assert.equal(r.status, 200, await r.text());
  };
  if (card.state === "Ready")
    await command({ action: "task", taskId: card._id, next: "Working" });
  await command({
    action: "task",
    taskId: card._id,
    stage: 0,
    complete: true,
    note: "Synthetic browser verification: actual task reasoning recorded for independent TL review.",
  });
  const next = await (await request("/api/pilot", cookies.get(cc.id))).json(),
    review = next.reviews.find(
      (r) =>
        r.data.taskId === card._id &&
        r.state === "PENDING" &&
        r.data.kind === "STAGE",
    );
  assert.equal(review.data.reviewerId, team.leaderId);
  await writeFile(
    "artifacts/pilot-browser-fixture.json",
    JSON.stringify(
      {
        synthetic: true,
        taskId: card._id,
        code: card.data.code,
        reviewId: review._id,
        ownerId: card.userId,
        leaderId: team.leaderId,
      },
      null,
      2,
    ),
  );
  console.log("Prepared an independent TL browser review in isolated staging.");
}
