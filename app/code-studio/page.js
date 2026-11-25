import { redirect } from "next/navigation";
import { collegePage } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import { requireExpedition } from "@/lib/player-stage.js";
import Studio from "@/components/TeamCodeStudio.js";

export default function Page() {
  return collegePage(async (college) => {
    const user = await currentUser();
    if (!user || user.mustChangePassword) redirect("/gamer/dashboard");
    if (!["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"].includes(user.role))
      redirect("/");
    try {
      if (user.role === "GAMER") await requireExpedition(user);
    } catch {
      redirect("/gamer/dashboard");
    }
    return (
      <Studio
        user={{
          _id: user._id,
          name: user.name,
          role: user.role,
          collegeId: college?._id,
        }}
      />
    );
  });
}
