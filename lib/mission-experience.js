export function projectMissionProgress(level, attempt, tasks, userId) {
  if (!attempt) tasks = [];
  const own = tasks.filter((t) => t.assigneeId === userId);
  const ready =
    own.length === (level.learningMode === "FULL_STACK" ? 5 : 1) &&
    own.every((t) => ["Review", "Done"].includes(t.status));
  const verified =
    tasks.length === level.tasks.length &&
    tasks.length > 0 &&
    tasks.every((t) => t.status === "Done");
  const cleared = attempt?.status === "CLEARED";
  const objectives = [
    { label: "Enter the level", done: Boolean(attempt) },
    { label: "Build & submit your feature", done: ready },
    { label: "Clear the team review", done: verified },
    { label: "Claim the level key", done: cleared },
  ];
  const nextTask = own.find((t) => !["Review", "Done"].includes(t.status));
  const next = cleared
    ? "Level cleared. Your next trail is open."
    : !attempt
      ? "Start the level with your team to reveal your feature missions."
      : nextTask
        ? `Your next mission: ${nextTask.title || nextTask.description}`
        : attempt.status === "REVIEW"
          ? "Your integrated project is with your Guide. You can keep coding while you wait."
          : verified
            ? "Your team's contributions are approved. Submit the integrated project for its final review."
            : "Your evidence is with your Guide. Check feedback and help your team finish.";
  return {
    objectives,
    next,
    nextTask,
    cleared,
    completed: objectives.filter((o) => o.done).length,
    total: objectives.length,
  };
}
export function sprintMissionProgress(sprint, tasks, userId, teamId) {
  const own = tasks.filter(
    (t) =>
      t.teamId === teamId &&
      (t.userId === userId || t.data?.coGamerId === userId),
  );
  const accepted = own.filter((t) => t.state === "Accepted").length;
  const nextTask =
    own.find((t) => ["Working", "Rework"].includes(t.state)) ||
    own.find((t) => t.state === "Ready") ||
    own.find((t) => t.state === "In Review");
  const cleared = Boolean(
    sprint?.data?.acceptances?.some(
      (a) =>
        a.teamId === teamId &&
        a.decision === "ACCEPTED" &&
        a.key === `Key ${sprint.data.number}`,
    ),
  );
  return {
    completed: accepted,
    total: own.length,
    nextTask,
    cleared,
    next: cleared
      ? "Team key secured. Explore your next trail or revisit your evidence."
      : nextTask
        ? `${nextTask.state === "In Review" ? "Awaiting your Guide" : "Next mission"}: ${nextTask.data?.title || nextTask.data?.code}`
        : own.length && accepted === own.length
          ? "Your missions are approved. Help your team prepare the client acceptance review to secure the team key."
          : "Your next missions open after your Guide completes kickoff and releases the tasks.",
  };
}

export function sprintTrailLinks(levels, sprint) {
  return Array.from({ length: 5 }, (_, i) => {
    const number = i + 1,
      level = levels.find((l) => l.number === number),
      current = number === sprint?.data.number;
    const id = current ? sprint._id : level?.sprintId;
    const available = Boolean(id && (current || level?.canOpen));
    return {
      number,
      current,
      href: available
        ? `/gamer/sprint-board?board=programme&sprint=${encodeURIComponent(id)}`
        : null,
      label: `Trail ${number}${current ? " · You are here" : available ? "" : level?.state === "LOCKED" ? " · Locked" : " · Awaiting release"}`,
    };
  });
}
