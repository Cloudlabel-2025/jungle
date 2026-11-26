import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { registryModels, contextForCollege, normalizeCollegeSlug, collegeError } from "./college-registry.js";
import { requirePlatformAdmin } from "./platform-auth.js";
import { provisionCollege } from "./college-admin.js";
import { runWithCollege } from "./college-context.js";
import { transaction } from "./db.js";
import { cohortFilter } from "./access-scope.js";
import { validateMembers } from "./team-management.js";
import { characters, characterKey as playerCharacterKey } from "./characters.js";
import { teamRoles, playerRole } from "./team-roles.js";
import { hashPassword } from "./password.js";
import { teams as originalTeams } from "./catalog.js";
import { validMailAddress } from "./mail-address.js";
import { authorizeManagement, requireCollegeCC, guideOwnsTeam } from "./management-actor.js";
import { normalizeCollegeProfile } from "./college-profile.js";

const fail = (message, status = 400) => { throw collegeError(message, status); };
const label = (value, title, max = 120) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) fail(`${title} is required and must be at most ${max} characters.`);
  return value.trim();
};
function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail("Choose a valid cohort start date.");
  return value;
}
function week(value) { const n = Number(value); if (!Number.isInteger(n) || n < 1 || n > 52) fail("Week must be between 1 and 52."); return n; }
const collegeFields = "_id name slug profile status accessRevision managementVersion createdAt";
const collegeView = c => ({ id: c._id, name: c.name, slug: c.slug, status: c.status,
  version: c.managementVersion || 1, accessRevision: c.accessRevision || 1, createdAt: c.createdAt, profile: c.profile || {} });
