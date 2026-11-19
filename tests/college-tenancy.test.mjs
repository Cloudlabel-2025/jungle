import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { models, createModels, transaction, connect } from "../lib/db.js";
import { runWithCollege } from "../lib/college-context.js";
import { contextForCollege, registryModels, closeCollegeConnections } from "../lib/college-registry.js";
import { backupDatabase, restoreBackup, inventoryDatabase, adoptCollege, provisionCollege } from "../lib/college-admin.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { signToken, tokenClaims } from "../lib/session-token.js";
import { scope, guardTargets } from "../lib/access-scope.js";
import { collegeJob } from "../lib/college-jobs.js";

test("College adoption preserves data; concurrent models, transactions, IDs, files, sessions and workers stay isolated", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const suffix = randomUUID().replaceAll("-", "");
  const oldEnv = { ...process.env };
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI.replace(/\/[^/?]+(?=\?|$)/, `/college_source_${suffix}`);
  process.env.TENANT_MONGODB_URI = process.env.MONGODB_URI;
  process.env.MASTER_MONGODB_URI = process.env.MONGODB_URI;
  process.env.MASTER_DB_NAME = `college_registry_${suffix}`;
  process.env.TENANCY_ENABLED = "true";
  process.env.SESSION_SECRET = "isolated-college-test-secret-at-least-32-chars";
  let source, restored;
  try {
    source = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
    const original = createModels(source);
    for (const model of Object.values(original)) await model.init();
    const passwordHash = await hashPassword("Test-password-123");
    await original.Cohort.create({ _id: "alpha", name: "Existing cohort", college: "Old college label", startDate: "2026-10-24" });
    await original.User.create({ _id: "same-user", email: "same@example.invalid", name: "Existing learner", role: "GAMER", cohortId: "alpha", teamId: "same-team", xp: 123, trophies: 45 });
    await original.Credential.create({ _id: "same-user", passwordHash });
    await original.Team.create({ _id: "same-team", cohortId: "alpha", name: "Existing team", code: "A" });
    await original.PrivateReportFile.create({ _id: "same-file", cohortId: "alpha", bytes: Buffer.from("private first college bytes"), sha256: "historical-integrity-value" });
    await source.db.createCollection("retainedsettings", { validator: { value: { $type: "string" } }, validationLevel: "strict" });
    await source.db.collection("retainedsettings").insertOne({ _id: "custom", value: "preserve collection options" });
    const directory = await mkdtemp(join(tmpdir(), "jungle-college-backup-"));
    const baseline = await backupDatabase(source, directory);
    restored = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: `college_restored_${suffix}` }).asPromise();
    await restoreBackup(restored, directory);
    assert.deepEqual((await inventoryDatabase(restored)).collections, baseline.collections);
    const first = await adoptCollege(source, { expectedInventory: baseline });
    assert.equal(first.name, "College for test");
    assert.equal(first.dbName, source.name);
    assert.equal((await adoptCollege(source, { expectedInventory: baseline }))._id, first._id, "adoption is idempotent");
    assert.equal((await original.Cohort.findById("alpha")).college, "College for test");
    const after = await inventoryDatabase(source);
    assert.deepEqual(after.collections.filter(c => c.name !== "cohorts"), baseline.collections.filter(c => c.name !== "cohorts"));
    assert.ok(await checkPassword("Test-password-123", (await original.Credential.findById("same-user")).passwordHash));
    const second = await provisionCollege({ name: "Other College", slug: "other-college", email: "admin@example.invalid", password: "Other-password-123", adminName: "Other admin", startDate: "2026-11-19" });
    const a = await contextForCollege({ _id: first._id }), b = await contextForCollege({ _id: second.id });
    assert.ok(Buffer.byteLength(b.college.dbName) <= 38, "new college databases fit the Atlas 38-byte limit");
    assert.equal(await b.models.User.countDocuments(), 1, "no fictional learners seeded");
    await b.models.User.create({ _id: "same-user", email: "same@example.invalid", name: "Different learner", role: "GAMER", cohortId: "alpha", teamId: "same-team", xp: 999 });
    await b.models.Team.create({ _id: "same-team", cohortId: "alpha", name: "Different team", code: "A" });
    await b.models.PrivateReportFile.create({ _id: "same-file", cohortId: "alpha", bytes: Buffer.from("private second college bytes"), sha256: "different" });
    await assert.rejects(connect(), /College context required/);
    assert.throws(() => models.User, /College context required/);
    await Promise.all([a, b].flatMap((ctx, i) => Array.from({ length: 8 }, (_, n) => runWithCollege(ctx, async () => {
      await new Promise(resolve => setTimeout(resolve, n));
      assert.equal((await models.User.findById("same-user")).xp, i ? 999 : 123);
      const result = await models.User.aggregate([{ $match: { _id: "same-user" } }]);
      assert.equal(result[0].name, i ? "Different learner" : "Existing learner");
      assert.equal((await models.PrivateReportFile.findById("same-file").select("+bytes")).bytes.toString(), i ? "private second college bytes" : "private first college bytes");
      const actor = await models.User.findById("same-user").lean();
      assert.deepEqual((await scope(actor)).teamIds, ["same-team"]);
      await guardTargets(actor, { userId: "same-user", teamId: "same-team" });
    }))));
    await runWithCollege(a, async () => {
      await transaction(s => models.User.updateOne({ _id: "same-user" }, { $inc: { xp: 1 } }, { session: s }));
      await assert.rejects(transaction(async s => {
        await models.User.updateOne({ _id: "same-user" }, { $inc: { xp: 100 } }, { session: s });
        throw new Error("rollback-test");
      }), /rollback-test/);
      assert.equal((await models.User.findById("same-user")).xp, 124);
    });
    assert.equal((await b.models.User.findById("same-user")).xp, 999);
    assert.equal(tokenClaims(signToken("same-user", first)).collegeId, first._id);
    assert.equal(tokenClaims(signToken("same-user", b.college)).collegeId, second.id);
    assert.equal(tokenClaims(signToken("same-user")).collegeId, undefined, "legacy tokens carry no college grant");
    const { College } = await registryModels();
    const retryId = randomUUID();
    await College.create({ _id: retryId, name: "Retry college", slug: "retry-college", dbName: `college_retry_${suffix}`, status: "FAILED" });
    const retried = await provisionCollege({ name: "Retry college", slug: "retry-college", email: "retry@example.invalid", password: "Retry-password-123", adminName: "Retry admin", startDate: "2026-11-19" });
    assert.equal(retried.id, retryId, "failed provisioning resumes its existing database");
    const retryContext = await contextForCollege({ _id: retryId });
    assert.equal(await retryContext.models.User.countDocuments(), 1);
    await College.updateOne({ _id: retryId }, { $set: { status: "ARCHIVED" } });
    await College.updateOne({ _id: first._id }, { $set: { status: "SUSPENDED" }, $inc: { accessRevision: 1 } });
    await assert.rejects(contextForCollege({ _id: first._id }), /unavailable/, "warm connection must not bypass suspension");
    let visited = [];
    const jobs = await collegeJob("isolation-test", async () => { visited.push((await connect()).name); });
    assert.deepEqual(visited, [b.connection.name]);
    assert.equal(jobs.length, 1);
    const nested = await runWithCollege(b, () => collegeJob("nested", async () => "selected-only"));
    assert.equal(nested, "selected-only");
    // Registry and tenant databases cannot be assigned to the same college twice.
    await assert.rejects(College.create({ _id: randomUUID(), slug: "duplicate-db", name: "Duplicate", dbName: first.dbName, status: "ACTIVE" }), e => e.code === 11000);
  } finally {
    if (restored) { await restored.dropDatabase(); await restored.close(); }
    if (source) { await source.dropDatabase(); await source.close(); }
    await closeCollegeConnections();
    await mongoose.disconnect();
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});
