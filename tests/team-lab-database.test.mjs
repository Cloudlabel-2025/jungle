import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, createModels } from "../lib/db.js";
import { runWithCollege } from "../lib/college-context.js";
import { pilotFixture } from "./pilot-fixture.mjs";
import {
  readTeamLab,
  saveTeamLab,
  heartbeatTeamLab,
  listTeamLabs,
  reviewTeamLab,
} from "../lib/team-lab.js";
import { randomUUID } from "node:crypto";
import {
  createLocalGrant,
  authenticateLocalGrant,
  revokeLocalGrant,
  listLocalGrants,
} from "../lib/team-lab-local-grants.js";
if (process.env.TEST_MONGODB_URI) {
  const uri = new URL(process.env.TEST_MONGODB_URI);
  uri.pathname = `/team_lab_${Date.now()}`;
  process.env.MONGODB_URI = uri.toString();
}

test(
  "team lab isolates projects and merges simultaneous work without losing source",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const { gamers, teams, cc, cc2, mc, otherMC } = await pilotFixture(2),
      [a, b] = gamers;
    try {
      const [initial, peer, other] = await Promise.all([
        readTeamLab(a),
        readTeamLab(b),
        readTeamLab(gamers[5]),
      ]);
      assert.equal(initial.projectId, peer.projectId);
      assert.notEqual(initial.projectId, other.projectId);
      await assert.rejects(readTeamLab(cc, { teamId: "outside" }), {
        status: 403,
      });
      assert.deepEqual(
        (await readTeamLab(cc, { teamId: teams[0].id })).files,
        initial.files,
      );
      const local = await createLocalGrant(
        a,
        { projectId: initial.projectId },
        "http://localhost:3191",
      );
      assert.equal(
        (await authenticateLocalGrant(local.grantId, local.config.token))
          .projectId,
        initial.projectId,
      );
      assert.equal((await listLocalGrants(a)).connections.length, 1);
      assert.notEqual(
        (await models.TeamLabLocalGrant.findById(local.grantId).lean())
          .secretHash,
        local.config.token,
      );
      await assert.rejects(
        authenticateLocalGrant(local.grantId, "wrong-token"),
        { status: 401 },
      );
      await assert.rejects(
        createLocalGrant(
          cc,
          { projectId: initial.projectId },
          "http://localhost:3191",
        ),
        { status: 403 },
      );
      await revokeLocalGrant(b, { grantId: local.grantId });
      assert.ok(
        await authenticateLocalGrant(local.grantId, local.config.token),
      );
      await revokeLocalGrant(a, { grantId: local.grantId });
      await assert.rejects(
        authenticateLocalGrant(local.grantId, local.config.token),
        { status: 401 },
      );
      const expiring = await createLocalGrant(
        a,
        { projectId: initial.projectId },
        "http://localhost:3191",
      );
      await models.TeamLabLocalGrant.updateOne(
        { _id: expiring.grantId },
        { $set: { expiresAt: new Date(0) } },
      );
      await assert.rejects(
        authenticateLocalGrant(expiring.grantId, expiring.config.token),
        { status: 401 },
      );
      const ctx = {
        college: { _id: "local-connection-qa", accessRevision: 1 },
        connection: mongoose.connection,
        models: createModels(mongoose.connection),
      };
      const bound = await runWithCollege(ctx, () =>
        createLocalGrant(
          a,
          { projectId: initial.projectId },
          "http://localhost:3191",
        ),
      );
      await assert.rejects(
        runWithCollege(
          { ...ctx, college: { ...ctx.college, accessRevision: 2 } },
          () => authenticateLocalGrant(bound.grantId, bound.config.token),
        ),
        { status: 401 },
      );
      await models.Team.updateOne(
        { _id: teams[1].id },
        { $set: { commanderId: otherMC._id } },
      );
      assert.equal((await listTeamLabs(mc)).teams.length, 1);
      await assert.rejects(readTeamLab(mc, { teamId: teams[1].id }), {
        status: 403,
      });
      const review = (actor, status, version = 0, extra = {}) =>
        reviewTeamLab(actor, {
          projectId: initial.projectId,
          teamId: teams[0].id,
          expectedVersion: version,
          status,
          feedback: "Verified fictional source and expected output.",
          requestId: randomUUID(),
          ...extra,
        });
      await assert.rejects(review(a, "APPROVED"), { status: 403 });
      await review(a, "REQUESTED");
      await review(a, "REQUESTED");
      assert.equal(
        await models.TeamLabReview.countDocuments({ status: "REQUESTED" }),
        1,
      );
      await review(mc, "CHANGES_REQUESTED", 0, {
        path: "src/App.jsx",
        line: 1,
        feedback: "Add a clear comment explaining the React import.",
      });
      const requestId = randomUUID();
      await review(cc, "APPROVED", 0, { requestId });
      await review(cc, "APPROVED", 0, { requestId });
      assert.equal(
        await models.TeamLabReview.countDocuments({ status: "APPROVED" }),
        1,
      );
      await assert.rejects(
        review(cc, "APPROVED", 0, {
          requestId,
          feedback: "Different feedback with the same receipt identifier.",
        }),
        { status: 409 },
      );
      await assert.rejects(
        review(mc, "COMMENT", 0, { path: "src/missing.js" }),
        { status: 400 },
      );
      await assert.rejects(
        review(mc, "COMMENT", 0, { path: "src/App.jsx", line: 999999 }),
        { status: 400 },
      );
      await models.User.updateOne(
        { _id: cc2._id },
        { $set: { permissions: ["reports:read"] } },
      );
      assert.ok((await readTeamLab(cc2, { teamId: teams[0].id })).files);
      await assert.rejects(review(cc2, "APPROVED"), { status: 403 });
      await models.User.updateOne(
        { _id: gamers[4]._id },
        { $unset: { teamId: 1 } },
      );
      await assert.rejects(readTeamLab(gamers[4]), { status: 403 });
      const save = (user, files, version = 0, projectId = initial.projectId) =>
        saveTeamLab(user, { files, expectedVersion: version, projectId });
      const left = {
          ...initial.files,
          "src/styles.css":
            initial.files["src/styles.css"] + "\n/* Player A */\n",
        },
        right = {
          ...peer.files,
          "README.md": peer.files["README.md"] + "\nPlayer B\n",
        };
      await Promise.all([save(a, left), save(b, right)]);
      const combined = await readTeamLab(a);
      assert.equal(combined.version, 2);
      await assert.rejects(review(cc, "APPROVED", 0), { status: 409 });
      await review(cc, "COMMENT", 0, {
        feedback: "This historical snapshot is retained for comparison.",
      });
      const received = (await readTeamLab(b)).reviews;
      assert.ok(
        received.some(
          (r) =>
            r.status === "CHANGES_REQUESTED" && r.role === "MISSION_COMMANDER",
        ),
      );
      assert.ok(
        received.some(
          (r) => r.status === "APPROVED" && r.role === "CENTRE_COMMAND",
        ),
      );
      assert.ok(
        !received.some((r) => r.version === 2 && r.status === "APPROVED"),
      );
      assert.match(combined.files["src/styles.css"], /Player A/);
      assert.match(combined.files["README.md"], /Player B/);
      const base = combined.files,
        v = combined.version;
      await save(a, { ...base, "README.md": "first\n" + base["README.md"] }, v);
      const both = await save(
        b,
        { ...base, "README.md": base["README.md"] + "last\n" },
        v,
      );
      assert.equal(both.conflict, undefined);
      assert.match(both.files["README.md"], /^first/);
      assert.match(both.files["README.md"], /last\n$/);
      const newer = await readTeamLab(a),
        first = { ...newer.files, "README.md": "A replacement\n" },
        second = { ...newer.files, "README.md": "B replacement\n" };
      await save(a, first, newer.version);
      const conflict = await save(b, second, newer.version);
      assert.equal(conflict.conflict, true);
      assert.deepEqual(conflict.conflicts, ["README.md"]);
      assert.equal(conflict.files["README.md"], "A replacement\n");
      assert.equal((await readTeamLab(a)).version, newer.version + 1);
      await assert.rejects(save(a, first, 999999), { status: 409 });
      await assert.rejects(save(gamers[5], first, newer.version), {
        status: 409,
      });
      await assert.rejects(save(a, { ...first, "../secret": "oops" }, 0), {
        status: 400,
      });
      const history = await readTeamLab(b, { revision: 0 });
      assert.deepEqual(history.files, initial.files);
      await heartbeatTeamLab(a, {
        projectId: initial.projectId,
        path: "src/App.jsx",
      });
      assert.equal((await readTeamLab(b)).presence[0].name, a.name);
      assert.deepEqual((await readTeamLab(gamers[5])).presence, []);
      const unchanged = await readTeamLab(a, { version: newer.version + 1 });
      assert.equal(unchanged.files, undefined);
      assert.equal(unchanged.version, newer.version + 1);
      assert.equal(unchanged.presence[0].name, a.name);
      assert.ok(unchanged.history.length > 0);
      const changed = await readTeamLab(a, { version: 0 });
      assert.equal(changed.version, unchanged.version);
      assert.equal(changed.files["README.md"], "A replacement\n");
      await models.User.updateOne(
        { _id: a._id },
        { $set: { teamId: teams[1].id } },
      );
      await assert.rejects(save(a, first, newer.version + 1), { status: 409 });
      await models.User.updateOne({ _id: b._id }, { $set: { active: false } });
      await assert.rejects(readTeamLab(b), { status: 403 });
      const revisions = await models.TeamLabRevision.find({
        projectId: initial.projectId,
      }).lean();
      assert.ok(revisions.some((r) => r.userId === a._id));
      assert.ok(revisions.some((r) => r.userId === b._id));
      const latest = await readTeamLab(gamers[2]);
      const raced = await Promise.allSettled([
        saveTeamLab(gamers[2], {
          projectId: latest.projectId,
          expectedVersion: latest.version,
          files: {
            ...latest.files,
            "README.md": latest.files["README.md"] + "\nConcurrent edit\n",
          },
        }),
        review(cc, "APPROVED", latest.version),
      ]);
      assert.equal(raced[0].status, "fulfilled");
      if (raced[1].status === "rejected")
        assert.equal(raced[1].reason.status, 409);
      else assert.equal(raced[1].value.review.version, latest.version);
      assert.equal((await readTeamLab(gamers[2])).version, latest.version + 1);
      const current = await readTeamLab(gamers[2]);
      await review(cc, "APPROVED", current.version);
      await models.TeamLabReview.insertMany(
        Array.from({ length: 41 }, (_, i) => ({
          _id: `historical-note-${i}`,
          projectId: initial.projectId,
          version: 0,
          sequence: 1000 + i,
          userId: cc._id,
          author: cc.name,
          role: cc.role,
          status: "COMMENT",
          feedback: "Historical comparison only.",
          createdAt: new Date(),
        })),
      );
      const bounded = await readTeamLab(gamers[2]);
      assert.equal(bounded.reviews.length, 40);
      assert.equal(bounded.currentReview.version, current.version);
      assert.equal(bounded.currentReview.status, "APPROVED");
    } finally {
      await mongoose.disconnect();
    }
  },
);
