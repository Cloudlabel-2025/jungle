import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { start } from "./staging.mjs";
import { fields } from "./fields.mjs";

const directory = resolve(process.argv[2]);
const local = name => new URL(name, import.meta.url);
const accepted = JSON.parse(await readFile(local("key-2-isolated-record.json")));
const incident = JSON.parse(await readFile(resolve(directory, "inc04.json")));
const fingerprint = createHash("sha256");
for (const name of ["fields.mjs", "staging.mjs", "ui.jsx", "verify.mjs", "../package-lock.json"])
  fingerprint.update(name).update("\0").update(await readFile(local(name))).update("\0");
const sha256 = fingerprint.digest("hex");
assert.equal(sha256, accepted.candidateSha256);
assert.equal(sha256, incident.approvedCandidateSha256);
assert.equal(incident.incident, "INC-04");
const regression = await readFile(local("restored-gateway-evidence/index.html"), "utf8");
assert.equal(new Set([...regression.matchAll(/<tr><td>(S[12]-AC\d\d)<\/td><td>PASS<\/td>/g)].map(m => m[1])).size, 14);
const incidentEvent = label => {
  const match = incident.events.find(row => row.check === label);
  assert.ok(match, label);
  return match.observed;
};
const app = await start(0);
const sessions = [];
const startedAt = new Date().toISOString();
let current;
async function request(path, expected, method = "GET", body, cookie) {
  const response = await fetch(app.url + path, {
    method, signal: AbortSignal.timeout(8000),
    headers: { ...(body && { "Content-Type": "application/json" }), ...(cookie && { Cookie: cookie }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  current.requests.push({ path, method, status: response.status, expected });
  assert.equal(response.status, expected, path);
  return { response, data: await response.json() };
}
async function login(account) {
  const { response, data } = await request("/api/login", 200, "POST", account);
  assert.equal(data.role, account.role);
  return response.headers.get("set-cookie").split(";")[0];
}
const profile = (cookie, id = "AL-QA-001") => request("/api/alumni/" + id, 200, "GET", undefined, cookie).then(r => r.data);
const admin = app.accounts.find(a => a.role === "admin");
const alumnus = app.accounts.find(a => a.role === "alumnus");
const dataFor = record => Object.fromEntries(fields.map(([name]) => [name, record[name]]));
async function slot(id, role, exercise) {
  current = { id, role: role.role, startedAt: new Date().toISOString(), requests: [], formalOutcome: "Pending" };
  sessions.push(current);
  try {
    const cookie = await login(role);
    current.observed = await exercise(cookie);
    await request("/api/logout", 200, "POST", undefined, cookie);
    await request("/api/session", 401, "GET", undefined, cookie);
    current.dryRun = "PASS";
  } catch (error) {
    current.dryRun = "FAIL";
    current.error = error.message;
    process.exitCode = 1;
  } finally {
    current.finishedAt = new Date().toISOString();
  }
}
try {
  await slot("S3-DEF-A", admin, async cookie => {
    const seed = await profile(cookie);
    const rows = (await request("/api/alumni", 200, "GET", undefined, cookie)).data;
    assert.equal(rows.length, 20);
    assert.match(incidentEvent("Rollback verified"), /identical 20-record directory and original profile/);
    return { seedId: seed._id, seedCount: rows.length, rollback: incidentEvent("Rollback verified") };
  });
  await slot("S3-DEF-B", admin, async cookie => {
    assert.match(incidentEvent("INC-04 reproduced"), /404.*direct.*200/);
    assert.equal((await request("/health", 200)).data.status, "ready");
    await request("/api/alumni", 200, "GET", undefined, cookie);
    return { symptom: incidentEvent("INC-04 reproduced"), priorWitnessedRegressionIndexCount: 14 };
  });
  await slot("S3-DEF-C", admin, async cookie => {
    assert.match(incidentEvent("Root cause isolated"), /API target changed/);
    assert.equal((await request("/health", 200)).data.status, "ready");
    assert.equal((await profile(cookie))._id, "AL-QA-001");
    return { candidateSha256: sha256, cause: incidentEvent("Root cause isolated") };
  });
  await slot("S3-DEF-D", alumnus, async cookie => {
    assert.equal((await profile(cookie))._id, alumnus.alumniId);
    await request("/api/alumni", 403, "GET", undefined, cookie);
    await request("/api/alumni/" + alumnus.alumniId, 403, "PUT", { city: "Denied" }, cookie);
    const adminCookie = await login(admin);
    const before = await profile(adminCookie);
    await request("/api/alumni/" + before._id, 400, "PUT", { ...dataFor(before), postcode: "SW1A 1AA" }, adminCookie);
    assert.deepEqual(await profile(adminCookie), before);
    await request("/api/logout", 200, "POST", undefined, adminCookie);
    return { rejectedEdit: 403, invalidPostcode: 400, unchangedRecord: before._id };
  });
  await slot("S3-DEF-E", admin, async cookie => {
    const before = await profile(cookie);
    const updated = (await request("/api/alumni/" + before._id, 200, "PUT", { ...dataFor(before), city: "Fictional defence dry run" }, cookie)).data;
    const next = await login(admin);
    assert.equal(updated._id, before._id);
    assert.deepEqual(await profile(next), updated);
    await request("/api/logout", 200, "POST", undefined, next);
    return { recordId: before._id, persistedAcrossSessions: true, comparison: incidentEvent("INC-04 reproduced") };
  });
} finally {
  await app.close();
  await writeFile(resolve(directory, "defences.json"), JSON.stringify({
    startedAt, finishedAt: new Date().toISOString(), candidateSha256: sha256, scope: "Fresh local disposable HTTP/API dry run",
    key3: "Pending", key4: "Pending", sessions,
  }, null, 2) + "\n");
}
console.log(sessions.map(s => s.id + ": " + s.dryRun).join("\n"));
