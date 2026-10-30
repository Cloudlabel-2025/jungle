import { models } from "./db.js";
import { projectLevels } from "./project-catalog.js";
import { fullStackLevel } from "./full-stack-levels.js";
import { levelsForTeam } from "./level-definitions.js";

export async function publishedLevels(session = null, teamId) {
  const records = await models.ProjectLevel.find({
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
