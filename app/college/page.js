import { redirect } from "next/navigation";
import { collegePage } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import { collegeManagementActor, authorizeManagement } from "@/lib/management-actor.js";
import { prefix } from "@/lib/catalog.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "College management · Voyage of Wilderness", robots: { index: false, follow: false } };
export default function CollegePage() {
  return collegePage(async college => {
    if (!college) redirect("/gamer/dashboard");
    const user = await currentUser();
    if (!user) redirect("/gamer/dashboard");
    if (user.mustChangePassword) redirect(`/${prefix(user.role)}/dashboard`);
    if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(user.role)) redirect("/gamer/dashboard");
    try { await authorizeManagement(collegeManagementActor(user), college._id); }
    catch (error) { if ([401, 403].includes(error.status)) redirect(`/${prefix(user.role)}/dashboard`); throw error; }
    redirect(`/${prefix(user.role)}/college-management`);
  });
}
