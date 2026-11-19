// Synthetic portal acceptance; never loads .env.local into the test process.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { request as httpRequest } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { platformModels } from "../lib/platform-auth.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { provisionCollege } from "../lib/college-admin.js";
import { contextForCollege, closeCollegeConnections } from "../lib/college-registry.js";
import { requestAccountRecovery, deliverRecoveryMail } from "../lib/password-recovery.js";

const replica = await MongoMemoryReplSet.create({ binary: { version: "7.0.24" }, replSet: { count: 1 } });
const base = "http://127.0.0.1:3195", password = "Portal-password-123";
const [playwrightRoot, chromePath] = process.argv.slice(2);
let server, browser, output = "", checks = 0;
try {
  for (const key of Object.keys(process.env)) if (key.startsWith("SMTP_")) delete process.env[key];
  Object.assign(process.env, { MONGODB_URI: replica.getUri("portal_source"), MASTER_MONGODB_URI: replica.getUri("portal_source"), TENANT_MONGODB_URI: replica.getUri("portal_source"),
    MASTER_DB_NAME: `pt_${randomUUID().replaceAll("-", "")}`, TENANCY_ENABLED: "true", SESSION_SECRET: "portal-fixture-secret-longer-than-32-characters",
    COLLEGE_ROOT_DOMAIN: "", ROOT_DOMAIN: "", CMS_PUBLIC_ORIGIN: "https://portals.example", CMS_EMAIL_FROM: "sender@portals.example" });
  const { PlatformAdmin } = await platformModels();
  await PlatformAdmin.create({ _id: "owner", name: "Owner", email: "owner@portals.example", mustChangePassword: false, passwordHash: await hashPassword(password) });
  const colleges = [], contexts = [];
  for (const [slug, name] of [["college-for-test", "College for test"], ["beta-college", "Beta College"]]) {
    const college = await provisionCollege({ name, slug, adminName: "College CC", email: "cc@portals.example", username: "staff", password, startDate: "2027-01-04" }, "owner");
    colleges.push(college);
    const context = await contextForCollege({ _id: college.id }); contexts.push(context);
    await context.models.Team.create({ _id: "same-team", cohortId: "alpha", name: `${name} team`, code: "ONE", commanderId: "same-mc" });
    await context.models.User.create([{ _id: "same-mc", name: `${name} MC`, email: "mc@portals.example", role: "MISSION_COMMANDER", cohortId: "alpha" },
      { _id: "same-player", name: `${name} Player`, email: "player@portals.example", username: "player", role: "GAMER", cohortId: "alpha", teamId: "same-team", characterKey: "blaze", characterVariant: "male" }]);
    await context.models.Credential.create([{ _id: "same-mc", passwordHash: await hashPassword(password) }, { _id: "same-player", passwordHash: await hashPassword(password) }]);
    // Portal routing fixtures have completed their initial password setup.
    await context.models.Credential.updateMany({}, { $set: { mustChangePassword: false } });
    await context.connection.db.collection("portal_history").insertOne({ _id: "same-history", result: 91, college: name, bytes: Buffer.from("preserved evidence") });
  }
  const digest = async context => createHash("sha256").update(mongoose.mongo.BSON.serialize(await context.connection.db.collection("portal_history").findOne())).digest("hex");
  const historyBefore = await Promise.all(contexts.map(digest));
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "-p", "3195"], {
    env: { ...process.env, APP_ORIGIN: base, DEMO_MODE: "false", BLOB_READ_WRITE_TOKEN: "", SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_TENANT_ID: "", SMTP_CLIENT_ID: "", SMTP_CLIENT_SECRET: "" }, windowsHide: true });
  server.stdout.on("data", bytes => output += bytes); server.stderr.on("data", bytes => output += bytes);
  let ready = false;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.ok(ready, output);
  const hostFor = index => `${colleges[index].slug}.localhost:3195`;
  async function request(path, { host, cookie, body, status = 200, origin, extra = {} } = {}) {
    // Native HTTP preserves Host; fetch can normalize it to the connection URL.
    const { response, text } = await new Promise((resolve, reject) => {
      const req = httpRequest(base + path, { method: body ? "POST" : "GET", headers: {
        ...(host ? { Host: host } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json", Origin: origin || (host ? `http://${host}` : base) } : {}), ...extra } }, res => {
        let text = ""; res.setEncoding("utf8"); res.on("data", chunk => text += chunk);
        res.on("end", () => { const headers = new Headers(); for (const [key,value] of Object.entries(res.headers)) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key,item); resolve({ response: { status: res.statusCode, headers }, text }); });
      });
      req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined);
    });
    assert.equal(response.status, status, `${path}: ${text.slice(0,200)}`); checks++;
    return { response, text, json: () => JSON.parse(text) };
  }
  assert.equal(new URL((await request("/", { status: 307 })).response.headers.get("location"), base).pathname, "/platform");
  for (let i = 0; i < 2; i++) {
    await request("/", { host: hostFor(i), status: 307 });
    const loginPage = await request("/gamer/dashboard", { host: hostFor(i) });
    assert.ok(loginPage.text.includes(colleges[i].name), `Login page must display ${colleges[i].name} on ${hostFor(i)}`);
    assert.ok(!loginPage.text.includes('role="combobox"'));
  }
  const root = await request("/api/platform/auth/login", { body: { email: "owner@portals.example", password } });
  const rootCookie = root.response.headers.get("set-cookie").split(";")[0];
  const detail = (await request(`/api/platform/colleges/${colleges[0].id}`, { cookie: rootCookie })).json();
  assert.equal(detail.college.loginUrl, `http://${hostFor(0)}/`);
  await request("/api/platform/colleges", { host: hostFor(0), cookie: rootCookie, status: 403 });
  await request("/api/platform/auth/login", { host: hostFor(0), body: { email: "owner@portals.example", password }, status: 403 });
  assert.equal((await request("/platform", { host: hostFor(0), status: 307 })).response.headers.get("location"), "http://localhost:3195/platform");
  for (let i = 0; i < 2; i++) for (const identifier of ["staff", "mc@portals.example", "player"]) {
    const login = await request("/api/auth/login", { host: hostFor(i), body: { identifier, password } });
    assert.equal(login.json().user.collegeId, colleges[i].id);
    const cookie = login.response.headers.get("set-cookie").split(";")[0];
    const me = (await request("/api/auth/me", { host: hostFor(i), cookie })).json();
    assert.equal(me.user.collegeId, colleges[i].id);
    await request("/api/auth/me", { host: hostFor(1-i), cookie, status: 409 });
    const spoof = (await request("/api/auth/me", { host: hostFor(i), cookie, extra: { "x-vow-college-entry": colleges[1-i].slug } })).json();
    assert.equal(spoof.user.collegeId, colleges[i].id);
  }
  await request("/api/auth/login", { host: hostFor(0), body: { identifier: "staff", password, collegeId: colleges[1].id }, status: 403 });
  await request("/api/auth/login", { host: hostFor(0), body: { identifier: "staff", password }, origin: `http://${hostFor(1)}`, status: 403 });
  await request("/api/recovery/request", { host: hostFor(0), body: { realm: "college", identifier: "player", collegeId: colleges[1].id }, status: 403 });
  const fallback = await request(`/c/${colleges[0].slug}`);
  assert.ok(fallback.response.headers.get("set-cookie").includes("HttpOnly"));
  const fallbackCookie = fallback.response.headers.get("set-cookie").split(";")[0];
  await request("/api/auth/login", { cookie: fallbackCookie, body: { identifier: "staff", password, collegeId: colleges[1].id }, status: 403 });
  if (playwrightRoot) {
    const { chromium } = createRequire(resolve(playwrightRoot,"package.json"))("playwright");
    browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), errors = [];
    const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
    await page.goto(base + "/");
    await page.getByRole("heading", { name: "Super admin sign-in", exact: true }).waitFor();
    await page.goto(`http://${hostFor(0)}/`);
    await page.getByText("College for test", { exact: true }).waitFor();
    assert.equal(await page.getByRole("combobox").count(), 0);
    await mkdir(".data/portal-qa", { recursive: true });
    await page.screenshot({ path: ".data/portal-qa/college-login-desktop.png", fullPage: true });
    await page.getByLabel("Username or email", { exact: true }).fill("staff");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`http://${hostFor(0)}/centre-command/dashboard`);
    await page.getByRole("link", { name: "Manage college", exact: false }).waitFor();
    assert.equal((await page.evaluate(() => fetch('/api/auth/me').then(r=>r.json()))).user.collegeId,colleges[0].id);
    const beta = await context.newPage(); beta.on("pageerror", e => errors.push(e.message));
    await beta.goto(`http://${hostFor(1)}/`);
    await beta.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    await beta.getByLabel("Username or email", { exact: true }).fill("staff");
    await beta.getByLabel("Password", { exact: true }).fill(password);
    await beta.getByRole("button", { name: "Sign in", exact: true }).click();
    await beta.waitForURL(`http://${hostFor(1)}/centre-command/dashboard`);
    await beta.getByRole("link", { name: "Manage college", exact: false }).waitFor();
    assert.equal((await beta.evaluate(() => fetch('/api/auth/me').then(r=>r.json()))).user.collegeId,colleges[1].id);
    assert.equal((await page.evaluate(() => fetch('/api/auth/me').then(r=>r.json()))).user.collegeId,colleges[0].id, 'host-only cookies support independent college tabs');
    const pathContext = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const pathPage = await pathContext.newPage(); pathPage.on("pageerror", e => errors.push(e.message));
    await pathPage.goto(`${base}/c/${colleges[0].slug}`);
    await pathPage.getByText("College for test", { exact: true }).waitFor();
    assert.equal(await pathPage.getByRole("combobox").count(), 0);
    await pathPage.screenshot({path:'.data/portal-qa/college-login-mobile.png',fullPage:true});
    const recovery = await requestAccountRecovery("owner", { realm: "college", collegeId: colleges[0].id, userId: "same-player", replace: true });
    let message; await deliverRecoveryMail(recovery.id, { send: async mail => { message = mail; } });
    const link = new URL(message.text.match(/https:\/\/\S+\/recover\?\S+/)[0]);
    assert.equal(link.pathname, `/c/${colleges[0].slug}/recover`);
    const token = link.hash.slice(7);
    await request('/api/recovery/reset',{host:hostFor(1),body:{token,password:'Wrong-college-password-123'},status:400});
    await pathPage.goto(`${base}${link.pathname}${link.search}${link.hash}`);
    await pathPage.getByLabel("New password", { exact: true }).fill("Recovered-player-password-123");
    await pathPage.getByLabel("Confirm new password", { exact: true }).fill("Recovered-player-password-123");
    await pathPage.getByRole("button", { name: "Save new password", exact: true }).click();
    await pathPage.getByText("Password changed. Sign in with your new password.", { exact: true }).waitFor();
    assert.ok(await checkPassword("Recovered-player-password-123", (await contexts[0].models.Credential.findById("same-player")).passwordHash));
    assert.ok(await checkPassword(password, (await contexts[1].models.Credential.findById("same-player")).passwordHash));
    assert.deepEqual(errors, []); checks += 12;
    await pathContext.close(); await context.close();
    await writeFile('.data/portal-qa/result.json',JSON.stringify({passed:true,checks,browser:true,pageErrors:errors},null,2));
  }
  assert.deepEqual(await Promise.all(contexts.map(digest)), historyBefore);
  console.log(JSON.stringify({ passed: true, checks, browser: Boolean(playwrightRoot), collegeHosts:2, rolesPerCollege:3, historicalDataPreserved:true, syntheticOnly:true }));
} catch (error) {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) { await mkdir('.data/portal-qa',{recursive:true});await page.screenshot({path:'.data/portal-qa/failure.png',fullPage:true}); }
  }
  throw error;
} finally {
  if(browser)await browser.close();
  if(server && server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
  await closeCollegeConnections();await mongoose.disconnect();await replica.stop();
}
