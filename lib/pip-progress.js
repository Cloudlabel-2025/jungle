import { connect, models } from "./db.js";
import { cohortOf, demand } from "./access-scope.js";
import { PIP_STEPS, emptyPipProgress, mergePipProgress } from "./pip-progress-rules.js";

async function owner(actor) {
  await connect();
  const user = typeof actor?._id === "string" ? await models.User.findById(actor._id).lean() : null;
  demand(user && user.active !== false && user.role === "GAMER", "An active Player account is required.", 403);
  return user;
}
const identity = (user) => ({ _id: JSON.stringify([cohortOf(user), user._id, user.pipGeneration || 1]), userId: user._id, cohortId: cohortOf(user), generation: user.pipGeneration || 1 });
const dto = (row, generation) => mergePipProgress({ ...emptyPipProgress(generation), version: row?.version || 0 }, row ? { seen: row.seen, dismissed: row.dismissed, completed: row.completed, following: row.following } : {});
export async function pipProgressSnapshot(actor) {
  const user = await owner(actor), id = identity(user);
  return dto(await models.PipProgress.findById(id._id).lean(), id.generation);
}
export async function savePipProgress(actor, body) {
  const user = await owner(actor), id = identity(user);
  demand(body && typeof body === "object" && !Array.isArray(body), "Use a tutorial progress update.", 400);
  demand(Object.keys(body).every((key) => ["account", "generation", "seen", "dismissed", "completed", "following"].includes(key)), "Only your own tutorial preferences can be updated.", 400);
  demand(body.account === JSON.stringify([user._id, cohortOf(user), id.generation]), "The signed-in player changed. Refresh before continuing.", 409);
  demand(body.generation === id.generation, "Tutorial progress changed. Refresh before continuing.", 409);
  const update = { $set: { updatedAt: new Date() }, $setOnInsert: id, $inc: { version: 1 } }, add = {};
  for (const key of ["seen", "dismissed", "completed"]) {
    if (!(key in body)) continue;
    demand(Array.isArray(body[key]) && body[key].length <= PIP_STEPS.length && body[key].every((v) => typeof v === "string" && PIP_STEPS.includes(v)), "Choose valid tutorial steps.", 400);
    add[key] = { $each: [...new Set(body[key])] };
  }
  if (Object.keys(add).length) update.$addToSet = add;
  if ("following" in body) {
    demand(typeof body.following === "boolean", "Use a valid arrow preference.", 400);
    update.$set.following = body.following;
  }
  // Set unions preserve independently completed steps from concurrent devices.
  let row;
  try { row = await models.PipProgress.findOneAndUpdate({ _id: id._id }, update, { upsert: true, new: true, setDefaultsOnInsert: false }).lean(); }
  catch (error) {
    if (error.code !== 11000) throw error;
    row = await models.PipProgress.findOneAndUpdate({ _id: id._id }, update, { new: true }).lean();
  }
  return dto(row, id.generation);
}
