import { connect } from "@/lib/db.js";
import { tenancyEnabled } from "@/lib/college-context.js";
import { registryModels } from "@/lib/college-registry.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (tenancyEnabled()) await (await registryModels()).connection.db.command({ ping: 1 });
    else await connect();
    return Response.json(
      { status: "ok", tenancy: tenancyEnabled() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