function versionMatch(version, field = "version") {
  if (!Number.isInteger(version) || version < 1) fail("Refresh the current record before saving.", 409);
  return version === 1 ? { $or: [{ [field]: 1 }, { [field]: { $exists: false } }] } : { [field]: version };
}
function key(value, title) {
  const result = label(value, title, 100);
  if (!/^[a-zA-Z0-9_:-]+$/.test(result)) fail(`Choose a valid ${title.toLowerCase()}.`);
  return result;
}
export async function platformColleges(adminId, query = {}) {
  await requirePlatformAdmin(adminId);
  const { College } = await registryModels();
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const search = String(query.search || "").slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = { ...(search ? { $or: [{ name: { $regex: search, $options: "i" } }, { slug: { $regex: search, $options: "i" } }] } : {}),
    ...(query.status ? { status: query.status } : {}) };
  const [rows, total, grouped] = await Promise.all([
    College.find(filter).select(collegeFields).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * 25).limit(25).lean(),
    College.countDocuments(filter), College.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return { colleges: rows.map(collegeView), total, page, pages: Math.max(1, Math.ceil(total / 25)),
    counts: Object.fromEntries(grouped.map(row => [row._id, row.count])) };
}
export async function platformCollegeDetail(adminId, collegeId) {
  const actor = await authorizeManagement(adminId, collegeId);
  const { College } = await registryModels();
  const college = await College.findById(key(collegeId, "College ID")).select(collegeFields).lean();
  if (!college) fail("College not found.", 404);
  if (["FAILED", "PROVISIONING"].includes(college.status)) return { college: collegeView(college), cohorts: [], teams: [], people: [], incomplete: true };
  const context = await contextForCollege({ _id: collegeId }, { administrative: actor.role === "SUPER_ADMIN" });
  const { Cohort, Team, User } = context.models;
  let [cohorts, teams, people] = await Promise.all([
    Cohort.find().select("_id name startDate currentWeek version").sort({ startDate: -1, _id: 1 }).lean(),
    Team.find().select("_id cohortId name code commanderId version").sort({ name: 1 }).lean(),
    User.find().select("_id cohortId teamId name email username role active characterKey characterVariant teamRoleCode assignment managementVersion").sort({ name: 1 }).lean(),
  ]);
  if (actor.role === "MISSION_COMMANDER") {
    teams = teams.filter(t => guideOwnsTeam(actor, t));
    const teamIds = new Set(teams.map(t => t._id));
    const cohortIds = new Set(teams.map(t => t.cohortId || "alpha"));
    cohorts = cohorts.filter(c => cohortIds.has(c._id));
    people = people.filter(p => p._id === actor.id || (p.role === "GAMER" && teamIds.has(p.teamId)));
  }
  return { college: collegeView(college),
    cohorts: cohorts.map(c => ({ id: c._id, name: c.name, startDate: c.startDate, currentWeek: c.currentWeek || 1, version: c.version || 1 })),
    teams: teams.map(t => ({ id: t._id, name: t.name, code: t.code, cohortId: t.cohortId || "alpha", commanderId: t.commanderId || "", version: t.version || 1 })),
    people: people.map(p => ({ id: p._id, name: p.name, email: p.email, username: p.username, role: p.role,
      cohortId: p.cohortId || "alpha", teamId: p.teamId || "", active: p.active !== false,
      version: p.managementVersion || 1, teamRoleCode: p.role === "GAMER" ? playerRole(p) || teamRoles[characters.findIndex(c => c.key === playerCharacterKey(p))]?.code || "" : "" })) };
}
export async function platformCreateCollege(adminId, body) {
  const admin = await requirePlatformAdmin(adminId);
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 256) fail("Use an initial password containing 8–256 characters.");
  if (!validMailAddress(typeof body.email === "string" ? body.email.trim() : body.email)) fail("Enter a valid Centre Command email.");
  if (body.username && (typeof body.username !== "string" || !/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(body.username))) fail("Use a username containing 3–32 letters, numbers, dots, underscores or hyphens.");
  return provisionCollege({ name: label(body.name, "College name"), slug: normalizeCollegeSlug(body.slug),
    email: label(body.email, "Centre Command email"), password: body.password, adminName: label(body.adminName, "Centre Command name"),
    ...(body.username ? { username: body.username } : {}), startDate: day(body.startDate),
    cohortName: body.cohortName === undefined ? "Initial cohort" : label(body.cohortName, "First cohort name"),
    profile: normalizeCollegeProfile(body.profile) }, admin._id);
}
export async function platformUpdateCollege(adminId, collegeId, body) {
  const admin = await requirePlatformAdmin(adminId);
  if (Object.keys(body).some(k => !["name", "slug", "status", "profile", "version", "accessRevision"].includes(k))) fail("Unsupported college change.");
  const profilePatch = normalizeCollegeProfile(body.profile);
  const { College, PlatformAudit, connection } = await registryModels();
  const session = await connection.startSession();
  let result;
  try { await session.withTransaction(async () => {
    const before = await College.findById(key(collegeId, "College ID")).session(session).lean();
    if (!before) fail("College not found.", 404);
    if (["FAILED", "PROVISIONING"].includes(before.status)) fail("Finish or retry provisioning before editing this college.", 409);
    const status = body.status ?? before.status;
    if (!["ACTIVE", "SUSPENDED", "MAINTENANCE", "ARCHIVED"].includes(status)) fail("Choose a valid college status.");
    if (!Number.isInteger(body.accessRevision)) fail("Refresh college settings before saving.", 409);
    const profile = { ...(before.profile || {}) };
    if (profilePatch !== undefined) {
      // Omitted fields survive partial API updates; explicit blanks clear saved values.
      for (const field of Object.keys(body.profile)) delete profile[field];
      Object.assign(profile, profilePatch);
    }
    const changed = await College.findOneAndUpdate({ _id: collegeId, accessRevision: body.accessRevision, ...versionMatch(body.version, "managementVersion") },
      { $set: { name: label(body.name ?? before.name, "College name"), slug: normalizeCollegeSlug(body.slug ?? before.slug), status,
          ...(profilePatch !== undefined ? { profile } : {}) },
        $inc: { managementVersion: 1, ...(status !== before.status ? { accessRevision: 1 } : {}) } }, { session, new: true, runValidators: true }).lean();
    if (!changed) fail("College changed elsewhere. Reload before saving.", 409);
    // Legacy documents have no managementVersion; assigning the next version is explicit.
    if (!before.managementVersion) { changed.managementVersion = body.version + 1; await College.updateOne({ _id: collegeId }, { $set: { managementVersion: changed.managementVersion } }, { session }); }
    await PlatformAudit.create([{ _id: randomUUID(), actor: adminId, collegeId, action: "COLLEGE_UPDATED",
      detail: { before: collegeView(before), after: collegeView(changed), state: "COMPLETED" } }], { session });
    result = collegeView(changed);
  }); } finally { await session.endSession(); }
  return result;
}

