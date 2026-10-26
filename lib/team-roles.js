export const teamRoles = [
  { code: "TEAM_LEAD", label: "Team Lead / Full Stack" },
  { code: "FRONTEND", label: "Frontend Specialist" },
  { code: "BACKEND", label: "Backend Architect" },
  { code: "DATABASE_QA", label: "Database / QA" },
  { code: "DEVOPS", label: "DevOps / Reliability" },
];
export function playerRole(user) {
  return (
    user.teamRoleCode ||
    teamRoles.find((r) => r.label === user.assignment)?.code ||
    null
  );
}
export function planRecipients(definitions, teams, players) {
  const recipients = [],
    errors = [];
  if (teams.length !== 5)
    errors.push("The cohort must have all five teams before publication.");
  for (const task of definitions) {
    for (const team of teams) {
      const matches = players.filter(
        (p) =>
          p.role === "GAMER" &&
          p.active !== false &&
          p.teamId === team._id &&
          playerRole(p) === task.targetRole,
      );
      if (matches.length !== 1)
        errors.push(
          `${team.name} / ${task.title}: expected one active ${teamRoles.find((r) => r.code === task.targetRole)?.label || task.targetRole}; found ${matches.length}.`,
        );
      else
        recipients.push({
          definitionId: task._id,
          taskTitle: task.title,
          targetRole: task.targetRole,
          teamId: team._id,
          teamName: team.name,
          userId: matches[0]._id,
          userName: matches[0].name,
        });
    }
  }
  return { recipients, errors, canPublish: errors.length === 0 };
}
