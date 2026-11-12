import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EJSON } from "bson";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { start } from "./source/sprint2-staging/staging.mjs";
import { fields } from "./source/sprint2-staging/fields.mjs";

const read = (file) => readFile(new URL(file, import.meta.url));
const evidencePath = (name) =>
  process.env.CODEWILD_EVIDENCE_DIR
    ? resolve(process.env.CODEWILD_EVIDENCE_DIR, name)
    : new URL(name, import.meta.url);
const release = JSON.parse(await read("./release.json"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hash = createHash("sha256");
for (const [name, expected] of Object.entries(release.sourceFiles)) {
  const bytes = await read("./source/sprint2-staging/" + name);
  assert.equal(digest(bytes), expected);
  hash.update(name).update("\0").update(bytes).update("\0");
}
assert.equal(hash.digest("hex"), release.candidateSha256);
const evidence = {
  candidateSha256: release.candidateSha256,
  startedAt: new Date().toISOString(),
  tls: {},
  session: [],
  backup: {},
  restore: {},
};
const tls = {
  key: await readFile(process.env.CODEWILD_STAGING_TLS_KEY_FILE),
  cert: await readFile(process.env.CODEWILD_STAGING_TLS_CERT_FILE),
};
const backupFile = "exact-https-retained-backup.ejson";
let candidate;
let db;

async function openCandidate() {
  const original = MongoMemoryServer.create;
  let uri;
  // Observe only the temporary Mongo instance created by the pinned launcher.
  MongoMemoryServer.create = async function (...args) {
    const mongo = await original.apply(this, args);
    uri = mongo.getUri("alumni_connect_sprint2");
    return mongo;
  };
  try {
    candidate = await start(0, { tls });
    assert.match(candidate.url, /^https:\/\/127\.0\.0\.1:/);
  } finally {
    MongoMemoryServer.create = original;
  }
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  db = await mongoose.createConnection(uri).asPromise();
  return db.collection("alumni");
}

async function closeCandidate() {
  if (db) {
    await db.close();
    db = undefined;
  }
  if (candidate) {
    await candidate.close();
    candidate = undefined;
  }
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(candidate.url + path, {
    method,
    signal: AbortSignal.timeout(8000),
    headers: {
      ...(body && { "Content-Type": "application/json" }),
      ...(cookie && { Cookie: cookie }),
      ...(method !== "GET" && { Origin: candidate.url }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    text: await response.text(),
  };
}

async function check(name, path, expected, options) {
  const reply = await request(path, options);
  evidence.session.push({ name, expected, actual: reply.status });
  assert.equal(reply.status, expected, name);
  return reply;
}

async function login() {
  const result = await check("Administrator sign-in", "/api/login", 200, {
    method: "POST",
    body: candidate.accounts[0],
  });
  assert.equal(Object.hasOwn(JSON.parse(result.text), "password"), false);
  const header = result.headers["set-cookie"];
  assert.match(header, /; Secure(?:;|$)/i);
  return { cookie: header.split(";")[0], header };
}

const records = (collection) => collection.find().sort({ _id: 1 }).toArray();
const indexes = (collection) => collection.indexes();

try {
  const source = await openCandidate();
  evidence.sourceUrl = candidate.url;
  evidence.tls.transport =
    "Certificate-validated localhost HTTPS using Windows trust";
  await check("Source HTTPS health", "/health", 200);
  const { cookie, header } = await login();
  evidence.tls.cookie = {
    httpOnly: /; HttpOnly/i.test(header),
    sameSiteStrict: /; SameSite=Strict/i.test(header),
    secure: /; Secure/i.test(header),
    path: /; Path=([^;]+)/i.exec(header)?.[1],
    maxAgeSeconds: Number(/; Max-Age=(\d+)/i.exec(header)?.[1]),
  };
  const current = await check("Signed-in session", "/api/session", 200, {
    cookie,
  });
  evidence.tls.sessionCacheControl = current.headers["cache-control"];
  await check("Unsigned session rejected", "/api/session", 401);
  const seedPath = "/api/alumni/AL-QA-001";
  const seed = JSON.parse(
    (await check("Seed profile", seedPath, 200, { cookie })).text,
  );
  const fieldsOf = (record) =>
    Object.fromEntries(fields.map(([key]) => [key, record[key]]));
  const createBody = {
    ...fieldsOf(seed),
    firstName: "Retained",
    email: "restore-qa@example.invalid",
    registration: "RESTORE-RC",
  };
  const created = JSON.parse(
    (
      await check("Create retained record", "/api/alumni", 201, {
        method: "POST",
        body: createBody,
        cookie,
      })
    ).text,
  );
  const path = "/api/alumni/" + created._id;
  const retained = JSON.parse(
    (
      await check("Save retained edit", path, 200, {
        method: "PUT",
        body: { ...createBody, city: "Retained QA City" },
        cookie,
      })
    ).text,
  );
  const editedSeed = JSON.parse(
    (
      await check("Edit existing seed profile", seedPath, 200, {
        method: "PUT",
        body: { ...fieldsOf(seed), city: "Updated Seed QA City" },
        cookie,
      })
    ).text,
  );
  const backupAt = new Date().toISOString();
  const backupStart = performance.now();
  const snapshot = {
    records: await records(source),
    indexes: await indexes(source),
  };
  assert.equal(snapshot.records.length, 21);
  const backup = EJSON.stringify(snapshot, { relaxed: false });
  await writeFile(evidencePath(backupFile), backup);
  evidence.backup = {
    at: backupAt,
    records: snapshot.records.length,
    indexes: snapshot.indexes.map((item) => item.name),
    bytes: Buffer.byteLength(backup),
    sha256: digest(backup),
    exportMs: Math.round(performance.now() - backupStart),
  };
  await check("Later edit after snapshot", path, 200, {
    method: "PUT",
    body: { ...createBody, city: "Post-backup QA City" },
    cookie,
  });
  const logout = await check("Sign out", "/api/logout", 200, {
    method: "POST",
    cookie,
  });
  evidence.tls.logoutClearsCookie = /; Max-Age=0/i.test(
    logout.headers["set-cookie"],
  );
  await check("Logged-out session rejected", "/api/session", 401, { cookie });
  const priorRestart = (await login()).cookie;
  await closeCandidate();

  const recoveryStart = performance.now();
  const target = await openCandidate();
  evidence.restoreUrl = candidate.url;
  assert.equal(await target.countDocuments(), 20);
  assert.equal(await target.findOne({ _id: created._id }), null);
  const saved = await readFile(evidencePath(backupFile));
  assert.equal(digest(saved), evidence.backup.sha256);
  const data = EJSON.parse(saved.toString());
  const applyStart = performance.now();
  await target.bulkWrite(
    data.records.map((record) => ({
      replaceOne: {
        filter: { _id: record._id },
        replacement: record,
        upsert: true,
      },
    })),
  );
  const applyMs = Math.round(performance.now() - applyStart);
  assert.deepEqual(await records(target), data.records);
  assert.deepEqual(await indexes(target), data.indexes);
  await check(
    "Pre-restart session rejected after recovery",
    "/api/session",
    401,
    { cookie: priorRestart },
  );
  const after = await login();
  const restored = JSON.parse(
    (
      await check("Reopen retained profile", path, 200, {
        cookie: after.cookie,
      })
    ).text,
  );
  const restoredSeed = JSON.parse(
    (
      await check("Reopen edited seed", seedPath, 200, {
        cookie: after.cookie,
      })
    ).text,
  );
  assert.deepEqual(restored, retained);
  assert.deepEqual(restoredSeed, editedSeed);
  await check(
    "Restored unique constraints reject duplicate",
    "/api/alumni",
    409,
    {
      method: "POST",
      body: createBody,
      cookie: after.cookie,
    },
  );
  evidence.restore = {
    recoveredRecords: data.records.length,
    allDocumentsMatch: true,
    indexesMatch: true,
    applyMs,
    relaunchThroughVerificationMs: Math.round(
      performance.now() - recoveryStart,
    ),
    retained: {
      id: restored._id,
      city: restored.city,
      createdAt: restored.createdAt,
      modifiedAt: restored.modifiedAt,
    },
    existing: {
      id: restoredSeed._id,
      city: restoredSeed.city,
      modifiedAt: restoredSeed.modifiedAt,
    },
    laterEditExcluded: restored.city !== "Post-backup QA City",
  };
  console.log(
    JSON.stringify(
      { tls: evidence.tls, backup: evidence.backup, restore: evidence.restore },
      null,
      2,
    ),
  );
} catch (error) {
  evidence.error = error.message;
  throw error;
} finally {
  try {
    await writeFile(
      evidencePath("exact-https-recovery.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
  } finally {
    await closeCandidate();
  }
}
