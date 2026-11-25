import { createHash } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { scope, permitted, cohortOf } from "./access-scope.js";
import { requiredText, fail } from "./day-one-rules.js";
import { trophyLeague } from "./trophy-leagues.js";
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function staff(access) {
  if (
    !["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(access.user.role) ||
    !permitted(access.user, "game:write")
  )
    fail("Trophy record access requires authorised MC or CC access.", 403);
}
export async function trophyConductSnapshot(actor, targetId = null) {
  await connect();
  const access = await scope(actor),
    own = access.user.role === "GAMER";
  if (!own) staff(access);
  const ids = own ? [access.user._id] : access.userIds;
  if (
    targetId &&
    (typeof targetId !== "string" ||
      targetId.length > 100 ||
      !ids.includes(targetId))
  )
    fail("Player is outside your authorised scope.", 403);
  const [players, decisions] = await Promise.all([
    models.User.find({
      _id: { $in: ids },
      active: { $ne: false },
      role: "GAMER",
    })
      .select("_id name trophies trophyConductRevision")
      .lean(),
    models.TrophyConduct.find({
      cohortId: cohortOf(access.user),
      userId: targetId || { $in: ids },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .lean(),
  ]);
  return JSON.parse(
    JSON.stringify({ rules: [], disabled: true, players, decisions }),
  );
}
// The retired conduct endpoint only supports CC undoing a historical deduction.
// New warnings and penalties cannot be created, even through a stale client.
export async function trophyConductAction(actor, body, now = new Date()) {
  if (body.action !== "RESTORE")
    fail(
      "Conduct trophy deductions have been removed. Correct the original result to reverse invalid rewards.",
      410,
    );
  if (body.amount !== undefined)
    fail("A reversal restores only the recorded amount.");
  const userId = requiredText(body.userId, "Player", 1, 100),
    originalId = requiredText(body.originalId, "Original deduction", 1, 200),
    eventKey = requiredText(body.eventKey, "Decision key", 8, 100);
  const reason = requiredText(body.reason, "Reversal reason", 10, 2000),
    evidence = requiredText(body.evidence, "Supporting evidence", 20, 4000);
  const fingerprint = hash({
    userId,
    action: "RESTORE",
    originalId,
    reason,
    evidence,
  });
  const receipt = (row) => ({
    success: true,
    decision: JSON.parse(JSON.stringify(row)),
    league: trophyLeague(row.after),
  });
  try {
    return await transaction(async (session) => {
      const access = await scope(actor, session);
      staff(access);
      if (access.user.role !== "CENTRE_COMMAND")
        fail(
          "Only Centre Command can reverse a historical trophy deduction.",
          403,
        );
      if (!access.userIds.includes(userId))
        fail("Player is outside your authorised scope.", 403);
      const cohortId = cohortOf(access.user);
      const prior = await models.TrophyConduct.findOne({ eventKey })
        .session(session)
        .lean();
      if (prior) {
        if (
          prior.fingerprint !== fingerprint ||
          prior.actorId !== access.user._id ||
          prior.cohortId !== cohortId
        )
          fail("Decision key already used.", 409);
        return receipt(prior);
      }
      const original = await models.TrophyConduct.findOne({
        _id: originalId,
        cohortId,
        userId,
        action: "DEDUCT",
      })
        .session(session)
        .lean();
      if (
        !original ||
        !Number.isFinite(original.amount) ||
        original.amount >= 0
      )
        fail("Choose a recorded deduction for this player.", 404);
      // Check by originalId as well as ID: earlier software used a different key.
      if (
        await models.TrophyConduct.exists({
          cohortId,
          userId,
          action: "RESTORE",
          originalId,
        }).session(session)
      )
        fail("This deduction has already been reversed.", 409);
      const player = await models.User.findOne({
        _id: userId,
        active: { $ne: false },
        role: "GAMER",
      }).session(session);
      if (!player) fail("Active player not found.", 404);
      if (
        !Number.isInteger(body.balanceVersion) ||
        body.balanceVersion !== (player.trophyConductRevision || 0) ||
        body.balanceBefore !== player.trophies
      )
        fail("The balance changed. Refresh before reversing.", 409);
      const before = player.trophies,
        amount = -original.amount;
      player.trophies += amount;
      player.trophyConductRevision = (player.trophyConductRevision || 0) + 1;
      await player.save({ session });
      const row = {
        _id: hash([cohortId, userId, "RESTORE", originalId]),
        cohortId,
        userId,
        actorId: access.user._id,
        actorRole: access.user.role,
        action: "RESTORE",
        originalId,
        incidentRef: `Reversal of ${original.incidentRef}`,
        reason,
        evidence,
        fingerprint,
        eventKey,
        requestedAmount: amount,
        amount,
        before,
        after: player.trophies,
        createdAt: now,
      };
      await models.TrophyConduct.create([row], { session });
      return receipt(row);
    });
  } catch (error) {
    if (error.code === 11000) {
      const access = await scope(actor);
      staff(access);
      if (
        access.user.role !== "CENTRE_COMMAND" ||
        !access.userIds.includes(userId)
      )
        fail("Outside your authorised scope.", 403);
      const saved = await models.TrophyConduct.findOne({
        eventKey,
        cohortId: cohortOf(access.user),
        userId,
        actorId: access.user._id,
      }).lean();
      if (saved?.fingerprint === fingerprint) return receipt(saved);
      fail(
        "This historical deduction was already reversed. Refresh the receipts.",
        409,
      );
    }
    throw error;
  }
}
