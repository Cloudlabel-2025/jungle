import { currentUser } from "@/lib/auth.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { pilotAction, pilotSnapshot } from "@/lib/pilot-engine.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    return Response.json(await pilotSnapshot(user), { headers });
  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: e.status || 400, headers },
    );
  }
}
export async function POST(request) {
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
