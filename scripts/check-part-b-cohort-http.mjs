// Only the disposable --five-teams browser fixture at this fixed loopback origin.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
const base = "http://localhost:3188", dir = "artifacts/part-b-final-local-2026-11-12";
const fixture = JSON.parse(await readFile(`${dir}/fixture-disclosure.json`, "utf8"));
assert.equal(fixture.base, base);
assert.equal(fixture.accounts.filter(account => account.role === "GAMER").length, 25);
const cookies = new Map(), observations = [];
const request = (path, actor, body, method = body === undefined ? "GET" : "POST", origin = base, headers = {}) => fetch(base + path, {
  method, headers: { ...(actor && { Cookie: cookies.get(actor) }), ...(method !== "GET" && { Origin: origin }),
    ...(body !== undefined && { "Content-Type": "application/json" }), ...headers },
  ...(body !== undefined && { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
});
for (const actor of fixture.accounts) {
  assert.match(actor.email, /@pilot\.invalid$/);
  const login = await request("/api/auth/login", null, { username: actor.email, password: "Fictional-QA-2026!" });
  assert.equal(login.status, 200, `fictional login ${actor.id}`);
  cookies.set(actor.id, login.headers.get("set-cookie").split(";")[0]);
}
const started = performance.now();
await Promise.all(fixture.accounts.map(async actor => {
  const response = await request("/api/pilot", actor.id);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  const state = await response.json();
  const gamer = actor.role === "GAMER";
  assert.equal(state.tasks.length, gamer ? 20 : 100);
  assert.equal(state.teams.length, gamer ? 1 : 5);
  if (gamer) {
    assert.equal(state.setup, null);
    assert.ok(state.tasks.every(task => task.teamId === `pilot-team-${Math.floor(Number(actor.id.replace("pilot-g", "")) / 5)}`));
    assert.ok(!state.daily.some(row => row.state.startsWith("FINAL_PROFILE") || row.state === "FINAL_DEMO_WITNESS"));
  }
  observations.push({ actor: actor.id, role: actor.role, tasks: state.tasks.length, teams: state.teams.length, scope: "PASS" });
}));
const parallelReadMs = Math.round(performance.now() - started);
const pdf = await readFile("output/pdf/part-b-fictional-passport.pdf"), uploads = [];
for (let team = 0; team < 5; team++) {
  const state = await (await request("/api/pilot", `pilot-g${team * 5}`)).json();
  const card = state.tasks.find(task => task.data.code === "DB-09");
  assert.ok(card);
  const actor = card.userId, taskId = card._id;
  const response = await request("/api/pilot/storage", actor, { action: "intent", requestId: randomUUID(), taskId, filename: "fictional-transport.pdf" });
  assert.equal(response.status, 200);
  const intent = await response.json();
  assert.equal(intent.provider, "MONGODB");
  const put = await request(intent.uploadUrl, actor, pdf, "PUT", base, { "Content-Type": intent.contentType,
    "X-Upload-Part": "0", "X-Upload-Parts": "1", "X-Upload-Size": String(pdf.length) });
  assert.equal(put.status, 200);
  assert.equal((await request(`/api/pilot/files/${intent.evidenceId}`, actor)).status, 409);
  assert.equal((await request("/api/pilot/storage", actor, { action: "complete", evidenceId: intent.evidenceId })).status, 200);
  const downloaded = await request(`/api/pilot/files/${intent.evidenceId}`, actor);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
  const other = `pilot-g${((team + 1) % 5) * 5}`;
  assert.equal((await request(`/api/pilot/files/${intent.evidenceId}`, other)).status, 403);
  assert.equal((await request(`/api/pilot/files/${intent.evidenceId}`)).status, 401);
  assert.equal((await request(intent.uploadUrl, actor, pdf, "PUT", "https://untrusted.invalid", { "Content-Type": intent.contentType })).status, 403);
  uploads.push({ team: team + 1, actor, evidenceId: intent.evidenceId, sha256: createHash("sha256").update(pdf).digest("hex"), roundTripAndPrivacy: "PASS" });
}
const owner = uploads[0].actor, taskId = "browser-sprint-3:pilot-team-0:DB-09";
const largeIntent = await (await request("/api/pilot/storage", owner, { action: "intent", requestId: randomUUID(), taskId, filename: "five-mb-transport.pdf" })).json();
assert.ok(largeIntent.evidenceId);
const chunkSize = 1024 * 1024, large = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(5 * chunkSize - 9, 32)]);
for (let part = 0; part < 5; part++) assert.equal((await request(largeIntent.uploadUrl, owner,
  large.subarray(part * chunkSize, (part + 1) * chunkSize), "PUT", base,
  { "Content-Type": "application/pdf", "X-Upload-Part": String(part), "X-Upload-Parts": "5", "X-Upload-Size": String(large.length) })).status, 200);
assert.equal((await request("/api/pilot/storage", owner, { action: "complete", evidenceId: largeIntent.evidenceId })).status, 200);
const stream = await request(`/api/pilot/files/${largeIntent.evidenceId}`, owner);
assert.equal(stream.status, 200);
assert.equal(stream.headers.get("Content-Length"), null);
assert.deepEqual(Buffer.from(await stream.arrayBuffer()), large);
const report = { fixture: "Disposable five-team checkpoint; prior work and SDLC checkpoints seeded, no actual student development certified",
  accounts: observations, simultaneousReads: { count: observations.length, elapsedMs: parallelReadMs,
    interpretation: "Local observation only; no CC-approved performance target or deployed capacity certification" },
  uploads, fiveMegabyteChunkedUploadAndStreamedDownload: "PASS",
  payloadNote: "The 5 MB header/padding payload tests transport limits, not PDF semantics or learner evidence validity" };
await writeFile(`${dir}/http-verification.json`, JSON.stringify(report, null, 2) + "\n");
console.log(`PASS: ${observations.length} simultaneous scoped actor reads, five team upload/hash/privacy cycles, and exact 5 MB chunked/streamed transport.`);
