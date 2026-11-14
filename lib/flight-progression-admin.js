import { randomUUID } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import { ensureWeekOne, lockWeekOne } from "./week-one.js";
import { blankProgram, validateDayContent } from "./week-one-program-rules.js";
import { prepareDay } from "./week-one-rules.js";
import { starterFlightContent } from "./flight-starter-content.js";

export async function enableCompletionProgression(cohortId, now = new Date()) {
  await connect();
  await ensureWeekOne(cohortId);
  return transaction(async (session) => {
    const release = await lockWeekOne(cohortId, session);
    let program =
      await models.WeekOneProgram.findById(cohortId).session(session);
    if (!program)
      program = new models.WeekOneProgram({
        _id: cohortId,
        version: 0,
        data: blankProgram(),
      });
    if (program.data.locked)
      throw Error(
        "This cohort has finalised results; use its existing audited correction workflow.",
      );
    const original = release.days[0]?.content;
    if (!original)
      throw Error(
        "Prepare Level 1 content before enabling the flight missions.",
      );
    const prepared = [];
    if (!program.data.settings.compassQuestions.length)
      program.data.settings.compassQuestions = [
        "What changed in your approach to checking claims?",
        "Which evidence most changed your original conclusion?",
        "What will you investigate or verify next?",
      ];
    for (const day of [2, 3, 4, 5]) {
      if (release.days[day - 1].content) continue;
      const raw =
        release.days[day - 1].draft || starterFlightContent(day, original);
      const content = validateDayContent(day, raw, original);
      content.version = (release.days[day - 1].contentVersion || 0) + 1;
      prepareDay(
        release,
        day,
        content,
        "system:completion-progression",
        now.toISOString(),
      );
      release.days[day - 1].contentSource =
        raw === release.days[day - 1].draft
          ? "Existing CC-authored draft"
          : "Starter missions from existing Week 1 topics";
      release.days[day - 1].draft = content;
      prepared.push(day);
    }
    program.data.progressionMode = "COMPLETION";
    program.version++;
    program.markModified("data");
    release.markModified("days");
    await program.save({ session });
    await release.save({ session });
    await models.WeekOneEvent.create(
      [
        {
          _id: randomUUID(),
          cohortId,
          actorId: "system:completion-progression",
          kind: "COMPLETION_PROGRESSION_ENABLED",
          createdAt: now,
          details: { preparedLevels: prepared, mode: "COMPLETION" },
        },
      ],
      { session },
    );
    return { cohortId, mode: "COMPLETION", preparedLevels: prepared };
  });
}
