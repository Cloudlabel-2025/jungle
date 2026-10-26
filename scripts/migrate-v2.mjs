import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
try {
  await connect();
  // Additive migration: build new collections and integrity indexes without
  // deleting historical rewards, reflections, or changing college calendars.
  for (const model of Object.values(models)) await model.init();
  await models.Migration.updateOne(
    { _id: "2026-10-26-campus-v2" },
    {
      $setOnInsert: {
        description:
          "Add Help Desk, narrative baselines, moderated case versions, growth reports, credentials and cohort calendar fields. Historical rewards preserved; new daily trophy cap is 50.",
        appliedAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log(
    "V2 additive migration and indexes verified. Configure the working calendar and challenge through Centre Command.",
  );
} finally {
  await mongoose.disconnect();
}
