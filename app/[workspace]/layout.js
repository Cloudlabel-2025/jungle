import { notFound, redirect } from "next/navigation";
import { currentUser, demoEnabled } from "@/lib/auth.js";
import { navigation, prefix } from "@/lib/catalog.js";
import WorkspaceShell from "@/components/WorkspaceShell";
import { publicPlayer } from "@/lib/player-stage.js";

export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children, params }) {
  const { workspace } = await params;
  const role = Object.keys(navigation).find(
    (value) => prefix(value) === workspace,
  );
  if (!role) notFound();
  const user = await currentUser();
  if (user && user.role !== role) redirect(`/${prefix(user.role)}/dashboard`);
  return (
    <WorkspaceShell
      workspace={workspace}
      initialUser={user ? JSON.parse(JSON.stringify(await publicPlayer(user))) : null}
      initialTime={new Date().toISOString()}
      demo={demoEnabled()}
    >
      {children}
    </WorkspaceShell>
  );
}
