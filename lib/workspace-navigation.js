import { navigation, prefix } from "./catalog.js";
import { weekOneNavigation } from "./week-one-catalog.js";

// Programme pages are additions to the existing workspace. Original URLs always
// retain their original meaning, including dashboard, setup and rewards.
export const programmeScreen = (screen) =>
  screen === "week-one"
    ? "dashboard"
    : screen.startsWith("week-one-")
      ? screen.slice(9)
      : null;
export const programmePath = (role, screen = "dashboard") =>
  `/${prefix(role)}/${screen === "dashboard" ? "week-one" : `week-one-${screen}`}`;
export const workspaceNavigation = (role) => [
  ...navigation[role],
  ["W1", "week-one", "Week 1 & Recovery", "BookOpen"],
];
export const validProgrammeScreen = (role, screen) =>
  weekOneNavigation[role]?.some(
    (entry) => entry[1] === programmeScreen(screen),
  );
export function legacyWorkspaceData(data) {
  const {
    weekOneEnergy,
    weekOneTrophies,
    dayOneEnergy,
    dayOneTrophies,
    ...user
  } = data.user;
  return { ...data, user };
}
