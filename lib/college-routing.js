// Adapted from the host/tenant URL patterns in Projects/Lims-V1.
const reserved = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "cdn",
  "cms",
  "dashboard",
  "developer",
  "docs",
  "help",
  "internal",
  "login",
  "mail",
  "platform",
  "root",
  "static",
  "support",
  "www",
]);
export const collegeEntryCookie = "vow_college_entry";
export const collegeEntryHeader = "x-vow-college-entry";
export function validCollegeAddress(value) {
  return (
    typeof value === "string" &&
    value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !reserved.has(value)
  );
}
export function normalizeCollegeRootDomain(value = "") {
  const domain = String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!domain) return "";
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/.test(domain))
    throw new Error(
      "Configure COLLEGE_ROOT_DOMAIN as a hostname without a path or port.",
    );
  return domain;
}
function hostnameOf(host) {
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}
export function collegeSlugFromHost(host, rootDomain = "") {
  const hostname = hostnameOf(host);
  const root = normalizeCollegeRootDomain(rootDomain);
  const suffix = hostname.endsWith(".localhost")
    ? ".localhost"
    : root && hostname.endsWith(`.${root}`)
      ? `.${root}`
      : "";
  if (!suffix) return null;
  const slug = hostname.slice(0, -suffix.length);
  return validCollegeAddress(slug) ? slug : null;
}
export function platformOrigin(origin, rootDomain = "") {
  const url = new URL(origin),
    root = normalizeCollegeRootDomain(rootDomain);
  if (
    url.hostname.endsWith(".localhost") ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    url.hostname = "localhost";
  else if (root && (url.hostname === root || url.hostname.endsWith(`.${root}`)))
    url.hostname = root;
  return url.origin;
}
export function buildCollegeUrl(
  slug,
  origin,
  { rootDomain = "", pathname = "/" } = {},
) {
  if (!validCollegeAddress(slug))
    throw new Error("Choose a valid college URL name.");
  const url = new URL(origin),
    root = normalizeCollegeRootDomain(rootDomain);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  url.search = "";
  url.hash = "";
  if (
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.hostname.endsWith(".localhost")
  ) {
    url.hostname = `${slug}.localhost`;
    url.pathname = path;
  } else if (root) {
    url.hostname = `${slug}.${root}`;
    url.pathname = path;
  } else url.pathname = `/c/${slug}${path === "/" ? "" : path}`;
  return url.toString();
}
export function requestOrigin(headers, fallback = "http://localhost:3000") {
  const host = headers.get("host");
  if (!host) return new URL(fallback).origin;
  const forwarded = headers.get("x-forwarded-proto");
  const protocol =
    forwarded === "https"
      ? "https"
      : forwarded === "http"
        ? "http"
        : new URL(fallback).protocol.slice(0, -1);
  return new URL(`${protocol}://${host}`).origin;
}
