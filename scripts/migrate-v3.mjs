import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
try {
  await connect();
  for (const model of Object.values(models)) await model.init();
  await models.HelpTicket.updateMany(
    { effortVersion: { $exists: false } },
    { $set: { effortVersion: 0 } },
  );
  await models.Cohort.updateMany(
    { comparisonReviewers: { $exists: false } },
    { $set: { comparisonReviewers: [] } },
  );
  await models.Migration.updateOne(
    { _id: "2026-10-27-campus-v3" },
    {
      $setOnInsert: {
        appliedAt: new Date(),
        description:
          "Add investigation effort, idempotency receipts, reviewed signed comparisons, explicit MC delegation and optional redacted case summaries. Preserve existing support and game records; default to CC review only.",
      },
    },
    { upsert: true },
  );
  console.log(
    "V3 additive migration and indexes verified. No MC review delegation enabled by default.",
  );
} finally {
  await mongoose.disconnect();
}
