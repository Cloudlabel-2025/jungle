import { currentUser } from "@/lib/auth.js";
import { boundedJson } from "@/lib/request-body.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { uploadIntent, finishUpload } from "@/lib/pilot-storage.js";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    if (!allowedWriteOrigin(request))
      return Response.json(
        { error: "Cross-origin upload denied." },
        { status: 403 },
      );
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    const { action, ...b } = await boundedJson(request, 10000);
    if (!["intent", "complete"].includes(action))
      throw new Error("Unknown storage action.");
    return Response.json(
      await (action === "intent"
        ? uploadIntent(user, b)
        : finishUpload(user, b)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 400 });
  }
}
