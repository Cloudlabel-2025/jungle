import { collegeError } from "./college-registry.js";

export function collegeContactKeys(profile = {}) {
  const email = profile.contactEmail?.trim().toLowerCase();
  const rawPhone = profile.phone?.trim();
  let phone = rawPhone?.replace(/\D/g, "");
  if (phone?.startsWith("00")) phone = phone.slice(2);
  // The CMS defaults to India. Preserve explicit international country codes.
  const indian = !profile.country?.trim() || /^(india|in|ind)$/i.test(profile.country.trim());
  if (phone && indian && !rawPhone.startsWith("+") && !rawPhone.startsWith("00")) {
    if (/^0\d{10}$/.test(phone)) phone = phone.slice(1);
    if (/^\d{10}$/.test(phone)) phone = `91${phone}`;
  }
  return { ...(email ? { contactEmailKey: email } : {}), ...(phone ? { contactPhoneKey: phone } : {}) };
}

export function collegeContactKeyUpdate(profile) {
  const keys = collegeContactKeys(profile);
  return { $set: keys, $unset: Object.fromEntries(
    ["contactEmailKey", "contactPhoneKey"].filter(key => !keys[key]).map(key => [key, ""]),
  ) };
}

const conflict = field => collegeError(field === "contactEmailKey"
  ? "This college contact email is already used by another college. Enter a different email."
  : "This contact phone number is already used by another college. Enter a different number.", 409);

export async function assertUniqueCollegeContacts(College, profile, excludeId, session = null) {
  const keys = collegeContactKeys(profile);
  if (!Object.keys(keys).length) return;
  // Include older records without identity keys until the backfill is applied.
  const colleges = await College.find(excludeId ? { _id: { $ne: excludeId } } : {})
    .select("profile.contactEmail profile.phone profile.country").session(session).lean();
  for (const college of colleges) {
    const other = collegeContactKeys(college.profile);
    for (const field of Object.keys(keys)) if (other[field] === keys[field]) throw conflict(field);
  }
}

export function rethrowCollegeContactConflict(error) {
  if (error.code === 11000) {
    for (const field of ["contactEmailKey", "contactPhoneKey"]) {
      if (error.keyPattern?.[field] || error.keyValue?.[field] || error.message?.includes(`college_${field}_unique`)) throw conflict(field);
    }
  }
  throw error;
}

export async function writeCollegeContacts(write) {
  try { return await write(); } catch (error) { rethrowCollegeContactConflict(error); }
}

export function planCollegeContactBackfill(colleges) {
  const owners = new Map(), conflicts = [];
  const updates = colleges.map(college => {
    const update = collegeContactKeyUpdate(college.profile);
    for (const [field, key] of Object.entries(update.$set)) {
      const identity = `${field}:${key}`;
      if (owners.has(identity)) conflicts.push({ field: field === "contactEmailKey" ? "contactEmail" : "phone", collegeIds: [owners.get(identity), college._id] });
      else owners.set(identity, college._id);
    }
    return { college, update };
  });
  return { conflicts, updates };
}
