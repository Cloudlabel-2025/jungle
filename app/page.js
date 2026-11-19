import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { tenancyEnabled } from "@/lib/college-context.js";
import { collegeEntryHeader } from "@/lib/college-routing.js";
export const dynamic = "force-dynamic";
export default async function Home() {
  redirect(
    !tenancyEnabled() || (await headers()).get(collegeEntryHeader)
      ? "/gamer/dashboard"
      : "/platform",
  );
}
