import { createHash } from "node:crypto";
import { models } from "./db.js";
import { snapshot } from "./snapshot.js";
import { cohortOf, demand } from "./access-scope.js";

export async function markNotificationsRead(user, ids) {
  demand(
    Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= 100 &&
      ids.every((id) => typeof id === "string" && id.length <= 1000),
    "Choose up to 100 notifications.",
    400,
  );
  const available = new Set(
    (await snapshot(user)).notifications.items.map((item) => item.id),
  );
  demand(
    ids.every((id) => available.has(id)),
    "Notification is unavailable for this account.",
    403,
  );
  const readAt = new Date();
  await models.NotificationReceipt.bulkWrite(
    [...new Set(ids)].map((notificationId) => ({
      updateOne: {
        filter: {
          _id: createHash("sha256")
            .update(JSON.stringify([cohortOf(user), user._id, notificationId]))
            .digest("hex"),
        },
        update: {
          $setOnInsert: {
            userId: user._id,
            cohortId: cohortOf(user),
            notificationId,
            readAt,
          },
        },
        upsert: true,
      },
    })),
  );
  return { success: true };
}
