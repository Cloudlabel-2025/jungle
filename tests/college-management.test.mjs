import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import mongoose from "mongoose";
import { platformModels } from "../lib/platform-auth.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { contextForCollege, registryModels, closeCollegeConnections } from "../lib/college-registry.js";
import { runWithCollege } from "../lib/college-context.js";
import { collegeManagementActor } from "../lib/management-actor.js";
import { platformCreateCollege, platformCreateCC, platformCollegeDetail, platformCohortCommand, platformTeamCommand, platformPersonUpdate } from "../lib/platform-management.js";
import { teamAction } from "../lib/team-management.js";

test("college management: college-wide CC, assigned-team MC, safe delegation and preserved history", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const previous = { ...process.env };
  Object.assign(process.env, { MONGODB_URI: process.env.TEST_MONGODB_URI, TENANT_MONGODB_URI: process.env.TEST_MONGODB_URI,
    MASTER_MONGODB_URI: process.env.TEST_MONGODB_URI, MASTER_DB_NAME: `cm_${randomUUID().replaceAll("-", "")}`,
    TENANCY_ENABLED: "true", SESSION_SECRET: "college-management-test-secret-longer-than-32-characters" });
  try {
    const { PlatformAdmin } = await platformModels();
    await PlatformAdmin.create({ _id: "owner", name: "Owner", email: "owner@cms.example", mustChangePassword: false, passwordHash: await hashPassword("Owner-password-123") });
    const createCollege = (slug) => platformCreateCollege("owner", { name: slug, slug, adminName: "CC", email: "cc@cms.example", password: "College-password-123", startDate: "2027-01-04" });
    const college = await createCollege("college-for-test"), other = await createCollege("other-college");
    const ctx = await contextForCollege({ _id: college.id }), otherCtx = await contextForCollege({ _id: other.id });
    const ccUser = await ctx.models.User.findOne({ role: "CENTRE_COMMAND" }).lean();
    const principal = user => runWithCollege(ctx, () => collegeManagementActor(user));
    const cc = principal(ccUser), as = work => runWithCollege(ctx, work);
    const home = ccUser.cohortId;
    const winter = await as(() => platformCohortCommand(cc, college.id, "create", { requestId: randomUUID(), code: "winter", name: "Winter", startDate: "2027-03-01" }));
    assert.equal(winter.id, "winter");
    await assert.rejects(platformCreateCC("owner", college.id, { requestId: randomUUID(), name: "Second CC", email: "second-cc@cms.example", password: "Short12", cohortId: "winter" }), /8–256/);
    const newCC = await platformCreateCC("owner", college.id, { requestId: randomUUID(), name: "Second CC", email: "second-cc@cms.example", password: "College8", cohortId: "winter" });
    assert.equal((await ctx.models.User.findById(newCC.id)).role, "CENTRE_COMMAND");
    assert.ok(await checkPassword("College8", (await ctx.models.Credential.findById(newCC.id)).passwordHash));
    assert.equal((await ctx.models.User.findById(ccUser._id)).cohortId, home, "existing home cohort is retained");
    await as(async () => {
      await assert.rejects(platformCreateCC(cc, college.id, { requestId: randomUUID(), name: "Escalation" }), e => e.status === 401);
      await assert.rejects(platformCohortCommand(cc, college.id, "add-staff", { requestId: randomUUID(), cohortId: "winter", role: "CENTRE_COMMAND" }), e => e.status === 403);
      await assert.rejects(platformCohortCommand(cc, other.id, "create", { requestId: randomUUID(), code: "hijack", name: "Hijack", startDate: "2027-01-04" }), e => e.status === 403);
      await assert.rejects(platformCollegeDetail({ ...cc, collegeId: other.id }, other.id), e => e.status === 403);
    });
    const makeGuide = email => as(() => platformCohortCommand(cc, college.id, "add-staff", { requestId: randomUUID(), cohortId: "winter", name: email, email, role: "MISSION_COMMANDER", password: "Guide-password-123" }));
    const guide = await makeGuide("guide@cms.example"), replacement = await makeGuide("replacement@cms.example");
    const mcUser = await ctx.models.User.findById(guide.id).lean(), mc = principal(mcUser);
    assert.equal((await as(() => platformCollegeDetail(cc, college.id))).cohorts.length, 2);
    const makeTeam = (name, commanderId) => as(() => platformTeamCommand(cc, college.id, "create", { requestId: randomUUID(), cohortId: "winter", name, commanderId }));
    const assigned = await makeTeam("Assigned team", guide.id), unassigned = await makeTeam("Other team", replacement.id);
    const playerBody = (username, characterKey = "blaze") => ({ requestId: randomUUID(), cohortId: "winter", teamId: assigned.id,
      member: { name: username, username, characterKey, variant: "female", password: "Player-password-123", role: "CENTRE_COMMAND" } });
    const body = playerBody("first-player");
    const player = await as(() => platformTeamCommand(mc, college.id, "add-member", body));
    assert.equal((await as(() => platformTeamCommand(mc, college.id, "add-member", body))).id, player.id, "network retry returns original account");
    assert.equal((await ctx.models.User.findById(player.id)).role, "GAMER", "request payload cannot promote a player");
    assert.ok(await checkPassword("Player-password-123", (await ctx.models.Credential.findById(player.id)).passwordHash));
    await ctx.connection.db.collection("history_sentinel").insertOne({ _id: "history", userId: player.id, marks: 91, bytes: Buffer.from("private history") });
    const history = () => ctx.connection.db.collection("history_sentinel").findOne({ _id: "history" }).then(row => createHash("sha256").update(mongoose.mongo.BSON.serialize(row)).digest("hex"));
    const before = await history();
    await as(async () => {
      await assert.rejects(platformTeamCommand(mc, college.id, "add-member", { ...playerBody("outside-team"), teamId: unassigned.id }), e => e.status === 403);
      await assert.rejects(platformTeamCommand(mc, college.id, "create", { requestId: randomUUID() }), e => e.status === 403);
      await assert.rejects(platformTeamCommand(mc, college.id, "update", { requestId: randomUUID(), cohortId: "winter", teamId: assigned.id }), e => e.status === 403);
      await assert.rejects(platformCohortCommand(mc, college.id, "add-staff", { requestId: randomUUID(), role: "MISSION_COMMANDER" }), e => e.status === 403);
      await assert.rejects(platformPersonUpdate(mc, college.id, {}), e => e.status === 403);
      await assert.rejects(platformTeamCommand(cc, college.id, "add-member", { ...playerBody("wrong-cohort"), cohortId: "alpha" }), e => e.status === 404);
      const view = await platformCollegeDetail(mc, college.id);
      assert.deepEqual(view.teams.map(t => t.id), [assigned.id]);
      assert.ok(!view.people.some(p => p.role === "CENTRE_COMMAND" || p.id === replacement.id));
      assert.equal(view.cohorts.length, 1);
      const ccTarget = { requestId: randomUUID(), cohortId: ccUser.cohortId, userId: ccUser._id, version: ccUser.managementVersion || 1,
        name: "Hijack CC", email: ccUser.email, active: false };
      await assert.rejects(platformPersonUpdate(cc, college.id, ccTarget), e => e.status === 403);
      const guideRow = await ctx.models.User.findById(guide.id).lean();
      await assert.rejects(platformPersonUpdate(cc, college.id, { ...ccTarget, cohortId: "winter", userId: guide.id,
        name: "Promoted Guide", email: guideRow.email, version: guideRow.managementVersion || 1, active: true, role: "CENTRE_COMMAND" }), e => e.status === 403);
      await assert.rejects(teamAction(mcUser, "add-members", { teamId: unassigned.id, members: [{ ...playerBody("legacy-denied").member }] }), e => e.status === 403);
      await teamAction(mcUser, "add-members", { teamId: assigned.id, members: [{ ...playerBody("legacy-player", "glitch").member }] });
    });
    // Existing and new endpoints share the same cohort lock and five-player constraint.
    await as(() => platformTeamCommand(cc, college.id, "add-member", playerBody("cc-player", "shade")));
    await as(() => platformTeamCommand(mc, college.id, "add-member", playerBody("mc-player", "pulse")));
    const race = await as(() => Promise.allSettled([
      platformTeamCommand(mc, college.id, "add-member", playerBody("last-one", "rune")),
      platformTeamCommand(cc, college.id, "add-member", playerBody("last-two", "rune")),
    ]));
    assert.equal(race.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(await ctx.models.User.countDocuments({ teamId: assigned.id, role: "GAMER" }), 5);
    const row = (await as(() => platformCollegeDetail(cc, college.id))).teams.find(t => t.id === assigned.id);
    await as(() => platformTeamCommand(cc, college.id, "update", { requestId: randomUUID(), cohortId: "winter", teamId: assigned.id,
      version: row.version, name: row.name, code: row.code, commanderId: replacement.id }));
    await as(() => assert.rejects(platformTeamCommand(mc, college.id, "add-member", playerBody("revoked-assignment")), e => e.status === 403));
    await as(() => assert.rejects(platformTeamCommand(mc, college.id, "add-member", body), e => e.status === 403, "replay cannot bypass revoked assignment"));
    assert.equal((await as(() => platformCollegeDetail(mc, college.id))).teams.length, 0);
    await ctx.models.User.updateOne({ _id: guide.id }, { $set: { active: false } });
    await as(() => assert.rejects(platformCollegeDetail(mc, college.id), e => e.status === 401));
    await ctx.models.User.updateOne({ _id: ccUser._id }, { $set: { permissions: ["game:write"] } });
    await as(() => assert.rejects(platformCollegeDetail(cc, college.id), e => e.status === 403));
    const ccRows = await ctx.models.User.find({ role: "CENTRE_COMMAND", active: { $ne: false } }).lean();
    const ccRemovalRace = await Promise.allSettled(ccRows.map(p => platformPersonUpdate("owner", college.id, {
      requestId: randomUUID(), cohortId: p.cohortId, userId: p._id, version: p.managementVersion || 1,
      name: p.name, email: p.email, active: false,
    })));
    assert.equal(ccRemovalRace.filter(r => r.status === "fulfilled").length, 1, "CC removals across home cohorts are serialized");
    assert.equal(await ctx.models.User.countDocuments({ role: "CENTRE_COMMAND", active: { $ne: false } }), 1);
    assert.equal(await otherCtx.models.User.countDocuments(), 1, "other college accounts are untouched");
    assert.equal(await history(), before, "account management never rewrites historical records");
    const { PlatformAudit } = await registryModels();
    const audit = JSON.stringify(await PlatformAudit.find().lean()) + JSON.stringify(await ctx.models.PlatformManagementEvent.find().lean());
    assert.ok(!audit.includes("Player-password-123") && !audit.includes("Guide-password-123"));
    assert.ok(audit.includes("MISSION_COMMANDER") && audit.includes("CENTRE_COMMAND"), "creation is attributed to the acting role");
  } finally {
    await closeCollegeConnections(); await mongoose.disconnect();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
