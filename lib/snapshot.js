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
import { publishedLevels } from "./published-levels.js";
import { playerEnergy } from "./rules.js";
import { attemptLevel } from "./project-catalog.js";
import { dayOneSnapshot } from "./day-one.js";
import { weekOneSnapshot, weekOneProtected } from "./week-one.js";
import { programSnapshot } from "./week-one-program.js";
import { characterKey } from "./characters.js";
export async function snapshot(user) {
  await connect();
  const dayOne = await dayOneSnapshot(user);
  const weekOne = await weekOneSnapshot(user);
  const weekOneActive = await weekOneProtected(user);
  const weekOneProgram = await programSnapshot(user);
  const dayOneRecord = dayOne.records.find(
    (record) => record.userId === user._id,
  );
  if (user.rewardVersion !== 2) await migrateRewards();
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
    projectAttempts,
    projectEvents,
    support,
    projectLevels,
    levelDrafts,
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
    models.ProjectAttempt.find(scope).sort({ number: 1 }).lean(),
    models.ProjectEvent.find({
      ...scope,
      ...(user.role === "GAMER"
        ? { kind: { $nin: ["TASK_UPDATED", "REASSIGNED"] } }
        : {}),
    })
      .sort({ createdAt: 1 })
      .lean(),
    supportSnapshot(user),
    publishedLevels(null, user.role === "GAMER" ? user.teamId : undefined),
    user.role === "CENTRE_COMMAND"
      ? models.ProjectLevel.find().sort({ updatedAt: -1 }).lean()
      : [],
  ]);
  const [challenges, taskEvents] = await Promise.all([
    challengeSnapshot(user, tasks),
    models.TaskEvent.find({
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
  ]);
  return JSON.parse(
    JSON.stringify({
      user: {
        ...self,
        characterKey: characterKey(self),
        ...(weekOneActive
          ? {
              weekOneEnergy: 5,
              weekOneTrophies:
                (dayOneRecord?.trophies || 0) +
                (
                  weekOneProgram?.learners.find((l) => l.userId === user._id)
                    ?.data.ledger || []
                ).reduce((n, e) => n + e.amount, 0),
            }
          : {}),
        energy: playerEnergy(self),
        level: experienceLevel(self.xp),
      },
      roster: roster.map((person) => ({
        ...person,
        characterKey: characterKey(person),
        energy: playerEnergy(person),
        level: experienceLevel(person.xp),
      })),
      leaderboard: trophyStandings(roster),
      rankingPaused: false,
      rewardLimits: { xp: DAILY_XP_CAP, trophies: DAILY_TROPHY_CAP },
      projectLevels:
        user.role === "GAMER"
          ? projectLevels.map((level) => {
              const existing = projectAttempts.find(
                (a) => a.teamId === user.teamId && a.levelId === level._id,
              );
              return existing ? attemptLevel(existing, projectLevels) : level;
            })
          : projectLevels,
      levelDrafts,
      projectAttempts: projectAttempts.map((attempt) => ({
        ...attempt,
        definitionSnapshot: attemptLevel(attempt, projectLevels),
      })),
      projectEvents,
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
      challenges,
      teamRoles,
      taskEvents,
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
      support,
      dayOne,
      weekOne,
      weekOneProgram,
      modules: modules.map(({ answer, ...m }) => m),
      perks,
      rules,
      serverTime: new Date().toISOString(),
    }),
  );
}
