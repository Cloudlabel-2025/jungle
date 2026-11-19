import { collegeRoute } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import { boundedJson } from "@/lib/request-body.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { uploadIntent, finishUpload, storePrivateUpload } from "@/lib/pilot-storage.js";
export const runtime = "nodejs";
async function handlePUT(request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (!allowedWriteOrigin(request)) return Response.json({ error: "Cross-origin upload denied." }, { status: 403, headers });
    const user = await currentUser();
    if (!user) return Response.json({ error: "Please sign in." }, { status: 401, headers });
    const id = new URL(request.url).searchParams.get("evidenceId");
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: "A valid upload reservation is required." }, { status: 400, headers });
    return Response.json(await storePrivateUpload(user, id, request), { headers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 400, headers });
  }
}
async function handlePOST(request) {
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

export const PUT = collegeRoute(handlePUT);

export const POST = collegeRoute(handlePOST);
