// Bootstrap is local-only. There is deliberately no public account creation API.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { platformModels } from "../lib/platform-auth.js";
import { hashPassword } from "../lib/password.js";
import { closeCollegeConnections } from "../lib/college-registry.js";
try {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new Error("Provide the super admin email address.");
  const { PlatformAdmin, PlatformSession } = await platformModels();
  await PlatformAdmin.init(); await PlatformSession.init();
  const existing = await PlatformAdmin.findById("platform-owner").lean();
  if (existing) console.log("Super admin is already provisioned. No credentials changed.");
  else {
    const path = resolve(".data/platform-admin-initial.json");
    await mkdir(resolve(".data"), { recursive: true });
    let credentials;
    try { credentials = JSON.parse(await readFile(path, "utf8")); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      credentials = { email, password: `Jungle-${randomBytes(24).toString("base64url")}`, signInPath: "/platform" };
      await writeFile(path, JSON.stringify(credentials, null, 2), { flag: "wx", mode: 0o600 });
    }
    if (credentials.email !== email) throw new Error("Existing private bootstrap file belongs to another email. Review it before continuing.");
    await PlatformAdmin.create({ _id: "platform-owner", name: "Super admin", email,
      passwordHash: await hashPassword(credentials.password), mustChangePassword: true });
    console.log(JSON.stringify({ email, credentialsFile: path, passwordChangeRequired: true }));
  }
} catch (error) {
  console.error(/^(Mongo|Mongoose)/.test(error.name) ? `Admin provisioning failed (${error.name}; ${error.code || "no code"}).` : error.message);
  process.exitCode = 1;
} finally { await closeCollegeConnections(); }
