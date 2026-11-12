import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fields } from "./source/sprint2-staging/fields.mjs";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");
const evidencePath = (name) =>
  process.env.CODEWILD_EVIDENCE_DIR
    ? resolve(process.env.CODEWILD_EVIDENCE_DIR, name)
    : new URL(name, import.meta.url);
const json = async (file) => JSON.parse(await read(file));
const release = await json("release.json");
const preflight = await json("cc-localhost-preflight.json");
assert.equal(preflight.url, "https://127.0.0.1:3193");
assert.equal(preflight.candidateSha256, release.candidateSha256);
assert.equal(preflight.windowsHttpsHealth, "ready");
assert.ok(Date.now() < Date.parse(preflight.stopAt), "Readiness window ended");
const fingerprint = createHash("sha256");
for (const [name, expected] of Object.entries(release.sourceFiles)) {
  const bytes = await readFile(
    new URL("source/sprint2-staging/" + name, import.meta.url),
  );
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  fingerprint.update(name).update("\0").update(bytes).update("\0");
}
assert.equal(fingerprint.digest("hex"), release.candidateSha256);
const accounts = JSON.parse(await readFile(process.argv[2], "utf8"));
assert.equal(accounts.length, 5);
for (const [index, account] of accounts.entries()) {
  const listed = preflight.accounts[index];
  assert.equal(account.slot, listed.slot);
  assert.equal(account.email, listed.username);
  assert.equal(account.role, listed.role);
}
const incident = await json("../inc04-rehearsal-evidence.json");
const key2 = await json("../key-2-isolated-record.json");
const sprint3 = await json("../sprint3-resumed-isolated-record.json");
const sprint4 = await json("../sprint4-isolated-import.json");
const friday = JSON.parse(
  await readFile(evidencePath("workflow.json"), "utf8"),
);
for (const item of [release, sprint3, sprint4, friday])
  assert.ok(item.key3 == null && item.key4 == null);
assert.equal(incident.incident, "INC-04");
assert.equal(incident.approvedCandidateSha256, key2.candidateSha256);
assert.equal(sprint3.candidateSha256, key2.candidateSha256);
assert.equal(friday.fridayEvidence.sha256, release.candidateSha256);
const index = await read("../restored-gateway-evidence/index.html");
const checks = [
  ...index.matchAll(/<tr><td>(S[12]-AC\d\d)<\/td><td>PASS<\/td>/g),
].map((match) => match[1]);
assert.equal(new Set(checks).size, 14);
const findIncident = (label) => {
  const event = incident.events.find(({ check }) => check === label);
  assert.ok(event, label);
  return event;
};
const result = {
  candidateSha256: release.candidateSha256,
  url: preflight.url,
  startedAt: new Date().toISOString(),
  scope:
    "Accelerated fictional rehearsal. The assistant operated all five accounts. The CC assessor and formal decisions are pending.",
  sessions: [],
};
let current;
const suffix = randomBytes(5).toString("hex");

