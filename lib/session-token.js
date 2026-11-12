import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
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
    JSON.stringify({
      sub: userId,
      sid: randomBytes(16).toString("hex"),
      exp: Date.now() + 8 * 3600000,
    }),
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

export function sessionKeyForToken(token) {
  if (!verifyToken(token)) return null;
  const payload = JSON.parse(
    Buffer.from(token.split(".")[0], "base64url").toString(),
  );
  return (
    payload.sid ||
    createHmac("sha256", secret()).update(token).digest("hex").slice(0, 32)
  );
}
