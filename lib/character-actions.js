import { models, transaction } from "./db.js";
import { validateAvatar } from "./avatar.js";
import { requireExpedition } from "./player-stage.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export async function chooseCharacter(actor, body) {
  return transaction(async (session) => {
    const player = await models.User.findById(actor._id).session(session);
    if (!player || player.active === false || player.role !== "GAMER")
      fail("Only an active player can customize their own avatar.", 403);
    await requireExpedition(player, session);
    if (
      !body ||
      Object.keys(body).some((key) => !["avatar", "version"].includes(key))
    )
      fail(
        "Save your personal avatar settings. Preset identities are retired.",
      );
    let avatar;
    try {
      avatar = validateAvatar(body.avatar);
    } catch (error) {
      fail(error.message);
    }
    if (!Number.isInteger(body.version) || body.version < 0)
      fail("Refresh the page before saving your avatar.");
    if ((player.avatarVersion || 0) !== body.version)
      fail(
        "Your avatar changed in another window. Refresh before saving again.",
        409,
      );
    player.avatar = avatar;
    player.avatarVersion = body.version + 1;
    player.avatarUpdatedAt = new Date();
    await player.save({ session });
    await models.CrashArrival.updateOne(
      { _id: JSON.stringify([player.cohortId || "alpha", player._id]) },
      { $set: { characterSelectedAt: new Date() } },
      { session },
    );
    return { avatar, avatarVersion: player.avatarVersion };
  });
}
