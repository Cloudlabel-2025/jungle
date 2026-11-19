// Local operator tool; credentials for new admins are read from stdin only.
import mongoose from "mongoose";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { registryModels, closeCollegeConnections, normalizeCollegeSlug, auditCollege } from "../lib/college-registry.js";
import { backupDatabase, restoreBackup, adoptCollege, provisionCollege } from "../lib/college-admin.js";
const command = process.argv[2];
let source, rehearsal;
try {
  if (command === "adopt") {
    if (!process.argv.includes("--writers-stopped")) throw new Error("Stop app and worker writes, then pass --writers-stopped.");
    source = await mongoose.createConnection(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 8000 }).asPromise();
    const directory = resolve(".data", "college-backups", `${Date.now()}-${randomUUID()}`);
    const inventory = await backupDatabase(source, directory);
    const rehearsalName = `jr_${randomUUID().replaceAll("-", "")}`;
    rehearsal = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: rehearsalName, maxPoolSize: 2 }).asPromise();
    await restoreBackup(rehearsal, directory);
    // Only the uniquely generated, disposable rehearsal DB is removed.
    await rehearsal.dropDatabase(); await rehearsal.close(); rehearsal = null;
    const college = await adoptCollege(source, { expectedInventory: inventory });
    await writeFile(join(directory, "adoption.json"), JSON.stringify({ collegeId: college._id,
      slug: college.slug, dbName: college.dbName }, null, 2));
    console.log(JSON.stringify({ name: college.name, slug: college.slug, status: college.status, backup: directory }));
  } else if (command === "create") {
    let input = "";
    for await (const chunk of process.stdin) { input += chunk; if (input.length > 10000) throw new Error("Input too large."); }
    console.log(JSON.stringify(await provisionCollege(JSON.parse(input))));
    input = "";
  } else if (command === "list") {
    const { College } = await registryModels();
    console.log(JSON.stringify(await College.find().select("_id name slug status accessRevision").lean(), null, 2));
  } else if (command === "status") {
    const slug = normalizeCollegeSlug(process.argv[3]), status = process.argv[4];
    if (!["ACTIVE", "SUSPENDED", "MAINTENANCE", "ARCHIVED"].includes(status)) throw new Error("Invalid college status.");
    const { College } = await registryModels();
    const college = await College.findOneAndUpdate({ slug, status: { $nin: ["FAILED", "PROVISIONING"] } },
      { $set: { status }, $inc: { accessRevision: 1 } }, { new: true });
    if (!college) throw new Error("College not found or provisioning incomplete.");
    await auditCollege(college._id, "STATUS_CHANGED", { status });
    console.log(JSON.stringify({ name: college.name, status }));
  } else throw new Error("Use: colleges.mjs adopt --writers-stopped | list | create (JSON stdin) | status <slug> <ACTIVE|SUSPENDED|MAINTENANCE|ARCHIVED>");
} catch (error) {
  console.error(error.code === 11000 ? "College code or database mapping already exists."
    : error instanceof SyntaxError ? "Invalid college JSON input."
    : /^(Mongo|Mongoose)/.test(error.name) ? `Database operation failed (${error.name}; ${error.code || "no code"}).`
    : error.message);
  process.exitCode = 1;
} finally {
  if (source) await source.close();
  if (rehearsal) await rehearsal.close();
  await closeCollegeConnections();
}
