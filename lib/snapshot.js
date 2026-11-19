import { collegeContext } from "./college-context.js";
import { models, connect } from "./db.js";
import {
  scope as accessScope,
  cohortOf,
  permitted,
  cohortFilter,
  demand,
} from "./access-scope.js";
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
import { buildNotifications } from "./notifications.js";
import { alumniMapSnapshot } from "./alumni-map-store.js";
import { mapLayoutSnapshot } from "./mission-map-store.js";
import { playerStage, flightIdentity } from "./player-stage.js";
import { attendanceSnapshot } from "./attendance.js";
import { pipProgressSnapshot } from "./pip-progress.js";
export async function snapshot(user) {
  await connect();
  const access = await accessScope(user);
  user = access.user;
  const story = await playerStage(user);
  const playSession = await attendanceSnapshot(user, new Date(), story);
  const pipProgress = user.role === "GAMER" ? await pipProgressSnapshot(user) : null;
  if (story.flight) {
    const [dayOne, weekOne, weekOneProgram, cohort, receipts] =
      await Promise.all([
        dayOneSnapshot(user),
        weekOneSnapshot(user),
        programSnapshot(user),
        models.Cohort.findById(cohortOf(user)).lean(),
        models.NotificationReceipt.find({
          userId: user._id,
          cohortId: cohortOf(user),
        })
          .select("notificationId")
          .lean(),
      ]);
    const current = dayOne.records.find((r) => r.userId === user._id);
    const result = {
    ...(collegeContext() ? { college: { id: collegeContext().college._id, name: collegeContext().college.name, slug: collegeContext().college.slug } } : {}),
      pipProgress,
      playSession,
      story,
      user: flightIdentity(
        {
          ...user,
          energy: playerEnergy(user),
          weekOneTrophies:
            (current?.trophies || 0) +
            (weekOneProgram.levelResults || []).filter((r) => r.userId === user._id).reduce((sum, r) => sum + (r.creditedTrophies || 0), 0) +
            (
              weekOneProgram.learners.find((l) => l.userId === user._id)?.data
                .ledger || []
            ).reduce((n, e) => n + e.amount, 0),
        },
        story,
      ),
      cohort: cohort || { name: "Your flight", currentWeek: 1 },
      dayOne,
      weekOne,
      weekOneProgram,
      serverTime: new Date().toISOString(),
      alumniMap: null,
      mapLayout: null,
      support: null,
      rankingPaused: true,
    };
    for (const key of [
      "roster",
      "leaderboard",
      "projectLevels",
      "levelDrafts",
      "projectAttempts",
      "projectEvents",
      "teams",
      "tasks",
      "challenges",
      "teamRoles",
      "taskEvents",
      "attendance",
      "trophies",
      "experience",
      "energy",
      "rescues",
      "progress",
      "journals",
      "messages",
      "proposals",
      "events",
      "coaching",
      "clearances",
      "versions",
      "modules",
      "perks",
      "rules",
    ])
      result[key] = [];
    result.notifications = buildNotifications(result, receipts, []);
    return JSON.parse(JSON.stringify(result));
  }
  if (user.role === "CENTRE_COMMAND")
    demand(
      permitted(user, "reports:read"),
      "Report access is outside delegated permissions.",
    );
  // Access scope has already resolved the permitted gamer IDs.
  await reconcile(access.userIds);
  const [dayOne, weekOne, weekOneActive, weekOneProgram] = await Promise.all([
    dayOneSnapshot(user),
    weekOneSnapshot(user),
    weekOneProtected(user),
    programSnapshot(user),
  ]);
  const dayOneRecord = dayOne.records.find(
    (record) => record.userId === user._id,
  );
  if (user.rewardVersion !== 2) await migrateRewards();
  await models.User.updateOne(
    { _id: user._id },
    { $set: { lastSeenAt: new Date() } },
  );
  const scope = access.teamFilter;
  const personal =
    user.role === "GAMER" ? { userId: user._id } : access.personFilter;
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
    notificationReceipts,
    programmeNotices,
    alumniMap,
    mapLayout,
  ] = await Promise.all([
    models.User.findById(user._id).lean(),
    models.User.find({ role: "GAMER", ...scope })
      .select("-email")
      .lean(),
    models.Team.find({ _id: { $in: access.teamIds } }).lean(),
    models.Task.find(scope).sort({ dueAt: 1 }).lean(),
    models.Attendance.find(personal).sort({ clockAt: -1 }).limit(500).lean(),
    models.Trophy.find(personal).sort({ createdAt: -1 }).limit(150).lean(),
    models.Experience.find(personal).sort({ createdAt: -1 }).limit(150).lean(),
    models.Energy.find(personal).sort({ createdAt: -1 }).limit(150).lean(),
    models.Rescue.find(personal).lean(),
    models.Progress.find(personal).lean(),
    models.Journal.find(personal).sort({ submittedAt: -1 }).limit(100).lean(),
    models.Message.find(scope).sort({ createdAt: -1 }).limit(100).lean(),
    models.Proposal.find({
      recipientId: { $in: user.role === "GAMER" ? [user._id] : access.userIds },
    })
      .sort({ createdAt: -1 })
      .lean(),
    models.ClientEvent.find(cohortFilter(user))
      .sort({ broadcastAt: -1 })
      .limit(20)
      .lean(),
    models.Cohort.findById(cohortOf(user)).lean(),
    user.role === "GAMER"
      ? []
      : permitted(user, "coaching:read")
        ? models.Coaching.find(access.personFilter)
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
        : [],
    models.Clearance.find(personal).lean(),
    models.RuleVersion.find(cohortFilter(user))
      .sort({ version: -1 })
      .limit(10)
      .lean(),
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
    publishedLevels(
      null,
      user.role === "GAMER" ? user.teamId : undefined,
      cohortOf(user),
    ),
    user.role === "CENTRE_COMMAND"
      ? models.ProjectLevel.find(cohortFilter(user)).sort({ updatedAt: -1 }).lean()
      : [],
    models.NotificationReceipt.find({
      userId: user._id,
      cohortId: cohortOf(user),
    })
      .select("notificationId")
      .lean(),
    models.PilotNotice.find({
      cohortId: cohortOf(user),
      ...(user.role === "GAMER"
        ? {
            $or: [
              { userId: user._id },
              { userId: null, teamId: { $in: access.teamIds } },
            ],
          }
        : {
            $or: [
              { teamId: { $in: access.teamIds } },
              { userId: user._id },
              { state: "WORKER_FAILURE" },
            ],
          }),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    alumniMapSnapshot(user),
    mapLayoutSnapshot(user),
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
  const result = {
    ...(collegeContext() ? { college: { id: collegeContext().college._id, name: collegeContext().college.name, slug: collegeContext().college.slug } } : {}),
    pipProgress,
    story,
    mapLayout,
    alumniMap,
    playSession,
    user: flightIdentity(
      {
        ...self,
        characterKey: characterKey(self),
        ...(weekOneActive
          ? {
              weekOneTrophies:
                (dayOneRecord?.trophies || 0) +
                (weekOneProgram.levelResults || []).filter((r) => r.userId === user._id).reduce((sum, r) => sum + (r.creditedTrophies || 0), 0) +
                (
                  weekOneProgram?.learners.find((l) => l.userId === user._id)
                    ?.data.ledger || []
                ).reduce((n, e) => n + e.amount, 0),
            }
          : {}),
        energy: playerEnergy(self),
        level: experienceLevel(self.xp),
      },
      story,
    ),
    roster: roster.map((person) => ({
      ...person,
      characterKey: characterKey(person),
      energy: playerEnergy(person),
      level: experienceLevel(person.xp),
      ...(person._id === user._id && story.characterSelectionRequired
        ? { characterHidden: true, characterKey: null, characterVariant: null }
        : {}),
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
  };
  result.notifications = buildNotifications(
    result,
    notificationReceipts,
    programmeNotices,
  );
  return JSON.parse(JSON.stringify(result));
}
