import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { models, connect } from "./db.js";
import { migrateRewards } from "./reward-migration.js";
const cookieName = "codewild_session";
function secret() {
  if (process.env.SESSION_SECRET?.length >= 32)
    return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  globalThis.__cwSecret ||= randomBytes(48).toString("hex");
  return globalThis.__cwSecret;
}
export function signToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyToken(token) {
  try {
    const [payload, sig] = token.split(".");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const given = Buffer.from(sig, "base64url");
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.exp > Date.now() ? value.sub : null;
  } catch {
    return null;
  }
}
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
