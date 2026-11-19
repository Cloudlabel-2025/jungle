import { models, transaction } from "./db.js";
import { cohortOf, cohortFilter, demand, permitted } from "./access-scope.js";
import { alumniLevels } from "./alumni-map.js";
import { validateMapPositions } from "./mission-map.js";

export async function mapLayoutSnapshot(user) {
  const row = await models.MapLayout.findById(cohortOf(user)).lean();
  return { revision: row?.revision || 0, positions: row?.positions || {} };
}
export async function saveMapLayout(actor, body) {
  return transaction(async (session) => {
    const user = await models.User.findOne({
      _id: actor._id,
      active: { $ne: false },
    })
      .session(session)
      .lean();
    demand(
      user?.role === "CENTRE_COMMAND" && permitted(user, "game:write"),
      "Only authorised Centre Command can arrange the map.",
    );
    demand(
      Number.isInteger(body.revision) && body.revision >= 0,
      "Provide the current map revision.",
      400,
    );
    const definitions = await models.ProjectLevel.find(cohortFilter(user))
      .session(session)
      .lean();
    const allowed = [
      ...alumniLevels.map((l) => l._id),
      ...definitions
        .filter((l) => l.draft?.mapMission || l.published?.mapMission)
        .map((l) => l._id),
    ];
    const positions = validateMapPositions(body.positions, allowed);
    const cohortId = cohortOf(user);
    const row = await models.MapLayout.findById(cohortId).session(session);
    demand(
      (row?.revision || 0) === body.revision,
      "The map changed. Reload the latest layout before saving.",
      409,
    );
    if (row) {
      row.positions = positions;
      row.revision += 1;
      row.updatedBy = user._id;
      row.updatedAt = new Date();
      await row.save({ session });
    } else
      await models.MapLayout.create(
        [
          {
            _id: cohortId,
            revision: 1,
            positions,
            updatedBy: user._id,
            updatedAt: new Date(),
          },
        ],
        { session },
      );
    return { success: true, revision: body.revision + 1 };
  });
}
