import { models } from "./db.js";
import { teams as originalTeams } from "./catalog.js";
export const cohortOf = (u) => u.cohortId || "alpha";
export const tenantOf = (u) =>
  cohortOf(u) === "alpha"
    ? {
        $or: [
          { cohortId: "alpha" },
          { cohortId: { $exists: false } },
          { cohortId: null },
        ],
      }
    : { cohortId: cohortOf(u) };
export function permitted(u, p) {
  return !Array.isArray(u.permissions) || u.permissions.includes(p);
}
export function demand(
  ok,
  message = "Outside your authorised scope.",
  status = 403,
) {
  if (!ok) throw Object.assign(new Error(message), { status });
}
export async function scope(actor, session = null) {
  const user = await models.User.findOne({
    _id: actor?._id,
    active: { $ne: false },
  })
    .session(session)
    .lean();
  demand(user, "Please sign in.", 401);
  const tenant = tenantOf(user);
  let teams = await models.Team.find(tenant).session(session).lean();
  if (user.role === "GAMER") teams = teams.filter((t) => t._id === user.teamId);
  if (user.role === "MISSION_COMMANDER")
    teams = teams.filter(
      (t) =>
        t.commanderId === user._id ||
        (!t.commanderId &&
          cohortOf(user) === "alpha" &&
          user._id === "usr_mc01" &&
          originalTeams.some((o) => o._id === t._id)),
    );
  const teamIds = teams.map((t) => t._id),
    gamers = await models.User.find({
      $and: [
        tenant,
        {
          role: "GAMER",
          ...(user.role === "CENTRE_COMMAND"
            ? {}
            : { teamId: { $in: teamIds } }),
        },
      ],
    })
      .session(session)
      .lean();
  return {
    user,
    tenant,
    teams,
    teamIds,
    userIds: gamers.map((g) => g._id),
    teamFilter: { teamId: { $in: teamIds } },
    personFilter: { userId: { $in: gamers.map((g) => g._id) } },
  };
}
export function typedIds(body) {
  for (const [k, v] of Object.entries(body))
    if (k.endsWith("Id") && v !== undefined && v !== null)
      demand(
        typeof v === "string" && v.length > 0 && v.length <= 200,
        "Resource IDs must be bounded strings.",
        400,
      );
}
export async function guardTargets(actor, body, session = null) {
  typedIds(body);
  const a = await scope(actor, session);
  if (body.teamId) demand(a.teamIds.includes(body.teamId));
  for (const k of [
    "userId",
    "recipientId",
    "assigneeId",
    "ownerId",
    "commanderId",
  ])
    if (body[k]) {
      const u = await models.User.findOne({
        $and: [a.tenant, { _id: body[k] }],
      })
        .session(session)
        .lean();
      demand(
        u &&
          (a.user.role === "CENTRE_COMMAND" ||
            a.userIds.includes(u._id) ||
            u._id === a.user._id),
      );
      if (a.user.role === "GAMER") demand(u._id === a.user._id);
    }
  for (const [k, name] of [
    ["taskId", "Task"],
    ["attemptId", "ProjectAttempt"],
    ["proposalId", "Proposal"],
    ["rescueId", "Rescue"],
  ])
    if (body[k]) {
      const d = await models[name].findById(body[k]).session(session).lean();
      demand(d && (!d.teamId || a.teamIds.includes(d.teamId)));
      if (d.userId || d.recipientId)
        demand(a.userIds.includes(d.userId || d.recipientId));
    }
  return a;
}
