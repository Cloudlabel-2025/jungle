import { after } from "next/server";
import { boundedJson } from "@/lib/request-body.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { selectedCollegeContext } from "@/lib/college-request.js";
import { collegeEntryHeader } from "@/lib/college-routing.js";
import { collegeError, collegeSignInSelector } from "@/lib/college-registry.js";
import { requestPasswordRecovery, completePasswordRecovery, deliverRecoveryMail, recoveryResponse } from "@/lib/password-recovery.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request, { params }) {
  if (!allowedWriteOrigin(request, request.headers.has(collegeEntryHeader) ? null : undefined)) return Response.json({ error: "Cross-origin commands are not allowed." }, { status: 403, headers });
  try {
    const body = await boundedJson(request, 10000), { action } = await params;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "A JSON object is required." }, { status: 400, headers });
    if (action === "request") {
      if (request.headers.has(collegeEntryHeader) && body.realm === "platform") throw collegeError("Use the central CMS for Super Admin recovery.", 403);
      if (body.realm !== "platform") {
        const context = await selectedCollegeContext();
        if (context) {
          if (body.collegeId !== undefined || body.collegeSlug !== undefined) {
            const supplied = collegeSignInSelector(body);
            if ((supplied._id && supplied._id !== context.college._id) || (supplied.slug && supplied.slug !== context.college.slug)) throw collegeError("Use this college's own recovery page.", 403);
          }
          body.collegeId = context.college._id;
        }
      }
      const id = await requestPasswordRecovery(body);
      after(async () => { if (id) await deliverRecoveryMail(id).catch(() => {}); });
      return Response.json(recoveryResponse, { status: 202, headers });
    }
    if (action === "reset") {
      const context = await selectedCollegeContext();
      return Response.json(await completePasswordRecovery(body.token, body.password, { collegeId: context?.college._id, allowPlatform: !request.headers.has(collegeEntryHeader) }), { headers });
    }
    return Response.json({ error: "Recovery endpoint not found." }, { status: 404, headers });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : "Password recovery is temporarily unavailable. Please try again." },
      { status: error.status || 503, headers });
  }
}