async function collegeMutation(adminId, collegeId, action, body, work) {
  const actor = await authorizeManagement(adminId, collegeId);
  const requestId = key(body.requestId, "Request ID");
  const context = await contextForCollege({ _id: key(collegeId, "College ID") }, { administrative: actor.role === "SUPER_ADMIN" });
  if (context.college.status === "ARCHIVED") fail("Reactivate this college before changing its cohorts or teams.", 409);
  const { PlatformAudit } = await registryModels();
  const actorId = actor.role === "SUPER_ADMIN" ? actor.id : `college:${collegeId}:${actor.id}`;
  const audit = await PlatformAudit.create({ _id: randomUUID(), actor: actorId, collegeId, action,
    detail: { state: "REQUESTED", requestId, actorRole: actor.role } });
  const secretKey = Symbol.for("jungle.management-receipt-key");
  const secret = process.env.SESSION_SECRET || (globalThis[secretKey] ||= randomBytes(32).toString("hex"));
  const inputHash = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
  try {
    const result = await runWithCollege(context, () => transaction(async session => {
      const managementActor = await authorizeManagement(adminId, collegeId, session, { lock: true });
      if (managementActor.role === "MISSION_COMMANDER") {
        if (action !== "TEAM_ADD_MEMBER") fail("Guides can create players in assigned teams only.", 403);
        const assignedTeam = await context.models.Team.findOne({ _id: key(body.teamId, "Team ID"),
          $and: [cohortFilter({ cohortId: body.cohortId })] }).session(session).lean();
        if (!assignedTeam || !guideOwnsTeam(managementActor, assignedTeam)) fail("You can create players only in your assigned teams.", 403);
      }
      const old = await context.models.PlatformManagementEvent.findById(requestId).session(session).lean();
      if (old) {
        if (old.actorId !== actorId || old.action !== action || old.details.inputHash !== inputHash) fail("Request ID was already used for another change.", 409);
        return old.details.result;
      }
      const result = await work({ ...context, managementActor }, session);
      await context.models.PlatformManagementEvent.create([{ _id: requestId, actorId, action,
        cohortId: body.cohortId, teamId: body.teamId, details: { inputHash, result } }], { session });
      return result;
    }));
    await PlatformAudit.updateOne({ _id: audit._id }, { $set: { "detail.state": "COMPLETED" } });
    return result;
  } catch (error) {
    await PlatformAudit.updateOne({ _id: audit._id }, { $set: { "detail.state": "FAILED" } });
    throw error;
  }
}
async function cohortLock(models, cohortId, session) {
  const c = await models.Cohort.findOneAndUpdate({ _id: key(cohortId, "Cohort ID") }, { $inc: { rosterVersion: 1 } }, { session, new: true });
  if (!c) fail("Cohort not found in this college.", 404);
  return c;
}
export async function platformCreateCC(adminId, collegeId, body) {
  await requirePlatformAdmin(adminId);
  const name = label(body.name, "Full name"), email = label(body.email, "Email").toLowerCase();
  if (!validMailAddress(email)) fail("Enter a valid email address.");
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 256) fail("Use an initial password containing 8–256 characters.");
  const passwordHash = await hashPassword(body.password);
  return collegeMutation(adminId, collegeId, "COLLEGE_CC_CREATED", body, async ({ models }, session) => {
    // Home cohort is retained for the game workspace; management access covers the whole college.
    const cohortId = body.cohortId || "alpha";
    await cohortLock(models, cohortId, session);
    const id = `usr_${randomUUID()}`;
    await models.User.create([{ _id: id, name, email, role: "CENTRE_COMMAND", cohortId }], { session });
    await models.Credential.create([{ _id: id, passwordHash }], { session });
    return { id };
  });
}
export async function platformCohortCommand(adminId, collegeId, action, body) {
  const actor = await authorizeManagement(adminId, collegeId);
  requireCollegeCC(actor);
  if (actor.role === "CENTRE_COMMAND" && action === "add-staff" && body.role !== "MISSION_COMMANDER")
    fail("Centre Command can create Guide accounts only.", 403);
  if (!["create", "update", "add-staff"].includes(action)) fail("Unknown cohort action.", 404);
  let prepared;
  if (action === "add-staff") {
    if (!["MISSION_COMMANDER", "CENTRE_COMMAND"].includes(body.role)) fail("Choose Guide or Centre Command.");
    const email = label(body.email, "Email").toLowerCase();
    if (!validMailAddress(email)) fail("Enter a valid email.");
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 256) fail("Use an initial password containing 8–256 characters.");
    prepared = { name: label(body.name, "Staff name"), email, role: body.role, passwordHash: await hashPassword(body.password) };
  }
  return collegeMutation(adminId, collegeId, `COHORT_${action.toUpperCase().replaceAll("-", "_")}`, body, async ({ models, college, managementActor }, session) => {
    requireCollegeCC(managementActor);
    if (managementActor.role === "CENTRE_COMMAND" && action === "add-staff" && body.role !== "MISSION_COMMANDER") fail("Centre Command can create Guide accounts only.", 403);
    if (action === "create") {
      const id = normalizeCollegeSlug(body.code);
      await models.Cohort.create([{ _id: id, name: label(body.name, "Cohort name"), college: college.name,
        startDate: day(body.startDate), currentWeek: 1 }], { session });
      return { id };
    }
    const c = await cohortLock(models, body.cohortId, session);
    if (action === "add-staff") {
      const id = `usr_${randomUUID()}`;
      const { passwordHash, ...fields } = prepared;
      await models.User.create([{ _id: id, ...fields, cohortId: c._id }], { session });
      await models.Credential.create([{ _id: id, passwordHash }], { session });
      return { id };
    }
    const result = await models.Cohort.updateOne({ _id: c._id, ...versionMatch(body.version) },
      { $set: { name: label(body.name, "Cohort name"), startDate: day(body.startDate), currentWeek: week(body.currentWeek), version: body.version + 1 } }, { session });
    if (!result.matchedCount) fail("Cohort changed elsewhere. Reload before saving.", 409);
    return { id: c._id };
  });
}
function teamCode(value, name) {
  const code = value ? label(value, "Team code", 20).toUpperCase() : `${name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "TM"}-${randomBytes(2).toString("hex").toUpperCase()}`;
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(code)) fail("Use letters, numbers and hyphens for the team code.");
  return code;
}
export async function platformTeamCommand(adminId, collegeId, action, body) {
  const actor = await authorizeManagement(adminId, collegeId);
  if (action !== "add-member") requireCollegeCC(actor);
  if (!["create", "update", "add-member"].includes(action)) fail("Unknown team action.", 404);
  let member;
  if (action === "add-member") {
    const [validated] = validateMembers([body.member]);
    const { password, ...rest } = validated;
    if (body.member.email && !validMailAddress(body.member.email)) fail("Enter a valid recovery email address.");
    member = { ...rest, ...(body.member.email ? { email: body.member.email.trim().toLowerCase() } : {}), passwordHash: await hashPassword(password) };
  }
  return collegeMutation(adminId, collegeId, `TEAM_${action.toUpperCase().replaceAll("-", "_")}`, body, async ({ models, managementActor }, session) => {
    if (action !== "add-member") requireCollegeCC(managementActor);
    await cohortLock(models, body.cohortId, session);
    const filter = cohortFilter({ cohortId: body.cohortId });
    let team = action === "create" ? null : await models.Team.findOne({ $and: [filter, { _id: key(body.teamId, "Team ID") }] }).session(session);
    if (action !== "create" && !team) fail("Team not found in this cohort.", 404);
    if (managementActor.role === "MISSION_COMMANDER" && !guideOwnsTeam(managementActor, team))
      fail("You can create players only in your assigned teams.", 403);
    if (action === "add-member") {
      const current = await models.User.find({ teamId: team._id, role: "GAMER" }).session(session).lean();
      if (current.length >= 5) fail("A team can have at most five learners.", 409);
      const id = `usr_${randomUUID()}`;
      await models.User.create([{ _id: id, cohortId: body.cohortId, teamId: team._id, name: member.name,
        username: member.username, email: member.email || `${member.username}@players.codewild.invalid`, role: "GAMER",
        assignment: "Full-stack explorer", rewardVersion: 2 }], { session });
      await models.Credential.create([{ _id: id, passwordHash: member.passwordHash }], { session });
      team.version = (team.version || 1) + 1; await team.save({ session });
      return { id };
    }
    const name = label(body.name, "Team name"), code = teamCode(body.code, name);
    const others = await models.Team.find(filter).select("_id name code").session(session).lean();
    if (others.some(t => t._id !== team?._id && (t.name.toLowerCase() === name.toLowerCase() || String(t.code || "").toUpperCase() === code)))
      fail("A team with this name or code already exists in this cohort.", 409);
    const commanderId = body.commanderId || "";
    if (commanderId && !(await models.User.exists({ _id: key(commanderId, "Guide ID"), role: "MISSION_COMMANDER", active: { $ne: false }, $and: [filter] }).session(session)))
      fail("Choose an active Guide assigned to this cohort.");
    if (team) {
      const result = await models.Team.updateOne({ _id: team._id, ...versionMatch(body.version) },
        { $set: { name, code, version: body.version + 1, ...(commanderId ? { commanderId } : {}) }, ...(!commanderId ? { $unset: { commanderId: "" } } : {}) }, { session });
      if (!result.matchedCount) fail("Team changed elsewhere. Reload before saving.", 409);
    } else {
      [team] = await models.Team.create([{ _id: `team_${randomUUID()}`, cohortId: body.cohortId, name, code,
        ...(commanderId ? { commanderId } : {}), color: "#7eaa69" }], { session });
    }
    return { id: team._id };
  });
}
export async function platformActivity(adminId) {
  await requirePlatformAdmin(adminId);
  const { PlatformAudit, College } = await registryModels();
  const rows = await PlatformAudit.find().select("_id action collegeId actor createdAt detail.state").sort({ createdAt: -1, _id: -1 }).limit(100).lean();
  const colleges = await College.find({ _id: { $in: rows.map(r => r.collegeId).filter(Boolean) } }).select("name").lean();
  const names = new Map(colleges.map(c => [c._id, c.name]));
  return rows.map(r => ({ id: r._id, action: r.action, college: names.get(r.collegeId) || "Platform",
    actor: r.actor === adminId ? "You" : "Operator", state: r.detail?.state || "COMPLETED", createdAt: r.createdAt }));
}

