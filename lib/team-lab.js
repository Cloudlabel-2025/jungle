import { models, transaction } from "./db.js";
import { requireExpedition } from "./player-stage.js";
import { teamInitialFiles, validateTeamFiles } from "./team-lab-project.js";
import { mergeTeamFiles } from "./team-lab-merge.js";
import { scope, permitted } from "./access-scope.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const mapFiles = (rows) =>
  Object.fromEntries(rows.map((f) => [f.path, f.content ?? ""]));
const rows = (files) =>
  Object.entries(files).map(([path, content]) => ({ path, content }));
const revisionId = (id, version) => JSON.stringify([id, version]);

async function membership(actor, session = null) {
  const user = await models.User.findById(actor._id).session(session).lean();
  if (!user || user.active === false || user.role !== "GAMER")
    fail("An active player account is required.", 403);
  await requireExpedition(user, session);
  if (typeof user.teamId !== "string" || !user.teamId.trim())
    fail(
      "Your approved team must be assigned before opening the team lab.",
      403,
    );
  const cohortId = user.cohortId || "alpha";
  const team = await models.Team.findOne({ _id: user.teamId, cohortId })
    .session(session)
    .lean();
  if (!team)
    fail(
      "Your approved team must be assigned before opening the team lab.",
      403,
    );
  return { user, team, cohortId, id: JSON.stringify([cohortId, team._id]) };
}

async function reviewer(actor, teamId, session = null, write = false) {
  const access = await scope(actor, session),
    user = access.user;
  if (
    !["MISSION_COMMANDER", "CENTRE_COMMAND"].includes(user.role) ||
    !(
      permitted(user, "sprint:write") ||
      (!write && permitted(user, "reports:read"))
    )
  )
    fail("Project review permission is required.", 403);
  if (!teamId) return access;
  const team = access.teams.find((t) => t._id === teamId);
  if (!team) fail("This team is outside your review scope.", 403);
  return {
    user,
    team,
    cohortId: user.cohortId || "alpha",
    id: JSON.stringify([user.cohortId || "alpha", team._id]),
  };
}

export async function listTeamLabs(actor) {
  const access = await reviewer(actor);
  const projects = await models.TeamLab.find({
    cohortId: access.user.cohortId || "alpha",
    teamId: { $in: access.teamIds },
  })
    .select("teamId version updatedAt")
    .lean();
  return {
    teams: access.teams.map((team) => ({
      id: team._id,
      name: team.name,
      project: projects.find((p) => p.teamId === team._id) || null,
    })),
    canReview: permitted(access.user, "sprint:write"),
  };
}

async function projectFor(member, session) {
  const existing = await models.TeamLab.findById(member.id)
    .session(session)
    .lean();
  if (existing) return existing;
  const project = {
    _id: member.id,
    teamId: member.team._id,
    cohortId: member.cohortId,
    version: 0,
    files: rows(teamInitialFiles),
    updatedAt: new Date(),
  };
  await models.TeamLab.create([project], { session });
  await models.TeamLabRevision.create(
    [
      {
        _id: revisionId(member.id, 0),
        projectId: member.id,
        version: 0,
        author: "Starter project",
        files: project.files,
        paths: [],
        createdAt: project.updatedAt,
      },
    ],
    { session },
  );
  return project;
}

