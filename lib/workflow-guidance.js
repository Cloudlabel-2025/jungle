import { prefix } from "./catalog.js";
import { programmePath } from "./workspace-navigation.js";

// Guidance uses the existing role-filtered snapshot. It never grants access or
// infers clearance from scores; publication and release remain server decisions.
export function workflowGuidance(data, now = new Date()) {
  const user = data.user;
  const gamer = user.role === "GAMER";
  const centre = user.role === "CENTRE_COMMAND";
  const base = `/${prefix(user.role)}`;
  const p = data.weekOneProgram;
  const openDay = p?.days?.find((day) => day.state === "OPEN");
  const actions = [];
  const add = (title, detail, href, count) =>
    actions.push({ title, detail, href, count });
  const ownTasks = (data.tasks || []).filter(
    (task) => task.assigneeId === user._id,
  );
  const recovery = p?.recovery?.participants?.find(
    (row) => row.userId === user._id,
  );
  let stage = openDay ? `Week 1 · Day ${openDay.day}` : "Expedition workspace";
  if (p?.publication) stage = "Week 1 results published";
  if (p?.recovery?.published) stage = "Final teams published";

  if (gamer) {
    const milestone = data.alumniMap?.find(level => level.canOpen && level.state !== "CLEARED");
    if (milestone) {
      stage = `Alumni Connect · Sprint ${milestone.number}`;
      add(`Continue ${milestone.name}`, milestone.statusLabel,
        `${base}/sprint-board?board=programme&sprint=${encodeURIComponent(milestone.sprintId)}`,
        milestone.tasks.filter(task => task.mine && task.state !== "Accepted").length);
    }
    const active = p?.attempts?.find(
      (attempt) =>
        attempt.data?.startedAt &&
        !attempt.data.submittedAt &&
        Date.parse(attempt.data.deadline) > new Date(now).getTime(),
    );
    if (active)
      add(
        "Continue timed activity",
        "Your timer is running. Return to your saved work.",
        programmePath(user.role, "games"),
      );
    if (recovery && !["CLEARED", "WITHDRAWN"].includes(recovery.state)) {
      stage = "Recovery follow-up";
      add(
        "Check recovery status",
        "View your response, schedule and next required step.",
        programmePath(user.role, "results"),
      );
    }
    const learner = p?.learners?.find((row) => row.userId === user._id);
    const rules = p?.rules?.at(-1);
    if (rules && !learner?.data?.ruleAcks?.[rules.version])
      add(
        "Read and acknowledge rules",
        "Review the current programme rules or ask for clarification.",
        programmePath(user.role, "game-rules"),
      );
    if (openDay && !active && !recovery)
      add(
        "Open today's activities",
        `Continue Day ${openDay.day}. Check each activity's availability before starting.`,
        programmePath(user.role, "dashboard"),
      );
    const ready = ownTasks.filter(
      (task) => !["Done", "Review"].includes(task.status),
    );
    if (ready.length && !data.alumniMap)
      add(
        "Review your objectives",
        "Check deadlines, prerequisites and feedback before submitting.",
        `${base}/sprint-board`,
        ready.length,
      );
    if (p?.publication && !recovery)
      add(
        "View your published results",
        "Your personal marks and published outcome.",
        programmePath(user.role, "results"),
      );
    add(
      "Programme sprint work",
      "Open assigned sprint tasks, evidence and reviews.",
      `${base}/sprint-board?board=programme`,
    );
    add(
      "Campfire · Team and help",
      "Talk to your team or open a support request.",
      `${base}/team-room`,
    );
  } else {
    const reviews = (data.tasks || []).filter(
      (task) => task.status === "Review",
    );
    if (reviews.length && !centre)
      add(
        "Review submitted objectives",
        "Inspect evidence and record feedback for your teams.",
        `${base}/sprints`,
        reviews.length,
      );
    const overdue = p?.overdueReviews?.length || 0;
    if (overdue)
      add(
        "Review waiting assessments",
        "Submitted evidence has been waiting at least 24 hours.",
        programmePath(user.role, "assessments"),
        overdue,
      );
    if (centre) {
      add(
        "Programme setup",
        "Check accounts, content, schedules and release readiness.",
        programmePath(user.role, "setup"),
      );
      if (p?.signoff && !p.publication)
        add(
          "Check result publication",
          "MC signoff is recorded. Review remaining publication gates.",
          programmePath(user.role, "results"),
        );
      add(
        "Sprint setup and permissions",
        "Load approved content and review ownership and kickoff.",
        `${base}/setup?programme=setup#programme-setup`,
      );
    } else {
      if (openDay)
        add(
          "Manage today's delivery",
          `Day ${openDay.day}: agenda, class completion and recaps.`,
          programmePath(user.role, "announcements"),
        );
      add(
        "Programme assessments",
        "Review submissions, verification requirements and signoff readiness.",
        programmePath(user.role, "assessments"),
      );
      add(
        "Sprint work and reviews",
        "Open programme tasks and your independent review queue.",
        `${base}/sprints?board=programme`,
      );
    }
    add(
      "Results, recovery and teams",
      "Follow the approved outcome and team publication workflow.",
      programmePath(user.role, "results"),
    );
  }
  return {
    stage,
    title: gamer
      ? "Your next steps"
      : centre
        ? "Council action desk"
        : "Guide's action desk",
    actions: actions.slice(0, 3),
  };
}