export async function platformPersonUpdate(adminId, collegeId, body) {
  requireCollegeCC(await authorizeManagement(adminId, collegeId));
  const allowed = ["requestId", "cohortId", "userId", "version", "name", "email", "username", "role", "active", "replacementGuideId"];
  if (Object.keys(body).some(k => !allowed.includes(k))) fail("Unsupported account change.");
  if (typeof body.active !== "boolean") fail("Choose whether this account is active.");
  if (body.replacementGuideId && (typeof body.replacementGuideId !== "string" || body.replacementGuideId.length > 200)) fail("Choose a valid replacement Guide.");
  const name = label(body.name, "Full name"), email = label(body.email, "Email").toLowerCase();
  if (!validMailAddress(email)) fail("Enter a valid email address.");
  const username = body.username ? label(body.username, "Username", 32).toLowerCase() : "";
  if (username && !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)) fail("Use a username of 3–32 letters, numbers, dots, underscores or hyphens.");
  return collegeMutation(adminId, collegeId, "PERSON_UPDATED", body, async ({ models, managementActor }, session) => {
    requireCollegeCC(managementActor);
    await cohortLock(models, body.cohortId, session);
    const filter = cohortFilter({ cohortId: body.cohortId });
    const person = await models.User.findOne({ $and: [filter, { _id: key(body.userId, "Account ID") }] }).session(session).lean();
    if (!person) fail("Account not found in this cohort.", 404);
    if (managementActor.role === "CENTRE_COMMAND" && (person.role === "CENTRE_COMMAND" || (body.role && body.role !== person.role)))
      fail("Only a super admin can manage Centre Command accounts or change account roles.", 403);
    const role = body.role || person.role;
    if (person.role === "GAMER" ? role !== "GAMER" : !["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(role)) fail("Learners and staff cannot be converted into each other.");
    if (person.role === "CENTRE_COMMAND" && person.active !== false && (!body.active || role !== "CENTRE_COMMAND")) {
      // All college-level CC removals share a lock, including CCs with different home cohorts.
      await cohortLock(models, "alpha", session);
      const remaining = await models.User.countDocuments({ role: "CENTRE_COMMAND", active: { $ne: false } }).session(session);
      if (remaining <= 1) fail("Keep at least one active Centre Command account in this college.", 409);
    }
    if (person.role === "MISSION_COMMANDER" && (!body.active || role !== "MISSION_COMMANDER")) {
      const guideFilter = { $or: [{ commanderId: person._id }, ...(person._id === "usr_mc01" && body.cohortId === "alpha" ? [{ _id: { $in: originalTeams.map(t => t._id) }, commanderId: { $in: [null, ""] } }] : [])] };
      const assigned = await models.Team.find({ $and: [filter, guideFilter] }).session(session);
      if (assigned.length) {
        const replacement = await models.User.findOne({ $and: [filter], _id: body.replacementGuideId,
          role: "MISSION_COMMANDER", active: { $ne: false } }).session(session).lean();
        if (!replacement || replacement._id === person._id) fail("Assign an active replacement Guide before disabling or changing this Guide's role.", 409);
        for (const team of assigned) { team.commanderId = replacement._id; team.version = (team.version || 1) + 1; await team.save({ session }); }
      }
    }
    const result = await models.User.updateOne({ _id: person._id, ...versionMatch(body.version, "managementVersion") },
      { $set: { name, email, role, active: body.active, managementVersion: body.version + 1, ...(username ? { username } : {}) },
        $inc: { authVersion: 1 }, ...(!username ? { $unset: { username: "" } } : {}) }, { session, runValidators: true });
    if (!result.matchedCount) fail("Account changed elsewhere. Reload before saving.", 409);
    // Older accounts have no stored authVersion; the first change must advance beyond the legacy value of 1.
    if (!person.authVersion) await models.User.updateOne({ _id: person._id }, { $set: { authVersion: 2 } }, { session });
    return { id: person._id, previous: { name: person.name, email: person.email, role: person.role, active: person.active !== false },
      updated: { name, email, role, active: body.active } };
  });
}
