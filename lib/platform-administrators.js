import { randomUUID } from "node:crypto";
import { platformModels, requirePlatformAdmin, publicAdmin } from "./platform-auth.js";
import { registryModels, collegeError } from "./college-registry.js";
import { hashPassword } from "./password.js";
import { validMailAddress } from "./mail-address.js";

export async function listAdministrators(actorId) {
  await requirePlatformAdmin(actorId);
  const { PlatformAdmin } = await platformModels();
  return (await PlatformAdmin.find().sort({ createdAt: 1 }).lean()).map(a => ({ ...publicAdmin(a), active: a.active,
    version: a.managementVersion || 1, createdAt: a.createdAt }));
}
export async function manageAdministrator(actorId, action, body) {
  await requirePlatformAdmin(actorId);
  if (!["create", "update"].includes(action)) throw collegeError("Unknown administrator action.", 404);
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120 || typeof body.email !== "string" ||
      !validMailAddress(body.email.trim())) throw collegeError("Enter a name and valid email.");
  if (action === "update" && (typeof body.active !== "boolean" || !Number.isInteger(body.version))) throw collegeError("Reload administrator details before saving.", 409);
  if (action === "create" && (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 256)) throw collegeError("Use an initial password of 8–256 characters.");
  const hash = action === "create" ? await hashPassword(body.password) : null;
  const { PlatformAdmin, PlatformSession, PlatformControl } = await platformModels();
  const { connection, PlatformAudit } = await registryModels();
  await Promise.all([PlatformAdmin.init(), PlatformSession.init(), PlatformControl.init(), PlatformAudit.init()]);
  await PlatformControl.updateOne({ _id: "administrators" }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  const session = await connection.startSession();
  let result;
  try { await session.withTransaction(async () => {
    await PlatformControl.updateOne({ _id: "administrators" }, { $inc: { revision: 1 } }, { session });
    const actor = await PlatformAdmin.findOne({ _id: actorId, active: true, mustChangePassword: false }).session(session).lean();
    if (!actor) throw collegeError("Super admin access changed. Sign in again.", 401);
    const name = body.name.trim(), email = body.email.trim().toLowerCase();
    let target;
    if (action === "create") {
      [target] = await PlatformAdmin.create([{ _id: randomUUID(), name, email, passwordHash: hash, active: true, mustChangePassword: true }], { session });
    } else {
      const before = await PlatformAdmin.findById(body.id).session(session).lean();
      if (!before) throw collegeError("Administrator not found.", 404);
      if (body.id === actorId && !body.active) throw collegeError("You cannot deactivate your own super admin account.", 409);
      if (before.active && !body.active && await PlatformAdmin.countDocuments({ active: true }).session(session) <= 1)
        throw collegeError("Keep at least one active super admin.", 409);
      const version = body.version === 1 ? { $or: [{ managementVersion: 1 }, { managementVersion: { $exists: false } }] } : { managementVersion: body.version };
      target = await PlatformAdmin.findOneAndUpdate({ _id: body.id, ...version }, { $set: { name, email, active: body.active,
        managementVersion: body.version + 1, failures: 0, lockedUntil: null }, $inc: { passwordVersion: 1 } }, { session, new: true });
      if (!target) throw collegeError("Administrator changed elsewhere. Reload before saving.", 409);
      await PlatformSession.deleteMany({ adminId: body.id }, { session });
    }
    await PlatformAudit.create([{ _id: randomUUID(), actor: actorId, action: `ADMINISTRATOR_${action.toUpperCase()}D`,
      detail: { targetId: target._id, name, email, active: target.active, state: "COMPLETED" } }], { session });
    result = { ...publicAdmin(target), active: target.active, version: target.managementVersion || 1 };
  }); } finally { await session.endSession(); }
  return result;
}
