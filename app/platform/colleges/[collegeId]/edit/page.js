import { notFound, redirect } from "next/navigation";
import { currentPlatformAdmin } from "@/lib/platform-session.js";
import { platformCollegeDetail } from "@/lib/platform-management.js";
import CollegeCreatePage from "@/components/CollegeCreatePage";
import { currentCollegeRouting } from "@/lib/college-urls.js";
import "../../../platform.css";
import "../../../college-create.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Edit college · Voyage of Wilderness",
  robots: { index: false, follow: false },
};
export default async function EditCollegePage({ params }) {
  const admin = await currentPlatformAdmin();
  if (!admin || admin.mustChangePassword) redirect("/platform");
  const { collegeId } = await params;
  let detail;
  try {
    detail = await platformCollegeDetail(admin._id, collegeId);
  } catch (error) {
    if ([400, 404].includes(error.status)) notFound();
    throw error;
  }
  if (detail.incomplete)
    redirect(`/platform?college=${encodeURIComponent(collegeId)}`);
  return <CollegeCreatePage mode="edit" initial={detail.college} routing={await currentCollegeRouting()} />;
}
