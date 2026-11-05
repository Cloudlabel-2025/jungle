import { timingSafeEqual } from "node:crypto";
import { processPilot } from "@/scripts/process-pilot.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const expected = process.env.CRON_SECRET,
    token = request.headers.get("authorization") || "",
    wanted = `Bearer ${expected}`;
  if (
    !expected ||
    Buffer.byteLength(token) !== Buffer.byteLength(wanted) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(wanted))
  )
    return Response.json({ error: "Unauthorised scheduler." }, { status: 401 });
  try {
    const results = await processPilot();
    return Response.json(results, {
      status: results.some((r) => r.error) ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Scheduled processing failed; check operational logs." },
      { status: 503 },
    );
  }
}
