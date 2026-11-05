import { models } from "./db.js";
import { tenantOf } from "./access-scope.js";
import { projectLevels } from "./project-catalog.js";
import { fullStackLevel } from "./full-stack-levels.js";
import { levelsForTeam } from "./level-definitions.js";

export async function publishedLevels(
  session = null,
  teamId,
  cohortId = "alpha",
) {
  if (teamId) {
    const t = await models.Team.findById(teamId).session(session).lean();
    if (t) cohortId = t.cohortId || "alpha";
  }
  const records = await models.ProjectLevel.find({
    ...tenantOf({ cohortId }),
    published: { $exists: true },
  })
    .session(session)
    .lean();
  const merged = new Map(
    projectLevels.map((level) => [level._id, fullStackLevel(level)]),
  );
  for (const record of records)
    if (record.published) merged.set(record._id, record.published);
  const levels = [...merged.values()].sort((a, b) => a.number - b.number);
  return teamId ? levelsForTeam(levels, teamId) : levels;
}
