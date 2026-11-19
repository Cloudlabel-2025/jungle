import { collegeContext } from "./college-context.js";
import { collegeError } from "./college-registry.js";
import { requirePlatformAdmin } from "./platform-auth.js";
import { cohortOf, permitted } from "./access-scope.js";
import { teams as originalTeams } from "./catalog.js";

// Constructed by server routes from the authenticated college session, never request JSON.
export function collegeManagementActor(user) {
  const college = collegeContext()?.college;
  if (!college || !user) throw collegeError("Please sign in to your college.", 401);
  return { realm: "college", collegeId: college._id, userId: user._id, authVersion: user.authVersion || 1 };
}
export function guideOwnsTeam(user, team) {
  return user.role === "MISSION_COMMANDER" && cohortOf(user) === (team.cohortId || "alpha") &&
    (team.commanderId === user._id || (!team.commanderId && user._id === "usr_mc01" &&
      cohortOf(user) === "alpha" && originalTeams.some(t => t._id === team._id)));
}
export async function authorizeManagement(actor, collegeId, session = null, { lock = false } = {}) {
  if (typeof actor === "string") {
    const admin = await requirePlatformAdmin(actor);
    return { id: admin._id, role: "SUPER_ADMIN" };
  }
  const context = collegeContext();
  if (!actor || actor.realm !== "college" || !collegeId || actor.collegeId !== collegeId ||
      context?.college?._id !== collegeId || context.college.status !== "ACTIVE")
    throw collegeError("Outside your college.", 403);
  const user = await context.models.User.findById(actor.userId).session(session).lean();
  if (!user || user.active === false || (user.authVersion || 1) !== actor.authVersion)
    throw collegeError("Please sign in again.", 401);
  if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(user.role) || !permitted(user, "roster:write"))
    throw collegeError("College management access required.", 403);
  if (lock) {
    // A concurrent deactivation or role change conflicts with this transaction.
    const changed = await context.models.User.updateOne({ _id: user._id, role: user.role, active: { $ne: false } },
      { $inc: { managementFence: 1 } }, { session });
    if (changed.matchedCount !== 1) throw collegeError("Account access changed. Reload before saving.", 409);
  }
  return { ...user, id: user._id };
}
export function requireCollegeCC(actor) {
  if (!["SUPER_ADMIN", "CENTRE_COMMAND"].includes(actor.role))
    throw collegeError("Only Centre Command can manage cohorts, teams and Guides.", 403);
}
