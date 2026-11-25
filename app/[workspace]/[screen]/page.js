import { collegePage } from "@/lib/college-request.js";
import { tenancyEnabled } from "@/lib/college-context.js";
import { notFound, redirect } from "next/navigation";
import { playerObjectives } from "@/lib/player-objectives.js";
import { currentUser } from "@/lib/auth.js";
import { navigation, prefix } from "@/lib/catalog.js";
import { weekOneNavigation } from "@/lib/week-one-catalog.js";
import {
  validProgrammeScreen,
  programmePath,
  isWorkspaceScreen,
} from "@/lib/workspace-navigation.js";
import WorkspaceScreen from "@/components/WorkspaceScreen";
import CollegeManagementPage from "@/components/CollegeManagementPage";
import { playerStage } from "@/lib/player-stage.js";
import { flightScreens } from "@/lib/flight-rules.js";
import FlightLockedPage from "@/components/FlightLockedPage";
export const dynamic = "force-dynamic";
async function renderPage({ params, searchParams }, college) {
  const { workspace, screen } = await params;
  const role = Object.keys(navigation).find((r) => prefix(r) === workspace);
  if (
    !role ||
    !(
      isWorkspaceScreen(role, screen) ||
      validProgrammeScreen(role, screen) ||
      weekOneNavigation[role].some((n) => n[1] === screen)
    )
  )
    notFound();
  const user = tenancyEnabled() && !college ? null : await currentUser();
  if (user && user.role !== role) redirect(`/${prefix(user.role)}/dashboard`);
  if (user?.mustChangePassword) return null;
  if (screen === "college-management") return <CollegeManagementPage role={role} />;
  if (user?.role === "GAMER") {
    const story = await playerStage(user);
    if (story.flight && !flightScreens.has(screen)) return <FlightLockedPage />;
    if (story.flight && !story.introComplete && !["dashboard", "week-one-ask-mc", "notifications"].includes(screen))
      redirect("/gamer/dashboard");
  }
  if (!isWorkspaceScreen(role, screen) && !validProgrammeScreen(role, screen))
    redirect(programmePath(role, screen));
  const objectives = screen === "objectives" && user?.role === "GAMER" ? await playerObjectives(user) : null;
  const query = screen === "objectives" ? await searchParams : null;
  return <WorkspaceScreen key={screen} screen={screen} objectives={objectives} objectiveLevel={query?.level} />;
}

export default function Page(props) { return collegePage(college => renderPage(props, college)); }
