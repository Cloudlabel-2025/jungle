import { boundedJson } from "@/lib/request-body.js";
import { withCollegeLoginUrls } from "@/lib/college-urls.js";
import { after } from "next/server";
import { listAdministrators, manageAdministrator } from "@/lib/platform-administrators.js";
import { recoveryOverview, requestAccountRecovery, deliverRecoveryMail } from "@/lib/password-recovery.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { collegeError } from "@/lib/college-registry.js";
import { authenticatePlatform, publicAdmin, requirePlatformAdmin, changePlatformPassword } from "@/lib/platform-auth.js";
import { currentPlatformAdmin, setPlatformSession, clearPlatformSession } from "@/lib/platform-session.js";
import { platformColleges, platformCollegeDetail, platformCreateCollege, platformUpdateCollege,
  platformCohortCommand, platformTeamCommand, platformActivity, platformPersonUpdate, platformCreateCC } from "@/lib/platform-management.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
async function handle(request, { params }) {
  try {
    const path = (await params).path, route = path.join("/"), method = request.method;
    if (method !== "GET" && !allowedWriteOrigin(request)) throw collegeError("Cross-origin commands are not allowed.", 403);
    const body = method === "GET" ? {} : await boundedJson(request, 20000);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw collegeError("A JSON object is required.");
    if (route === "auth/login" && method === "POST") {
      const admin = await authenticatePlatform(body.email, body.password);
      await clearPlatformSession();
      await setPlatformSession(admin);
      return Response.json({ admin: publicAdmin(admin) }, { headers });
    }
    if (route === "auth/logout" && method === "POST") {
      await clearPlatformSession();
      return Response.json({ success: true }, { headers });
    }
    const current = await currentPlatformAdmin();
    if (route === "auth/me" && method === "GET") return Response.json({ admin: publicAdmin(current) }, { headers });
    if (!current) throw collegeError("Super admin access required.", 401);
    if (route === "auth/password" && method === "POST") {
      await requirePlatformAdmin(current._id, { allowPasswordChange: true });
      const admin = await changePlatformPassword(current._id, body.currentPassword, body.newPassword);
      await setPlatformSession(admin);
      return Response.json({ admin: publicAdmin(admin) }, { headers });
    }
    await requirePlatformAdmin(current._id);
    let result;
    if (route === "administrators" && method === "GET") result = await listAdministrators(current._id);
    else if (route === "administrators" && method === "POST") result = await manageAdministrator(current._id, "create", body);
    else if (path[0] === "administrators" && path.length === 2 && method === "PATCH") {
      result = await manageAdministrator(current._id, "update", { ...body, id: path[1] });
      if (result.id === current._id) await setPlatformSession(await requirePlatformAdmin(current._id));
    }
    else if (route === "recovery" && method === "GET") result = await recoveryOverview(current._id);
    else if (route === "recovery" && method === "POST") {
      result = await requestAccountRecovery(current._id, body);
      after(async () => { await deliverRecoveryMail(result.id).catch(() => {}); });
    }
    else if (route === "activity" && method === "GET") result = await platformActivity(current._id);
    else if (route === "colleges") {
      if (method === "GET") result = await platformColleges(current._id, Object.fromEntries(new URL(request.url).searchParams));
      else if (method === "POST") result = await platformCreateCollege(current._id, body);
      else throw collegeError("Method not allowed.", 405);
    } else if (path[0] === "colleges" && path.length === 2) {
      if (method === "GET") result = await platformCollegeDetail(current._id, path[1]);
      else if (method === "PATCH") result = await platformUpdateCollege(current._id, path[1], body);
      else throw collegeError("Method not allowed.", 405);
    } else if (path[0] === "colleges" && path.length === 3 && path[2] === "cc" && method === "POST") {
      result = await platformCreateCC(current._id, path[1], body);
    } else if (path[0] === "colleges" && path[2] === "cohorts") {
      const fixed = { ...body, ...(path[3] ? { cohortId: path[3] } : {}), ...(path[5] ? { teamId: path[5] } : {}) };
      if (path.length === 3 && method === "POST") result = await platformCohortCommand(current._id, path[1], "create", fixed);
      else if (path.length === 4 && method === "PATCH") result = await platformCohortCommand(current._id, path[1], "update", fixed);
      else if (path.length === 5 && path[4] === "staff" && method === "POST") result = await platformCohortCommand(current._id, path[1], "add-staff", fixed);
      else if (path.length === 5 && path[4] === "teams" && method === "POST") result = await platformTeamCommand(current._id, path[1], "create", fixed);
      else if (path.length === 6 && path[4] === "teams" && method === "PATCH") result = await platformTeamCommand(current._id, path[1], "update", fixed);
      else if (path.length === 7 && path[4] === "teams" && path[6] === "members" && method === "POST") result = await platformTeamCommand(current._id, path[1], "add-member", fixed);
      else if (path.length === 6 && path[4] === "people" && method === "PATCH") result = await platformPersonUpdate(current._id, path[1], { ...body, cohortId: path[3], userId: path[5] });
      else throw collegeError("Management endpoint not found.", 404);
    } else throw collegeError("Management endpoint not found.", 404);
    return Response.json(withCollegeLoginUrls(result, request), { headers });
  } catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : error instanceof SyntaxError ? 400 : 503);
    const message = error.status ? error.message : error.code === 11000 ? "This code, name or account is already in use. Reload and choose another."
      : error instanceof SyntaxError ? "Enter valid JSON." : "The operation could not be completed. Reload to check its status and try again.";
    return Response.json({ error: message }, { status, headers });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
