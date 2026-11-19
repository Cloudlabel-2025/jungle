import { NextResponse } from "next/server";
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
  if (process.env.TENANCY_ENABLED !== "true")
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
    // NextURL normalizes 127.0.0.1 to localhost. Keep the actual Host so this
    // stays an internal rewrite and retains the trusted college header.
    rewrite = new URL(request.nextUrl.pathname + request.nextUrl.search, requestOrigin(request.headers, request.url));
    rewrite.pathname = target === "recover" ? "/recover" : "/gamer/dashboard";
  }
  if (slug) headers.set(collegeEntryHeader, slug);
  const response = rewrite
    ? NextResponse.rewrite(rewrite, { request: { headers } })
    : NextResponse.next({ request: { headers } });
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
