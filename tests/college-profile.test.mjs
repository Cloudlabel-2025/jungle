import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { normalizeCollegeProfile } from "../lib/college-profile.js";
import {
  platformCreateCollege,
  platformCollegeDetail,
  platformUpdateCollege,
} from "../lib/platform-management.js";
import { platformModels } from "../lib/platform-auth.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { inventoryDatabase } from "../lib/college-admin.js";
import {
  registryModels,
  contextForCollege,
  closeCollegeConnections,
} from "../lib/college-registry.js";

test("college profile rejects invalid, oversized and executable contact details", () => {
  assert.equal(normalizeCollegeProfile(undefined), undefined);
  assert.deepEqual(
    normalizeCollegeProfile({
      city: " Chennai ",
      contactEmail: " OFFICE@COLLEGE.EDU ",
      phone: "+91 98765 43210",
      website: "https://college.edu",
      affiliation: "  ",
    }),
    {
      city: "Chennai",
      contactEmail: "office@college.edu",
      phone: "+91 98765 43210",
      website: "https://college.edu/",
    },
  );
  for (const input of [
    null,
    [],
    "college",
    { dbName: "injected" },
    { city: 123 },
    { city: "x".repeat(81) },
    { institutionType: "Invalid" },
    { contactEmail: "one@college.edu,two@college.edu" },
    { contactEmail: "invalid" },
    { phone: "call me" },
    { phone: "123" },
    { website: "javascript:alert(1)" },
    { website: "college.edu" },
    { website: "https://user:password@college.edu" },
  ])
    assert.throws(
      () => normalizeCollegeProfile(input),
      (e) => e.status === 400,
    );
});

test(
  "college creation stores profile and named first cohort without migrating existing college records",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const previous = { ...process.env };
    Object.assign(process.env, {
      MONGODB_URI: process.env.TEST_MONGODB_URI,
      TENANT_MONGODB_URI: process.env.TEST_MONGODB_URI,
      MASTER_MONGODB_URI: process.env.TEST_MONGODB_URI,
      MASTER_DB_NAME: `cp_${randomUUID().replaceAll("-", "")}`,
      TENANCY_ENABLED: "true",
      SESSION_SECRET: "college-profile-test-secret-longer-than-32-characters",
    });
    try {
      const { PlatformAdmin } = await platformModels();
      await PlatformAdmin.create({
        _id: "owner",
        name: "Owner",
        email: "owner@cms.example",
        mustChangePassword: false,
        passwordHash: await hashPassword("Owner-password-123"),
      });
      const body = {
        name: "Riverstone College",
        slug: "riverstone",
        adminName: "College CC",
        email: "cc@college.edu",
        password: "College-password-123",
        startDate: "2027-01-04",
      };
      const existing = await platformCreateCollege("owner", {
        ...body,
        name: "College for test",
        slug: "college-for-test",
      });
      const { College, PlatformAudit } = await registryModels();
      assert.equal(
        (await registryModels()).College,
        College,
        "the optional profile fields keep registry model caching stable",
      );
      const before = mongoose.mongo.BSON.serialize(
        await College.collection.findOne({ _id: existing.id }),
      );
      const profile = {
        institutionType: "Private",
        affiliation: "Example University",
        contactEmail: "OFFICE@COLLEGE.EDU",
        phone: "+91 98765 43210",
        website: "https://college.edu",
        addressLine1: "10 College Road",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        postalCode: "600001",
      };
      const added = await platformCreateCollege("owner", {
        ...body,
        cohortName: "Foundation 2027",
        profile,
      });
      const detail = await platformCollegeDetail("owner", added.id);
      assert.equal(detail.college.profile.city, "Chennai");
      assert.equal(detail.college.profile.contactEmail, "office@college.edu");
      assert.equal(detail.college.profile.website, "https://college.edu/");
      assert.equal(detail.cohorts[0].name, "Foundation 2027");
      const ctx = await contextForCollege({ _id: added.id });
      const cc = await ctx.models.User.findOne({
        role: "CENTRE_COMMAND",
      }).lean();
      assert.ok(
        await checkPassword(
          body.password,
          (await ctx.models.Credential.findById(cc._id)).passwordHash,
        ),
      );
      for (const bad of [
        {
          ...body,
          slug: "bad-profile",
          profile: { website: "javascript:alert(1)" },
        },
        { ...body, slug: "empty-cohort", cohortName: " " },
      ])
        await assert.rejects(
          platformCreateCollege("owner", bad),
          (e) => e.status === 400,
        );
      assert.equal(
        await College.countDocuments(),
        2,
        "invalid input is rejected before creating databases or registry rows",
      );
      assert.deepEqual(
        mongoose.mongo.BSON.serialize(
          await College.collection.findOne({ _id: existing.id }),
        ),
        before,
      );
      assert.deepEqual(
        (await platformCollegeDetail("owner", existing.id)).college.profile,
        {},
        "legacy colleges need no migration",
      );
      await assert.rejects(
        platformCreateCollege(cc._id, {
          ...body,
          slug: "no-privileges",
          profile,
        }),
        (e) => e.status === 401,
      );
      const failureId = randomUUID();
      await College.create({
        _id: failureId,
        name: "Incomplete college",
        slug: "retry-college",
        dbName: `jng_${failureId.replaceAll("-", "")}`,
        status: "FAILED",
      });
      const retried = await platformCreateCollege("owner", {
        ...body,
        name: "Retry College",
        slug: "retry-college",
        profile,
        cohortName: "Retry intake",
      });
      assert.equal(retried.id, failureId);
      const retryDetails = await platformCollegeDetail("owner", retried.id);
      assert.equal(retryDetails.college.profile.city, "Chennai");
      assert.equal(retryDetails.cohorts[0].name, "Retry intake");
      assert.ok(
        !JSON.stringify(await PlatformAudit.find().lean()).includes(
          body.password,
        ),
      );
      assert.ok(!JSON.stringify(detail).includes(body.password));
    } finally {
      await closeCollegeConnections();
      await mongoose.disconnect();
      for (const key of Object.keys(process.env))
        if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  },
);

