import { models } from "./db.js";
import { completionBased, flightProgress } from "./flight-progression.js";

export async function playerFlightProgress(
  user,
  release,
  program,
  session = null,
  known = {},
) {
  if (!completionBased(program) || user.role !== "GAMER") return null;
  const cohortId = user.cohortId || "alpha";
  const originalQuery = "original" in known ? known.original : models.DayOneRecord.findOne({
    cohortId,
    userId: user._id,
  })
    .session(session)
    .lean();
  const attemptsQuery = known.attempts ?? models.WeekOneAttempt.find({
    cohortId,
    userId: user._id,
  })
    .session(session)
    .lean();
  const levelsQuery = known.levels ?? models.WeekOneLevel.find({ cohortId, userId: user._id }).session(session).lean();
  let original, attempts, levels;
  if (session) {
    original = await originalQuery;
    attempts = await attemptsQuery;
    levels = await levelsQuery;
  } else [original, attempts, levels] = await Promise.all([originalQuery, attemptsQuery, levelsQuery]);
  return flightProgress(release?.days || [], original?.data, attempts, levels);
}

export async function closeCompletedFlightLevels(
  cohortId,
  release,
  program,
  session,
  now,
) {
  if (!completionBased(program)) return false;
  const players = await models.User.find({
    role: "GAMER",
    active: { $ne: false },
    ...(cohortId === "alpha"
      ? { $or: [{ cohortId }, { cohortId: { $exists: false } }] }
      : { cohortId }),
  })
    .session(session)
    .select("_id")
    .lean();
  if (!players.length) return false;
  const originals = await models.DayOneRecord.find({ cohortId })
    .session(session)
    .lean();
  const attempts = await models.WeekOneAttempt.find({ cohortId })
    .session(session)
    .lean();
  const levelRows = await models.WeekOneLevel.find({ cohortId }).session(session).lean();
  const progress = players.map((p) =>
    flightProgress(
      release.days,
      originals.find((r) => r.userId === p._id)?.data,
      attempts.filter((a) => a.userId === p._id),
      levelRows.filter((a) => a.userId === p._id),
    ),
  );
  let changed = false;
  for (const day of release.days)
    if (
      day.state !== "CLOSED" &&
      progress.every(
        (levels) => levels[day.day - 1].ready && levels[day.day - 1].completed,
      )
    ) {
      day.state = "CLOSED";
      day.closedAt = now.toISOString();
      day.closedBy = "system:level-completion";
      changed = true;
    }
  if (changed) release.markModified("days");
  return changed;
}
