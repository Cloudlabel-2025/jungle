import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomBytes, X509Certificate } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
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
await mkdir(resolve(".data/sprint4-trusted-origin-rc"), { recursive: true });
const directory = await mkdtemp(
  resolve(".data/sprint4-trusted-origin-rc/cc-session-"),
);
if (process.platform === "win32") {
  const sid = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    ],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  assert.match(sid, /^S-1-[\d-]+$/);
  execFileSync(
    "icacls.exe",
    [directory, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`],
    { windowsHide: true },
  );
}
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

const serverListen = Server.prototype.listen;
let server;
Server.prototype.listen = function (...args) {
  server = this;
  return serverListen.apply(this, args);
};
let app;
let agent;
let trustAttempted = false;
const cleanup = async () => {
  try {
    if (trustAttempted) {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$s=[System.Security.Cryptography.X509Certificates.X509Store]::new('Root','CurrentUser'); try{$s.Open('ReadWrite'); foreach($c in $s.Certificates.Find('FindByThumbprint','" +
            thumbprint +
            "',$false)){$s.Remove($c)}; if($s.Certificates.Find('FindByThumbprint','" +
            thumbprint +
            "',$false).Count){exit 1}}finally{$s.Close()}",
        ],
        { windowsHide: true },
      );
    }
  } finally {
    agent?.destroy();
    if (app) await app.close();
    for (const path of [
      rootKey,
      rootCert,
      keyFile,
      certFile,
      csr,
      ext,
      credentialsFile,
    ])
      await rm(path, { force: true });
    await rmdir(directory);
  }
};
const thumbprint = new X509Certificate(ca).fingerprint.replaceAll(":", "");
const credentialsFile = resolve(directory, "session-accounts.json");
const identities = [
  { slot: "A", card: "UAT-01", role: "admin" },
  { slot: "B", card: "UAT-02", role: "admin" },
  { slot: "C", card: "UAT-03", role: "admin" },
  { slot: "D", card: "UAT-04", role: "alumnus", alumniId: "AL-QA-001" },
  { slot: "E", card: "UAT-05", role: "admin" },
];
try {
  try {
    app = await start(3193, { tls });
  } finally {
    Server.prototype.listen = serverListen;
  }
  assert.ok(server);
  const accounts = identities.map(({ slot, card, ...role }) => ({
    ...role,
    email: "uat-" + slot.toLowerCase() + "@example.invalid",
    password: randomBytes(18).toString("base64url"),
  }));
  app.accounts.push(...accounts);
  agent = new Agent();
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
  const send = (path, { method = "GET", body, cookie } = {}) =>
    new Promise((resolve, reject) => {
      const req = request(
        app.url + path,
        {
          method,
          agent,
          headers: {
            ...(body && {
              "Content-Type": "application/json",
              Origin: app.url,
            }),
            ...(cookie && { Cookie: cookie }),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: JSON.parse(Buffer.concat(chunks).toString()),
            }),
          );
        },
      );
      req.on("error", reject);
      req.setTimeout(8000, () =>
        req.destroy(new Error("Session account check timed out")),
      );
      req.end(body && JSON.stringify(body));
    });
  const tested = [];
  for (const [index, account] of accounts.entries()) {
    const login = await send("/api/login", { method: "POST", body: account });
    assert.equal(login.status, 200);
    assert.equal(login.data.role, account.role);
    assert.match(login.headers["set-cookie"][0], /; Secure(?:;|$)/);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    const directory = await send("/api/alumni", { cookie });
    assert.equal(directory.status, account.role === "admin" ? 200 : 403);
    if (account.role === "admin") assert.equal(directory.data.length, 20);
    else
      assert.equal(
        (await send("/api/alumni/" + account.alumniId, { cookie })).data._id,
        account.alumniId,
      );
    assert.equal(
      (await send("/api/logout", { method: "POST", body: {}, cookie })).status,
      200,
    );
    tested.push({
      ...identities[index],
      username: account.email,
      signIn: login.status,
      directory: directory.status,
    });
  }
  await writeFile(
    credentialsFile,
    JSON.stringify(
      accounts.map((account, index) => ({ ...identities[index], ...account })),
      null,
      2,
    ) + "\n",
    { mode: 0o600, flag: "wx" },
  );
  const maxHours = 4;
  const startedAt = new Date();
  const stopAt = new Date(+startedAt + maxHours * 3600000);
  const state = {
    url: app.url,
    candidateSha256: release.candidateSha256,
    startedAt,
    stopAt,
    accounts: tested,
  };
  await writeFile(
    new URL("cc-localhost-preflight.json", import.meta.url),
    JSON.stringify(state, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ ...state, credentialsFile, publicCaPath: rootCert }),
  );
  if (process.argv.includes("--windows-trust")) {
    trustAttempted = true;
    const command =
      "$ErrorActionPreference='Stop'; $c=[System.Security.Cryptography.X509Certificates.X509Certificate2]::new($env:CODEWILD_QA_CA_PATH); if($c.Thumbprint -ne '" +
      thumbprint +
      "' -or $c.Subject -ne 'CN=CODEWILD Isolated HTTPS QA' -or $c.NotAfter -gt (Get-Date).AddHours(25) -or !($c.Extensions | Where-Object {$_.Oid.Value -eq '2.5.29.30' -and $_.Critical})){throw 'Unexpected QA CA'}; $s=[System.Security.Cryptography.X509Certificates.X509Store]::new('Root','CurrentUser'); try{$s.Open('ReadWrite'); if($s.Certificates.Find('FindByThumbprint',$c.Thumbprint,$false).Count){throw 'Test CA already present'}; $s.Add($c); if(!$s.Certificates.Find('FindByThumbprint',$c.Thumbprint,$false).Count){throw 'Trust not installed'}}finally{$s.Close()}";
    execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
      env: { ...process.env, CODEWILD_QA_CA_PATH: rootCert },
      stdio: "inherit",
      windowsHide: true,
    });
    const { stdout: health } = await promisify(execFile)(
      "curl.exe",
      [
        "--noproxy",
        "*",
        "--silent",
        "--show-error",
        "--fail",
        "--max-time",
        "5",
        app.url + "/health",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(JSON.parse(health).status, "ready");
    state.windowsHttpsHealth = "ready";
    await writeFile(
      new URL("cc-localhost-preflight.json", import.meta.url),
      JSON.stringify(state, null, 2) + "\n",
    );
    console.log("Windows-trusted HTTPS health verified.");
  }
  await new Promise((done) => {
    const timer = setTimeout(done, maxHours * 3600000);
    const stop = () => {
      clearTimeout(timer);
      done();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
} finally {
  await cleanup();
}
