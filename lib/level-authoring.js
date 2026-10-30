import { randomUUID, createHash } from "node:crypto";
import { models, transaction } from "./db.js";
import { projectLevels, projectRecipients } from "./project-catalog.js";
import { publishedLevels } from "./published-levels.js";
import {
  levelsForTeam,
  previousLevel,
  validateLevel,
} from "./level-definitions.js";
import { startTeamProject } from "./project-start.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
async function assignments(record, definition, levels, session) {
  const teams = await models.Team.find({ _id: { $in: definition.teamIds } })
    .session(session)
    .lean();
  if (teams.length !== definition.teamIds.length)
    fail("A selected team no longer exists.");
  const players = await models.User.find({
    role: "GAMER",
    teamId: { $in: definition.teamIds },
  })
    .session(session)
    .lean();
  const attempts = await models.ProjectAttempt.find({
    teamId: { $in: definition.teamIds },
  })
    .session(session)
    .lean();
  const rows = teams
    .sort((a, b) => a._id.localeCompare(b._id))
    .map((team) => {
      let recipients = [],
        error;
      try {
        recipients = projectRecipients(
          definition,
          players.filter((p) => p.teamId === team._id),
        );
      } catch (e) {
        error = e.message;
      }
      const sequence = levelsForTeam(levels, team._id);
      const previous = previousLevel(sequence, definition._id);
      const existing = attempts.find(
        (a) => a.teamId === team._id && a.levelId === definition._id,
      );
      const ready =
        !previous ||
        attempts.some(
          (a) =>
            a.teamId === team._id &&
            a.levelId === previous._id &&
            a.status === "CLEARED" &&
            a.stars >= 1,
        );
      return {
        teamId: team._id,
        teamName: team.name,
        error,
        state: existing ? "PRESERVED" : ready ? "STARTS_ON_PUBLISH" : "QUEUED",
        previousName: previous?.name,
        recipients: recipients.map((r) => ({
          targetRole: r.targetRole,
          targetCharacter: r.targetCharacter,
          featureName: r.featureName,
          discipline: r.discipline,
          userId: r.assigneeId,
          name: players.find((p) => p._id === r.assigneeId)?.name,
          title: r.title,
        })),
      };
    });
  const token = createHash("sha256")
    .update(
      JSON.stringify({
        id: record._id,
        version: record.version,
        definition,
        rows,
      }),
    )
    .digest("hex");
  return { rows, canPublish: rows.every((row) => !row.error), token };
}
export async function levelAction(actor, action, body) {
  return transaction(async (session) => {
    const user = await models.User.findById(actor._id).session(session);
    if (user?.active === false || user?.role !== "CENTRE_COMMAND")
      fail("Only Centre Command can manage project levels.", 403);
    if (!["save", "preview", "publish"].includes(action))
      fail("Unknown level action.", 404);
    // Shared with roster changes and project starts so previews cannot publish stale roles.
    const lock = await models.Cohort.updateOne(
      { _id: "alpha" },
      { $inc: { rosterVersion: 1, projectVersion: 1 } },
      { session },
    );
    if (!lock.matchedCount) fail("Configure the cohort first.");
    const builtin = projectLevels.find((l) => l._id === body.levelId);
    let record = body.levelId
      ? await models.ProjectLevel.findById(body.levelId).session(session)
      : null;
    if (body.levelId && !record && !builtin) fail("Level not found.", 404);
    if (record && record.version !== body.version)
      fail("This level changed. Reopen it before saving or publishing.", 409);
    const now = new Date();
    if (action === "save") {
      const draft = validateLevel(body.definition);
      if (builtin) {
        const teamIds = (
          await models.Team.find().select("_id").session(session).lean()
        ).map((t) => t._id);
        if (
          draft.teamIds.length !== teamIds.length ||
          teamIds.some((id) => !draft.teamIds.includes(id))
        )
          fail(
            "Existing chapter levels apply to every team. Create a new level to target selected teams.",
          );
      }
      const count = await models.Team.countDocuments({
        _id: { $in: draft.teamIds },
      }).session(session);
      if (count !== draft.teamIds.length) fail("Select existing teams.");
      if (!record)
        record = new models.ProjectLevel({
          _id: builtin?._id || `custom_${randomUUID()}`,
          createdBy: user._id,
          createdAt: now,
          version: 0,
        });
      record.draft = draft;
      record.version++;
      record.updatedBy = user._id;
      record.updatedAt = now;
      await record.save({ session });
      await models.ProjectLevelEvent.create(
        [
          {
            _id: randomUUID(),
            levelId: record._id,
            actorId: user._id,
            kind: "DRAFT_SAVED",
            version: record.version,
            definition: draft,
            createdAt: now,
          },
        ],
        { session },
      );
      return { levelId: record._id, version: record.version };
    }
    if (!record?.draft) fail("Save a draft before previewing or publishing.");
    const levels = await publishedLevels(session);
    const old = levels.find((l) => l._id === record._id);
    const number =
      old?.number || Math.max(...levels.map((l) => l.number), 0) + 1;
    if (number > 100) fail("The expedition supports up to 100 levels.");
    const definition = {
      ...validateLevel(record.draft),
      _id: record._id,
      number,
      custom: !builtin,
      authored: true,
      baseXp: 100 + (number - 1) * 25,
      baseTrophies: 50 + (number - 1) * 10,
      version: record.version,
    };
    const nextLevels = [
      ...levels.filter((l) => l._id !== record._id),
      definition,
    ].sort((a, b) => a.number - b.number);
    const preview = await assignments(record, definition, nextLevels, session);
    if (action === "preview") return { ...preview, level: definition };
    if (!preview.canPublish)
      fail(
        "Fix missing or duplicate team character assignments before publishing.",
        409,
      );
    if (body.previewToken !== preview.token)
      fail(
        "The assignments changed. Preview this level again before publishing.",
        409,
      );
    // Pin legacy attempts before replacing their published definition.
    if (old)
      await models.ProjectAttempt.updateMany(
        { levelId: record._id, definitionSnapshot: { $exists: false } },
        {
          $set: {
            definitionSnapshot:
              old.learningMode === "FULL_STACK"
                ? projectLevels.find((l) => l._id === old._id) || old
                : old,
          },
        },
        { session },
      );
    if (record.published) {
      const removed = (record.published.teamIds || []).filter(
        (id) => !definition.teamIds.includes(id),
      );
      if (removed.length)
        fail(
          "Published teams cannot be removed from a level. Their progression history must be preserved.",
          409,
        );
    }
    record.published = definition;
    record.publishedAt = now;
    record.updatedAt = now;
    record.updatedBy = user._id;
    record.version++;
    await record.save({ session });
    await models.ProjectLevelEvent.create(
      [
        {
          _id: randomUUID(),
          levelId: record._id,
          actorId: user._id,
          kind: "PUBLISHED",
          version: definition.version,
          definition,
          createdAt: now,
        },
      ],
      { session },
    );
    for (const row of preview.rows)
      if (row.state === "STARTS_ON_PUBLISH")
        await startTeamProject(
          user,
          row.teamId,
          definition,
          levelsForTeam(nextLevels, row.teamId),
          session,
        );
    return {
      levelId: record._id,
      version: record.version,
      assignments: preview.rows,
    };
  });
}
