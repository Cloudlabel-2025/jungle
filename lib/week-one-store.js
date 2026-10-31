import { randomUUID, createHash } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { ensureWeekOne, lockWeekOne } from "./week-one.js";
import { cohortOf, dayNumber } from "./week-one-rules.js";
import { blankProgram } from "./week-one-program-rules.js";
import { fail, requiredText } from "./day-one-rules.js";

export const copy = (value) => JSON.parse(JSON.stringify(value));
export const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const rosterQuery = (cohortId) => ({
  role: "GAMER",
  active: { $ne: false },
  ...(cohortId === "alpha"
    ? { $or: [{ cohortId }, { cohortId: { $exists: false } }] }
    : { cohortId }),
});
export const permit = (user, roles) => {
  if (!roles.includes(user.role))
    fail("Your role cannot perform this Week 1 action.", 403);
};
export const staff = ["MISSION_COMMANDER", "CENTRE_COMMAND"];
export function editable(ctx) {
  if (ctx.p.locked && !ctx.p.correction)
    fail(
      "Results are locked. CC must authorise an audited correction first.",
      409,
    );
}
export const dayAt = (ctx, value, open = false) => {
  const day = ctx.release.days[dayNumber(value) - 1];
  if (open && day.state !== "OPEN")
    fail("This day is not open. Past days are read-only.", 409);
  return day;
};
export async function learner(ctx, userId = ctx.user._id) {
  const target = await models.User.findOne({
    _id: userId,
    ...rosterQuery(ctx.cohortId),
  })
    .session(ctx.session)
    .lean();
  if (!target) fail("Gamer not found in your cohort.", 404);
  let record = await models.WeekOneLearner.findById(
    `${ctx.cohortId}:${userId}`,
  ).session(ctx.session);
  if (!record)
    record = new models.WeekOneLearner({
      _id: `${ctx.cohortId}:${userId}`,
      cohortId: ctx.cohortId,
      userId,
      data: { days: {}, ruleAcks: {}, ledger: [], exceptions: {} },
    });
  normaliseLearner(record);
  return record;
}
export function normaliseLearner(record) {
  record.data ||= {};
  for (const key of ["days", "ruleAcks", "exceptions"]) record.data[key] ||= {};
  record.data.ledger ||= [];
  return record;
}
export async function saveLearner(ctx, record) {
  record.markModified("data");
  await record.save({ session: ctx.session });
}
export async function attempt(ctx, id, own = false) {
  const record = await models.WeekOneAttempt.findOne({
    _id: id,
    cohortId: ctx.cohortId,
    ...(own ? { userId: ctx.user._id } : {}),
  }).session(ctx.session);
  if (!record) fail("Attempt not found.", 404);
  return record;
}
export async function saveAttempt(ctx, record) {
  record.version++;
  record.markModified("data");
  await record.save({ session: ctx.session });
}
export async function event(ctx, kind, details) {
  const id = randomUUID();
  await models.WeekOneEvent.create(
    [
      {
        _id: id,
        cohortId: ctx.cohortId,
        actorId: ctx.user._id,
        kind,
        createdAt: ctx.now,
        details,
      },
    ],
    { session: ctx.session },
  );
  return id;
}
export const reason = (body) =>
  requiredText(body.reason, "Reason and supporting evidence", 10, 4000);
export async function runProgram(user, action, body, now, handler) {
  await connect();
  const cohortId = cohortOf(user);
  await ensureWeekOne(cohortId);
  await models.WeekOneProgram.updateOne(
    { _id: cohortId },
    { $setOnInsert: { version: 0, data: blankProgram() } },
    { upsert: true },
  );
  return transaction(async (session) => {
    const release = await lockWeekOne(cohortId, session);
    const program =
      await models.WeekOneProgram.findById(cohortId).session(session);
    if (body.version !== undefined && body.version !== program.version)
      fail("Week 1 data changed. Refresh before saving.", 409);
    const ctx = {
      user,
      action,
      body,
      cohortId,
      now,
      at: now.toISOString(),
      session,
      release,
      program,
      p: program.data,
      changedResults: false,
    };
    const result = await handler(ctx);
    if (ctx.changedResults) ctx.p.signoff = null;
    program.version++;
    program.markModified("data");
    release.markModified("days");
    await program.save({ session });
    await release.save({ session });
    return { success: true, ...(result || {}) };
  });
}
