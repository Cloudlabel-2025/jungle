import { cookies, headers } from "next/headers";
import { collegeSlugFromHost } from "./college-routing.js";
import { platformAdminFromToken, createPlatformSession, revokePlatformSession } from "./platform-auth.js";
export const platformCookie = "jungle_platform_session";
export async function currentPlatformAdmin() {
  if (collegeSlugFromHost((await headers()).get("host"), process.env.COLLEGE_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "")) return null;
  return platformAdminFromToken((await cookies()).get(platformCookie)?.value);
}
export async function setPlatformSession(admin) {
  (await cookies()).set(platformCookie, await createPlatformSession(admin), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600,
  });
}
export async function clearPlatformSession() {
  const jar = await cookies();
  await revokePlatformSession(jar.get(platformCookie)?.value);
  jar.delete(platformCookie);
}
