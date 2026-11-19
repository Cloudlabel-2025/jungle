import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID, createHash } from "node:crypto";
import { platformModels, createPlatformSession, platformAdminFromToken, changePlatformPassword, authenticatePlatform } from "../lib/platform-auth.js";
import { listAdministrators, manageAdministrator } from "../lib/platform-administrators.js";
import { platformCreateCollege, platformCollegeDetail, platformCohortCommand, platformTeamCommand, platformPersonUpdate } from "../lib/platform-management.js";
import { contextForCollege, closeCollegeConnections } from "../lib/college-registry.js";
import { requestPasswordRecovery, requestAccountRecovery, deliverRecoveryMail, completePasswordRecovery, recoveryModels, recoveryOverview } from "../lib/password-recovery.js";
import { recoveryMailStatus, sendRecoveryMail } from "../lib/recovery-mail.js";
import nodemailer from "nodemailer";
import { hashPassword, checkPassword } from "../lib/password.js";

test("CMS accounts: safe staff/learner edits, session revocation, concurrent admin safeguards, automatic one-use recovery and preserved history", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const old = { ...process.env };
  for (const k of Object.keys(process.env)) if (k.startsWith("SMTP_")) delete process.env[k];
  Object.assign(process.env, { MONGODB_URI: process.env.TEST_MONGODB_URI, TENANT_MONGODB_URI: process.env.TEST_MONGODB_URI,
    MASTER_MONGODB_URI: process.env.TEST_MONGODB_URI, MASTER_DB_NAME: `cms_${randomUUID().replaceAll("-", "")}`,
    TENANCY_ENABLED: "true", SESSION_SECRET: "cms-fixture-secret-more-than-32-characters", CMS_PUBLIC_ORIGIN: "https://cms.example", CMS_EMAIL_FROM: "sender@cms.example" });
  try {
    const { PlatformAdmin } = await platformModels(); await PlatformAdmin.init();
    await PlatformAdmin.create({ _id: "owner", name: "Owner", email: "owner@cms.example", mustChangePassword: false, passwordHash: await hashPassword("Original-owner-password-123") });
    let actor = "owner";
    const college = await platformCreateCollege(actor, { name: "Safe College", slug: "safe-college", adminName: "CC", email: "cc@cms.example", password: "College-password-123", startDate: "2027-01-04" });
    const other = await platformCreateCollege(actor, { name: "Other College", slug: "other-college", adminName: "CC", email: "other-cc@cms.example", password: "College-password-123", startDate: "2027-01-04" });
    const ctx = await contextForCollege({ _id: college.id });
    const guide = await platformCohortCommand(actor, college.id, "add-staff", { requestId: randomUUID(), cohortId: "alpha", name: "Guide One", email: "guide1@cms.example", password: "Guide-password-123", role: "MISSION_COMMANDER" });
    await assert.rejects(platformCohortCommand(actor, college.id, "add-staff", { requestId: randomUUID(), cohortId: "alpha", name: "Invalid recipients", email: "one@cms.example,two@cms.example", password: "Guide-password-123", role: "MISSION_COMMANDER" }), /valid email/);
    const replacement = await platformCohortCommand(actor, college.id, "add-staff", { requestId: randomUUID(), cohortId: "alpha", name: "Guide Two", email: "guide2@cms.example", password: "Guide-password-123", role: "MISSION_COMMANDER" });
    const team = await platformTeamCommand(actor, college.id, "create", { requestId: randomUUID(), cohortId: "alpha", name: "Safe Team", commanderId: guide.id });
    const learner = await platformTeamCommand(actor, college.id, "add-member", { requestId: randomUUID(), cohortId: "alpha", teamId: team.id,
      member: { name: "Learner", username: "learner", email: "learner@cms.example", password: "Learner-password-123", characterKey: "blaze", variant: "female" } });
    await ctx.models.User.updateOne({ _id: learner.id }, { $set: { xp: 321, trophies: 77, hp: 4, energy: 2 } });
    await ctx.connection.db.collection("history_sentinel").insertOne({ _id: "past-assessment", userId: learner.id, teamId: team.id, guideId: guide.id, bytes: Buffer.from("unchanged-private-evidence"), marks: 83 });
    const digest = async () => createHash("sha256").update(mongoose.mongo.BSON.serialize(await ctx.connection.db.collection("history_sentinel").findOne())).digest("hex");
    const historyBefore = await digest();
    let detail = await platformCollegeDetail(actor, college.id), person = detail.people.find(p => p.id === learner.id);
    const update = p => ({ requestId: randomUUID(), cohortId: p.cohortId, userId: p.id, version: p.version, name: p.name, email: p.email, username: p.username || "", role: p.role, active: p.active });
    await assert.rejects(platformPersonUpdate(actor, other.id, update(person)), e => e.status === 404);
    await assert.rejects(platformPersonUpdate(actor, college.id, { ...update(person), teamId: "another-team" }), /Unsupported account change/);
    await platformPersonUpdate(actor, college.id, { ...update(person), name: "Learner Edited", active: false });
    assert.equal((await ctx.models.User.findById(learner.id)).authVersion, 2);
    await assert.rejects(platformPersonUpdate(actor, college.id, update(person)), e => e.status === 409);
    detail = await platformCollegeDetail(actor, college.id); person = detail.people.find(p => p.id === learner.id);
    await platformPersonUpdate(actor, college.id, { ...update(person), active: true });
    const retained = await ctx.models.User.findById(learner.id).lean();
    assert.deepEqual([retained.xp, retained.trophies, retained.hp, retained.energy, retained.teamId], [321, 77, 4, 2, team.id]);
    const coordinator = detail.people.find(p => p.role === "CENTRE_COMMAND");
    await assert.rejects(platformPersonUpdate(actor, college.id, { ...update(coordinator), active: false }), /at least one active Centre Command/);
    const g = detail.people.find(p => p.id === guide.id);
    await assert.rejects(platformPersonUpdate(actor, college.id, { ...update(g), active: false, replacementGuideId: { $ne: null } }), /valid replacement Guide/);
    await assert.rejects(platformPersonUpdate(actor, college.id, { ...update(g), active: false }), /replacement Guide/);
    await platformPersonUpdate(actor, college.id, { ...update(g), active: false, replacementGuideId: replacement.id });
    assert.equal((await ctx.models.Team.findById(team.id)).commanderId, replacement.id);
    assert.equal(await digest(), historyBefore, "past evidence and assessor assignments are untouched");
    await assert.rejects(manageAdministrator(actor, "create", { name: "Second Owner", email: "second@cms.example", password: "Short12" }), /8–256/);
    const extra = await manageAdministrator(actor, "create", { name: "Second Owner", email: "second@cms.example", password: "Start123" });
    assert.equal(extra.mustChangePassword, true);
    await assert.rejects(changePlatformPassword(extra.id, "Start123", "Short12"), /8–256/);
    await changePlatformPassword(extra.id, "Start123", "Newpass8");
    assert.equal((await listAdministrators(actor)).length, 2);
    await assert.rejects(manageAdministrator(actor, "update", { id: actor, name: "Owner", email: "owner@cms.example", version: 1, active: false }), /own super admin/);
    const races = await Promise.allSettled([
      manageAdministrator(actor, "update", { id: extra.id, name: extra.name, email: extra.email, version: 1, active: false }),
      manageAdministrator(extra.id, "update", { id: actor, name: "Owner", email: "owner@cms.example", version: 1, active: false }),
    ]);
    assert.equal(races.filter(r => r.status === "fulfilled").length, 1, "concurrent mutual deactivation cannot lock everyone out");
    assert.equal(await PlatformAdmin.countDocuments({ active: true }), 1);
    actor = (await PlatformAdmin.findOne({ active: true }).lean())._id;
    const inactive = await PlatformAdmin.findOne({ active: false }).lean();
    await assert.rejects(authenticatePlatform(inactive.email, "Newpass8"), e => e.status === 401);
    const admin = await PlatformAdmin.findById(actor).lean(), adminToken = await createPlatformSession(admin);
    const platformCase = await requestPasswordRecovery({ realm: "platform", identifier: admin.email });
    assert.equal((await deliverRecoveryMail(platformCase)).state, "BLOCKED");
    let message;
    await deliverRecoveryMail(platformCase, { send: async m => { message = m; } });
    const token = new URL(message.text.match(/https:\/\/\S+\/recover\?\S+/)[0]).hash.slice(7);
    assert.equal(message.to, admin.email);
    assert.ok(!JSON.stringify((await recoveryOverview(actor)).requests).includes(token));
    await assert.rejects(completePasswordRecovery(token, "Short12"), /8–256/);
    await completePasswordRecovery(token, "Reset123");
    assert.equal(await platformAdminFromToken(adminToken), null);
    assert.equal((await authenticatePlatform(admin.email, "Reset123"))._id, actor);
    await assert.rejects(completePasswordRecovery(token, "Replay-password-123"), e => e.status === 400);
    const caseId = await requestPasswordRecovery({ realm: "college", collegeId: college.id, identifier: "learner" });
    assert.equal(await requestPasswordRecovery({ realm: "college", collegeSlug: "safe-college", identifier: "learner" }), caseId, "name-picker and legacy clients share the same recovery account and throttle");
    let learnerMail;
    await deliverRecoveryMail(caseId, { send: async m => { learnerMail = m; } });
    const learnerToken = new URL(learnerMail.text.match(/https:\/\/\S+\/recover\?\S+/)[0]).hash.slice(7);
    assert.ok(learnerMail.text.includes("/c/safe-college/recover?realm=college"), "recovery email points to the college's own portal");
    await assert.rejects(completePasswordRecovery(learnerToken, "Wrong-portal-password-123", { collegeId: other.id }), e => e.status === 400);
    const { RecoveryCase } = await recoveryModels();
    const privateCase = await RecoveryCase.findById(caseId).select("+encrypted +tokenHash").lean();
    assert.notEqual(privateCase.encrypted.data, learnerToken);
    assert.equal(privateCase.tokenHash, createHash("sha256").update(learnerToken).digest("hex"));
    const attempts = await Promise.allSettled([completePasswordRecovery(learnerToken, "Winner-password-123"), completePasswordRecovery(learnerToken, "Other-password-456")]);
    assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
    const credential = await ctx.models.Credential.findById(learner.id).lean();
    assert.equal(credential.mustChangePassword, false, "email recovery sets a permanent password");
    assert.ok(await checkPassword("Winner-password-123", credential.passwordHash) || await checkPassword("Other-password-456", credential.passwordHash));
    assert.equal(await digest(), historyBefore);
    const nextCase = await requestAccountRecovery(actor, { realm: "college", collegeId: college.id, userId: learner.id, replace: true });
    let expiredMail;
    await deliverRecoveryMail(nextCase.id, { send: async m => { expiredMail = m; } });
    const expiredToken = new URL(expiredMail.text.match(/https:\/\/\S+\/recover\?\S+/)[0]).hash.slice(7);
    await RecoveryCase.updateOne({ _id: nextCase.id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    await assert.rejects(completePasswordRecovery(expiredToken, "Expired-password-123"), e => e.status === 400);
    const failedCase = await requestAccountRecovery(actor, { realm: "college", collegeId: college.id, userId: learner.id, replace: true });
    await deliverRecoveryMail(failedCase.id, { send: async () => { throw Object.assign(new Error("PRIVATE-SMTP-SECRET"), { code: "EAUTH" }); } });
    assert.equal((await RecoveryCase.findById(failedCase.id)).failureCode, "AUTHORIZATION");
    assert.ok(!JSON.stringify(await recoveryOverview(actor)).includes("PRIVATE-SMTP-SECRET"));
    assert.equal(await requestPasswordRecovery({ realm: "college", collegeSlug: "wrong-college", identifier: "learner" }), null);
    assert.equal(await requestPasswordRecovery({ realm: "platform", identifier: "not-present@cms.example" }), null);
    assert.equal(recoveryMailStatus().ready, false);
    // Exercise Microsoft OAuth and SMTP message construction without external traffic.
    const originalFetch = globalThis.fetch, originalTransport = nodemailer.createTransport;
    try {
      Object.assign(process.env, { SMTP_HOST: "smtp.office365.com", SMTP_PORT: "587", SMTP_USER: "sender@cms.example", SMTP_AUTH_MODE: "oauth2",
        SMTP_TENANT_ID: "11111111-1111-1111-1111-111111111111", SMTP_CLIENT_ID: "22222222-2222-2222-2222-222222222222", SMTP_CLIENT_SECRET: "fake-private-app-secret" });
      let sent = false, closed = false;
      globalThis.fetch = async (url, init) => {
        assert.equal(url, "https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/oauth2/v2.0/token");
        assert.equal(init.body.get("scope"), "https://outlook.office365.com/.default");
        return Response.json({ access_token: "fake-ephemeral-access-token" });
      };
      nodemailer.createTransport = options => {
        assert.equal(options.requireTLS, true); assert.equal(options.tls.rejectUnauthorized, true);
        assert.equal(options.auth.type, "OAuth2"); assert.equal(options.auth.accessToken, "fake-ephemeral-access-token");
        return { sendMail: async m => { assert.equal(m.to.address, "recipient@cms.example"); assert.equal(m.from.address, "sender@cms.example"); sent = true; return { accepted: [m.to.address] }; }, close: () => { closed = true; } };
      };
      assert.equal(recoveryMailStatus().ready, true);
      await sendRecoveryMail({ to: "recipient@cms.example", text: "Captured recovery email", messageId: "<captured@cms.example>" });
      assert.ok(sent && closed);
      globalThis.fetch = async () => new Response(null, { status: 401 });
      await assert.rejects(sendRecoveryMail({ to: "recipient@cms.example", text: "No delivery" }), e => e.code === "AUTHORIZATION");
    } finally { globalThis.fetch = originalFetch; nodemailer.createTransport = originalTransport; }
  } finally {
    await closeCollegeConnections(); await mongoose.disconnect();
    for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old);
  }
});
