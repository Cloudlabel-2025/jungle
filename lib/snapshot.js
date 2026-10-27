import { models, connect } from "./db.js";
import { modules, perks, rules } from "./catalog.js";
import { reconcile } from "./engine.js";
import {
  experienceLevel,
  trophyStandings,
  DAILY_XP_CAP,
  DAILY_TROPHY_CAP,
} from "./rewards.js";
import { migrateRewards } from "./reward-migration.js";
import { supportSnapshot } from "./support.js";
import { challengeSnapshot } from "./challenges.js";
import { teamRoles } from "./team-roles.js";
import { projectLevels } from "./project-catalog.js";
export async function snapshot(user) {
  await connect();
  await migrateRewards();
  await models.User.updateOne(
    { _id: user._id },
    { $set: { lastSeenAt: new Date() } },
  );
  const gamers = await models.User.find({
    role: "GAMER",
    ...(user.role === "GAMER" ? { teamId: user.teamId } : {}),
  }).lean();
  await reconcile(gamers.map((g) => g._id));
  const scope = user.role === "GAMER" ? { teamId: user.teamId } : {};
  const personal = user.role === "GAMER" ? { userId: user._id } : {};
  const [
    self,
    roster,
    teams,
    tasks,
    attendance,
    trophies,
    experience,
    energy,
    rescues,
    progress,
    journals,
    messages,
    proposals,
    events,
    cohort,
    coaching,
    clearances,
    versions,
  ] = await Promise.all([
    models.User.findById(user._id).lean(),
    models.User.find({ role: "GAMER", ...scope })
      .select("-email")
      .lean(),
    models.Team.find().lean(),
    models.Task.find(scope).sort({ dueAt: 1 }).lean(),
    models.Attendance.find(user.role === "GAMER" ? { userId: user._id } : {})
      .sort({ clockAt: -1 })
      .limit(500)
      .lean(),
    models.Trophy.find(personal).sort({ createdAt: -1 }).limit(150).lean(),
    models.Experience.find(personal).sort({ createdAt: -1 }).limit(150).lean(),
    models.Energy.find(personal).sort({ createdAt: -1 }).limit(150).lean(),
    models.Rescue.find(
      user.role === "GAMER" ? { userId: user._id } : {},
    ).lean(),
    models.Progress.find(personal).lean(),
    models.Journal.find(personal).sort({ submittedAt: -1 }).limit(100).lean(),
    models.Message.find(scope).sort({ createdAt: -1 }).limit(100).lean(),
    models.Proposal.find(user.role === "GAMER" ? { recipientId: user._id } : {})
      .sort({ createdAt: -1 })
      .lean(),
    models.ClientEvent.find().sort({ broadcastAt: -1 }).limit(20).lean(),
    models.Cohort.findById("alpha").lean(),
    user.role === "GAMER"
      ? []
      : models.Coaching.find().sort({ createdAt: -1 }).limit(100).lean(),
    models.Clearance.find(personal).lean(),
    models.RuleVersion.find().sort({ version: -1 }).limit(10).lean(),
  ]);
  return JSON.parse(
    JSON.stringify({
      user: { ...self, level: experienceLevel(self.xp) },
      roster: roster.map((person) => ({
        ...person,
        level: experienceLevel(person.xp),
      })),
      leaderboard: cohort?.currentWeek === 1 ? [] : trophyStandings(roster),
      rankingPaused: cohort?.currentWeek === 1,
      rewardLimits: { xp: DAILY_XP_CAP, trophies: DAILY_TROPHY_CAP },
      projectLevels,
      projectAttempts: await models.ProjectAttempt.find(scope)
        .sort({ number: 1 })
        .lean(),
      projectEvents: await models.ProjectEvent.find({
        ...scope,
        ...(user.role === "GAMER"
          ? { kind: { $nin: ["TASK_UPDATED", "REASSIGNED"] } }
          : {}),
      })
        .sort({ createdAt: 1 })
        .lean(),
      teams,
      tasks: tasks.map((task) => {
        if (user.role !== "GAMER" || task.assigneeId === user._id) return task;
        const {
          submissionSummary,
          evidenceReferences,
          reviewFeedback,
          ...visible
        } = task;
        return visible;
      }),
      challenges: await challengeSnapshot(user, tasks),
      teamRoles,
      taskEvents: await models.TaskEvent.find({
        taskId: {
          $in: tasks
            .filter(
              (t) =>
                t.challengeId &&
                (user.role !== "GAMER" || t.assigneeId === user._id),
            )
            .map((t) => t._id),
        },
      })
        .sort({ createdAt: 1 })
        .lean(),
      attendance,
      trophies,
      experience,
      energy,
      rescues,
      progress,
      journals,
      messages: messages.reverse(),
      proposals,
      events,
      cohort,
      coaching,
      clearances,
      versions,
      support: await supportSnapshot(user),
      modules: modules.map(({ answer, ...m }) => m),
      perks,
      rules,
      serverTime: new Date().toISOString(),
    }),
  );
}
