import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { fields } from "./fields.mjs";
import { start } from "./staging.mjs";

const local = (name) => new URL(name, import.meta.url);
const accepted = JSON.parse(
  await readFile(local("key-2-isolated-record.json"), "utf8"),
);
const resumed = JSON.parse(
  await readFile(local("sprint3-resumed-isolated-record.json"), "utf8"),
);
assert.equal(accepted.acceptance.key, "Key 2");
assert.equal(accepted.team, "Fictional Team A");
assert.equal(resumed.teamId, accepted.teamId);
assert.equal(resumed.candidateSha256, accepted.candidateSha256);
async function fingerprint() {
  const hash = createHash("sha256");
  for (const file of [
    "fields.mjs",
    "staging.mjs",
    "ui.jsx",
    "verify.mjs",
    "../package-lock.json",
  ])
    hash
      .update(file)
      .update("\0")
      .update(await readFile(local(file)))
      .update("\0");
  return hash.digest("hex");
}
assert.equal(
  await fingerprint(),
  accepted.candidateSha256,
  "Approved source changed.",
);
const events = [];
function record(check, observed) {
  events.push({ at: new Date().toISOString(), check, observed });
  console.log(check + " — " + observed);
}

async function loopback(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

let app = await start();
const browserRegression = process.argv.includes("--serve-restored");
let wrongService;
let gateway;
let apiBase = app.url;
try {
  wrongService = await loopback((_req, res) => {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Alumni API is not available at this staging target.",
      }),
    );
  });
  gateway = await loopback(async (req, res) => {
    try {
      const path = new URL(req.url, "http://127.0.0.1").pathname;
      const base = path.startsWith("/api/") ? apiBase : app.url;
      const target = new URL(base);
      target.pathname = path;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = {};
      for (const name of ["content-type", "cookie"])
        if (req.headers[name]) headers[name] = req.headers[name];
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        redirect: "error",
        ...(chunks.length && { body: Buffer.concat(chunks) }),
        signal: AbortSignal.timeout(5000),
      });
      res.statusCode = upstream.status;
      for (const name of ["content-type", "cache-control", "set-cookie"])
        if (upstream.headers.has(name))
          res.setHeader(name, upstream.headers.get(name));
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Staging API upstream unavailable." }));
    }
  });
  const request = (base, path, { method = "GET", data, cookie } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(cookie && { Cookie: cookie }),
        ...(data && { "Content-Type": "application/json" }),
      },
      ...(data && { body: JSON.stringify(data) }),
    });
  const login = async (base, account) => {
    const response = await request(base, "/api/login", {
      method: "POST",
      data: account,
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const smoke = async (base) => {
    const html = await request(base, "/");
    assert.equal(html.status, 200);
    assert.match(await html.text(), /src="\/app.js"/);
    assert.equal((await request(base, "/app.js")).status, 200);
  };
  const profilePath = "/api/alumni/AL-QA-001";
  const admin = await login(gateway.url, app.accounts[0]);
  await smoke(gateway.url);
  const directoryBefore = await (
    await request(gateway.url, "/api/alumni", { cookie: admin })
  ).json();
  const baseline = await (
    await request(gateway.url, profilePath, { cookie: admin })
  ).json();
  assert.equal(directoryBefore.length, 20);
  assert.equal(baseline._id, "AL-QA-001");
  record(
    "Clean baseline",
    "Staging shell and React bundle served. Administrator login, directory of 20 and profile read passed.",
  );

  try {
    apiBase = wrongService.url;
    await smoke(gateway.url);
    const failed = await request(gateway.url, "/api/login", {
      method: "POST",
      data: app.accounts[0],
    });
    assert.equal(failed.status, 404);
    assert.match(
      (await failed.json()).error,
      /not available at this staging target/,
    );
    assert.equal(
      (await request(gateway.url, "/api/alumni", { cookie: admin })).status,
      404,
    );
    const direct = await login(app.url, app.accounts[0]);
    assert.equal(
      (await request(app.url, "/api/alumni", { cookie: direct })).status,
      200,
    );
    record(
      "INC-04 reproduced",
      "Staging HTML and bundle stayed reachable. Login and directory returned 404 through the incorrect API target while the app's direct login and directory returned 200.",
    );
    record(
      "Root cause isolated",
      "Only the disposable staging gateway's API target changed. The approved application process, source and MongoDB remained in place.",
    );
  } finally {
    apiBase = app.url;
  }
  await smoke(gateway.url);
  const fresh = await login(gateway.url, app.accounts[0]);
  const directoryAfter = await (
    await request(gateway.url, "/api/alumni", { cookie: fresh })
  ).json();
  assert.deepEqual(directoryAfter, directoryBefore);
  assert.deepEqual(
    await (await request(gateway.url, profilePath, { cookie: fresh })).json(),
    baseline,
  );
  record(
    "Rollback verified",
    "Restored the original API target. A fresh administrator session retrieved the identical 20-record directory and original profile from the same database.",
  );

  if (browserRegression) {
    const verifier = local("verify.mjs").href;
    const bridge = Symbol.for("codewild.restored-gateway-test");
    let starts = 0;
    globalThis[bridge] = async () => {
      if (starts++) {
        await app.close();
        app = await start();
        apiBase = app.url;
      }
      return {
        url: gateway.url,
        accounts: app.accounts,
        close: async () => {},
      };
    };
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        if (specifier === "./staging.mjs" && context.parentURL === verifier)
          return {
            url: 'data:text/javascript,export const start=globalThis[Symbol.for("codewild.restored-gateway-test")]',
            shortCircuit: true,
          };
        return next(specifier, context);
      },
    });
    try {
      await import(verifier);
      assert.equal(starts, 2);
      record(
        "Same-gateway regression",
        "Existing API verifier and clean reset passed through the restored gateway. The reset restored 20 fictional rows for the browser run.",
      );
    } finally {
      hooks.deregister();
      delete globalThis[bridge];
    }
    console.log("Restored gateway for browser QA: " + gateway.url);
    console.table(
      app.accounts
        .slice(0, 2)
        .map(({ role, email, password }) => ({ role, email, password })),
    );
    await new Promise((resolve) => {
      const done = () => {
        process.off("SIGINT", done);
        process.off("SIGTERM", done);
        resolve();
      };
      process.on("SIGINT", done);
      process.on("SIGTERM", done);
    });
  } else {
    const save = (path, method, data, cookie = fresh) =>
      request(gateway.url, path, { method, data, cookie });
    const newProfile = Object.fromEntries(
      fields.map(([key]) => [key, baseline[key]]),
    );
    Object.assign(newProfile, {
      email: "inc04-rehearsal@example.invalid",
      registration: "INC04-QA",
      firstName: "Rehearsal",
    });
    const created = await save("/api/alumni", "POST", newProfile);
    assert.equal(created.status, 201);
    const recordId = (await created.json())._id;
    const path = `/api/alumni/${recordId}`;
    assert.equal(
      (await save(path, "PUT", { ...newProfile, city: "Rollback Test City" }))
        .status,
      200,
    );
    const relogin = await login(gateway.url, app.accounts[0]);
    const saved = await (
      await request(gateway.url, path, { cookie: relogin })
    ).json();
    assert.equal(saved._id, recordId);
    assert.equal(saved.city, "Rollback Test City");
    const alumnus = await login(gateway.url, app.accounts[1]);
    assert.equal(
      (await request(gateway.url, profilePath, { cookie: alumnus })).status,
      200,
    );
    assert.equal(
      (await request(gateway.url, path, { cookie: alumnus })).status,
      403,
    );
    assert.equal((await save(path, "PUT", newProfile, alumnus)).status, 403);
    record(
      "Restored staging journey",
      "Create and edit persisted after fresh sign-in. Alumnus could read own profile and received 403 for another profile and an edit.",
    );
  }
} finally {
  try {
    if (gateway) await gateway.close();
    if (wrongService) await wrongService.close();
  } finally {
    await app.close();
  }
}

