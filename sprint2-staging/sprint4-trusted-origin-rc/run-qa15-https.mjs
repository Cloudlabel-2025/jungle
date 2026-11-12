import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { start } from "./source/sprint2-staging/staging.mjs";
import { fields } from "./source/sprint2-staging/fields.mjs";

const source = createHash("sha256");
for (const file of [
  "fields.mjs",
  "staging.mjs",
  "ui.jsx",
  "verify.mjs",
  "../package-lock.json",
])
  source
    .update(file)
    .update("\0")
    .update(
      await readFile(
        new URL("source/sprint2-staging/" + file, import.meta.url),
      ),
    )
    .update("\0");
const fingerprint = source.digest("hex");
const release = JSON.parse(
  await readFile(new URL("release.json", import.meta.url)),
);
assert.equal(fingerprint, release.candidateSha256);
console.log(`Candidate SHA-256: ${fingerprint}`);
const tls = {
  key: await readFile(process.env.CODEWILD_STAGING_TLS_KEY_FILE),
  cert: await readFile(process.env.CODEWILD_STAGING_TLS_CERT_FILE),
};
const app = await start(0, { tls });
try {
  assert.match(app.url, /^https:\/\/127\.0\.0\.1:/);
  console.log("Disposable HTTPS run: " + app.url);
  async function request(path, status, { method = "GET", data, cookie } = {}) {
    const response = await fetch(app.url + path, {
      method,
      headers: {
        ...(cookie && { Cookie: cookie }),
        ...(method !== "GET" && { Origin: app.url }),
        ...(data && { "Content-Type": "application/json" }),
      },
      ...(data && { body: JSON.stringify(data) }),
    });
    assert.equal(response.status, status, `${method} ${path}`);
    return response;
  }
  const login = async (account) => {
    const response = await request("/api/login", 200, {
      method: "POST",
      data: account,
    });
    const header = response.headers.get("set-cookie");
    assert.match(header, /; Secure(?:;|$)/i);
    return header.split(";")[0];
  };
  const admin = await login(app.accounts[0]);
  console.log("PASS S1-AC01: administrator session");
  const records = await (
    await request("/api/alumni", 200, { cookie: admin })
  ).json();
  assert.equal(records.length, 20);
  console.log("PASS S1-AC02: 20 fictional MongoDB records via API");
  const firstPath = `/api/alumni/${records[0]._id}`;
  const profile = await (
    await request(firstPath, 200, { cookie: admin })
  ).json();
  assert.equal(profile._id, records[0]._id);
  console.log("PASS S1-AC03: individual profile via administrator API");
  const learner = await login(app.accounts[1]);
  assert.deepEqual(
    await (await request(firstPath, 200, { cookie: learner })).json(),
    profile,
  );
  console.log("PASS S1-AC04: alumnus session and own profile via API");
  await request(`/api/alumni/${records[1]._id}`, 403, { cookie: learner });
  await request("/api/alumni", 403, { cookie: learner });
  console.log("PASS S1-AC05: other profile and directory denied");
  await request("/api/login", 401, {
    method: "POST",
    data: { email: app.accounts[0].email, password: "incorrect" },
  });
  await request(firstPath, 401);
  console.log("PASS S1-AC06: invalid credentials and unsigned reads denied");
  const html = await (await request("/", 200)).text();
  assert.match(html, /src="\/app.js"/);
  assert.match(
    (await request("/app.js", 200)).headers.get("content-type"),
    /javascript/,
  );
  await request("/health", 200);
  console.log(
    "LOCAL SMOKE S1-AC07: HTML, compiled React and health served together. CC browser demo pending.",
  );
  const data = Object.fromEntries(fields.map(([key]) => [key, profile[key]]));
  Object.assign(data, {
    firstName: "Élodie",
    lastName: "D’Arcy-Smith",
    email: "new@example.invalid",
    registration: "NEW-1",
  });
  const save = (status, values, path = "/api/alumni", cookie = admin) =>
    request(path, status, {
      method: path === "/api/alumni" ? "POST" : "PUT",
      data: values,
      cookie,
    });
  const created = await (await save(201, data)).json();
  assert.match(created._id, /^AL-/);
  assert.ok(!records.some(({ _id }) => _id === created._id));
  const savedPath = `/api/alumni/${created._id}`;
  await save(400, { ...data, _id: "AL-changed" }, savedPath);
  console.log("PASS S2-AC01: unique generated ID and system-field edit denied");
  const update = {
    ...data,
    status: "Employed",
    title: "Engineer",
    organisation: "Fictional Company",
  };
  const edited = await (await save(200, update, savedPath)).json();
  assert.equal(edited._id, created._id);
  assert.equal(edited.createdAt, created.createdAt);
  assert.ok(Date.parse(edited.modifiedAt) > Date.parse(created.modifiedAt));
  const adminAgain = await login(app.accounts[0]);
  assert.deepEqual(
    await (await request(savedPath, 200, { cookie: adminAgain })).json(),
    edited,
  );
  assert.equal(
    (await (await save(200, update, savedPath)).json()).modifiedAt,
    edited.modifiedAt,
  );
  console.log(
    "PASS S2-AC02: persisted edit across sessions, timestamp advances only for a change",
  );
  await save(409, {
    ...data,
    email: " NEW@EXAMPLE.INVALID ",
    registration: "",
  });
  await save(409, {
    ...data,
    email: "different@example.invalid",
    registration: " new-1 ",
  });
  await save(201, {
    ...data,
    email: "blank1@example.invalid",
    registration: "",
  });
  await save(201, {
    ...data,
    email: "blank2@example.invalid",
    registration: " ",
  });
  console.log(
    "PASS S2-AC03: normalized email and registration uniqueness, multiple blanks allowed",
  );
  for (const bad of [
    { firstName: "Name1" },
    { dob: "2024-02-30" },
    { dob: "2999-01-01" },
    { email: "invalid" },
    { mobile: "123" },
    { address1: " " },
    { city: "" },
    { state: "" },
    { country: "Unsupported" },
    { postcode: "SW1A 1AA" },
    { course: "Unsupported" },
    { year: "2999" },
    { status: "Unsupported" },
    { skill: "Unsupported" },
    { status: "Employed", title: "Engineer" },
    { linkedin: "not-a-url" },
  ])
    await save(400, { ...data, ...bad });
  await save(201, {
    ...data,
    email: "uk@example.invalid",
    registration: "",
    country: "United Kingdom",
    postcode: "sw1a 1aa",
    mobile: "+447700900000",
  });
  await save(201, {
    ...data,
    email: "us@example.invalid",
    registration: "",
    country: "United States",
    postcode: "02108",
    mobile: "+12025550100",
  });
  console.log(
    "PASS S2-AC04: 16 invalid cases, international name and three country formats",
  );
  await save(403, data, "/api/alumni", learner);
  await save(403, data, firstPath, learner);
  assert.deepEqual(
    await (await request(firstPath, 200, { cookie: learner })).json(),
    profile,
  );
  console.log(
    "API PASS S2-AC05: non-admin create and edit denied. CC UI check pending.",
  );
  console.log(
    "CC PENDING S2-AC06/07: browser regression and independent release acceptance.",
  );
} finally {
  await app.close();
}

const restored = await start(0, { tls });
try {
  const session = await fetch(restored.url + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: restored.url },
    body: JSON.stringify(restored.accounts[0]),
  });
  assert.equal(session.status, 200);
  const directory = await fetch(restored.url + "/api/alumni", {
    headers: { Cookie: session.headers.get("set-cookie").split(";")[0] },
  });
  assert.equal(directory.status, 200);
  const records = await directory.json();
  assert.equal(records.length, 20);
  assert.deepEqual(
    records.map((record) => record._id),
    Array.from(
      { length: 20 },
      (_, index) => `AL-QA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
  assert.equal(
    records.some((record) => record.email === "new@example.invalid"),
    false,
  );
  console.log(
    "PASS reset: fresh launch restored exactly the 20 original fictional records and removed rehearsal writes.",
  );
} finally {
  await restored.close();
}
