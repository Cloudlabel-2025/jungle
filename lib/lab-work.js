import { models } from "./db.js";
import { requireExpedition } from "./player-stage.js";
import { localParts } from "./day-one-rules.js";
import { sessionAt, workSessions } from "./work-sessions.js";

const paths = ["src/App.jsx", "src/styles.css", "tests/ledger.test.js"];
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
async function checkpoint(user, files, version, at, session) {
  const cohort = await models.Cohort.findById(user.cohortId || "alpha")
    .session(session)
    .lean();
  const rows = await models.Attendance.find({
    userId: user._id,
    clockAt: { $lte: at },
  })
    .sort({ clockAt: -1 })
    .limit(2)
    .session(session)
    .lean();
  const period = sessionAt(workSessions(rows), at);
  const timeZone =
    period?.timeZone ||
    rows[0]?.timeZone ||
    cohort?.workingCalendar?.timeZone ||
    "Asia/Kolkata";
  const day = localParts(at, timeZone).day;
  const id = JSON.stringify([user._id, day, period?.id || "untracked"]);
  await models.LabCheckpoint.updateOne(
    { _id: id },
    {
      $set: {
        userId: user._id,
        cohortId: user.cohortId || "alpha",
        day,
        timeZone,
        sessionId: period?.id || null,
        files,
        version,
        savedAt: at,
      },
    },
    { upsert: true, session },
  );
}
export async function saveLabWork(user, body, session, now = new Date()) {
  const current = await models.User.findById(user._id).session(session).lean();
  if (!current || current.role !== "GAMER" || current.active === false)
    fail("Only active players can save a workspace.", 403);
  user = current;
  if (user.role !== "GAMER" || user.active === false)
    fail("Only active players can save a workspace.", 403);
  await requireExpedition(user, session);
  if (body.ownerId != null && body.ownerId !== user._id)
    fail("This workspace belongs to another signed-in player.", 403);
  if (
    !body.files ||
    typeof body.files !== "object" ||
    Object.keys(body.files).length !== paths.length ||
    !paths.every(
      (p) => typeof body.files[p] === "string" && body.files[p].length <= 25000,
    )
  )
    fail("Invalid virtual project. Each file must be under 25 KB.");
  const files = paths.map((path) => ({ path, content: body.files[path] }));
  const old = await models.Lab.findById(user._id).session(session).lean();
  const version = old?.version || 0;
  if (
    old &&
    paths.every(
      (path) =>
        old.files.find((f) => f.path === path)?.content === body.files[path],
    )
  ) {
    await checkpoint(user, old.files, version, old.updatedAt || now, session);
    return { version };
  }
  if (
    body.expectedVersion != null &&
    (!Number.isInteger(body.expectedVersion) ||
      body.expectedVersion !== version)
  )
    fail(
      "This workspace changed in another tab. Copy your unsaved edits, then reload the saved project.",
      409,
    );
  if (old)
    await checkpoint(user, old.files, version, old.updatedAt || now, session);
  await models.Lab.updateOne(
    { _id: user._id },
    { $set: { files, updatedAt: now, version: version + 1 } },
    { upsert: true, session },
  );
  await checkpoint(user, files, version + 1, now, session);
  return { version: version + 1 };
}
