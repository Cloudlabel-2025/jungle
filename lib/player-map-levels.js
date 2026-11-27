import { alumniLevels } from "./alumni-map.js";
import { levelsForTeam } from "./level-definitions.js";

// One catalogue for the player map, setup preview and team progression.
// Practice projects keep their own records; only map missions belong here.
export function playerMapLevels(data, { teamId, includeDrafts = false } = {}) {
  const core = alumniLevels.map(level => ({
    ...data.alumniMap?.find(saved => saved._id === level._id),
    ...level,
    kind: "SPRINT",
  }));
  const missions = new Map(
    (data.projectLevels || []).filter(level => level.mapMission).map(level => [level._id, level]),
  );
  if (includeDrafts) for (const record of data.levelDrafts || []) {
    const level = record.published || record.draft;
    if (level?.mapMission && !missions.has(record._id)) {
      missions.set(record._id, { ...level, _id: record._id, privateDraft: !record.published });
    }
  }
  const custom = [...missions.values()];
  return [...core, ...(teamId ? levelsForTeam(custom, teamId) : custom.sort((a,b) => a.number - b.number))
    .map(level => ({ ...level, kind: "PROJECT" }))];
}
