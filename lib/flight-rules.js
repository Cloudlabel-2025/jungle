// Shared presentation/access vocabulary. Authority is resolved from server records.
export const flightScreens = new Set([
  "dashboard",
  "week-one",
  "week-one-announcements",
  "week-one-games",
  "week-one-ask-mc",
  "week-one-showcase",
  "week-one-challenges",
  "week-one-game-rules",
  "week-one-results",
  "notifications",
]);
export function flightApiAllowed(route, method, introComplete) {
  if (route === "player/work-history" && method === "GET") return true;
  if (
    [
      "state",
      "auth/me",
      "auth/logout",
      "story/flight-intro",
      "story/crash-arrival",
      "attendance/clock-in",
      "attendance/clock-out",
      "attendance/stay",
      "notifications",
      "notifications/read",
    ].includes(route)
  )
    return true;
  if (route === "week1/program/ask") return true;
  if (route.startsWith("day1/") || route.startsWith("week1/"))
    return introComplete || method === "GET";
  return false;
}
