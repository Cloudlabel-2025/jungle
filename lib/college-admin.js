import mongoose from "mongoose";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createModels } from "./db.js";
import { registryModels, normalizeCollegeSlug, auditCollege } from "./college-registry.js";
import { hashPassword } from "./password.js";
import { normalizeCollegeProfile } from "./college-profile.js";
import { assertUniqueCollegeContacts, collegeContactKeys, collegeContactKeyUpdate, writeCollegeContacts } from "./college-contact-identity.js";

export async function inventoryDatabase(connection) {
  const collections = [];
  for (const { name, type, options } of await connection.db.listCollections({}, { nameOnly: false }).toArray()) {
    if (name.startsWith("system.")) continue;
    if (type !== "collection") throw new Error("Adoption backup requires ordinary collections; review views or time-series collections separately.");
    const hash = createHash("sha256");
    let count = 0;
    for await (const row of connection.db.collection(name).find().sort({ _id: 1 })) {
      hash.update(mongoose.mongo.BSON.serialize(row)); count++;
    }
    collections.push({ name, options: options || {}, count, sha256: hash.digest("hex"),
      indexes: await connection.db.collection(name).indexes() });
  }
  return { dbName: connection.name, collections: collections.sort((a, b) => a.name.localeCompare(b.name)) };
}

// BSON retains binary bytes and dates, unlike a JSON export. Caller must stop writers.
export async function backupDatabase(connection, directory) {
  await mkdir(directory, { recursive: true });
  const inventory = await inventoryDatabase(connection);
  for (const collection of inventory.collections) {
    const file = await open(join(directory, `${collection.name}.bson`), "wx");
    try {
      for await (const row of connection.db.collection(collection.name).find().sort({ _id: 1 }))
        await file.writeFile(mongoose.mongo.BSON.serialize(row));
    } finally { await file.close(); }
  }
  await writeFile(join(directory, "manifest.json"), JSON.stringify(inventory, null, 2), { flag: "wx" });
  await writeFile(join(directory, "manifest.bson"), mongoose.mongo.BSON.serialize(inventory), { flag: "wx" });
  // Verify saved bytes and counts before calling this a backup.
  for (const collection of inventory.collections) {
    const bytes = await readFile(join(directory, `${collection.name}.bson`));
    if (createHash("sha256").update(bytes).digest("hex") !== collection.sha256)
      throw new Error("Database changed during backup. Stop writers and retry.");
  }
  return inventory;
}
export async function restoreBackup(connection, directory) {
  if ((await connection.db.listCollections().toArray()).length)
    throw new Error("Restore requires an empty disposable database.");
  const manifest = mongoose.mongo.BSON.deserialize(await readFile(join(directory, "manifest.bson")));
  for (const collection of manifest.collections) {
    const bytes = await readFile(join(directory, `${collection.name}.bson`));
    if (createHash("sha256").update(bytes).digest("hex") !== collection.sha256)
      throw new Error("Backup integrity check failed.");
    await connection.db.createCollection(collection.name, collection.options || {});
    let offset = 0;
    while (offset < bytes.length) {
      const size = bytes.readInt32LE(offset);
      if (size < 5 || offset + size > bytes.length) throw new Error("Invalid BSON backup.");
      await connection.db.collection(collection.name).insertOne(mongoose.mongo.BSON.deserialize(bytes.subarray(offset, offset + size)));
      offset += size;
    }
    for (const index of collection.indexes.filter(i => i.name !== "_id_")) {
      const { key, v, ns, ...options } = index;
      await connection.db.collection(collection.name).createIndex(key, options);
    }
  }
  const restored = await inventoryDatabase(connection);
  if (JSON.stringify(restored.collections) !== JSON.stringify(manifest.collections))
    throw new Error("Restored database does not match its backup.");
  return restored;
}

