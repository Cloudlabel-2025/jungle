import { notFound, redirect } from "next/navigation";
import { currentUser, demoEnabled } from "@/lib/auth.js";
import { navigation, prefix } from "@/lib/catalog.js";
import Arena from "@/components/Arena";
export const dynamic = "force-dynamic";
export default async function Page({ params }) {
  const { workspace, screen } = await params;
  const role = Object.keys(navigation).find((r) => prefix(r) === workspace);
  if (!role || !navigation[role].some((n) => n[1] === screen)) notFound();
  const user = await currentUser();
  if (user && user.role !== role) redirect(`/${prefix(user.role)}/dashboard`);
  return (
    <Arena
      screen={screen}
      workspace={workspace}
      initialUser={user ? JSON.parse(JSON.stringify(user)) : null}
      initialTime={new Date().toISOString()}
      demo={demoEnabled()}
    />
  );
}
