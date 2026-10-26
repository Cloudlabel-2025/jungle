import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 256
  )
    throw new Error("Passwords must contain 8–256 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password, stored) {
  if (typeof password !== "string" || password.length > 256) return false;
  const [salt, hex] = (stored || "").split(":");
  if (!salt || !hex || hex.length !== 128) return false;
  const key = await scrypt(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