if (!browserRegression) {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [fileURLToPath(local("verify.mjs"))],
    { windowsHide: true },
  );
  assert.ok(stdout.includes(accepted.candidateSha256));
  assert.ok(stdout.includes("PASS reset:"));
  assert.equal(await fingerprint(), accepted.candidateSha256);
  record(
    "Post-rollback regression",
    "The existing Sprint 1 and 2 API verifier, compiled UI smoke, and clean-reset check passed on a fresh instance of the unchanged accepted release.",
  );
  const report = {
    team: accepted.team,
    incident: "INC-04",
    approval:
      "User confirmed MC selection, CC approval, and Codex as authorised operator in this chat.",
    approvedCandidateSha256: accepted.candidateSha256,
    scope: "Local disposable gateway and fictional Alumni Connect database.",
    method:
      "Temporary API target misconfiguration at the disposable staging gateway. Original target restored in finally.",
    events,
    regressionOutput: stdout.trim().split(/\r?\n/),
    browserEvidence:
      "Prior accepted Key 2 browser evidence is in acceptance-evidence/index.html. This incident run exercised HTTP and API journeys.",
    key3: "Pending CC gate review and five individual defences.",
  };
  await writeFile(
    process.env.CODEWILD_INC04_EVIDENCE_FILE || local("inc04-rehearsal-evidence.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
