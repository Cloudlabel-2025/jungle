import { models, transaction } from "./db.js";
import { characters, characterKey } from "./characters.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export async function chooseCharacter(actor, body) {
  return transaction(async (session) => {
    const player = await models.User.findById(actor._id).session(session);
    if (!player || player.active === false || player.role !== "GAMER")
      fail("Only an active player can choose their character.", 403);
    if (
      !characters.some((c) => c.key === body.characterKey) ||
      !["male", "female"].includes(body.variant)
    )
      fail("Choose an available character and a male or female version.");
    await models.Cohort.updateOne(
      { _id: "alpha" },
      { $inc: { rosterVersion: 1 } },
      { session },
    );
    const team = await models.User.find({
      teamId: player.teamId,
      role: "GAMER",
      active: { $ne: false },
    })
      .session(session)
      .lean();
    if (
      team.some(
        (p) => p._id !== player._id && characterKey(p) === body.characterKey,
      )
    )
      fail(
        "That character belongs to a teammate. Choose your version, or ask Centre Command to swap character identities.",
        409,
      );
    player.characterKey = body.characterKey;
    player.characterVariant = body.variant;
    await player.save({ session });
    return {
      characterKey: player.characterKey,
      variant: player.characterVariant,
    };
  });
}