export async function readTeamLab(actor, options = {}) {
  const member =
    actor.role === "GAMER"
      ? await membership(actor)
      : await reviewer(actor, options.teamId);
  if (!member.id) fail("Choose a team to review.");
  if (
    actor.role === "GAMER" &&
    options.teamId &&
    options.teamId !== member.team._id
  )
    fail("This is not your team project.", 403);
  // Most collaborative polls ask about an unchanged revision. Avoid reading
  // the entire source tree from MongoDB on those two-second polls.
  let project = options.version !== undefined
    ? await models.TeamLab.findOne({ _id: member.id, version: options.version })
        .select("-files").lean()
    : null;
  if (!project) project = await models.TeamLab.findById(member.id).lean();
  if (!project && actor.role !== "GAMER")
    return {
      projectId: member.id,
      teamName: member.team.name,
      notStarted: true,
      files: null,
      version: 0,
      history: [],
      presence: [],
      reviews: [],
    };
  if (!project) {
    try {
      project = await transaction(async (session) => {
        const fresh = await membership(actor, session);
        if (fresh.id !== member.id)
          fail("Your team changed. Reopen the lab.", 409);
        return projectFor(fresh, session);
      });
    } catch (e) {
      // Two teammates may open an untouched project at the same time.
      if (e.code !== 11000) throw e;
      project = await models.TeamLab.findById(member.id).lean();
      if (!project) throw e;
    }
  }
  if (options.revision !== undefined) {
    const revision = await models.TeamLabRevision.findById(
      revisionId(member.id, options.revision),
    ).lean();
    if (!revision) fail("That project version was not found.", 404);
    return {
      projectId: member.id,
      version: revision.version,
      files: mapFiles(revision.files),
      author: revision.author,
    };
  }
  const [presence, reviews, history, currentDecision] = await Promise.all([
    models.TeamLabPresence.find({
      projectId: member.id,
      expiresAt: { $gt: new Date() },
    })
      .select("userId name path -_id")
      .lean(),
    models.TeamLabReview.find({ projectId: member.id })
      .sort({ sequence: -1, createdAt: -1 })
      .limit(40)
      .select(
        "version sequence author role status feedback path line createdAt",
      )
      .lean(),
    models.TeamLabRevision.find({ projectId: member.id })
      .sort({ version: -1 })
      .limit(20)
      .select("version author createdAt paths -_id")
      .lean(),
    models.TeamLabReview.aggregate([
      {
        $match: {
          projectId: member.id,
          version: project.version,
          status: { $in: ["REQUESTED", "APPROVED", "CHANGES_REQUESTED"] },
        },
      },
      {
        $addFields: {
          requestOnly: { $cond: [{ $eq: ["$status", "REQUESTED"] }, 1, 0] },
        },
      },
      { $sort: { requestOnly: 1, sequence: -1 } },
      { $limit: 1 },
      { $project: { version: 1, status: 1, author: 1, role: 1, createdAt: 1 } },
    ]),
  ]);
  return {
    projectId: member.id,
    teamName: member.team.name,
    version: project.version,
    updatedAt: project.updatedAt,
    ...(options.version === project.version
      ? {}
      : { files: mapFiles(project.files) }),
    presence,
    history,
    reviews,
    currentReview: currentDecision[0] || null,
  };
}

export async function reviewTeamLab(actor, body) {
  if (
    !["REQUESTED", "APPROVED", "CHANGES_REQUESTED", "COMMENT"].includes(
      body.status,
    )
  )
    fail("Choose a review decision.");
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0)
    fail("A saved project version is required.");
  const feedback =
    typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (feedback.length < 10 || feedback.length > 4000)
    fail("Add review notes between 10 and 4,000 characters.");
  if (
    body.status !== "REQUESTED" &&
    (typeof body.requestId !== "string" ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId))
  )
    fail("A review request ID is required.");
  return transaction(async (session) => {
    const m =
      body.status === "REQUESTED"
        ? await membership(actor, session)
        : await reviewer(actor, body.teamId, session, true);
    if (!m.id || body.projectId !== m.id)
      fail("The project or team changed. Reload before reviewing.", 409);
    const id = JSON.stringify([
      m.id,
      body.status === "REQUESTED" ? "request" : m.user._id,
      body.status === "REQUESTED" ? body.expectedVersion : body.requestId,
    ]);
    const existing = await models.TeamLabReview.findById(id)
      .session(session)
      .lean();
    if (existing) {
      if (
        existing.version !== body.expectedVersion ||
        existing.status !== body.status ||
        (body.status !== "REQUESTED" &&
          (existing.feedback !== feedback ||
            existing.path !== (body.path || undefined) ||
            existing.line !== (body.line || undefined)))
      )
        fail("This request ID was already used for different feedback.", 409);
      return { review: existing };
    }
    const project = await models.TeamLab.findById(m.id).session(session).lean();
    if (!project) fail("A player must open and save the project first.", 409);
    if (body.expectedVersion !== project.version && body.status !== "COMMENT")
      fail(
        "New code has been saved. Review the latest project version before deciding.",
        409,
      );
    const snapshot = await models.TeamLabRevision.findById(
      revisionId(m.id, body.expectedVersion),
    )
      .session(session)
      .lean();
    if (!snapshot) fail("The inspected project version was not found.", 404);
    if (body.path) {
      const file = snapshot.files.find((f) => f.path === body.path);
      if (!file) fail("The review file is not present in that version.");
      if (
        body.line != null &&
        (!Number.isSafeInteger(body.line) ||
          body.line < 1 ||
          body.line > file.content.split("\n").length)
      )
        fail("Choose a line in the inspected file.");
    } else if (body.line != null)
      fail("Choose a file before adding a line reference.");
    await models.TeamLab.updateOne(
      { _id: m.id, version: project.version },
      { $inc: { reviewRevision: 1 } },
      { session },
    );
    const review = {
      _id: id,
      projectId: m.id,
      version: body.expectedVersion,
      sequence: (project.reviewRevision || 0) + 1,
      userId: m.user._id,
      author: m.user.name,
      role: m.user.role,
      status: body.status,
      feedback,
      path: body.path || undefined,
      line: body.line || undefined,
      createdAt: new Date(),
    };
    await models.TeamLabReview.create([review], { session });
    return { review };
  });
}

