import mongoose from "mongoose";
import { randomUUID, randomBytes, createHash, createCipheriv, createDecipheriv } from "node:crypto";
import { registryModels, contextForCollege, collegeError, collegeSignInSelector } from "./college-registry.js";
import { registerModel } from "./model-registry.js";
import { platformModels, requirePlatformAdmin } from "./platform-auth.js";
import { hashPassword } from "./password.js";
import { recoveryMailStatus, sendRecoveryMail } from "./recovery-mail.js";
import { validMailAddress } from "./mail-address.js";
import { buildCollegeUrl } from "./college-routing.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const invalid = () => collegeError("This reset link is invalid, expired or already used. Request a new link.", 400);
function encryptionKey() {
  if (process.env.SESSION_SECRET?.length < 32 || !process.env.SESSION_SECRET) throw collegeError("Recovery encryption is not configured.", 503);
  return createHash("sha256").update(`jungle-recovery:${process.env.SESSION_SECRET}`).digest();
}
function encrypt(token) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  return { iv: iv.toString("base64"), data: Buffer.concat([cipher.update(token, "utf8"), cipher.final()]).toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}
function decrypt(value) {
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  cipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([cipher.update(Buffer.from(value.data, "base64")), cipher.final()]).toString("utf8");
}
export async function recoveryModels() {
  const { connection } = await registryModels();
  const schema = new mongoose.Schema({ _id: String, targetKey: String, realm: String, collegeId: String,
    userId: String, name: String, email: String, authVersion: Number, active: Boolean,
    tokenHash: { type: String, select: false }, encrypted: { type: mongoose.Schema.Types.Mixed, select: false },
    state: String, delivery: String, deliveryAttempts: { type: Number, default: 0 }, failureCode: String,
    createdAt: Date, expiresAt: Date, sentAt: Date, usedAt: Date, leaseUntil: Date, leaseOwner: String,
    deliveryLease: Date, deliveryOwner: String,
  }, { strict: "throw", versionKey: false });
  schema.index({ targetKey: 1 }, { unique: true, partialFilterExpression: { active: true } });
  schema.index({ tokenHash: 1 }, { unique: true, partialFilterExpression: { tokenHash: { $type: "string" } } });
  const RecoveryCase = registerModel(connection, "RecoveryCase", schema);
  const throttle = new mongoose.Schema({ _id: String, count: Number, expiresAt: Date }, { versionKey: false });
  throttle.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return { connection, RecoveryCase, RecoveryThrottle: registerModel(connection, "RecoveryThrottle", throttle) };
}
async function target(realm, collegeId, userId) {
  if (realm === "platform") {
    const { PlatformAdmin } = await platformModels();
    const user = await PlatformAdmin.findOne({ _id: userId, active: true }).lean();
    return user ? { user, version: user.passwordVersion || 1 } : null;
  }
  const context = await contextForCollege({ _id: collegeId });
  const user = await context.models.User.findOne({ _id: userId, active: { $ne: false } }).lean();
  if (!user || !(await context.models.Credential.exists({ _id: userId }))) return null;
  return { user, version: user.authVersion || 1, context };
}
async function queue(realm, collegeId, userId) {
  const found = await target(realm, collegeId, userId);
  if (!found || !validMailAddress(found.user.email) || found.user.email.endsWith(".invalid")) return null;
  const { RecoveryCase } = await recoveryModels(); await RecoveryCase.init();
  const now = new Date(), targetKey = hash(`${realm}:${collegeId || ""}:${userId}`);
  await RecoveryCase.updateMany({ targetKey, active: true, expiresAt: { $lte: now } },
    { $set: { active: false, state: "EXPIRED" }, $unset: { encrypted: "" } });
  await RecoveryCase.updateMany({ targetKey, active: true, $or: [{ authVersion: { $ne: found.version } }, { email: { $ne: found.user.email } }] },
    { $set: { active: false, state: "CANCELLED" }, $unset: { encrypted: "" } });
  const token = randomBytes(32).toString("hex"), id = randomUUID();
  try {
    const row = await RecoveryCase.findOneAndUpdate({ targetKey, active: true }, { $setOnInsert: {
      _id: id, realm, collegeId, userId, name: found.user.name, email: found.user.email,
      authVersion: found.version, active: true, state: "OPEN", delivery: "PENDING", tokenHash: hash(token),
      encrypted: encrypt(token), createdAt: now, expiresAt: new Date(now.getTime() + 30 * 60000),
    } }, { upsert: true, new: true }).lean();
    return row._id;
  } catch (e) { if (e.code === 11000) return (await RecoveryCase.findOne({ targetKey, active: true }).lean())?._id; throw e; }
}
export const recoveryResponse = { message: "If an active account matches, a password reset has been requested. Check your inbox or contact your administrator." };
export async function requestPasswordRecovery(body) {
  const realm = body.realm === "platform" ? "platform" : "college";
  if (typeof body.identifier !== "string" || !body.identifier.trim() || body.identifier.length > 254) throw collegeError("Enter your username or email.");
  encryptionKey(); // Configuration errors must not depend on whether an account exists.
  const identifier = body.identifier.trim().toLowerCase();
  const { RecoveryThrottle } = await recoveryModels();
  const bucket = Math.floor(Date.now() / (15 * 60000));
  let context;
  for (const [index, limit] of [1000, 5].entries()) {
    if (index === 1 && realm === "college") {
      try { context = await contextForCollege(collegeSignInSelector(body)); }
      catch (error) { if ([400, 403, 404].includes(error.status)) return null; throw error; }
    }
    const scope = index === 0 ? "global" : hash(`${realm}:${context?.college._id || ""}:${identifier}`);
    let rate;
    try { rate = await RecoveryThrottle.findOneAndUpdate({ _id: `${scope}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 30 * 60000) } }, { upsert: true, new: true }).lean(); }
    catch (e) { if (e.code !== 11000) throw e; rate = await RecoveryThrottle.findOneAndUpdate({ _id: `${scope}:${bucket}` }, { $inc: { count: 1 } }, { new: true }).lean(); }
    if (rate.count > limit) return null;
  }
  if (realm === "platform") {
    const { PlatformAdmin } = await platformModels();
    const user = await PlatformAdmin.findOne({ email: identifier, active: true }).lean();
    return user ? queue(realm, undefined, user._id) : null;
  }
  try {
    const user = await context.models.User.findOne({ ...(identifier.includes("@") ? { email: identifier } : { username: identifier }), active: { $ne: false } }).lean();
    return user ? queue(realm, context.college._id, user._id) : null;
  } catch (error) { if ([400, 403, 404].includes(error.status)) return null; throw error; }
}
export async function requestAccountRecovery(actorId, body) {
  await requirePlatformAdmin(actorId);
  if (!["college", "platform"].includes(body.realm) || typeof body.userId !== "string" || body.userId.length > 200) throw collegeError("Select an account.");
  if (body.realm === "platform") body = { ...body, collegeId: undefined };
  else if (typeof body.collegeId !== "string" || body.collegeId.length > 100) throw collegeError("Select a college.");
  if (body.replace === true) {
    const { RecoveryCase } = await recoveryModels();
    await RecoveryCase.updateMany({ targetKey: hash(`${body.realm}:${body.collegeId || ""}:${body.userId}`), active: true },
      { $set: { active: false, state: "CANCELLED" }, $unset: { encrypted: "" } });
  }
  const id = await queue(body.realm, body.collegeId, body.userId);
  if (!id) throw collegeError("This active account needs a deliverable email address before password recovery.");
  const { PlatformAudit } = await registryModels();
  await PlatformAudit.create({ _id: randomUUID(), collegeId: body.collegeId, actor: actorId, action: "RECOVERY_REQUESTED", detail: { targetId: body.userId, realm: body.realm, state: "COMPLETED" } });
  return { id };
}
export async function deliverRecoveryMail(id, { send = sendRecoveryMail } = {}) {
  const { RecoveryCase } = await recoveryModels();
  const status = recoveryMailStatus();
  if (send === sendRecoveryMail && !status.ready) {
    await RecoveryCase.updateOne({ _id: id, active: true, delivery: { $ne: "SENT" } }, { $set: { delivery: "BLOCKED", failureCode: "CONFIGURATION" } });
    return { state: "BLOCKED" };
  }
  const owner = randomUUID(), now = new Date();
  const row = await RecoveryCase.findOneAndUpdate({ _id: id, active: true, expiresAt: { $gt: now }, delivery: { $ne: "SENT" },
    $or: [{ deliveryLease: null }, { deliveryLease: { $lt: now } }] },
    { $set: { deliveryLease: new Date(Date.now() + 60000), deliveryOwner: owner }, $inc: { deliveryAttempts: 1 } }, { new: true }).select("+encrypted").lean();
  if (!row) return { state: "UNCHANGED" };
  try {
    const found = await target(row.realm, row.collegeId, row.userId);
    if (!found || found.version !== row.authVersion || found.user.email !== row.email) {
      await RecoveryCase.updateOne({ _id: id, deliveryOwner: owner }, { $set: { active: false, state: "CANCELLED" }, $unset: { encrypted: "" } });
      return { state: "CANCELLED" };
    }
    const origin = status.origin || "https://recovery.example";
    const resetBase = row.realm === "college" ? buildCollegeUrl(found.context.college.slug, origin, {
      rootDomain: process.env.COLLEGE_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "", pathname: "/recover",
    }) : `${origin}/recover`;
    const url = `${resetBase}?realm=${row.realm}#token=${decrypt(row.encrypted)}`;
    await send({ to: row.email, text: `Hello ${row.name},\n\nUse this link to reset your Jungle password:\n${url}\n\nThis link expires in 30 minutes and works once. If you did not request it, ignore this email. Your password has not changed.`,
      messageId: `<recovery-${id}@${new URL(origin).hostname}>` });
    await RecoveryCase.updateOne({ _id: id, deliveryOwner: owner }, { $set: { delivery: "SENT", sentAt: new Date() }, $unset: { failureCode: "", deliveryLease: "", deliveryOwner: "" } });
    return { state: "SENT" };
  } catch (e) {
    await RecoveryCase.updateOne({ _id: id, deliveryOwner: owner }, { $set: { delivery: "FAILED", failureCode: e.code === "AUTHORIZATION" || e.code === "EAUTH" ? "AUTHORIZATION" : "DELIVERY" }, $unset: { deliveryLease: "", deliveryOwner: "" } });
    return { state: "FAILED" };
  }
}
export async function completePasswordRecovery(token, password, { collegeId, allowPlatform = false } = {}) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw invalid();
  if (typeof password !== "string" || password.length < 8 || password.length > 256) throw collegeError("Use a password containing 8–256 characters.");
  const { RecoveryCase, connection } = await recoveryModels();
  const owner = randomUUID(), now = new Date();
  const row = await RecoveryCase.findOneAndUpdate({ tokenHash: hash(token), active: true, expiresAt: { $gt: now },
    ...(collegeId ? { $and: [{ $or: [{ realm: "college", collegeId }, ...(allowPlatform ? [{ realm: "platform" }] : [])] }] } : {}),
    $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] }, { $set: { leaseUntil: new Date(Date.now() + 120000), leaseOwner: owner } }, { new: true }).lean();
  if (!row) throw invalid();
  let committed = false;
  try {
    const found = await target(row.realm, row.collegeId, row.userId);
    if (row.realm === "college" && found && found.version !== row.authVersion &&
        await found.context.models.PlatformManagementEvent.exists({ _id: `recovery_${row._id}` })) {
      await RecoveryCase.updateOne({ _id: row._id, leaseOwner: owner }, { $set: { active: false, state: "USED", usedAt: new Date() }, $unset: { encrypted: "", leaseUntil: "", leaseOwner: "" } });
      throw invalid();
    }
    if (!found || found.version !== row.authVersion || found.user.email !== row.email) throw invalid();
    const passwordHash = await hashPassword(password);
    const targetConnection = found.context?.connection || connection, session = await targetConnection.startSession();
    try { await session.withTransaction(async () => {
      if (row.realm === "platform") {
        const { PlatformAdmin, PlatformSession } = await platformModels();
        const changed = await PlatformAdmin.updateOne({ _id: row.userId, active: true, passwordVersion: row.authVersion },
          { $set: { passwordHash, mustChangePassword: false, failures: 0, lockedUntil: null }, $inc: { passwordVersion: 1 } }, { session });
        if (!changed.matchedCount) throw invalid();
        await PlatformSession.deleteMany({ adminId: row.userId }, { session });
        const closed = await RecoveryCase.updateOne({ _id: row._id, active: true, leaseOwner: owner }, { $set: { active: false, state: "USED", usedAt: new Date() }, $unset: { encrypted: "", leaseUntil: "", leaseOwner: "" } }, { session });
        if (!closed.matchedCount) throw invalid();
      } else {
        const { User, Credential, PlatformManagementEvent } = found.context.models;
        const version = row.authVersion === 1 ? { $or: [{ authVersion: 1 }, { authVersion: { $exists: false } }] } : { authVersion: row.authVersion };
        const changed = await User.updateOne({ _id: row.userId, active: { $ne: false }, ...version }, { $set: { authVersion: row.authVersion + 1 } }, { session });
        if (!changed.matchedCount) throw invalid();
        const saved = await Credential.updateOne({ _id: row.userId }, { $set: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), failures: 0, lockedUntil: null } }, { session });
        if (!saved.matchedCount) throw invalid();
        await PlatformManagementEvent.create([{ _id: `recovery_${row._id}`, actorId: row.userId, action: "PASSWORD_RECOVERED", details: { caseId: row._id } }], { session });
      }
    }); committed = true; } finally { await session.endSession(); }
    if (row.realm === "college") await RecoveryCase.updateOne({ _id: row._id, leaseOwner: owner }, { $set: { active: false, state: "USED", usedAt: new Date() }, $unset: { encrypted: "", leaseUntil: "", leaseOwner: "" } });
    return { success: true, realm: row.realm };
  } catch (error) {
    if (error.status === 400) await RecoveryCase.updateOne({ _id: row._id, active: true, leaseOwner: owner }, { $set: { active: false, state: "CANCELLED" }, $unset: { encrypted: "" } });
    else if (!committed) await RecoveryCase.updateOne({ _id: row._id, leaseOwner: owner }, { $unset: { leaseUntil: "", leaseOwner: "" } });
    throw error;
  }
}
export async function recoveryOverview(actorId) {
  await requirePlatformAdmin(actorId);
  const { RecoveryCase } = await recoveryModels();
  await RecoveryCase.updateMany({ active: true, expiresAt: { $lte: new Date() } }, { $set: { active: false, state: "EXPIRED" }, $unset: { encrypted: "" } });
  const requests = await RecoveryCase.find().select("_id realm collegeId userId name email state delivery createdAt expiresAt sentAt usedAt failureCode").sort({ createdAt: -1 }).limit(100).lean();
  return { configuration: recoveryMailStatus(), requests: requests.map(r => ({ ...r, expired: r.expiresAt <= new Date() })) };
}
export async function deliverPendingRecovery() {
  const { RecoveryCase } = await recoveryModels();
  await RecoveryCase.updateMany({ active: true, expiresAt: { $lte: new Date() } }, { $set: { active: false, state: "EXPIRED" }, $unset: { encrypted: "" } });
  const rows = await RecoveryCase.find({ active: true, delivery: { $in: ["PENDING", "BLOCKED", "FAILED"] }, expiresAt: { $gt: new Date() }, deliveryAttempts: { $lt: 5 } }).limit(2).select("_id").lean();
  return Promise.all(rows.map(row => deliverRecoveryMail(row._id)));
}
