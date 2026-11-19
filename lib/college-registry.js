import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { registerModel } from "./model-registry.js";
import { createModels } from "./db.js";
import { runWithCollege } from "./college-context.js";
import { validCollegeAddress } from "./college-routing.js";

const stateKey = Symbol.for("jungle.college-connections");
const state = globalThis[stateKey] ||= { registry: null, colleges: new Map() };
const options = { maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 8000, bufferCommands: false };
export function collegeError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
export function normalizeCollegeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw collegeError("Enter a valid college code.");
  if (!validCollegeAddress(slug))
    throw collegeError("This college code is reserved.");
  return slug;
}
export function collegeSignInSelector(body) {
  if (body.collegeId !== undefined) {
    if (typeof body.collegeId !== "string" || body.collegeId.length > 100 || !/^[a-zA-Z0-9_:-]+$/.test(body.collegeId))
      throw collegeError("Choose a college from the search results.");
    return { _id: body.collegeId };
  }
  // Preserve existing API clients; the public sign-in UI uses college IDs.
  return { slug: normalizeCollegeSlug(body.collegeSlug) };
}
export async function registryModels() {
  if (!state.registry) {
    const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
    if (!uri) throw collegeError("College registry is not configured.", 503);
    const dbName = process.env.MASTER_DB_NAME || "jungle_platform";
    state.registry = mongoose.createConnection(uri, { ...options, dbName }).asPromise()
      .catch(error => { state.registry = null; throw error; });
  }
  const connection = await state.registry;
  const College = registerModel(connection, "College", new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    profile: { institutionType: { type: String, maxlength: 30 }, affiliation: { type: String, maxlength: 160 },
      website: { type: String, maxlength: 300 }, contactEmail: { type: String, maxlength: 120 }, phone: { type: String, maxlength: 30 },
      addressLine1: { type: String, maxlength: 160 }, addressLine2: { type: String, maxlength: 160 }, city: { type: String, maxlength: 80 },
      state: { type: String, maxlength: 80 }, country: { type: String, maxlength: 80 }, postalCode: { type: String, maxlength: 20 },
    },
    dbName: { type: String, required: true, unique: true },
    connectionProfile: { type: String, enum: ["DEFAULT", "LEGACY"], default: "DEFAULT" },
    status: { type: String, enum: ["PROVISIONING", "ACTIVE", "MAINTENANCE", "SUSPENDED", "ARCHIVED", "FAILED"], required: true },
    accessRevision: { type: Number, default: 1 },
    managementVersion: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
  }, { versionKey: false, strict: "throw" }));
  const PlatformAudit = registerModel(connection, "PlatformAudit", new mongoose.Schema({
    _id: String, collegeId: String, actor: String, action: String,
    detail: mongoose.Schema.Types.Mixed, createdAt: { type: Date, default: Date.now },
  }, { versionKey: false, strict: "throw" }));
  return { connection, College, PlatformAudit };
}
export async function findCollege(selector, { administrative = false } = {}) {
  const { College } = await registryModels();
  const college = await College.findOne(selector).lean();
  if (!college) throw collegeError("College not found.", 404);
  if (college.status !== "ACTIVE" && !(administrative && ["SUSPENDED", "MAINTENANCE", "ARCHIVED"].includes(college.status))) throw collegeError("This college is unavailable. Contact your administrator.", 403);
  return college;
}
export async function contextForCollege(selector, requestOptions = {}) {
  // Always revalidate registry status, even with a warm connection.
  const college = await findCollege(selector, requestOptions);
  if (college.dbName === (process.env.MASTER_DB_NAME || "jungle_platform"))
    throw collegeError("Invalid college database mapping.", 503);
  const uri = college.connectionProfile === "LEGACY" ? process.env.MONGODB_URI
    : process.env.TENANT_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw collegeError("College storage is not configured.", 503);
  const cacheKey = `${college._id}:${college.dbName}:${college.connectionProfile}`;
  if (!state.colleges.has(cacheKey)) {
    // Refuse unbounded connection growth; never evict a connection in use.
    const limit = Number(process.env.COLLEGE_CONNECTION_LIMIT || 50);
    if (!Number.isInteger(limit) || limit < 1 || state.colleges.size >= limit)
      throw collegeError("College connection capacity reached.", 503);
    state.colleges.set(cacheKey, mongoose.createConnection(uri, { ...options, dbName: college.dbName })
      .asPromise().then(connection => ({ connection, models: createModels(connection) }))
      .catch(error => { state.colleges.delete(cacheKey); throw error; }));
  }
  return { ...await state.colleges.get(cacheKey), college };
}
export async function inCollege(slug, work) {
  return runWithCollege(await contextForCollege({ slug: normalizeCollegeSlug(slug) }), work);
}
export async function auditCollege(collegeId, action, detail = {}, actor = process.env.COLLEGE_OPERATOR || "local-operator") {
  const { PlatformAudit } = await registryModels();
  await PlatformAudit.create({ _id: randomUUID(), collegeId, action, detail,
    actor });
}
export async function closeCollegeConnections() {
  for (const promise of state.colleges.values()) await (await promise).connection.close();
  state.colleges.clear();
  if (state.registry) await (await state.registry).close();
  state.registry = null;
}
