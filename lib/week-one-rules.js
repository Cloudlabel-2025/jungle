import { fail, requiredText } from "./day-one-rules.js";

export const dayNames = [
  "Discover",
  "Explore",
  "STORY IT!",
  "FIRE IT!",
  "Prove",
];
export const cohortOf = (user) => user.cohortId || "alpha";
export function initialDays() {
  return dayNames.map((title, i) => ({ day: i + 1, title, state: "DRAFT" }));
}
export function dayNumber(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5)
    fail("Choose a Week 1 day from 1 to 5.");
  return value;
}
export function staffOnly(user) {
  if (!["MISSION_COMMANDER", "CENTRE_COMMAND"].includes(user.role))
    fail("Only MC or CC can manage day releases.", 403);
}
export const dayVisible = (day) => ["OPEN", "CLOSED"].includes(day?.state);
export function prepareDay(release, number, config, actorId, at) {
  const day = release.days[dayNumber(number) - 1];
  if (dayVisible(day))
    fail(
      "An opened day is version-locked. Existing attempts must retain their content.",
      409,
    );
  day.state = "PREPARED";
  day.contentVersion = config.version;
  day.officialStart = config.officialStart;
  day.scheduledEnd = config.closingCutoff;
  day.content = structuredClone(config);
  day.preparedAt = at;
  day.preparedBy = actorId;
  return day;
}
export function transitionDay(release, number, action, actorId, now) {
  const day = release.days[dayNumber(number) - 1];
  const previousState = day.state;
  if (action === "open") {
    if (day.state !== "PREPARED")
      fail("Prepare and validate the day before opening it.", 409);
    if (number > 1 && release.days[number - 2].state !== "CLOSED")
      fail("Close the previous day before opening the next day.", 409);
    if (release.days.some((d) => d.state === "OPEN"))
      fail("Close the currently open day first.", 409);
    day.state = "OPEN";
    day.openedAt = now.toISOString();
    day.openedBy = actorId;
  } else if (action === "close") {
    if (day.state !== "OPEN") fail("Only an open day can be closed.", 409);
    if (now < new Date(day.scheduledEnd))
      fail("The scheduled activity window has not ended.", 409);
    day.state = "CLOSED";
    day.closedAt = now.toISOString();
    day.closedBy = actorId;
  } else fail("Unknown day-release action.", 404);
  return {
    day: number,
    previousState,
    state: day.state,
    contentVersion: day.contentVersion,
  };
}
export function publishAgenda(day, text, actorId, now) {
  if (day.state !== "OPEN")
    fail("Open this day before publishing its agenda.", 409);
  if (now < new Date(day.officialStart))
    fail("Publish the agenda at or after the official start.", 409);
  if (day.agenda) fail("This day's agenda has already been published.", 409);
  day.agenda = {
    text: requiredText(text, "Day agenda", 10, 8000),
    publishedAt: now.toISOString(),
    publishedBy: actorId,
    version: 1,
  };
}
export function releaseProjection(release, role) {
  const gamer = role === "GAMER";
  return {
    revision: release?.revision || 0,
    days: (release?.days || initialDays()).map((d) => {
      if (gamer && !dayVisible(d))
        return { day: d.day, title: d.title, state: "LOCKED" };
      const { content, draft, ...publicDay } = d;
      return publicDay;
    }),
  };
}
