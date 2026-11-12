import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth.js";
import { navigation, prefix } from "@/lib/catalog.js";
import { weekOneNavigation } from "@/lib/week-one-catalog.js";
import {
  validProgrammeScreen,
  programmePath,
  isWorkspaceScreen,
} from "@/lib/workspace-navigation.js";
import WorkspaceScreen from "@/components/WorkspaceScreen";
export const dynamic = "force-dynamic";
export default async function Page({ params }) {
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
  const user = await currentUser();
  if (user && user.role !== role) redirect(`/${prefix(user.role)}/dashboard`);
  if (!isWorkspaceScreen(role, screen) && !validProgrammeScreen(role, screen))
    redirect(programmePath(role, screen));
  return <WorkspaceScreen key={screen} screen={screen} />;
}
