import { randomUUID } from "node:crypto";
import { connect, models, transaction } from "./db.js";
import { lockWeekOne } from "./week-one.js";
import { starterFlightContent } from "./flight-starter-content.js";
import { validateDayContent } from "./week-one-program-rules.js";

const technicalIds = new Set(["D2-G02", "D3-G02", "D4-G02"]);
const hasPortalContext = (activity) =>
  technicalIds.has(activity.id) && /alumni|chapter/i.test(JSON.stringify(activity));

// Operator-only content correction. Never rewrite a player's pinned investigation.
export async function upgradeFlightInvestigations(cohortId, now = new Date()) {
  await connect();
  return transaction(async (session) => {
    const release = await lockWeekOne(cohortId, session);
    const program = await models.WeekOneProgram.findById(cohortId).session(session);
    if (!release || !program || program.data.locked)
      throw Error("A current, unfinalised Week 1 programme is required.");
    const original = release.days[0]?.content;
    const replacements = [];
    for (const day of release.days.filter((d) => [2, 3, 4].includes(d.day))) {
      const changed = new Set();
      for (const slot of ["content", "draft"]) {
        const pack = day[slot];
        if (!pack) continue;
        const ids = pack.activities.filter(hasPortalContext).map((a) => a.id);
        if (!ids.length) continue;
        if (day.contentSource !== "Starter missions from existing Week 1 topics")
          throw Error(`Level ${day.day} has custom content; it needs an explicit authored correction.`);
        if (await models.WeekOneAttempt.exists({ cohortId, activityId: { $in: ids } }).session(session))
          throw Error(`Level ${day.day} already has a pinned investigation. Its saved work must not be rewritten.`);
        const fresh = starterFlightContent(day.day, original);
        const raw = structuredClone(pack);
        raw.activities = raw.activities.map((a) => {
          if (!ids.includes(a.id)) return a;
          changed.add(a.id);
          return fresh.activities.find((candidate) => candidate.id === a.id);
        });
        day[slot] = { ...validateDayContent(day.day, raw, original), version: (day.contentVersion || 0) + 1 };
      }
      if (changed.size) {
        day.contentVersion = (day.contentVersion || 0) + 1;
        replacements.push({ day: day.day, activityIds: [...changed] });
      }
    }
    if (replacements.length) {
      release.markModified("days");
      await release.save({ session });
      await models.WeekOneEvent.create([{
        _id: randomUUID(), cohortId, actorId: "system:flight-investigation-upgrade",
        kind: "FLIGHT_INVESTIGATIONS_REPLACED", createdAt: now,
        details: { replacements, reason: "Keep Alumni Portal work after Week 1 clearance and crash arrival." },
      }], { session });
    }
    return { cohortId, replacements };
  });
}
