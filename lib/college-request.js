import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { collegeEntryCookie, collegeEntryHeader, validCollegeAddress } from "./college-routing.js";
import { tokenClaims } from "./session-token.js";
import { tenancyEnabled, runWithCollege } from "./college-context.js";
import { contextForCollege, collegeSignInSelector, collegeError } from "./college-registry.js";
import { boundedJson } from "./request-body.js";
import { allowedWriteOrigin } from "./request-origin.js";
import { passwordChangeRequired } from "./college-password.js";

const privateHeaders = { "Cache-Control": "private, no-store" };
export async function selectedCollegeContext() {
  const slug = (await headers()).get(collegeEntryHeader) || (await cookies()).get(collegeEntryCookie)?.value;
  if (!slug) return null;
  if (!validCollegeAddress(slug)) throw collegeError("College URL not found.", 404);
  return contextForCollege({ slug });
}
export function collegeRoute(handler) {
  return async (request, args) => {
    if (!tenancyEnabled()) return handler(request, args);
    try {
      const path = new URL(request.url).pathname;
      const login = path === "/api/auth/login" && request.method === "POST";
      const portalSlug = request.headers.get(collegeEntryHeader) || (await cookies()).get(collegeEntryCookie)?.value;
      if (!["GET", "HEAD"].includes(request.method) && !allowedWriteOrigin(request, portalSlug ? null : undefined))
        throw collegeError("Cross-origin writes are not allowed.", 403);
      if (path === "/api/auth/logout" && request.method === "POST") {
        (await cookies()).delete("codewild_session");
        return Response.json({ success: true }, { headers: privateHeaders });
      }
      const claims = tokenClaims((await cookies()).get("codewild_session")?.value || "");
      let selector;
      if (portalSlug) {
        if (!validCollegeAddress(portalSlug)) throw collegeError("College URL not found.", 404);
        selector = { slug: portalSlug };
      } else if (login) {
        const body = await boundedJson(request.clone(), 100000);
        selector = collegeSignInSelector(body);
      } else if (claims?.collegeId) selector = { _id: claims.collegeId };
      else if (path === "/api/auth/me")
        return Response.json({ authenticated: false, user: null, tenancy: true,
          serverTime: new Date().toISOString() }, { headers: privateHeaders });
      else if (path === "/api/auth/personas")
        return Response.json({ personas: [], demo: false }, { headers: privateHeaders });
      else throw collegeError("Please sign in to your college.", 401);
      const context = await contextForCollege(selector);
      if (login && portalSlug) {
        const body = await boundedJson(request.clone(), 100000);
        if (body.collegeId !== undefined || body.collegeSlug !== undefined) {
          const supplied = collegeSignInSelector(body);
          if ((supplied._id && supplied._id !== context.college._id) || (supplied.slug && supplied.slug !== context.college.slug))
            throw collegeError("This sign-in belongs to another college URL.", 403);
        }
      }
      if (!login && !claims?.collegeId) {
        if (path === "/api/auth/me") return Response.json({ authenticated: false, user: null, tenancy: true, serverTime: new Date().toISOString() }, { headers: privateHeaders });
        if (path === "/api/auth/personas") return Response.json({ personas: [], demo: false }, { headers: privateHeaders });
        throw collegeError("Please sign in to this college.", 401);
      }
      if (!login && claims.collegeId !== context.college._id) throw collegeError("Your session belongs to another college. Sign in at this college URL.", 409);
      if (!login && claims.collegeRevision !== context.college.accessRevision)
        throw collegeError("College access changed. Please sign in again.", 401);
      const expected = request.headers.get("x-codewild-college");
      if (!login && expected && expected !== context.college._id)
        throw collegeError("Your college session changed. Reload and sign in again.", 409);
      if (!login && !["GET", "HEAD"].includes(request.method) && request.headers.has("origin") && !expected)
        throw collegeError("Reload this page before saving college data.", 409);
      const response = await runWithCollege(context, async () => {
        if (!login && !["/api/auth/me", "/api/auth/personas", "/api/auth/password"].includes(path)) {
          const account = await context.models.User.findById(claims.sub).select("active authVersion").lean();
          if (!account || account.active === false || (account.authVersion || 1) !== (claims.accountVersion || 1)) throw collegeError("Please sign in again.", 401);
          if (await passwordChangeRequired(claims.sub)) return Response.json({ error: "Set your permanent password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403, headers: privateHeaders });
        }
        return handler(request, args);
      });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      return Response.json({ error: error.status ? error.message : "College storage is unavailable." },
        { status: error.status || 503, headers: privateHeaders });
    }
  };
}
export async function collegePage(render) {
  if (!tenancyEnabled()) return render(null);
  let entry;
  try { entry = await selectedCollegeContext(); }
  catch (error) { if ([403, 404].includes(error.status)) notFound(); throw error; }
  if (entry) return runWithCollege(entry, () => render(entry.college));
  const claims = tokenClaims((await cookies()).get("codewild_session")?.value || "");
  if (!claims?.collegeId) return render(null);
  // Do not hide storage errors by silently rendering another college.
  let context;
  try { context = await contextForCollege({ _id: claims.collegeId }); }
  catch (error) {
    // Inactive/removed colleges can still reach sign-in for a different college.
    if ([403, 404].includes(error.status)) return render(null);
    throw error;
  }
  if (claims.collegeRevision !== context.college.accessRevision) return render(null);
  return runWithCollege(context, () => render(context.college));
}
