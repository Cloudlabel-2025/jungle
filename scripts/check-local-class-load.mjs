// HTTP measurements against serve-team-lab-browser --class-size --missions.
// Refuses non-loopback hosts; never writes credentials or cookies to artifacts.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = new URL(process.argv[2] || "http://127.0.0.1:3191");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Local QA only");
const actors = [];
for (let group = 0; group < 25; group += 5)
  actors.push(
    ...(await Promise.all(
      Array.from({ length: 5 }, async (_, offset) => {
        const i = group + offset;
        const response = await fetch(new URL("/api/auth/login", base), {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base.origin },
          body: JSON.stringify({
            email: `g${i}@pilot.invalid`,
            password: "Fictional-QA-2026!",
          }),
        });
        assert.equal(response.status, 200, `login ${i}`);
        const cookie = response.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; ");
        assert.ok(cookie);
        return { i, cookie };
      }),
    )),
  );
const samples = [];
async function read(actor, path, label) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), {
    headers: { Cookie: actor.cookie },
  });
  const body = await response.json();
  samples.push({
    label,
    ms: Math.round(performance.now() - start),
    status: response.status,
  });
  assert.equal(
    response.status,
    200,
    `${label} ${actor.i}: ${body.error || ""}`,
  );
  return body;
}
// Initialise one project per team before measuring steady-state collaboration.
for (const actor of actors.filter((a) => a.i % 5 === 0))
  await read(actor, "/api/team-lab", "initialise");
for (let wave = 0; wave < 3; wave++) {
  await Promise.all(
    actors.map(async (actor) => {
      const state = await read(actor, "/api/state", "player-state");
      assert.equal(state.user._id, `pilot-g${actor.i}`);
      const sprint = await read(actor, "/api/pilot", "sprint");
      assert.ok(
        sprint.tasks.every(
          (t) => t.teamId === `pilot-team-${Math.floor(actor.i / 5)}`,
        ),
        "sprint team isolation",
      );
      const project = await read(actor, "/api/team-lab", "team-project");
      assert.ok(
        project.projectId.includes(`pilot-team-${Math.floor(actor.i / 5)}`),
        "project isolation",
      );
      await read(
        actor,
        `/api/team-lab?version=${project.version}`,
        "unchanged-project",
      );
    }),
  );
}
for (const actor of actors.filter((a) => a.i % 5 === 0)) {
  const other = (Math.floor(actor.i / 5) + 1) % 5;
  const response = await fetch(
    new URL(`/api/team-lab?teamId=pilot-team-${other}`, base),
    { headers: { Cookie: actor.cookie } },
  );
  assert.equal(response.status, 403, "cross-team denial");
}
const summary = {
  disclosure:
    "Local production build, synthetic 25-player/5-team cohort; 3 waves of authenticated HTTP reads. This does not measure WebContainer compilation or production network conditions.",
  actors: 25,
  waves: 3,
  requests: samples.length,
  crossTeamDenials: 5,
  endpoints: {},
};
for (const label of [
  "player-state",
  "sprint",
  "team-project",
  "unchanged-project",
]) {
  const values = samples
    .filter((s) => s.label === label)
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  summary.endpoints[label] = {
    requests: values.length,
    p50ms: values[Math.ceil(values.length * 0.5) - 1],
    p95ms: values[Math.ceil(values.length * 0.95) - 1],
    maxMs: values.at(-1),
  };
}
await mkdir("artifacts/local-readiness", { recursive: true });
await writeFile(
  "artifacts/local-readiness/class-load.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
