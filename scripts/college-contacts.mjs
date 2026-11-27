// Read-only by default. No contact values are printed in the audit.
import mongoose from "mongoose";
import { planCollegeContactBackfill } from "../lib/college-contact-identity.js";

let connection;
try {
  if (process.argv.slice(2).some(arg => arg !== "--apply")) throw Error("Use college-contacts.mjs [--apply].");
  const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw Error("Registry connection is not configured.");
  connection = await mongoose.createConnection(uri, { dbName: process.env.MASTER_DB_NAME || "jungle_platform",
    autoIndex: false, autoCreate: false, maxPoolSize: 2, serverSelectionTimeoutMS: 8000 }).asPromise();
  const College = connection.collection("colleges");
  const rows = await College.find({}, { projection: { _id: 1, profile: 1 } }).toArray();
  const { conflicts, updates } = planCollegeContactBackfill(rows);
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "audit", colleges: rows.length, conflicts }, null, 2));
  if (conflicts.length) {
    process.exitCode = 1;
    console.error("Contact duplicates found. Correct the contacts for the listed college IDs in CMS, then run this command again. No records were changed.");
  } else if (process.argv.includes("--apply")) {
    for (const field of ["contactEmailKey", "contactPhoneKey"]) await College.createIndex({ [field]: 1 }, {
      name: `college_${field}_unique`, unique: true, partialFilterExpression: { [field]: { $type: "string" } },
    });
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        for (const {college, update} of updates) {
          const result = await College.updateOne({ _id: college._id,
            profile: college.profile ?? { $exists: false } }, update, {session});
          if (result.matchedCount !== 1) throw Error("A college changed during the backfill. Run the audit again before retrying.");
        }
      });
    } finally { await session.endSession(); }
    console.log(`Contact uniqueness keys applied to ${updates.length} colleges.`);
  } else console.log("No duplicates found. Run with --apply to backfill the database uniqueness keys.");
} catch (error) {
  // Database errors can contain contact values; keep operator output private.
  console.error(error.code === 11000 ? "A contact changed during the backfill and conflicts with another college. Run the audit again."
    : error.message?.startsWith("Use college-contacts") || error.message?.startsWith("A college changed") ? error.message
    : "Contact audit/backfill could not complete. Check database access and retry.");
  process.exitCode = 1;
} finally { await connection?.close(); }