test(
  "college edits preserve tenant data, validate partial updates, clear fields and reject stale saves",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const previous = { ...process.env };
    Object.assign(process.env, {
      MONGODB_URI: process.env.TEST_MONGODB_URI,
      TENANT_MONGODB_URI: process.env.TEST_MONGODB_URI,
      MASTER_MONGODB_URI: process.env.TEST_MONGODB_URI,
      MASTER_DB_NAME: "ce_" + randomUUID().replaceAll("-", ""),
      TENANCY_ENABLED: "true",
      SESSION_SECRET: "college-edit-test-secret-longer-than-32-characters",
    });
    try {
      const { PlatformAdmin } = await platformModels();
      await PlatformAdmin.create({
        _id: "owner",
        name: "Owner",
        email: "owner@cms.example",
        mustChangePassword: false,
        passwordHash: await hashPassword("Owner-password-123"),
      });
      const college = await platformCreateCollege("owner", {
        name: "College for test",
        slug: "college-for-test",
        adminName: "CC",
        email: "cc@college.edu",
        password: "College-password-123",
        startDate: "2027-01-04",
      });
      const ctx = await contextForCollege({ _id: college.id });
      await ctx.connection.db.collection("history_sentinel").insertOne({
        _id: "past-result",
        score: 91,
        bytes: Buffer.from("preserved result"),
      });
      const before = await inventoryDatabase(ctx.connection);
      const { College } = await registryModels();
      const mapping = await College.collection.findOne({ _id: college.id });
      const old = (await platformCollegeDetail("owner", college.id)).college;
      const profile = {
        institutionType: "Private",
        affiliation: "Updated University",
        website: "https://college.edu",
        contactEmail: "OFFICE@COLLEGE.EDU",
        phone: "+91 98765 43210",
        addressLine1: "10 College Road",
        addressLine2: "Main campus",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        postalCode: "600001",
      };
      const updated = await platformUpdateCollege("owner", college.id, {
        name: "Updated college",
        slug: "updated-college",
        profile,
        version: old.version,
        accessRevision: old.accessRevision,
      });
      assert.equal(updated.profile.contactEmail, "office@college.edu");
      assert.equal(updated.profile.affiliation, profile.affiliation);
      assert.equal(
        updated.accessRevision,
        old.accessRevision,
        "profile edits do not invalidate college sessions",
      );
      await assert.rejects(
        platformUpdateCollege("owner", college.id, {
          profile: { city: "stale overwrite" },
          version: old.version,
          accessRevision: old.accessRevision,
        }),
        (e) => e.status === 409,
      );
      await assert.rejects(
        platformUpdateCollege("owner", college.id, {
          profile: { website: "javascript:alert(1)" },
          version: updated.version,
          accessRevision: updated.accessRevision,
        }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        platformUpdateCollege("owner", college.id, {
          dbName: "other-database",
          version: updated.version,
          accessRevision: updated.accessRevision,
        }),
        (e) => e.status === 400,
      );
      const partial = await platformUpdateCollege("owner", college.id, {
        profile: { city: "Coimbatore", phone: "" },
        version: updated.version,
        accessRevision: updated.accessRevision,
      });
      assert.equal(partial.profile.city, "Coimbatore");
      assert.equal(
        partial.profile.phone,
        undefined,
        "blank values clear optional information",
      );
      assert.equal(
        partial.profile.affiliation,
        profile.affiliation,
        "omitted profile fields are preserved",
      );
      let current = partial;
      for (const status of ["SUSPENDED", "ACTIVE"]) {
        const next = await platformUpdateCollege("owner", college.id, {
          status,
          version: current.version,
          accessRevision: current.accessRevision,
        });
        assert.deepEqual(
          next.profile,
          current.profile,
          "status-only updates retain profile information",
        );
        assert.equal(next.accessRevision, current.accessRevision + 1);
        current = next;
      }
      const cc = await ctx.models.User.findOne({
        role: "CENTRE_COMMAND",
      }).lean();
      await assert.rejects(
        platformUpdateCollege(cc._id, college.id, { name: "Escalation" }),
        (e) => e.status === 401,
      );
      const cleared = await platformUpdateCollege("owner", college.id, {
        profile: Object.fromEntries(
          Object.keys(profile).map((key) => [key, ""]),
        ),
        version: current.version,
        accessRevision: current.accessRevision,
      });
      assert.deepEqual(cleared.profile, {});
      const afterMapping = await College.collection.findOne({
        _id: college.id,
      });
      assert.equal(afterMapping.dbName, mapping.dbName);
      assert.equal(afterMapping.connectionProfile, mapping.connectionProfile);
      assert.deepEqual(
        await inventoryDatabase(ctx.connection),
        before,
        "college edits leave all tenant collections byte-for-byte unchanged",
      );
      const { PlatformAudit } = await registryModels();
      const audit = await PlatformAudit.findOne({
        collegeId: college.id,
        action: "COLLEGE_UPDATED",
        "detail.after.profile.city": "Coimbatore",
      }).lean();
      assert.ok(
        audit,
        "saved profile changes are recorded in the existing audit trail",
      );
    } finally {
      await closeCollegeConnections();
      await mongoose.disconnect();
      for (const key of Object.keys(process.env))
        if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  },
);
