import { redirect } from "next/navigation";
import { collegeManagementActor, authorizeManagement } from "@/lib/management-actor.js";
import { prefix } from "@/lib/catalog.js";
import { currentCollegeRouting } from "@/lib/college-urls.js";
import { buildCollegeUrl } from "@/lib/college-routing.js";
import { collegePage } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import CollegeManagement from "./CollegeManagement";
import "@/app/platform/platform.css";
import "@/app/college-management.css";

export default function CollegeManagementPage({ role }) {
  // React renders this server component after its parent returns. Resolve its
  // own college scope so authorization runs inside the tenant async context.
  return collegePage(async college => {
  const user = await currentUser();
  if (!college || !user) redirect(`/${prefix(role)}/dashboard`);
  if (user.role !== role) redirect(`/${prefix(user.role)}/dashboard`);
  if (user.mustChangePassword) return null;
  try { await authorizeManagement(collegeManagementActor(user), college._id); }
  catch (error) {
    if ([401, 403].includes(error.status)) redirect(`/${prefix(user.role)}/dashboard`);
    throw error;
  }
  const routing = await currentCollegeRouting();
  return <CollegeManagement
    college={{ id: college._id, name: college.name, slug: college.slug, loginUrl: buildCollegeUrl(college.slug, routing.origin, routing) }}
    actor={{ id: user._id, name: user.name, email: user.email, role: user.role }}
  />;
  });
}
