import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Agent, Server, request } from "node:https";
import { duplexPair } from "node:stream";
import { connect } from "node:tls";
import { resolve } from "node:path";
import { start } from "./source/sprint2-staging/staging.mjs";

const read = (name) => readFile(new URL(name, import.meta.url));
const release = JSON.parse(await read("release.json"));
const fingerprint = createHash("sha256");
for (const [name, expected] of Object.entries(release.sourceFiles)) {
  const bytes = await read("source/sprint2-staging/" + name);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  fingerprint.update(name).update("\0").update(bytes).update("\0");
}
assert.equal(fingerprint.digest("hex"), release.candidateSha256);
const directory = resolve(".data/sprint4-https-rc");
await mkdir(directory, { recursive: true });
const [rootKey, rootCert, keyFile, certFile, csr, ext] = [
  "ca-key.pem",
  "ca.pem",
  "key.pem",
  "cert.pem",
  "leaf.csr",
  "leaf.cnf",
].map((name) => resolve(directory, name));
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
  "/CN=CODEWILD Isolated HTTPS QA",
  "-addext",
  "basicConstraints=critical,CA:TRUE,pathlen:0",
  "-addext",
  "keyUsage=critical,keyCertSign,cRLSign",
  "-addext",
  "nameConstraints=critical,permitted;IP:127.0.0.1/255.255.255.255,permitted;DNS:localhost",
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
  ext,
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
  ext,
]);
openssl(["verify", "-CAfile", rootCert, certFile]);
const ca = await readFile(rootCert);
const tls = { key: await readFile(keyFile), cert: await readFile(certFile) };
let server;
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  server = this;
  return listen.apply(this, args);
};
let app;
const browserPort = process.argv.includes("--fresh-browser-url") ? 3192 : 3191;
try {
  app = await start(browserPort, { tls });
} finally {
  Server.prototype.listen = listen;
}
assert.ok(server);
const evidence = {
  candidateSha256: release.candidateSha256,
  startedAt: new Date().toISOString(),
  url: app.url,
  checks: [],
};
const agent = new Agent();
agent.createConnection = () => {
  const [client, peer] = duplexPair();
  server.emit("connection", peer);
  return connect({
    socket: client,
    servername: "localhost",
    ca,
    rejectUnauthorized: true,
  });
};
const send = (path, { method = "GET", origin, body, cookie, direct } = {}) =>
  new Promise((resolve, reject) => {
    const req = request(
      app.url + path,
      {
        method,
        ca,
        rejectUnauthorized: true,
        agent: direct ? false : agent,
        headers: {
          ...(body && { "Content-Type": "application/json" }),
          ...(origin && { Origin: origin }),
          ...(cookie && { Cookie: cookie }),
        },
      },
      (res) => {
        const tls = {
          authorized: res.socket.authorized,
          protocol: res.socket.getProtocol(),
        };
        res.resume();
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, tls }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Request timeout")));
    req.end(body && JSON.stringify(body));
  });
async function check(name, path, expected, options) {
  const response = await send(path, options);
  assert.equal(response.tls.authorized, true);
  evidence.checks.push({ name, expected, actual: response.status });
  assert.equal(response.status, expected, name);
  return response;
}
try {
  try {
    const direct = await send("/health", { direct: true });
    evidence.directTcp = { status: direct.status, ...direct.tls };
  } catch (error) {
    evidence.directTcp = { error: error.code || error.message };
  }
  const health = await check("Validated TLS health", "/health", 200);
  evidence.tls = health.tls;
  const body = app.accounts[0];
  await check("Foreign HTTPS Origin denied", "/api/login", 403, {
    method: "POST",
    origin: "https://unrelated.example.invalid",
    body,
  });
  const login = await check(
    "Exact same-origin HTTPS sign-in",
    "/api/login",
    200,
    { method: "POST", origin: app.url, body },
  );
  const header = login.headers["set-cookie"][0];
  const attributes = header.split("; ").slice(1);
  for (const attribute of [
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=3600",
  ])
    assert.ok(attributes.includes(attribute), attribute);
  evidence.cookieAttributes = attributes;
  const cookie = header.split(";")[0];
  const session = await check("Session after login", "/api/session", 200, {
    cookie,
  });
  assert.equal(session.headers["cache-control"], "no-store");
  evidence.sessionCacheControl = session.headers["cache-control"];
  const logout = await check("Same-origin HTTPS sign-out", "/api/logout", 200, {
    method: "POST",
    origin: app.url,
    cookie,
  });
  evidence.logoutCookieAttributes = logout.headers["set-cookie"][0]
    .split("; ")
    .slice(1);
  assert.ok(
    evidence.logoutCookieAttributes.includes("Secure") &&
      evidence.logoutCookieAttributes.includes("Max-Age=0"),
  );
  await check("Signed-out session rejected", "/api/session", 401, { cookie });
  await writeFile(
    new URL("https-evidence.json", import.meta.url),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
  if (process.argv.includes("--browser")) {
    if (process.argv.includes("--fresh-browser-url")) {
      const browserRequests = [];
      server.on("request", (req, res) => {
        if (!req.headers["sec-fetch-site"]) return;
        res.once("finish", () => {
          const cookie = res.getHeader("set-cookie");
          browserRequests.push({
            path: req.url,
            method: req.method,
            status: res.statusCode,
            origin: req.headers.origin,
            fetchSite: req.headers["sec-fetch-site"],
            cookieSent: Boolean(req.headers.cookie),
            responseCookieAttributes:
              typeof cookie === "string"
                ? cookie.split("; ").slice(1)
                : undefined,
          });
          void writeFile(
            new URL("browser-https-requests.json", import.meta.url),
            JSON.stringify(
              { candidateSha256: release.candidateSha256, browserRequests },
              null,
              2,
            ) + "\n",
          );
        });
      });
    }
    console.log(
      "Disposable browser credentials",
      app.url,
      JSON.stringify(body),
    );
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} finally {
  agent.destroy();
  await app.close();
}
