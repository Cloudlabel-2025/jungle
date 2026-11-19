import mongoose from "mongoose";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { registryModels, collegeError } from "./college-registry.js";
import { registerModel } from "./model-registry.js";
import { hashPassword, checkPassword } from "./password.js";

export async function platformModels() {
  const { connection } = await registryModels();
  const PlatformAdmin = registerModel(connection, "PlatformAdmin", new mongoose.Schema({
    _id: { type: String, required: true }, name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true }, mustChangePassword: { type: Boolean, default: true },
    passwordVersion: { type: Number, default: 1 }, failures: { type: Number, default: 0 },
    managementVersion: { type: Number, default: 1 },
    lockedUntil: Date, createdAt: { type: Date, default: Date.now },
  }, { strict: "throw", versionKey: false }));
  const sessionSchema = new mongoose.Schema({
    _id: String, adminId: { type: String, required: true }, passwordVersion: Number,
    expiresAt: { type: Date, required: true }, createdAt: { type: Date, default: Date.now },
  }, { strict: "throw", versionKey: false });
  sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const PlatformSession = registerModel(connection, "PlatformSession", sessionSchema);
  const PlatformControl = registerModel(connection, "PlatformControl", new mongoose.Schema({ _id: String, revision: { type: Number, default: 0 } }, { versionKey: false }));
  return { PlatformAdmin, PlatformSession, PlatformControl };
}
export const publicAdmin = admin => admin ? ({ id: admin._id, name: admin.name, email: admin.email,
  mustChangePassword: Boolean(admin.mustChangePassword) }) : null;
const sessionHash = token => createHash("sha256").update(token).digest("hex");
let dummyHash;
export async function authenticatePlatform(email, password) {
  if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || password.length > 256)
    throw collegeError("Invalid email or password.", 401);
  const { PlatformAdmin } = await platformModels();
  const admin = await PlatformAdmin.findOne({ email: email.trim().toLowerCase(), active: true }).select("+passwordHash").lean();
  dummyHash ||= hashPassword(randomBytes(32).toString("hex"));
  const valid = await checkPassword(password, admin?.passwordHash || await dummyHash);
  if (!admin || admin.lockedUntil > new Date()) throw collegeError("Invalid credentials or account temporarily locked.", 401);
  if (!valid) {
    const attempt = await PlatformAdmin.findOneAndUpdate({ _id: admin._id }, { $inc: { failures: 1 } }, { new: true });
    if (attempt.failures >= 5) await PlatformAdmin.updateOne({ _id: admin._id },
      { $set: { failures: 0, lockedUntil: new Date(Date.now() + 15 * 60000) } });
    throw collegeError("Invalid credentials or account temporarily locked.", 401);
  }
  const current = await PlatformAdmin.findOneAndUpdate({ _id: admin._id, active: true,
    passwordVersion: admin.passwordVersion, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }] },
    { $set: { failures: 0, lockedUntil: null } }, { new: true }).lean();
  if (!current) throw collegeError("Please try signing in again.", 401);
  return current;
}
export async function createPlatformSession(admin) {
  const { PlatformSession } = await platformModels();
  const token = randomBytes(32).toString("hex");
  await PlatformSession.create({ _id: sessionHash(token), adminId: admin._id,
    passwordVersion: admin.passwordVersion, expiresAt: new Date(Date.now() + 8 * 3600000) });
  return token;
}
export async function platformAdminFromToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  const { PlatformAdmin, PlatformSession } = await platformModels();
  const session = await PlatformSession.findOne({ _id: sessionHash(token), expiresAt: { $gt: new Date() } }).lean();
  return session ? PlatformAdmin.findOne({ _id: session.adminId, active: true,
    passwordVersion: session.passwordVersion }).lean() : null;
}
export async function revokePlatformSession(token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return;
  const { PlatformSession } = await platformModels();
  await PlatformSession.deleteOne({ _id: sessionHash(token) });
}
export async function requirePlatformAdmin(id, { allowPasswordChange = false } = {}) {
  const { PlatformAdmin } = await platformModels();
  const admin = typeof id === "string" ? await PlatformAdmin.findOne({ _id: id, active: true }).lean() : null;
  if (!admin) throw collegeError("Super admin access required.", 401);
  if (admin.mustChangePassword && !allowPasswordChange) throw collegeError("Change your temporary password before managing colleges.", 403);
  return admin;
}
export async function changePlatformPassword(adminId, currentPassword, newPassword) {
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 256)
    throw collegeError("Use a new password containing 8–256 characters.");
  const { PlatformAdmin, PlatformSession } = await platformModels();
  const admin = await PlatformAdmin.findOne({ _id: adminId, active: true }).select("+passwordHash").lean();
  if (!admin || !(await checkPassword(currentPassword, admin.passwordHash))) throw collegeError("Current password is incorrect.", 400);
  if (await checkPassword(newPassword, admin.passwordHash)) throw collegeError("Choose a different new password.");
  const next = await PlatformAdmin.findOneAndUpdate({ _id: adminId, passwordHash: admin.passwordHash },
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, failures: 0, lockedUntil: null },
      $inc: { passwordVersion: 1 } }, { new: true }).lean();
  if (!next) throw collegeError("Account changed. Please sign in again.", 409);
  await PlatformSession.deleteMany({ adminId });
  const { PlatformAudit } = await registryModels();
  await PlatformAudit.create({ _id: randomUUID(), actor: adminId, action: "PLATFORM_PASSWORD_CHANGED", detail: {} });
  return next;
}
