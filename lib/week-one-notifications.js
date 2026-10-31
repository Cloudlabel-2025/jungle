import { randomUUID } from "node:crypto";
import { models, connect } from "./db.js";
import { cohortOf } from "./week-one-rules.js";
import { permit } from "./week-one-store.js";

export const noticeId = (cohortId, version, userId) =>
  `${cohortId}:${version}:${userId}`;
function deliveryConfiguration(cohortId) {
  if (!process.env.WEEK1_NOTIFICATION_WEBHOOK_URL)
    throw new Error(
      "Configure an approved notification webhook before delivery.",
    );
  const url = new URL(process.env.WEEK1_NOTIFICATION_WEBHOOK_URL);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(
      "The notification webhook must use HTTPS without embedded credentials.",
    );
  let configured;
  try {
    configured = JSON.parse(process.env.WEEK1_COLLEGE_CONTACTS_JSON || "{}");
  } catch {
    throw new Error("Configure valid college contact JSON.");
  }
  const contacts = configured[cohortId];
  if (
    !Array.isArray(contacts) ||
    !contacts.length ||
    contacts.length > 20 ||
    contacts.some(
      (c) =>
        typeof c.name !== "string" ||
        !c.name.trim() ||
        typeof c.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ||
        typeof c.approval !== "string" ||
        c.approval.trim().length < 10,
    )
  )
    throw new Error(
      "Supply authorised college contacts with approval references for this cohort.",
    );
  return {
    url: url.href,
    contacts: contacts.map(({ name, email }) => ({ name, email })),
  };
}
// Delivery is deliberately outside score transactions. Stable idempotency keys
// allow the receiving provider to deduplicate a retry after a process crash.
export async function deliverCollegeNotices(
  user,
  { fetchImpl = globalThis.fetch, now = new Date() } = {},
) {
  permit(user, ["CENTRE_COMMAND"]);
  await connect();
  const cohortId = cohortOf(user),
    program = await models.WeekOneProgram.findById(cohortId).lean();
  const publication = program?.data.publications.at(-1);
  if (!publication) return { delivered: 0, pending: 0 };
  const recovery = program.data.recovery,
    config = recovery?.configs.at(-1);
  const bookings = recovery?.policy
    ? recovery.fridayVersion === publication.version &&
      !program.data.correction &&
      config
      ? recovery.participants
          .filter((p) => p.fridayVersion === publication.version)
          .map((p) => ({
            userId: p.userId,
            status: "BOOKED",
            slotId: `recovery-${p.configVersion}`,
            start: config.start,
            end: new Date(Date.parse(config.start) + 170 * 60000).toISOString(),
            meetingUrl:
              recovery.sessionLinks?.at(-1)?.configVersion === config.version
                ? recovery.sessionLinks.at(-1).meetingUrl
                : config.meetingUrl,
            configVersion: p.configVersion,
          }))
      : []
    : publication.rescue;
  let configuration, configurationError;
  try {
    configuration = deliveryConfiguration(cohortId);
  } catch (error) {
    configurationError = error.message;
  }
  let delivered = 0,
    pending = 0;
  for (const booking of bookings) {
    const id =
      noticeId(cohortId, publication.version, booking.userId) +
      (recovery?.policy ? `:recovery-${booking.configVersion}` : "");
    await models.WeekOneDelivery.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          cohortId,
          userId: booking.userId,
          publicationVersion: publication.version,
          status: "QUEUED",
          attempts: 0,
        },
      },
      { upsert: true },
    );
    if ((await models.WeekOneDelivery.findById(id).lean()).status === "SENT")
      continue;
    if (configurationError) {
      await models.WeekOneDelivery.updateOne(
        { _id: id, status: { $ne: "SENT" } },
        {
          $set: {
            status: "CONFIGURATION_REQUIRED",
            detail: configurationError,
          },
        },
      );
      pending++;
      continue;
    }
    const claimed = await models.WeekOneDelivery.findOneAndUpdate(
      {
        _id: id,
        status: { $ne: "SENT" },
        $or: [{ status: { $ne: "SENDING" } }, { leaseUntil: { $lte: now } }],
      },
      {
        $set: {
          status: "SENDING",
          leaseUntil: new Date(now.getTime() + 60000),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    if (!claimed) {
      pending++;
      continue;
    }
    let status, detail;
    try {
      const response = await fetchImpl(configuration.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": id,
          ...(process.env.WEEK1_NOTIFICATION_WEBHOOK_TOKEN
            ? {
                Authorization: `Bearer ${process.env.WEEK1_NOTIFICATION_WEBHOOK_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({
          type: recovery?.policy
            ? "CODEWILD_SATURDAY_RECOVERY"
            : "CODEWILD_SATURDAY_RESCUE",
          noticeId: id,
          cohortId,
          publicationVersion: publication.version,
          recipients: configuration.contacts,
          learner: {
            id: booking.userId,
            name: publication.results.find((r) => r.userId === booking.userId)
              ?.name,
          },
          booking,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error(
          `Notification provider returned HTTP ${response.status}.`,
        );
      status = "SENT";
      detail =
        "Approved scheduling notice accepted by the configured provider.";
      delivered++;
    } catch (error) {
      status = "DELIVERY_FAILED";
      detail =
        error.name === "TimeoutError"
          ? "Notification delivery timed out; retry using the same idempotency key."
          : "Notification provider did not accept this notice; check provider availability and retry.";
      pending++;
    }
    await models.WeekOneDelivery.updateOne(
      { _id: id },
      {
        $set: { status, detail, ...(status === "SENT" ? { sentAt: now } : {}) },
        $unset: { leaseUntil: 1 },
      },
    );
    await models.WeekOneEvent.create({
      _id: randomUUID(),
      cohortId,
      actorId: user._id,
      kind:
        status === "SENT"
          ? "COLLEGE_NOTICE_DELIVERED"
          : "COLLEGE_NOTICE_FAILED",
      createdAt: now,
      details: {
        noticeId: id,
        userId: booking.userId,
        publicationVersion: publication.version,
        recipientCount: configuration.contacts.length,
        status,
      },
    });
  }
  return { delivered, pending };
}
