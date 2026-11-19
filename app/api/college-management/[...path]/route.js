import { currentUser } from "@/lib/auth.js";
import { collegeRoute } from "@/lib/college-request.js";
import { collegeContext } from "@/lib/college-context.js";
import { collegeError } from "@/lib/college-registry.js";
import { collegeManagementActor, authorizeManagement } from "@/lib/management-actor.js";
import { platformCollegeDetail, platformCohortCommand, platformTeamCommand, platformPersonUpdate } from "@/lib/platform-management.js";
import { boundedJson } from "@/lib/request-body.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function handle(request, { params }) {
  try {
    const user = await currentUser();
    const actor = collegeManagementActor(user), collegeId = collegeContext().college._id;
    await authorizeManagement(actor, collegeId);
    const path = (await params).path, method = request.method;
    if (method !== "GET" && !allowedWriteOrigin(request)) throw collegeError("Cross-origin writes are not allowed.", 403);
    const body = method === "GET" ? {} : await boundedJson(request, 20000);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw collegeError("A JSON object is required.");
    let result;
    if (path.length === 1 && path[0] === "state" && method === "GET") {
      result = await platformCollegeDetail(actor, collegeId);
      result.actor = { id: user._id, name: user.name, email: user.email, role: user.role };
    } else if (path[0] === "cohorts") {
      // Route IDs override JSON, and the college always comes from the signed-in session.
      const fixed = { ...body, ...(path[1] ? { cohortId: path[1] } : {}), ...(path[3] ? { teamId: path[3] } : {}) };
      if (path.length === 1 && method === "POST") result = await platformCohortCommand(actor, collegeId, "create", fixed);
      else if (path.length === 2 && method === "PATCH") result = await platformCohortCommand(actor, collegeId, "update", fixed);
      else if (path.length === 3 && path[2] === "guides" && method === "POST") {
        if (body.role && body.role !== "MISSION_COMMANDER") throw collegeError("Only Guide accounts can be created here.", 403);
        result = await platformCohortCommand(actor, collegeId, "add-staff", { ...fixed, role: "MISSION_COMMANDER" });
      } else if (path.length === 3 && path[2] === "teams" && method === "POST") result = await platformTeamCommand(actor, collegeId, "create", fixed);
      else if (path.length === 4 && path[2] === "teams" && method === "PATCH") result = await platformTeamCommand(actor, collegeId, "update", fixed);
      else if (path.length === 5 && path[2] === "teams" && path[4] === "players" && method === "POST") result = await platformTeamCommand(actor, collegeId, "add-member", fixed);
      else if (path.length === 4 && path[2] === "people" && method === "PATCH") result = await platformPersonUpdate(actor, collegeId, { ...body, cohortId: path[1], userId: path[3] });
      else throw collegeError("Management endpoint not found.", 404);
    } else throw collegeError("Management endpoint not found.", 404);
    return Response.json(result, { headers });
  } catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : error instanceof SyntaxError ? 400 : 503);
    return Response.json({ error: error.status ? error.message : error.code === 11000 ? "This account or code already exists. Reload and choose another." :
      error instanceof SyntaxError ? "Enter valid JSON." : "The operation could not be completed. Reload to check its status." }, { status, headers });
  }
}
export const GET = collegeRoute(handle);
export const POST = collegeRoute(handle);
export const PATCH = collegeRoute(handle);
