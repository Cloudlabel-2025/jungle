import { collegeError } from "./college-registry.js";
import { validMailAddress } from "./mail-address.js";
import { collegeTypes } from "./college-options.js";

const limits = {
  institutionType: 30,
  affiliation: 160,
  website: 300,
  contactEmail: 120,
  phone: 30,
  addressLine1: 160,
  addressLine2: 160,
  city: 80,
  state: 80,
  country: 80,
  postalCode: 20,
};
export function normalizeCollegeProfile(input) {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw collegeError("Enter valid college details.");
  if (Object.keys(input).some((key) => !Object.hasOwn(limits, key)))
    throw collegeError("Unsupported college detail.");
  const profile = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || value.length > limits[key])
      throw collegeError(
        `Enter a valid ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`,
      );
    if (value.trim()) profile[key] = value.trim();
  }
  if (
    profile.institutionType &&
    !collegeTypes.includes(profile.institutionType)
  )
    throw collegeError("Choose a valid college type.");
  if (profile.contactEmail) {
    if (!validMailAddress(profile.contactEmail))
      throw collegeError("Enter a valid college contact email.");
    profile.contactEmail = profile.contactEmail.toLowerCase();
  }
  if (
    profile.phone &&
    (!/^[+\d().\s-]+$/.test(profile.phone) ||
      profile.phone.replace(/\D/g, "").length < 7 ||
      profile.phone.replace(/\D/g, "").length > 15)
  )
    throw collegeError("Enter a valid contact phone number with 7–15 digits.");
  if (profile.website) {
    let url;
    try {
      url = new URL(profile.website);
    } catch {
      throw collegeError(
        "Enter a full college website URL, such as https://college.edu.",
      );
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw collegeError(
        "Use an HTTP or HTTPS college website without embedded credentials.",
      );
    profile.website = url.href;
  }
  return profile;
}
