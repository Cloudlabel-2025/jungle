import { collegePage } from "@/lib/college-request.js";
import { tenancyEnabled } from "@/lib/college-context.js";
import { notFound, redirect } from "next/navigation";
import { currentUser, demoEnabled } from "@/lib/auth.js";
import { navigation, prefix } from "@/lib/catalog.js";
import WorkspaceShell from "@/components/WorkspaceShell";
import { publicPlayer } from "@/lib/player-stage.js";

export const dynamic = "force-dynamic";
async function renderWorkspaceLayout({ children, params }, college) {
  const { workspace } = await params;
  const role = Object.keys(navigation).find(
    (value) => prefix(value) === workspace,
  );
  if (!role) notFound();
  if (tenancyEnabled() && !college) redirect("/platform");
  const user = tenancyEnabled() && !college ? null : await currentUser();
  if (user && user.role !== role) redirect(`/${prefix(user.role)}/dashboard`);
  return (
    <WorkspaceShell
      college={college ? { id: college._id, name: college.name, slug: college.slug } : null}
      tenancy={tenancyEnabled()}
      workspace={workspace}
      initialUser={user ? JSON.parse(JSON.stringify(await publicPlayer(user))) : null}
      initialTime={new Date().toISOString()}
      demo={demoEnabled()}
    >
      {children}
    </WorkspaceShell>
  );
}

export default function WorkspaceLayout(props) { return collegePage(college => renderWorkspaceLayout(props, college)); }
