import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { models, transaction } from "./db.js";
import { collegeContext, tenancyEnabled } from "./college-context.js";
import { passwordChangeRequired } from "./college-password.js";
import { requireExpedition } from "./player-stage.js";
const fail = (message, status = 403) => {
  throw Object.assign(new Error(message), { status });
};
const digest = (secret) => createHash("sha256").update(secret).digest();
async function member(actor, session = null) {
  const user = await models.User.findById(actor._id).session(session).lean();
  if (!user || user.active === false || user.role !== "GAMER" || !user.teamId)
    fail("An active player with a team is required.");
  await requireExpedition(user, session);
  if (tenancyEnabled() && (await passwordChangeRequired(user._id)))
    fail("Set your permanent password before connecting local code.", 403);
  const cohortId = user.cohortId || "alpha";
  if (
    !(await models.Team.exists({ _id: user.teamId, cohortId }).session(session))
  )
    fail("Your team is no longer available.");
  return { user, projectId: JSON.stringify([cohortId, user.teamId]) };
}
export async function createLocalGrant(actor, body, origin) {
  const token = randomBytes(32).toString("base64url"),
    grantId = randomUUID();
  return transaction(async (session) => {
    const m = await member(actor, session);
    if (body.projectId !== m.projectId)
      fail("Your team changed. Reopen the project.", 409);
    const now = new Date(),
      expiresAt = new Date(+now + 12 * 3600000);
    await models.TeamLabLocalGrant.create(
      [
        {
          _id: grantId,
          projectId: m.projectId,
          userId: m.user._id,
          secretHash: digest(token).toString("hex"),
          authVersion: m.user.authVersion || 1,
          collegeRevision: collegeContext()?.college.accessRevision,
          createdAt: now,
          expiresAt,
        },
      ],
      { session },
    );
    const collegeId = collegeContext()?.college._id || null;
    return {
      grantId,
      expiresAt,
      config: {
        format: 1,
        origin,
        grantId,
        token,
        collegeId,
        projectId: m.projectId,
        scopeKey: collegeId
          ? `college:${collegeId}:project:${m.projectId}`
          : `project:${m.projectId}`,
        expiresAt,
      },
    };
  });
}
export async function listLocalGrants(actor) {
  const m = await member(actor);
  return {
    connections: await models.TeamLabLocalGrant.find({
      userId: m.user._id,
      projectId: m.projectId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("_id createdAt expiresAt lastSeenAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  };
}
export async function revokeLocalGrant(actor, body) {
  const user = await models.User.findById(actor._id).lean();
  if (!user || user.active === false) fail("Please sign in.", 401);
  await models.TeamLabLocalGrant.updateOne(
    { _id: body.grantId, userId: user._id },
    { $set: { revokedAt: new Date() } },
  );
  return { success: true };
}
export async function authenticateLocalGrant(grantId, token) {
  if (
    typeof grantId !== "string" ||
    grantId.length > 80 ||
    typeof token !== "string" ||
    token.length > 100
  )
    fail("Local connection is invalid or expired.", 401);
  const grant = await models.TeamLabLocalGrant.findById(grantId).lean();
  if (!grant || grant.revokedAt || new Date(grant.expiresAt) <= new Date())
    fail(
      "Local connection is expired or disconnected. Download a new connection package.",
      401,
    );
  const expected = Buffer.from(grant.secretHash, "hex"),
    actual = digest(token);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    fail("Local connection is invalid or expired.", 401);
  const m = await member({ _id: grant.userId });
  if (
    collegeContext() &&
    grant.collegeRevision !== collegeContext().college.accessRevision
  )
    fail("College access changed. Connect again from your college lab.", 401);
  if (
    m.projectId !== grant.projectId ||
    (m.user.authVersion || 1) !== grant.authVersion
  )
    fail("Your account or team changed. Connect again from the lab.", 401);
  if (!grant.lastSeenAt || Date.now() - new Date(grant.lastSeenAt) > 30000)
    await models.TeamLabLocalGrant.updateOne(
      { _id: grant._id },
      { $set: { lastSeenAt: new Date() } },
    );
  return { user: m.user, projectId: grant.projectId };
}
