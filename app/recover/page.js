import PasswordRecovery from "@/components/PasswordRecovery";
import { collegePage } from "@/lib/college-request.js";
import "../platform/platform.css";
export const metadata = { title: "Password recovery · Voyage of Wilderness", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function RecoveryPage() { return collegePage(college => <PasswordRecovery college={college ? { id: college._id, name: college.name } : null} />); }