export async function heartbeatTeamLab(actor, body) {
  const member = await membership(actor);
  if (body.projectId !== member.id)
    fail(
      "Your team changed. Download your draft before reopening the lab.",
      409,
    );
  await models.TeamLabPresence.updateOne(
    { _id: JSON.stringify([member.id, member.user._id]) },
    {
      $set: {
        projectId: member.id,
        userId: member.user._id,
        name: member.user.name,
        path: typeof body.path === "string" ? body.path.slice(0, 120) : "",
        expiresAt: new Date(Date.now() + 45000),
      },
    },
    { upsert: true },
  );
  return { success: true };
}

export async function saveTeamLab(actor, body) {
  if (!validateTeamFiles(body.files))
    fail(
      "Use up to 32 project files, 50,000 characters each and 200,000 characters total. Required starter files must remain.",
    );
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0)
    fail("A saved base version is required.");
  return transaction(async (session) => {
    const member = await membership(actor, session);
    if (body.projectId !== member.id)
      fail(
        "Your team changed. Download your draft before reopening the lab.",
        409,
      );
    const project = await projectFor(member, session);
    const current = mapFiles(project.files);
    const base = await models.TeamLabRevision.findById(
      revisionId(member.id, body.expectedVersion),
    )
      .session(session)
      .lean();
    if (!base)
      fail(
        "Your saved base version is unavailable. Download your draft and reopen the lab.",
        409,
      );
    const merged = mergeTeamFiles(mapFiles(base.files), body.files, current);
    if (merged.conflicts.length)
      return {
        conflict: true,
        conflicts: merged.conflicts,
        files: current,
        version: project.version,
        projectId: member.id,
      };
    if (!validateTeamFiles(merged.files))
      fail(
        "The combined project exceeds the workspace limits. Download your draft before reducing file sizes.",
        409,
      );
    const changed = [
      ...new Set([...Object.keys(current), ...Object.keys(merged.files)]),
    ].filter((p) => current[p] !== merged.files[p]);
    if (!changed.length)
      return { files: current, version: project.version, projectId: member.id };
    const now = new Date(),
      version = project.version + 1,
      fileRows = rows(merged.files);
    await models.TeamLab.updateOne(
      { _id: member.id, version: project.version },
      {
        $set: {
          files: fileRows,
          version,
          updatedAt: now,
          updatedBy: member.user._id,
        },
      },
      { session },
    );
    await models.TeamLabRevision.create(
      [
        {
          _id: revisionId(member.id, version),
          projectId: member.id,
          version,
          userId: member.user._id,
          author: member.user.name,
          createdAt: now,
          files: fileRows,
          paths: changed,
        },
      ],
      { session },
    );
    return { files: merged.files, version, projectId: member.id };
  });
}
