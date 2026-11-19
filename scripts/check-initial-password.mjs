// Synthetic accounts only; never loads .env.local into this test process.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { platformModels } from "../lib/platform-auth.js";
import { provisionCollege } from "../lib/college-admin.js";
import { platformCohortCommand, platformTeamCommand } from "../lib/platform-management.js";
import { contextForCollege, closeCollegeConnections } from "../lib/college-registry.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { prefix } from "../lib/catalog.js";

const replica = await MongoMemoryReplSet.create({ binary: { version: "7.0.24" }, replSet: { count: 1 } });
const base = "http://127.0.0.1:3194", initial = "Initial8", [playwrightRoot, chromePath] = process.argv.slice(2);
let server, browser, output = "", checks = 0;
const roleResults = [];
const evidence = resolve(".data/initial-password-qa");
try {
  Object.assign(process.env, { MONGODB_URI: replica.getUri("initial_source"), MASTER_MONGODB_URI: replica.getUri("initial_source"), TENANT_MONGODB_URI: replica.getUri("initial_source"),
    MASTER_DB_NAME: `ip_${randomUUID().replaceAll("-", "")}`, TENANCY_ENABLED: "true", SESSION_SECRET: "initial-password-fixture-secret-longer-than-32", ROOT_DOMAIN: "", COLLEGE_ROOT_DOMAIN: "" });
  const { PlatformAdmin } = await platformModels();
  await PlatformAdmin.create({ _id: "owner", name: "Owner", email: "owner@password.example", passwordHash: await hashPassword(initial), mustChangePassword: false });
  const college = await provisionCollege({ name: "Initial College", slug: "initial-college", username: "staff", adminName: "College CC", email: "cc@password.example", password: initial, startDate: "2027-01-04" }, "owner");
  const other = await provisionCollege({ name: "Other College", slug: "other-college", username: "staff", adminName: "Other CC", email: "cc@password.example", password: initial, startDate: "2027-01-04" }, "owner");
  const context = await contextForCollege({ _id: college.id }), otherContext = await contextForCollege({ _id: other.id });
  const guide = await platformCohortCommand("owner", college.id, "add-staff", { requestId: randomUUID(), cohortId: "alpha", name: "College MC", email: "mc@password.example", role: "MISSION_COMMANDER", password: initial });
  const team = await platformTeamCommand("owner", college.id, "create", { requestId: randomUUID(), cohortId: "alpha", name: "First Team", commanderId: guide.id });
  const player = await platformTeamCommand("owner", college.id, "add-member", { requestId: randomUUID(), cohortId: "alpha", teamId: team.id, member: { name: "College Player", username: "player", characterKey: "blaze", variant: "female", password: initial } });
  const cc = await context.models.User.findOne({ role: "CENTRE_COMMAND" }).lean();
  const accounts = [{ id: cc._id, identifier: "staff", role: "CENTRE_COMMAND" }, { id: guide.id, identifier: "mc@password.example", role: "MISSION_COMMANDER" }, { id: player.id, identifier: "player", role: "GAMER" }];
  for (const account of accounts) assert.equal((await context.models.Credential.findById(account.id).lean()).mustChangePassword, true, "production account creation marks the password as initial");
  // A pre-existing credential without the new field must also require setup.
  await context.models.Credential.updateOne({ _id: player.id }, { $unset: { mustChangePassword: "" } });
  await context.connection.db.collection("saved_history").insertOne({ _id: "history", marks: 93, bytes: Buffer.from("keep this evidence") });
  const historyBefore = mongoose.mongo.BSON.serialize(await context.connection.db.collection("saved_history").findOne());
  const otherBefore = mongoose.mongo.BSON.serialize(await otherContext.connection.db.collection("credentials").findOne());
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "-p", "3194"], { windowsHide: true, env: { ...process.env, APP_ORIGIN: base, DEMO_MODE: "false", SMTP_HOST: "", SMTP_CLIENT_ID: "", SMTP_CLIENT_SECRET: "", SMTP_TENANT_ID: "" } });
  server.stdout.on("data", chunk => output += chunk); server.stderr.on("data", chunk => output += chunk);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.ok(ready, output);
  async function request(path, { cookie, body, status = 200, origin = base, collegeId = college.id } = {}) {
    const response = await fetch(base + path, { method: body ? "POST" : "GET", redirect: "manual", headers: { ...(cookie ? { Cookie: cookie } : {}), "x-codewild-college": collegeId, ...(body ? { "Content-Type": "application/json", Origin: origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); assert.equal(response.status, status, `${path}: ${text.slice(0, 250)}`); checks++;
    return { response, json: JSON.parse(text) };
  }
  await request("/api/auth/password", { body: { newPassword: "Secret88", confirmPassword: "Secret88" }, status: 401 });
  if (playwrightRoot) {
    const { chromium } = createRequire(resolve(playwrightRoot, "package.json"))("playwright");
    browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });
    await mkdir(evidence, { recursive: true });
  }
  for (const [index, account] of accounts.entries()) {
    const login = await request("/api/auth/login", { body: { collegeId: college.id, identifier: account.identifier, password: initial } });
    assert.equal(login.json.user.mustChangePassword, true);
    const oldCookie = login.response.headers.get("set-cookie").split(";")[0];
    for (const path of ["/api/state", "/api/college-management/state", "/api/pilot", "/api/pilot/storage", "/api/pilot/marks", "/api/pilot/files/unknown"]) {
      assert.equal((await request(path, { cookie: oldCookie, status: 403, ...(path === "/api/pilot/storage" ? { body: {} } : {}) })).json.code, "PASSWORD_CHANGE_REQUIRED");
    }
    assert.equal((await request("/api/college-management/cohorts/alpha/guides", { cookie: oldCookie, body: { name: "Blocked creation", role: "MISSION_COMMANDER" }, status: 403 })).json.code, "PASSWORD_CHANGE_REQUIRED");
    await request("/api/auth/password", { cookie: oldCookie, body: { newPassword: "Final888", confirmPassword: "Final888" }, collegeId: other.id, status: 409 });
    await request("/api/auth/password", { cookie: oldCookie, body: { newPassword: "Final888", confirmPassword: "Final888" }, origin: "https://untrusted.example", status: 403 });
    await request("/api/auth/password", { cookie: oldCookie, body: { newPassword: "Short12", confirmPassword: "Short12" }, status: 400 });
    await request("/api/auth/password", { cookie: oldCookie, body: { newPassword: "Final888", confirmPassword: "Different8" }, status: 400 });
    await request("/api/auth/password", { cookie: oldCookie, body: { newPassword: initial, confirmPassword: initial }, status: 400 });
    const permanent = `Final8-${index}`;
    if (browser) {
      const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await browserContext.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${base}/c/initial-college`);
      await page.getByLabel("Username or email", { exact: true }).fill(account.identifier);
      await page.getByLabel("Password", { exact: true }).fill(initial);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("heading", { name: "Set your permanent password", exact: true }).waitFor();
      assert.equal(await page.getByRole("navigation", { name: "Workspace", exact: true }).count(), 0);
      const workspace = `/${prefix(account.role)}`;
      const protectedPages = [`${workspace}/dashboard`, `${workspace}/notifications`, `${workspace}/calendar`, `${workspace}/${account.role === "GAMER" ? "objectives" : "college-management"}`, "/college", account.role === "CENTRE_COMMAND" ? "/gamer/dashboard" : "/centre-command/dashboard"];
      for (const path of protectedPages) {
        await page.goto(base + path);
        await page.getByRole("heading", { name: "Set your permanent password", exact: true }).waitFor();
        assert.equal(await page.locator(".arena, #main-content").count(), 0, `${account.role} cannot render dashboard/workspace content at ${path}`);
        checks++;
      }
      await page.reload();
      await page.getByRole("heading", { name: "Set your permanent password", exact: true }).waitFor();
      assert.equal(await page.locator(".arena, #main-content").count(), 0, "refresh cannot bypass initial password setup");
      const blockedState = await page.evaluate(async () => { const response = await fetch("/api/state"); return { status: response.status, body: await response.json() }; });
      assert.equal(blockedState.status, 403);
      assert.equal(blockedState.body.code, "PASSWORD_CHANGE_REQUIRED", "API remains protected even without the client college header");
      checks += 2;
      await page.getByLabel("New password", { exact: true }).fill(permanent);
      await page.getByLabel("Confirm password", { exact: true }).fill("Different8");
      await page.getByRole("button", { name: "Confirm password", exact: true }).click();
      await page.getByText("The passwords do not match.", { exact: true }).waitFor();
      await page.getByLabel("Confirm password", { exact: true }).fill(permanent);
      await page.screenshot({ path: resolve(evidence, `${account.role}-setup.png`), fullPage: true });
      await Promise.all([page.waitForResponse(response => response.url().endsWith("/api/auth/password") && response.request().method() === "POST" && response.status() === 200), page.getByRole("button", { name: "Confirm password", exact: true }).click()]);
      await page.waitForURL(`${base}/${prefix(account.role)}/dashboard`);
      await page.locator(".vow-password-setup").waitFor({ state: "detached" });
      await page.locator('.arena #main-content[data-screen="dashboard"]').waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.querySelector(".arena")?.hasAttribute("inert"));
      await page.screenshot({ path: resolve(evidence, `${account.role}-dashboard.png`), fullPage: true });
      assert.deepEqual(errors, []);
      await page.reload();
      await page.locator('.arena #main-content[data-screen="dashboard"]').waitFor({ state: "visible" });
      assert.equal(await page.getByRole("heading", { name: "Set your permanent password", exact: true }).count(), 0);
      await browserContext.close(); checks += 7;
    } else await request("/api/auth/password", { cookie: oldCookie, body: { newPassword: permanent, confirmPassword: permanent } });
    await request("/api/auth/me", { cookie: oldCookie }).then(result => assert.equal(result.json.authenticated, false));
    await request("/api/state", { cookie: oldCookie, status: 401 });
    await request("/api/auth/login", { body: { collegeId: college.id, identifier: account.identifier, password: initial }, status: 401 });
    const finalLogin = await request("/api/auth/login", { body: { collegeId: college.id, identifier: account.identifier, password: permanent } });
    assert.equal(finalLogin.json.user.mustChangePassword, false);
    const credential = await context.models.Credential.findById(account.id).lean();
    assert.equal(credential.mustChangePassword, false); assert.ok(credential.passwordChangedAt);
    assert.ok(await checkPassword(permanent, credential.passwordHash));
    await request("/api/state", { cookie: finalLogin.response.headers.get("set-cookie").split(";")[0] });
    await request("/api/auth/password", { cookie: finalLogin.response.headers.get("set-cookie").split(";")[0], body: { newPassword: "Another8", confirmPassword: "Another8" }, status: 409 });
    roleResults.push({ role: account.role, dashboardBlockedBeforeSetup: Boolean(browser), protectedApisBlocked: true, permanentPasswordAccepted: true, oldPasswordRejected: true, oldSessionRevoked: true, dashboardAvailableAfterSetup: Boolean(browser) });
  }
  const racing = await platformCohortCommand("owner", college.id, "add-staff", { requestId: randomUUID(), cohortId: "alpha", name: "Concurrent MC", email: "concurrent@password.example", role: "MISSION_COMMANDER", password: initial });
  const raceLogin = await request("/api/auth/login", { body: { collegeId: college.id, identifier: "concurrent@password.example", password: initial } });
  const raceCookie = raceLogin.response.headers.get("set-cookie").split(";")[0];
  const races = await Promise.all(["Race8-11", "Race8-22"].map(newPassword => fetch(base + "/api/auth/password", { method: "POST", headers: { Cookie: raceCookie, "Content-Type": "application/json", Origin: base, "x-codewild-college": college.id }, body: JSON.stringify({ newPassword, confirmPassword: newPassword }) }).then(async response => { await response.text(); return response.status; })));
  assert.equal(races.filter(status => status === 200).length, 1);
  assert.ok(races.every(status => [200, 401, 409].includes(status)));
  assert.equal((await context.models.User.findById(racing.id).lean()).authVersion, 2); checks += 2;
  assert.deepEqual(mongoose.mongo.BSON.serialize(await context.connection.db.collection("saved_history").findOne()), historyBefore);
  assert.deepEqual(mongoose.mongo.BSON.serialize(await otherContext.connection.db.collection("credentials").findOne()), otherBefore);
  const events = await context.models.PlatformManagementEvent.find({ action: "INITIAL_PASSWORD_CHANGED" }).lean();
  assert.equal(events.length, 4); assert.ok(!JSON.stringify(events).includes(initial));
  const result = { passed: true, testedAt: new Date().toISOString(), checks, roles: 3, roleResults, browser: Boolean(browser), legacyCredentials: true, historicalDataPreserved: true, syntheticOnly: true };
  await mkdir(evidence, { recursive: true }); await writeFile(resolve(evidence, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) { await mkdir(evidence, { recursive: true }); await page.screenshot({ path: resolve(evidence, "failure.png"), fullPage: true }); console.error(await page.locator("body").innerText()); }
  throw error;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once("exit", resolve)); }
  await closeCollegeConnections(); await mongoose.disconnect(); await replica.stop();
}
