import { collegeRoute } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { pilotAction, pilotSnapshot } from "@/lib/pilot-engine.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function handleGET(request) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    const sprintId = new URL(request.url).searchParams.get("sprint");
    if (sprintId && !/^[\w:-]{1,150}$/.test(sprintId))
      return Response.json({ error: "Invalid sprint identifier." }, { status: 400, headers });
    return Response.json(await pilotSnapshot(user, new Date(), sprintId), { headers });
  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: e.status || 400, headers },
    );
  }
}
async function handlePOST(request) {
  try {
    if (!allowedWriteOrigin(request))
      return Response.json(
        { error: "Cross-origin commands denied." },
        { status: 403 },
      );
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    const reader = request.body?.getReader(),
      chunks = [];
    let size = 0;
    if (!reader) throw new Error("JSON body required.");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 400000) {
        await reader.cancel();
        return Response.json(
          { error: "Command exceeds 400 KB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const { action, ...body } = JSON.parse(Buffer.concat(chunks).toString());
    return Response.json(await pilotAction(user, action, body), { headers });
  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: e.status || 400, headers },
    );
  }
}

export const GET = collegeRoute(handleGET);

export const POST = collegeRoute(handlePOST);
