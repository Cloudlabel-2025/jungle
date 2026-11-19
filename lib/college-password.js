import { randomUUID } from "node:crypto";
import { models, transaction } from "./db.js";
import { hashPassword, checkPassword } from "./password.js";
import { collegeError } from "./college-registry.js";

export async function passwordChangeRequired(userId) {
  const credential = await models.Credential.findById(userId).select("mustChangePassword").lean();
  // Legacy credentials are initial passwords until their owner records a change.
  return Boolean(credential && credential.mustChangePassword !== false);
}

export async function setPermanentPassword(user, { newPassword, confirmPassword }) {
  if (!user || !["CENTRE_COMMAND", "MISSION_COMMANDER", "GAMER"].includes(user.role)) throw collegeError("Please sign in.", 401);
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 256) throw collegeError("Use a password containing 8–256 characters.");
  if (newPassword !== confirmPassword) throw collegeError("The passwords do not match.");
  const credential = await models.Credential.findById(user._id).lean();
  if (!credential || credential.mustChangePassword === false) throw collegeError("Your initial password has already been changed. Sign in again.", 409);
  if (await checkPassword(newPassword, credential.passwordHash)) throw collegeError("Choose a new password different from your initial password.");
  const passwordHash = await hashPassword(newPassword), version = user.authVersion || 1;
  await transaction(async session => {
    const match = version === 1 ? { $or: [{ authVersion: 1 }, { authVersion: { $exists: false } }] } : { authVersion: version };
    const updated = await models.User.updateOne({ _id: user._id, active: { $ne: false }, ...match }, { $set: { authVersion: version + 1 } }, { session });
    if (!updated.matchedCount) throw collegeError("Your account changed. Sign in again.", 401);
    const saved = await models.Credential.updateOne({ _id: user._id, passwordHash: credential.passwordHash, mustChangePassword: { $ne: false } },
      { $set: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), failures: 0, lockedUntil: null } }, { session });
    if (!saved.matchedCount) throw collegeError("Your password changed elsewhere. Sign in again.", 409);
    await models.PlatformManagementEvent.create([{ _id: randomUUID(), actorId: user._id, action: "INITIAL_PASSWORD_CHANGED", cohortId: user.cohortId, details: { userId: user._id } }], { session });
  });
}
