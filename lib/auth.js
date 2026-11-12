import { cookies } from "next/headers";
import { models, connect } from "./db.js";
import { migrateRewards } from "./reward-migration.js";
import { signToken, verifyToken, sessionKeyForToken } from "./session-token.js";
export { signToken, verifyToken } from "./session-token.js";
const cookieName = "codewild_session";
export async function currentUser() {
  const jar = await cookies();
  const id = verifyToken(jar.get(cookieName)?.value || "");
  if (!id) return null;
  await connect();
  const user = await models.User.findOne({
    _id: id,
    active: { $ne: false },
  }).lean();
  if (!user || user.rewardVersion === 2) return user;
  await migrateRewards();
  return models.User.findOne({ _id: id, active: { $ne: false } }).lean();
}
export async function currentSessionKey() {
  return sessionKeyForToken((await cookies()).get(cookieName)?.value || "");
}
export async function setSession(id) {
  (await cookies()).set(cookieName, signToken(id), {
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
