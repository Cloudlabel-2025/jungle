import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { Agent, createServer, request as httpsRequest } from "node:https";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { duplexPair } from "node:stream";
import { connect as tlsConnect, createSecureContext } from "node:tls";
import { promisify } from "node:util";
import { EJSON } from "bson";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { start } from "../source/sprint2-staging/staging.mjs";
import { fields } from "../source/sprint2-staging/fields.mjs";

const read = (file) => readFile(new URL(file, import.meta.url));
const release = JSON.parse(await read("../release.json"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hash = createHash("sha256");
for (const [name, expected] of Object.entries(release.sourceFiles)) {
  const bytes = await read("../source/sprint2-staging/" + name);
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
const ephemeral = await mkdtemp(join(tmpdir(), "cw-rc-tls-"));
let candidate;
let proxy;
let db;
let ca;
let secureContext;
let agent;
let mapOrigin = false;
let base;
const httpOnlyRun = process.argv.includes("--http-recovery");
const backupFile = httpOnlyRun
  ? "retained-backup-http.ejson"
  : "retained-backup.ejson";

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
    candidate = await start();
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

async function openProxy(key, cert) {
  const serverContext = createSecureContext({ key, cert });
  proxy = createServer(
    {
      key,
      cert,
      minVersion: "TLSv1.2",
      SNICallback: (_name, callback) => callback(null, serverContext),
    },
    async (req, res) => {
      try {
        const url = new URL(candidate.url);
        const incoming = new URL(req.url, base);
        url.pathname = incoming.pathname;
        url.search = incoming.search;
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const headers = {};
        for (const header of ["content-type", "cookie", "origin"]) {
          if (req.headers[header]) headers[header] = req.headers[header];
        }
        if (mapOrigin && headers.origin === base)
          headers.origin = candidate.url;
        const reply = await fetch(url, {
          method: req.method,
          headers,
          signal: AbortSignal.timeout(5000),
          ...(chunks.length && { body: Buffer.concat(chunks) }),
        });
        res.writeHead(reply.status, Object.fromEntries(reply.headers));
        res.end(Buffer.from(await reply.arrayBuffer()));
      } catch {
        res.writeHead(502).end();
      }
    },
  );
  await new Promise((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(3190, "127.0.0.1", resolve);
  });
  proxy.on("tlsClientError", (error) => {
    (evidence.tls.gatewayHandshakeErrors ||= []).push(
      error.code || error.message,
    );
  });
  base = "https://127.0.0.1:" + proxy.address().port;
}

function request(path, { method = "GET", body, cookie, origin } = {}) {
  return new Promise((resolve, reject) => {
    const encoded = body && JSON.stringify(body);
    const req = (httpOnlyRun ? httpRequest : httpsRequest)(
      (httpOnlyRun ? candidate.url : base) + path,
      {
        method,
        agent,
        headers: {
          ...(encoded && { "Content-Type": "application/json" }),
          ...(cookie && { Cookie: cookie }),
          ...(origin && { Origin: origin }),
        },
      },
      (res) => {
        const tls = httpOnlyRun
          ? undefined
          : {
              protocol: res.socket.getProtocol(),
              authorized: res.socket.authorized,
              certificateFingerprint256:
                res.socket.getPeerCertificate().fingerprint256,
            };
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            tls,
            text: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(8000, () =>
      req.destroy(new Error("HTTPS request timed out")),
    );
    req.end(encoded);
  });
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
    origin: httpOnlyRun ? candidate.url : base,
  });
  assert.equal(Object.hasOwn(JSON.parse(result.text), "password"), false);
  const header = result.headers["set-cookie"][0];
  return { cookie: header.split(";")[0], header };
}

const records = (collection) => collection.find().sort({ _id: 1 }).toArray();
const indexes = (collection) => collection.indexes();

try {
  const source = await openCandidate();
  if (httpOnlyRun) {
    evidence.tls = { status: "Not exercised by the HTTP recovery run" };
  } else {
    const keyFile = join(ephemeral, "key.pem");
    const certFile = join(ephemeral, "cert.pem");
    const rootKey = join(ephemeral, "ca-key.pem");
    const rootCert = join(ephemeral, "ca.pem");
    const csr = join(ephemeral, "leaf.csr");
    const extensions = join(ephemeral, "leaf.cnf");
    const openssl = (args) =>
      execFileSync(process.argv[2] || "openssl", args, {
        stdio: "ignore",
        windowsHide: true,
      });
    openssl([
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      rootKey,
      "-out",
      rootCert,
      "-days",
      "1",
      "-subj",
      "/CN=CODEWILD Disposable QA CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ]);
    openssl([
      "req",
      "-new",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyFile,
      "-out",
      csr,
      "-subj",
      "/CN=127.0.0.1",
    ]);
    await writeFile(
      extensions,
      "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n",
    );
    openssl([
      "x509",
      "-req",
      "-in",
      csr,
      "-CA",
      rootCert,
      "-CAkey",
      rootKey,
      "-set_serial",
      "1",
      "-out",
      certFile,
      "-days",
      "1",
      "-extfile",
      extensions,
    ]);
    ca = await readFile(rootCert);
    const cert = await readFile(certFile);
    const root = new X509Certificate(ca);
    const leaf = new X509Certificate(cert);
    assert.ok(
      root.ca && leaf.verify(root.publicKey) && leaf.checkIP("127.0.0.1"),
    );
    evidence.tls.generatedChain = {
      rootSubject: root.subject,
      leafIssuer: leaf.issuer,
      leafFingerprint256: leaf.fingerprint256,
      offlineVerification: openssl(["verify", "-CAfile", rootCert, certFile])
        ?.toString()
        .trim(),
    };
    secureContext = createSecureContext({ ca });
    await openProxy(await readFile(keyFile), Buffer.concat([cert, ca]));
    const curl = promisify(execFile);
    try {
      const probe = await curl(
        "curl.exe",
        [
          "--noproxy",
          "*",
          "--cacert",
          rootCert,
          "--fail",
          "--silent",
          "--show-error",
          "--max-time",
          "5",
          base + "/health",
        ],
        { windowsHide: true },
      );
      evidence.tls.curlProbe = JSON.parse(probe.stdout);
    } catch (error) {
      evidence.tls.curlProbeError = error.stderr?.trim() || error.message;
    }
    agent = new Agent({ keepAlive: false });
    agent.createConnection = () => {
      const [client, server] = duplexPair();
      proxy.emit("connection", server);
      return tlsConnect({
        socket: client,
        servername: "localhost",
        secureContext,
        rejectUnauthorized: true,
      });
    };
    const health = await check(
      "Health over certificate-verified HTTPS",
      "/health",
      200,
    );
    assert.equal(health.tls.authorized, true);
    evidence.tls = {
      ...evidence.tls,
      ...health.tls,
      loopbackUrl: base,
      trust: "Ephemeral QA CA explicitly trusted by test client",
      transport:
        "In-process TLS socket pair at the gateway; HTTP loopback upstream",
      setCookieRewritten: false,
    };
    const html = await check("Candidate HTML over HTTPS", "/", 200);
    evidence.tls.htmlCspPresent = !!html.headers["content-security-policy"];
    const native = await request("/api/login", {
      method: "POST",
      body: candidate.accounts[0],
      origin: httpOnlyRun ? candidate.url : base,
    });
    evidence.tls.sameOriginLoginWithOriginPreserved = native.status;
    evidence.tls.originMapping =
      "For the remaining checks, exact gateway Origin mapped to the pinned loopback backend Origin. Other origins and Set-Cookie pass through.";
    mapOrigin = true;
    await check("Foreign-origin sign-in rejected", "/api/login", 403, {
      method: "POST",
      body: candidate.accounts[0],
      origin: "https://unrelated.example.invalid",
    });
  }
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
        origin: httpOnlyRun ? candidate.url : base,
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
        origin: httpOnlyRun ? candidate.url : base,
      })
    ).text,
  );
  const editedSeed = JSON.parse(
    (
      await check("Edit existing seed profile", seedPath, 200, {
        method: "PUT",
        body: { ...fieldsOf(seed), city: "Updated Seed QA City" },
        cookie,
        origin: httpOnlyRun ? candidate.url : base,
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
  await writeFile(new URL(backupFile, import.meta.url), backup);
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
    origin: httpOnlyRun ? candidate.url : base,
  });
  const logout = await check("Sign out", "/api/logout", 200, {
    method: "POST",
    cookie,
    origin: httpOnlyRun ? candidate.url : base,
  });
  evidence.tls.logoutClearsCookie = /; Max-Age=0/i.test(
    logout.headers["set-cookie"][0],
  );
  await check("Logged-out session rejected", "/api/session", 401, { cookie });
  const priorRestart = (await login()).cookie;
  await closeCandidate();

  const recoveryStart = performance.now();
  const target = await openCandidate();
  assert.equal(await target.countDocuments(), 20);
  assert.equal(await target.findOne({ _id: created._id }), null);
  const saved = await read(backupFile);
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
      origin: httpOnlyRun ? candidate.url : base,
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
  await writeFile(
    new URL(
      httpOnlyRun ? "recovery-http.json" : "evidence.json",
      import.meta.url,
    ),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  if (proxy) await new Promise((resolve) => proxy.close(resolve));
  agent?.destroy();
  await closeCandidate();
  for (const name of [
    "key.pem",
    "cert.pem",
    "ca-key.pem",
    "ca.pem",
    "leaf.csr",
    "leaf.cnf",
  ])
    await rm(join(ephemeral, name), { force: true });
  await rmdir(ephemeral);
}
