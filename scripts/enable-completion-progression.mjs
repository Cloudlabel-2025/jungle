import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import { connect, models } from "../lib/db.js";
import { enableCompletionProgression } from "../lib/flight-progression-admin.js";
import { programSnapshot } from "../lib/week-one-program.js";
try {
  const cohortId =
    process.argv.find((a) => a.startsWith("--cohort="))?.slice(9) || "alpha";
  await connect();
  const release = await models.WeekOneRelease.findById(cohortId).lean();
  const program = await models.WeekOneProgram.findById(cohortId).lean();
  if (!process.argv.includes("--apply"))
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          cohortId,
          existingMode: program?.data.progressionMode || "SCHEDULED",
          missingContent: release?.days
            .filter((d) => d.day > 1 && !d.content)
            .map((d) => d.day),
        },
        null,
        2,
      ),
    );
  else {
    await mkdir(".data/backups", { recursive: true });
    const backup = `.data/backups/completion-progression-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify({ release, program }, null, 2), {
      flag: "wx",
    });
    const result = await enableCompletionProgression(cohortId);
    const aarav = await models.User.findOne({
      _id: "usr_g01",
      cohortId,
    }).lean();
    const snapshot = aarav ? await programSnapshot(aarav) : null;
    console.log(
      JSON.stringify(
        {
          ...result,
          backup,
          player: aarav?.name,
          levels: snapshot?.progression.levels,
        },
        null,
        2,
      ),
    );
  }
} catch (e) {
  console.error(e.name + ": " + e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
