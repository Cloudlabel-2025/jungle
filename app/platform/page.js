import PlatformDashboard from "@/components/PlatformDashboard";
import { currentPlatformAdmin } from "@/lib/platform-session.js";
import { publicAdmin } from "@/lib/platform-auth.js";
import "./platform.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "CMS · Voyage of Wilderness", robots: { index: false, follow: false } };
export default async function PlatformPage({ searchParams }) {
  const query = await searchParams;
  return <PlatformDashboard initialAdmin={publicAdmin(await currentPlatformAdmin())} initialCollegeId={typeof query?.college === "string" ? query.college : ""} />;
}
