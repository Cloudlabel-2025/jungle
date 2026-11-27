import { NextResponse } from "next/server";
import { tenancyEnabled } from "./lib/tenancy-mode.js";
import {
  collegeEntryCookie,
  collegeEntryHeader,
  collegeSlugFromHost,
  validCollegeAddress,
  platformOrigin,
  requestOrigin,
} from "./lib/college-routing.js";

export function proxy(request) {
  const headers = new Headers(request.headers);
  headers.delete(collegeEntryHeader);
  const rootDomain =
    process.env.COLLEGE_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "";
  if (!tenancyEnabled())
    return NextResponse.next({ request: { headers } });
  const hostSlug = collegeSlugFromHost(
    request.headers.get("host") || request.nextUrl.host,
    rootDomain,
  );
  const path = request.nextUrl.pathname;
  if (path === "/") return NextResponse.redirect(new URL(hostSlug ? "/gamer/dashboard" : "/platform", requestOrigin(request.headers, request.url)));
  if (hostSlug && (path === "/platform" || path.startsWith("/platform/")))
    return NextResponse.redirect(
      new URL(
        path + request.nextUrl.search,
        platformOrigin(requestOrigin(request.headers, request.url), rootDomain),
      ),
    );
  if (
    hostSlug &&
    (path === "/api/platform" || path.startsWith("/api/platform/"))
  )
    return NextResponse.json(
      { error: "Use the central CMS address for Super Admin access." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  let slug = hostSlug,
    rewrite;
  if (path === "/c" || path.startsWith("/c/")) {
    const parts = path.split("/");
    const requested = parts[2];
    if (!validCollegeAddress(requested) || (hostSlug && hostSlug !== requested))
      return NextResponse.json(
        { error: "College URL not found." },
        { status: 404 },
      );
    slug = requested;
    const target = parts.slice(3).join("/");
    // Dedicated college entry/recovery paths keep URL fragments in the browser.
    if (target && target !== "recover")
      return NextResponse.json(
        { error: "College URL not found." },
        { status: 404 },
      );
    // Rewrite against Next's internal request origin, not the browser's Host.
    // A tenant .localhost Host can differ from the loopback origin and would
    // turn this into an external proxy request requiring OS DNS resolution.
    // Plain URL also avoids NextURL normalizing 127.0.0.1 into localhost.
    rewrite = new URL(request.url);
    rewrite.pathname = target === "recover" ? "/recover" : "/gamer/dashboard";
  }
  if (slug) headers.set(collegeEntryHeader, slug);
  const response = rewrite
    ? NextResponse.rewrite(rewrite, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  if (rewrite)
    response.headers.set("Cache-Control", "private, no-store");
  if (rewrite)
    response.cookies.set(collegeEntryCookie, slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: requestOrigin(request.headers, request.url).startsWith("https:"),
      path: "/",
      maxAge: 8 * 3600,
    });
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|images/|vendor/).*)",
  ],
};
