import { teamRoles } from "./team-roles.js";
import { hazardLibrary } from "./level-hazards.js";
import { levelImages } from "./level-images.js";
import { characters, disciplines } from "./characters.js";

const invalid = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
function text(value, name, min, max = 4000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    invalid(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function validateLevel(input) {
  if (!input || typeof input !== "object")
    invalid("Provide a level definition.");
  if (!Number.isFinite(input.hours) || input.hours < 0.25 || input.hours > 160)
    invalid("The time budget must be 0.25–160 working hours.");
  if (!hazardLibrary.some((h) => h.key === input.hazardKey))
    invalid("Choose a forest emblem.");
  if (
    input.imageKey != null &&
    input.imageKey !== "auto" &&
    !levelImages.some((image) => image.key === input.imageKey)
  )
    invalid("Choose an available forest image.");
  if (
    !Array.isArray(input.criteria) ||
    !input.criteria.length ||
    input.criteria.length > 10
  )
    invalid("Add 1–10 integrated project acceptance criteria.");
  let features;
  let tasks;
  if (input.learningMode === "FULL_STACK") {
    if (!Array.isArray(input.features) || input.features.length !== 5)
      invalid("Define one feature for each of the five characters.");
    features = characters.map((character) => {
      const matches = input.features.filter(
        (f) => f?.characterKey === character.key,
      );
      if (matches.length !== 1)
        invalid(`Define one ${character.label} feature.`);
      const feature = matches[0];
      if (
        typeof feature.key !== "string" ||
        !/^[a-z][a-z0-9-]{1,39}$/.test(feature.key)
      )
        invalid(
          "Feature IDs must be 2–40 lowercase letters, digits or hyphens, starting with a letter.",
        );
      return {
        key: feature.key,
        characterKey: character.key,
        name: text(feature.name, "Feature name", 3, 80),
        objective: text(feature.objective, "Feature objective", 10, 1000),
      };
    });
    if (new Set(features.map((f) => f.key)).size !== 5)
      invalid("Use five distinct feature IDs.");
    if (!Array.isArray(input.tasks) || input.tasks.length !== 25)
      invalid("Define five full-stack tasks per character: 25 tasks in total.");
    tasks = features.flatMap((feature) =>
      disciplines.map((discipline) => {
        const matches = input.tasks.filter(
          (t) =>
            t?.targetCharacter === feature.characterKey &&
            t.discipline === discipline.code,
        );
        if (matches.length !== 1)
          invalid(`Define one ${discipline.label} task for ${feature.name}.`);
        const task = matches[0];
        return {
          targetRole: `${feature.characterKey}:${discipline.code}`,
          targetCharacter: feature.characterKey,
          featureId: feature.key,
          featureName: feature.name,
          discipline: discipline.code,
          title: text(task.title, "Task title", 3, 160),
          instructions: text(task.instructions, "Task instructions", 10),
          acceptanceCriteria: text(
            task.acceptanceCriteria,
            "Task acceptance criteria",
            10,
          ),
        };
      }),
    );
  } else {
    if (!Array.isArray(input.tasks) || input.tasks.length !== teamRoles.length)
      invalid("Define exactly one task for each of the five team roles.");
    tasks = teamRoles.map((role) => {
      const matches = input.tasks.filter((t) => t?.targetRole === role.code);
      if (matches.length !== 1)
        invalid(`Define exactly one ${role.label} task.`);
      const task = matches[0];
      return {
        targetRole: role.code,
        title: text(task.title, `${role.label} task title`, 3, 160),
        instructions: text(task.instructions, `${role.label} instructions`, 10),
        acceptanceCriteria: text(
          task.acceptanceCriteria,
          `${role.label} acceptance criteria`,
          10,
        ),
      };
    });
  }
  if (
    !Array.isArray(input.teamIds) ||
    !input.teamIds.length ||
    input.teamIds.length > 100 ||
    input.teamIds.some((id) => typeof id !== "string") ||
    new Set(input.teamIds).size !== input.teamIds.length
  )
    invalid("Select at least one team, without duplicates.");
  return {
    name: text(input.name, "Project name", 3, 120),
    description: text(input.description, "Project brief", 10),
    hours: input.hours,
    hazardKey: input.hazardKey,
    imageKey: input.imageKey ?? "auto",
    ...(features ? { learningMode: "FULL_STACK", features } : {}),
    criteria: input.criteria.map((c) =>
      text(c, "Integrated acceptance criterion", 3, 500),
    ),
    tasks,
    teamIds: [...input.teamIds],
  };
}

export function levelsForTeam(levels, teamId) {
  return levels
    .filter(
      (level) =>
        level.custom === false ||
        !level.teamIds?.length ||
        level.teamIds.includes(teamId),
    )
    .sort((a, b) => a.number - b.number);
}

export function previousLevel(levels, levelId) {
  const index = levels.findIndex((l) => l._id === levelId);
  return index > 0 ? levels[index - 1] : null;
}
