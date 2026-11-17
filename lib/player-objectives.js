import { connect, models } from "./db.js";
import { flightProgress } from "./flight-progression.js";
import { objectiveJourney } from "./level-objectives.js";

export async function playerObjectives(user) {
  if (!user || user.role !== "GAMER" || user.active === false) throw new Error("Player access required");
  await connect();
  const cohortId = user.cohortId || "alpha", own = {cohortId,userId:user._id};
  const [release, original, attempts, levels] = await Promise.all([
    models.WeekOneRelease.findById(cohortId).lean(),
    models.DayOneRecord.findOne(own).lean(),
    models.WeekOneAttempt.find(own).lean(),
    models.WeekOneLevel.find(own).lean(),
  ]);
  return objectiveJourney(flightProgress(release?.days || [], original?.data, attempts, levels));
}
