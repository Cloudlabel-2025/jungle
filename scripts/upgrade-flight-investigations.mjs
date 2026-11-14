import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import { connect, models } from "../lib/db.js";
import { upgradeFlightInvestigations } from "../lib/flight-content-upgrade.js";
try {
  const cohortId = process.argv.find((a) => a.startsWith("--cohort="))?.slice(9) || "alpha";
  await connect();
  const release = await models.WeekOneRelease.findById(cohortId).lean();
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ cohortId, mode: "preview", mission: release?.days[1]?.content?.activities.find((a) => a.id === "D2-G02")?.name }));
  } else {
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/flight-investigations-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify({ release }, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ ...await upgradeFlightInvestigations(cohortId), backup }));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
