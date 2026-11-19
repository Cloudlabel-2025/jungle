import { notFound, redirect } from "next/navigation";
import { currentPlatformAdmin } from "@/lib/platform-session.js";
import { platformCollegeDetail } from "@/lib/platform-management.js";
import CollegeCreatePage from "@/components/CollegeCreatePage";
import { currentCollegeRouting } from "@/lib/college-urls.js";
import "../../platform.css";
import "../../college-create.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Add college · Voyage of Wilderness",
  robots: { index: false, follow: false },
};
export default async function NewCollegePage({ searchParams }) {
  const admin = await currentPlatformAdmin();
  if (!admin || admin.mustChangePassword) redirect("/platform");
  const query = await searchParams;
  let initial = null;
  if (query.retry !== undefined) {
    if (typeof query.retry !== "string" || query.retry.length > 100) notFound();
    let result;
    try {
      result = await platformCollegeDetail(admin._id, query.retry);
    } catch (error) {
      if ([400, 404].includes(error.status)) notFound();
      throw error;
    }
    if (result.college.status !== "FAILED")
      redirect(`/platform?college=${encodeURIComponent(result.college.id)}`);
    initial = result.college;
  }
  return <CollegeCreatePage initial={initial} routing={await currentCollegeRouting()} />;
}
