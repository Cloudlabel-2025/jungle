import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { platformModels, authenticatePlatform, createPlatformSession, platformAdminFromToken, changePlatformPassword } from "../lib/platform-auth.js";
import { platformColleges, platformCollegeDetail, platformCreateCollege, platformUpdateCollege,
  platformCohortCommand, platformTeamCommand, platformActivity } from "../lib/platform-management.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { registryModels, contextForCollege, closeCollegeConnections } from "../lib/college-registry.js";

test("Super admin: independent sessions, forced password rotation, college lifecycle, scoped cohort/staff/team CRUD and audited retries", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const previous = { ...process.env }, suffix = randomUUID().replaceAll("-", "");
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  process.env.TENANT_MONGODB_URI = process.env.TEST_MONGODB_URI;
  process.env.MASTER_MONGODB_URI = process.env.TEST_MONGODB_URI;
  process.env.MASTER_DB_NAME = `pa_${suffix}`;
  process.env.TENANCY_ENABLED = "true";
  process.env.SESSION_SECRET = "platform-test-session-secret-longer-than-32-characters";
  try {
    const { PlatformAdmin, PlatformSession } = await platformModels();
    await PlatformAdmin.init(); await PlatformSession.init();
    await PlatformAdmin.create({ _id: "owner", name: "Owner", email: "admin@jungle.com", passwordHash: await hashPassword("Initial-password-123") });
    await assert.rejects(platformColleges("college-cc-id"), e => e.status === 401);
    const initial = await authenticatePlatform("ADMIN@JUNGLE.COM", "Initial-password-123");
    const token = await createPlatformSession(initial);
    assert.equal((await platformAdminFromToken(token))._id, "owner");
    assert.equal(await platformAdminFromToken("college-session-token"), null);
    assert.equal(await PlatformSession.countDocuments({ _id: token }), 0, "raw session token is never stored");
    await assert.rejects(platformColleges("owner"), e => e.status === 403);
    const changed = await changePlatformPassword("owner", "Initial-password-123", "Permanent-password-456");
    assert.equal(changed.mustChangePassword, false);
    assert.equal(await platformAdminFromToken(token), null, "password changes revoke prior sessions");
    await assert.rejects(authenticatePlatform("admin@jungle.com", "Initial-password-123"), e => e.status === 401);
    assert.equal((await authenticatePlatform("admin@jungle.com", "Permanent-password-456"))._id, "owner");
    const college = await platformCreateCollege("owner", { name: "College A", slug: "college-a", adminName: "College CC", email: "cc@example.invalid", password: "CC-password-123", startDate: "2027-01-04" });
    const other = await platformCreateCollege("owner", { name: "College B", slug: "college-b", adminName: "Other CC", email: "cc@example.invalid", password: "CC-password-123", startDate: "2027-01-04" });
    const list = await platformColleges("owner", { search: ".*" });
    assert.equal(list.total, 0, "search input is literal, not executable regular expression");
    assert.equal((await platformColleges("owner")).total, 2);
    const ctx = await contextForCollege({ _id: college.id });
    const userBefore = await ctx.models.User.countDocuments();
    const cohortRequest = { requestId: randomUUID(), code: "winter-2027", name: "Winter 2027", startDate: "2027-01-04" };
    const cohort = await platformCohortCommand("owner", college.id, "create", cohortRequest);
    assert.equal((await platformCohortCommand("owner", college.id, "create", cohortRequest)).id, cohort.id, "network retries return original result");
    await assert.rejects(platformCohortCommand("owner", college.id, "create", { ...cohortRequest, name: "Changed input" }), e => e.status === 409);
    await assert.rejects(platformCohortCommand("owner", college.id, "create", { requestId: randomUUID(), code: "bad-date", name: "Bad", startDate: "2027-02-30" }), /valid cohort start date/);
    const guide = await platformCohortCommand("owner", college.id, "add-staff", { requestId: randomUUID(), cohortId: cohort.id, name: "New Guide", email: "guide@example.invalid", role: "MISSION_COMMANDER", password: "Guide-password-123" });
    const teamBody = { requestId: randomUUID(), cohortId: cohort.id, name: "Forest Team", code: "FOR-1", commanderId: guide.id };
    const team = await platformTeamCommand("owner", college.id, "create", teamBody);
    assert.equal((await platformTeamCommand("owner", college.id, "create", teamBody)).id, team.id);
    await assert.rejects(platformTeamCommand("owner", college.id, "create", { ...teamBody, requestId: randomUUID(), name: "forest team" }), e => e.status === 409);
    await assert.rejects(platformTeamCommand("owner", other.id, "update", { requestId: randomUUID(), cohortId: "alpha", teamId: team.id, name: "Hijack", code: "HIJ", version: 1 }), e => e.status === 404);
    await assert.rejects(platformTeamCommand("owner", college.id, "create", { requestId: randomUUID(), cohortId: "alpha", name: "Wrong Guide", commanderId: guide.id }), /active Guide assigned/);
    for (const [i, characterKey] of ["blaze", "glitch", "shade", "pulse", "rune"].entries()) {
      const body = { requestId: randomUUID(), cohortId: cohort.id, teamId: team.id,
        member: { name: `Learner ${i}`, username: `learner${i}`, password: "Learner-password-123", characterKey, variant: "female" } };
      const saved = await platformTeamCommand("owner", college.id, "add-member", body);
      if (i === 0) assert.equal((await platformTeamCommand("owner", college.id, "add-member", body)).id, saved.id);
    }
    await assert.rejects(platformTeamCommand("owner", college.id, "add-member", { requestId: randomUUID(), cohortId: cohort.id, teamId: team.id,
      member: { name: "Sixth learner", username: "sixth", password: "Learner-password-123", characterKey: "blaze", variant: "male" } }), /at most five/);
    assert.equal(await ctx.models.User.countDocuments(), userBefore + 6);
    const learner = await ctx.models.User.findOne({ username: "learner0" }).lean();
    assert.equal(learner.cohortId, cohort.id);
    assert.ok(await checkPassword("Learner-password-123", (await ctx.models.Credential.findById(learner._id)).passwordHash));
    let detail = await platformCollegeDetail("owner", college.id);
    const currentTeam = detail.teams.find(t => t.id === team.id);
    await assert.rejects(platformTeamCommand("owner", college.id, "update", { requestId: randomUUID(), cohortId: cohort.id, teamId: team.id, name: "Stale", code: "FOR-1", version: 1 }), /changed elsewhere/);
    await platformTeamCommand("owner", college.id, "update", { requestId: randomUUID(), cohortId: cohort.id, teamId: team.id, name: "Forest Renamed", code: "FOR-2", commanderId: guide.id, version: currentTeam.version });
    const c = detail.cohorts.find(c => c.id === cohort.id);
    await platformCohortCommand("owner", college.id, "update", { requestId: randomUUID(), cohortId: c.id, name: "Winter Intake", startDate: c.startDate, currentWeek: 2, version: c.version });
    await assert.rejects(platformUpdateCollege("owner", college.id, { dbName: "another-db", version: 1, accessRevision: 1 }), /Unsupported college change/);
    const original = detail.college;
    await platformUpdateCollege("owner", college.id, { name: "College A renamed", status: "SUSPENDED", version: original.version, accessRevision: original.accessRevision });
    await assert.rejects(contextForCollege({ _id: college.id }), e => e.status === 403);
    detail = await platformCollegeDetail("owner", college.id);
    assert.equal(detail.college.name, "College A renamed");
    assert.equal(detail.teams.find(t => t.id === team.id).name, "Forest Renamed");
    await assert.rejects(platformUpdateCollege("owner", college.id, { name: "Stale", version: original.version, accessRevision: original.accessRevision }), e => e.status === 409);
    await platformUpdateCollege("owner", college.id, { status: "ARCHIVED", version: detail.college.version, accessRevision: detail.college.accessRevision });
    await assert.rejects(platformCohortCommand("owner", college.id, "create", { requestId: randomUUID(), name: "No", code: "no", startDate: "2027-01-04" }), /Reactivate/);
    assert.equal((await platformCollegeDetail("owner", other.id)).teams.length, 0);
    const events = await platformActivity("owner");
    assert.ok(events.some(e => e.state === "FAILED"));
    assert.ok(events.some(e => e.action === "COLLEGE_UPDATED"));
    const { PlatformAudit } = await registryModels();
    assert.ok(!JSON.stringify(await PlatformAudit.find().lean()).includes("Learner-password-123"));
    assert.ok(!JSON.stringify(await ctx.models.PlatformManagementEvent.find().lean()).includes("Learner-password-123"));
    // Lockout is database-backed and does not turn a correct password into a bypass.
    await PlatformAdmin.create({ _id: "locked", name: "Locked", email: "locked@example.invalid", mustChangePassword: false, passwordHash: await hashPassword("Locked-password-123") });
    for (let i = 0; i < 5; i++) await assert.rejects(authenticatePlatform("locked@example.invalid", "wrong"), e => e.status === 401);
    await assert.rejects(authenticatePlatform("locked@example.invalid", "Locked-password-123"), e => e.status === 401);
  } finally {
    await closeCollegeConnections(); await mongoose.disconnect();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
