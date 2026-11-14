// Explicit operator review of one player's current saved shared-chat submission.
// Without --apply this reads and previews only; it never changes results.
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import { models, connect } from "../lib/db.js";
import { readSharedChat } from "../lib/shared-chat-reader.js";
import { scoreLevelOne } from "../lib/level-one-rules.js";
import { dayOneAction } from "../lib/day-one.js";
try {
  const id = process.argv.find((a) => a.startsWith("--player-id="))?.slice(12);
  if (!id || !/^[\w-]{1,100}$/.test(id))
    throw Error("Specify exactly one --player-id=ID.");
  await connect();
  const player = await models.User.findOne({
    _id: id,
    role: "GAMER",
    active: { $ne: false },
  }).lean();
  if (!player) throw Error("Active player not found.");
  const record = await models.DayOneRecord.findOne({
    userId: player._id,
    cohortId: player.cohortId || "alpha",
  }).lean();
  const submission = record?.data.submissions.at(-1);
  if (!submission) throw Error("No saved research submission.");
  const reading = await readSharedChat(submission.url);
  if (!reading.ok) {
    console.log(
      JSON.stringify({
        player: player.name,
        read: false,
        code: reading.code,
        message: reading.message,
      }),
    );
    process.exitCode = 1;
  } else {
    const preview = scoreLevelOne(record.data, {
      ...submission,
      transcript: reading.transcript,
      evidence: reading.evidence,
    });
    const beforeVersion = record.version;
    let backup;
    if (process.argv.includes("--apply")) {
      await mkdir(".data/backups", { recursive: true });
      backup = `.data/backups/level-one-review-${id}-${Date.now()}.json`;
      await writeFile(backup, JSON.stringify({ record, player }, null, 2), {
        flag: "wx",
      });
      await dayOneAction(
        player,
        "review-link",
        { version: beforeVersion, revisionId: submission.id },
        new Date(),
        { sharedChatReader: async () => reading },
      );
      const saved = await models.DayOneRecord.findById(record._id).lean();
      const balance = await models.User.findById(player._id).lean();
      console.log(
        JSON.stringify(
          {
            mode: "applied",
            player: player.name,
            result:
              saved.data.levelOne.override || saved.data.levelOne.automatic,
            trophies: saved.data.levelOne.creditedTrophies,
            xp: saved.data.levelOne.creditedTrophies * 5,
            balance: { trophies: balance.trophies, xp: balance.xp },
            originalSubmissionAt: submission.at,
            submissionAtPreserved:
              saved.data.submissions.at(-1).at === submission.at,
            backup,
          },
          null,
          2,
        ),
      );
    } else
      console.log(
        JSON.stringify(
          {
            mode: "preview",
            player: player.name,
            read: true,
            turns: {
              user: reading.evidence.userTurns,
              assistant: reading.evidence.assistantTurns,
            },
            characters: reading.transcript.length,
            result: preview,
            unchanged: true,
          },
          null,
          2,
        ),
      );
  }
} catch (error) {
  console.error(error.name + ": " + error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
