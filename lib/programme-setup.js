import { sprintRoleAssignments } from "./role-rotation.js";

export function programmeSetupConfig(format, sprint) {
  const source = sprint?.state === "DRAFT" && sprint.data.number === format.config.number
    ? sprint.data : format.config;
  const config = structuredClone(source);
  config.teams = config.teams.map(team => ({ ...team,
    members: [...(format.config.teams.find(row => row.teamId === team.teamId)?.members || team.members)],
  }));
  return config;
}

// The setup form displays schedule dates in India time on every device.
export function programmeTimeInput(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 330 * 60000).toISOString().slice(0, 16);
}
export function programmeTimeValue(value) {
  return value ? new Date(`${value}:00+05:30`).toISOString() : "";
}

export function programmeSetupPayload(config, reason) {
  if (![config.kickoffStart, config.kickoffEnd, config.dueAt].every(value => value && Number.isFinite(Date.parse(value))))
    throw new Error("Complete all three dates in the Schedule step.");
  if (Date.parse(config.kickoffEnd) <= Date.parse(config.kickoffStart))
    throw new Error("Kickoff must finish after it starts.");
  if (config.number === 1 && Date.parse(config.kickoffEnd) - Date.parse(config.kickoffStart) !== 7200000)
    throw new Error("Sprint 1 requires a two-hour kickoff. Check the Schedule step.");
  if (Date.parse(config.dueAt) <= Date.parse(config.kickoffEnd))
    throw new Error("The sprint deadline must follow kickoff. Check the Schedule step.");
  // Keep submission separate from the editable state, including existing calendar overrides.
  const candidate = structuredClone(config);
  candidate.teams = candidate.teams.map(team => ({ ...team,
    roleAssignments: sprintRoleAssignments(team.members, config.number),
  }));
  candidate.calendar.holidays = [...new Set(candidate.calendar.holidays.map(date => date.trim()).filter(Boolean))];
  return { config: candidate, reason: reason.trim() };
}
