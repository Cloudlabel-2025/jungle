import { headers } from "next/headers";
import {
  buildCollegeUrl,
  normalizeCollegeRootDomain,
  requestOrigin,
} from "./college-routing.js";

export function collegeRouting(headers, fallback) {
  return {
    origin: requestOrigin(headers, fallback),
    rootDomain: normalizeCollegeRootDomain(
      process.env.COLLEGE_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "",
    ),
  };
}
export async function currentCollegeRouting() {
  return collegeRouting(await headers());
}
export function withCollegeLoginUrls(result, request) {
  const routing = collegeRouting(request.headers, request.url);
  const decorate = (college) => ({
    ...college,
    loginUrl: buildCollegeUrl(college.slug, routing.origin, routing),
  });
  if (Array.isArray(result?.colleges))
    return { ...result, colleges: result.colleges.map(decorate) };
  if (result?.college?.slug)
    return { ...result, college: decorate(result.college) };
  if (result?.slug && result?.id) return decorate(result);
  return result;
}
