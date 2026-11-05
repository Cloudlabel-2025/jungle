import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { models, connect } from "../lib/db.js";
import { pilotAction } from "../lib/pilot-engine.js";
export async function processPilot() {
  await connect();
  const results = [];
  for (const s of await models.PilotSprint.find({
    state: { $in: ["PREVIEW", "ACTIVE", "CLIENT_REVIEW", "ACCEPTED"] },
  }).lean()) {
    const user = await models.User.findOne({
      cohortId: s.cohortId,
      role: "MISSION_COMMANDER",
      active: { $ne: false },
      _id: { $in: s.data.teams.map((t) => t.commanderId) },
    }).lean();
    try {
      if (!user)
        throw Error("No active assigned MC; CC intervention required.");
      await pilotAction(user, "sync", {
        requestId: `worker:${s._id}:${Math.floor(Date.now() / 60000)}`,
        sprintId: s._id,
      });
      results.push({ sprintId: s._id, processed: true });
    } catch (e) {
      await models.PilotNotice.updateOne(
        { _id: `${s._id}:worker:${Math.floor(Date.now() / 3600000)}` },
        {
          $setOnInsert: {
            cohortId: s.cohortId,
            sprintId: s._id,
            state: "WORKER_FAILURE",
            createdAt: new Date(),
            data: { message: e.message },
          },
        },
        { upsert: true },
      );
      results.push({ sprintId: s._id, error: e.message });
    }
  }
  return results;
}
if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("/process-pilot.mjs") ||
  process.argv[1] === "scripts/process-pilot.mjs"
) {
  try {
    console.log(JSON.stringify(await processPilot()));
  } finally {
    await mongoose.disconnect();
  }
}
