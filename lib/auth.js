import { cookies } from "next/headers";
import { models, connect } from "./db.js";
import { migrateRewards } from "./reward-migration.js";
import { signToken, verifyToken, sessionKeyForToken } from "./session-token.js";
import { tokenClaims } from "./session-token.js";
import { collegeContext, tenancyEnabled } from "./college-context.js";
import { passwordChangeRequired } from "./college-password.js";
export { signToken, verifyToken } from "./session-token.js";
const cookieName = "codewild_session";
export async function withPasswordStatus(user) {
  return user && tenancyEnabled() ? { ...user, mustChangePassword: await passwordChangeRequired(user._id) } : user;
}
export async function currentUser() {
  const jar = await cookies();
  const claims = tokenClaims(jar.get(cookieName)?.value || "");
  if (tenancyEnabled()) {
    const college = collegeContext()?.college;
    if (!college || claims?.collegeId !== college._id || claims.collegeRevision !== college.accessRevision) return null;
  }
  const id = verifyToken(jar.get(cookieName)?.value || "");
  if (!id) return null;
  await connect();
  const user = await models.User.findOne({
    _id: id,
    active: { $ne: false },
  }).lean();
  if (user && (claims?.accountVersion ?? 1) !== (user.authVersion ?? 1)) return null;
  const account = await withPasswordStatus(user);
  if (account?.mustChangePassword) return account;
  if (!user || user.rewardVersion === 2) return account;
  await migrateRewards();
  return withPasswordStatus(await models.User.findOne({ _id: id, active: { $ne: false } }).lean());
}
export async function currentSessionKey() {
  return sessionKeyForToken((await cookies()).get(cookieName)?.value || "");
}
export async function setSession(id) {
  const user = await models.User.findById(id).select("authVersion").lean();
  (await cookies()).set(cookieName, signToken(id, collegeContext()?.college, user?.authVersion || 1), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 3600,
    path: "/",
  });
}
export async function clearSession() {
  (await cookies()).delete(cookieName);
}
export function demoEnabled() {
  if (tenancyEnabled()) return false;
  return (
    process.env.DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false")
  );
}
export function assertRole(user, roles) {
  if (!user) throw Object.assign(new Error("Please sign in."), { status: 401 });
  if (!roles.includes(user.role))
    throw Object.assign(new Error("Your role cannot perform this action."), {
      status: 403,
    });
}
