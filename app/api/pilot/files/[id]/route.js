import { collegeRoute } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import { privateFileResponse } from "@/lib/pilot-storage.js";
export const runtime = "nodejs";
async function handleGET(request, { params }) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    return await privateFileResponse(user, (await params).id);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 400,
      headers: { "Cache-Control": "private, no-store" } });
  }
}

export const GET = collegeRoute(handleGET);