export async function adoptCollege(connection, { name = "College for test", slug = "college-for-test", expectedInventory }) {
  slug = normalizeCollegeSlug(slug);
  const { College } = await registryModels();
  await College.init();
  const existing = await College.findOne({ slug }).lean();
  if (existing) {
    if (existing.dbName !== connection.name || existing.connectionProfile !== "LEGACY")
      throw new Error("College already points to a different database.");
    if (existing.status === "ACTIVE") return existing;
    if (existing.status !== "MAINTENANCE") throw new Error("College adoption requires operator recovery.");
    if (!expectedInventory || JSON.stringify(await inventoryDatabase(connection)) !== JSON.stringify(expectedInventory))
      throw new Error("A new verified backup is required to resume adoption.");
    await connection.db.collection("cohorts").updateMany({}, { $set: { college: name } });
    await auditCollege(existing._id, "ADOPTION_RESUMED");
    return College.findOneAndUpdate({ _id: existing._id, status: "MAINTENANCE" }, { $set: { status: "ACTIVE" } }, { new: true }).lean();
  }
  if (!expectedInventory || expectedInventory.dbName !== connection.name)
    throw new Error("A verified inventory and backup are required for adoption.");
  const current = await inventoryDatabase(connection);
  if (JSON.stringify(current) !== JSON.stringify(expectedInventory))
    throw new Error("Source changed after backup. Stop writers and retry.");
  const priorCohorts = await connection.db.collection("cohorts").find({}, { projection: { _id: 1, college: 1 } }).toArray();
  // No learner, credential, file, result or history collection is rewritten.
  const college = await College.create({ _id: randomUUID(), name, slug,
    dbName: connection.name, connectionProfile: "LEGACY", status: "MAINTENANCE" });
  await auditCollege(college._id, "ADOPTION_PREPARED", { inventory: current, priorCohorts });
  await connection.db.collection("cohorts").updateMany({}, { $set: { college: name } });
  await auditCollege(college._id, "ADOPTED", { sourceDatabase: connection.name,
    preservedCollections: current.collections.length });
  college.status = "ACTIVE";
  await college.save();
  return college.toObject();
}

export async function provisionCollege({ name, slug, email, username, password, adminName, startDate, cohortName = "Initial cohort", profile }, actor) {
  slug = normalizeCollegeSlug(slug);
  if (!name?.trim() || name.length > 120 || !adminName?.trim() || !/^\S+@\S+\.\S+$/.test(email || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") ||
      (username !== undefined && (typeof username !== "string" || !/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(username))))
    throw new Error("College name, admin name/email and cohort startDate are required.");
  profile = normalizeCollegeProfile(profile);
  const { College } = await registryModels();
  await College.init();
  const prior = await College.findOne({ slug, status: "FAILED" }).lean();
  const effectiveProfile = profile ?? prior?.profile ?? {};
  await assertUniqueCollegeContacts(College, effectiveProfile, prior?._id);
  const passwordHash = await hashPassword(password);
  const contactUpdate = collegeContactKeyUpdate(effectiveProfile);
  const failed = await writeCollegeContacts(() => College.findOneAndUpdate({ slug, status: "FAILED" }, {
    $set: { status: "PROVISIONING", name: name.trim(), ...contactUpdate.$set, ...(profile !== undefined ? { profile } : {}) },
    $unset: contactUpdate.$unset,
  }, { new: true }));
  const id = failed?._id || randomUUID(), dbName = failed?.dbName || `jng_${id.replaceAll("-", "")}`;
  const college = failed || await writeCollegeContacts(() => College.create({ _id: id, name: name.trim(), slug, dbName, status: "PROVISIONING", ...collegeContactKeys(effectiveProfile), ...(profile !== undefined ? { profile } : {}) }));
  let connection;
  try {
    connection = await mongoose.createConnection(process.env.TENANT_MONGODB_URI || process.env.MONGODB_URI,
      { dbName, maxPoolSize: 2, serverSelectionTimeoutMS: 8000 }).asPromise();
    const models = createModels(connection);
    for (const model of Object.values(models)) await model.init();
    const userId = `admin:${id}`, session = await connection.startSession();
    try { await session.withTransaction(async () => {
      await models.Cohort.updateOne({ _id: "alpha" }, { $setOnInsert: { name: cohortName, college: college.name, startDate, currentWeek: 1 } }, { upsert: true, session });
      await models.User.updateOne({ _id: userId }, { $setOnInsert: { name: adminName.trim(), email: email.trim().toLowerCase(),
        ...(username ? { username: username.trim().toLowerCase() } : {}), role: "CENTRE_COMMAND", cohortId: "alpha" } }, { upsert: true, session });
      await models.Credential.updateOne({ _id: userId }, { $set: { passwordHash, mustChangePassword: true } }, { upsert: true, session });
    }); } finally { await session.endSession(); }
    await auditCollege(id, "PROVISIONED", { slug }, actor);
    college.status = "ACTIVE"; await college.save();
    return { id, name: college.name, slug, status: college.status };
  } catch (error) {
    college.status = "FAILED"; await college.save();
    await auditCollege(id, "PROVISIONING_FAILED", {}, actor);
    throw error;
  } finally { if (connection) await connection.close(); }
}
