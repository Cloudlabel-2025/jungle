import { models } from "./db.js";
import { cohortOf } from "./access-scope.js";
import { buildAlumniMap } from "./alumni-map.js";
import partA from "./pilot-manifests.json" with { type: "json" };
import partB from "./pilot-part-b.json" with { type: "json" };

export async function alumniMapSnapshot(user) {
  if (user.role !== "GAMER") return null;
  const cohortId = cohortOf(user);
  const sprints = await models.PilotSprint.find({ cohortId, state: { $ne: "DRAFT" },
    "data.teams.members": user._id })
    .select("state createdAt data.number data.teams data.acceptances data.gates data.template.acceptance data.dueAt").lean();
  const teamIds = sprints.flatMap(s => s.data.teams.filter(t => t.members.includes(user._id)).map(t => t.teamId));
  const tasks = sprints.length ? await models.PilotTask.find({ cohortId, teamId: { $in: teamIds },
    sprintId: { $in: sprints.map(s => s._id) } })
    .select("sprintId teamId userId state data.code data.title data.depends data.coGamerId data.extensionId").lean() : [];
  const people = tasks.length ? await models.User.find({ cohortId, _id: { $in: tasks.map(t => t.userId).filter(Boolean) } }).select("name").lean() : [];
  const names = Object.fromEntries(people.map(p => [p._id, p.name]));
  return buildAlumniMap(user, sprints, tasks.map(t => ({ ...t, ownerName: names[t.userId] })), [...partA.sprints, ...partB.sprints]);
}