async function request(path, expected, { method = "GET", body, cookie } = {}) {
  const response = await fetch(preflight.url + path, {
    method,
    signal: AbortSignal.timeout(8000),
    headers: {
      ...(method !== "GET" && { Origin: preflight.url }),
      ...(body && { "Content-Type": "application/json" }),
      ...(cookie && { Cookie: cookie }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  current.requests.push({ method, path, expected, status: response.status });
  assert.equal(response.status, expected, method + " " + path);
  return { response, data: JSON.parse(text) };
}
async function login(account) {
  const { response, data } = await request("/api/login", 200, {
    method: "POST",
    body: account,
  });
  assert.equal(data.role, account.role);
  const header = response.headers.get("set-cookie");
  assert.match(header, /; Secure(?:;|$)/i);
  return header.split(";")[0];
}
async function logout(cookie) {
  await request("/api/logout", 200, { method: "POST", cookie });
  await request("/api/session", 401, { cookie });
}
const profilePath = (id) => "/api/alumni/" + id;
const getProfile = async (id, cookie) =>
  (await request(profilePath(id), 200, { cookie })).data;
const seed = async (cookie) => getProfile("AL-QA-001", cookie);
const bodyFor = (profile, tag) => ({
  ...Object.fromEntries(fields.map(([key]) => [key, profile[key]])),
  firstName: "Rehearsal",
  lastName: "Fictional",
  email: "uat-" + tag + "-" + suffix + "@example.invalid",
  registration: "UAT-" + tag + "-" + suffix,
});
const create = async (body, cookie) =>
  (await request("/api/alumni", 201, { method: "POST", body, cookie })).data;
const edit = async (id, body, cookie) =>
  (await request(profilePath(id), 200, { method: "PUT", body, cookie })).data;

async function session(id, account, run) {
  current = {
    id,
    slot: account.slot,
    role: account.role,
    startedAt: new Date().toISOString(),
    requests: [],
  };
  result.sessions.push(current);
  try {
    current.observations = await run(account);
    current.rehearsal = "PASS";
  } catch (error) {
    current.rehearsal = "FAIL";
    current.failure = error.message;
    process.exitCode = 1;
  } finally {
    current.finishedAt = new Date().toISOString();
    current.formalOutcome = "Pending";
  }
}
async function defend(account, review) {
  const cookie = await login(account);
  try {
    const observations = await review(cookie);
    return observations;
  } finally {
    await logout(cookie);
  }
}

const [a, b, c, d, e] = accounts;
await session("S3-DEF-A", a, (account) =>
  defend(account, async (cookie) => {
    const rollback = findIncident("Rollback verified");
    assert.match(
      rollback.observed,
      /identical 20-record directory and original profile/,
    );
    assert.equal((await seed(cookie))._id, "AL-QA-001");
    return [
      rollback.observed,
      "Read fictional seed AL-QA-001. Compared the recorded recovery with the run-sheet prompt about when a data restore would be needed.",
    ];
  }),
);
await session("S3-DEF-B", b, (account) =>
  defend(account, async (cookie) => {
    const before = findIncident("INC-04 reproduced");
    assert.match(before.observed, /404.*direct.*200/);
    assert.ok(
      (await request("/api/alumni", 200, { cookie })).data.length >= 20,
    );
    return [
      before.observed,
      "Verified 14 PASS entries in the earlier restored-gateway index. The current directory also returned 200.",
    ];
  }),
);
await session("S3-DEF-C", c, (account) =>
  defend(account, async (cookie) => {
    const root = findIncident("Root cause isolated");
    assert.match(root.observed, /API target changed/);
    assert.equal((await request("/health", 200)).data.status, "ready");
    assert.equal((await seed(cookie))._id, "AL-QA-001");
    return [
      root.observed,
      findIncident("Rollback verified").observed,
      "Confirmed the earlier pinned baseline and sampled the current HTTPS health and profile endpoints.",
    ];
  }),
);
await session("S3-DEF-D", d, (account) =>
  defend(account, async (cookie) => {
    assert.equal((await seed(cookie))._id, account.alumniId);
    await request("/api/alumni", 403, { cookie });
    await request(profilePath(account.alumniId), 403, {
      method: "PUT",
      body: { city: "Denied" },
      cookie,
    });
    assert.match(index, /mismatched postcode/);
    return [
      "Compared earlier validation and UI evidence with server enforcement. The fictional alumnus could read their profile, while directory and edit returned 403.",
    ];
  }),
);
await session("S3-DEF-E", e, (account) =>
  defend(account, async (cookie) => {
    const persisted = findIncident("Restored staging journey");
    assert.match(persisted.observed, /persisted after fresh sign-in/);
    const before = await seed(cookie);
    const second = await login(account);
    try {
      assert.deepEqual(await seed(second), before);
    } finally {
      await logout(second);
    }
    return [
      findIncident("INC-04 reproduced").observed,
      persisted.observed,
      "Compared the same seed profile in two current HTTPS sessions.",
    ];
  }),
);

await session("UAT-01", a, async (account) => {
  const cookie = await login(account);
  try {
    const body = bodyFor(await seed(cookie), "a");
    const created = await create(body, cookie);
    assert.match(created._id, /^AL-/);
    const saved = await edit(
      created._id,
      { ...body, city: "Gamer A QA City" },
      cookie,
    );
    assert.equal(saved._id, created._id);
    assert.equal(
      (await getProfile(created._id, cookie)).city,
      "Gamer A QA City",
    );
    return [
      {
        recordId: created._id,
        createdCity: created.city,
        reopenedCity: saved.city,
      },
    ];
  } finally {
    await logout(cookie);
  }
});
await session("UAT-02", b, async (account) => {
  const cookie = await login(account);
  try {
    const body = bodyFor(await seed(cookie), "b");
    const before = (await request("/api/alumni", 200, { cookie })).data.length;
    const invalid = [];
    for (const patch of [
      { postcode: "SW1A 1AA" },
      { status: "Employed", title: "", organisation: "" },
    ]) {
      invalid.push(
        (
          await request("/api/alumni", 400, {
            method: "POST",
            body: { ...body, ...patch },
            cookie,
          })
        ).data.error,
      );
    }
    assert.equal(
      (await request("/api/alumni", 200, { cookie })).data.length,
      before,
    );
    const created = await create({ ...body, postcode: "560001" }, cookie);
    const alternate = bodyFor(body, "b-duplicate");
    for (const duplicate of [
      { email: " " + body.email.toUpperCase() + " " },
      { registration: body.registration.toLowerCase() },
    ]) {
      invalid.push(
        (
          await request("/api/alumni", 409, {
            method: "POST",
            body: { ...alternate, ...duplicate },
            cookie,
          })
        ).data.error,
      );
    }
    assert.equal(
      (await request("/api/alumni", 200, { cookie })).data.length,
      before + 1,
    );
    return [{ correctedRecordId: created._id, messages: invalid }];
  } finally {
    await logout(cookie);
  }
});
await session("UAT-03", c, async (account) => {
  let cookie = await login(account);
  try {
    const body = bodyFor(await seed(cookie), "c");
    const created = await create(body, cookie);
    const saved = await edit(
      created._id,
      { ...body, city: "Gamer C QA City" },
      cookie,
    );
    await logout(cookie);
    cookie = await login(account);
    const reopened = await getProfile(created._id, cookie);
    assert.deepEqual(reopened, saved);
    assert.equal(reopened.createdAt, created.createdAt);
    assert.ok(Date.parse(reopened.modifiedAt) > Date.parse(created.modifiedAt));
    return [
      {
        recordId: reopened._id,
        createdAt: reopened.createdAt,
        modifiedAt: reopened.modifiedAt,
        city: reopened.city,
      },
    ];
  } finally {
    await logout(cookie);
  }
});
await session("UAT-04", d, async (account) => {
  const cookie = await login(account);
  try {
    const before = await seed(cookie);
    assert.equal(before._id, account.alumniId);
    await request("/api/alumni", 403, { cookie });
    await request(profilePath("AL-QA-002"), 403, { cookie });
    await request("/api/alumni", 403, {
      method: "POST",
      body: bodyFor(before, "d"),
      cookie,
    });
    await request(profilePath(before._id), 403, {
      method: "PUT",
      body: { city: "Denied" },
      cookie,
    });
    assert.deepEqual(await seed(cookie), before);
    return [
      {
        ownProfile: before._id,
        unchangedAfterDeniedWrites: true,
        earlierUiEvidence: "restored-gateway-evidence/index.html",
      },
    ];
  } finally {
    await logout(cookie);
  }
});
await session("UAT-05", e, async (account) => {
  const releaseCard = friday.fridayEvidence.cards.find(
    ({ code }) => code === "OP-13",
  );
  const { handover, simulatedSession } = friday.fridayEvidence;
  assert.ok(
    friday.cards.some(
      ({ id, state }) => id === "OP-13" && state === "Accepted",
    ),
  );
  assert.ok(releaseCard.reviews.some(({ kind }) => kind === "FINAL"));
  assert.ok(handover.id.includes(releaseCard.taskId));
  assert.ok(Date.parse(handover.readyAt) <= Date.parse(simulatedSession.start));
  assert.equal(simulatedSession.workingMinutes, 150);
  let cookie = await login(account);
  try {
    const body = bodyFor(await seed(cookie), "e");
    await request("/api/alumni", 400, {
      method: "POST",
      body: { ...body, postcode: "SW1A 1AA" },
      cookie,
    });
    const created = await create(body, cookie);
    const saved = await edit(
      created._id,
      { ...body, city: "Gamer E Friday QA City" },
      cookie,
    );
    await logout(cookie);
    cookie = await login(account);
    assert.deepEqual(await getProfile(saved._id, cookie), saved);
    const restricted = await login(d);
    try {
      await request(profilePath(saved._id), 403, { cookie: restricted });
    } finally {
      await logout(restricted);
    }
    return [
      {
        recordId: saved._id,
        city: saved.city,
        rehearsalHandover: handover.id,
        readyAt: handover.readyAt,
        simulatedStart: simulatedSession.start,
        recommendation:
          "Rehearsal cases passed. Formal acceptance remains pending.",
      },
    ];
  } finally {
    await logout(cookie);
  }
});
result.finishedAt = new Date().toISOString();
await writeFile(
  evidencePath("cc-ten-session-rehearsal.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.table(
  result.sessions.map(({ id, slot, rehearsal, requests, failure }) => ({
    id,
    slot,
    rehearsal,
    requests: requests.length,
    failure,
  })),
);
