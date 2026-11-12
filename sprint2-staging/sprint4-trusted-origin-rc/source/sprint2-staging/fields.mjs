export const options = {
  country: ["India", "United States", "United Kingdom"],
  course: ["BSc Computer Science", "BTech", "MCA"],
  status: ["Employed", "Self-employed", "Seeking work", "Higher studies"],
  skill: ["Java", "Python", "React", "Node.js", "SQL", "Testing", "Cloud"],
};

export const fields = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["dob", "Date of birth", "date"],
  ["email", "Email", "email"],
  ["mobile", "Mobile", "tel"],
  ["address1", "Address line 1"],
  ["address2", "Address line 2"],
  ["city", "City"],
  ["state", "State"],
  ["country", "Country"],
  ["postcode", "Postal/PIN code"],
  ["course", "Course / Degree"],
  ["year", "Graduation year"],
  ["registration", "Student registration number"],
  ["status", "Employment status"],
  ["skill", "Primary skill"],
  ["title", "Current job title"],
  ["organisation", "Current organisation"],
  ["linkedin", "LinkedIn URL", "url"],
];

export const optional = [
  "address2",
  "registration",
  "title",
  "organisation",
  "linkedin",
];
const mobile = /^\+(?:91[6-9]\d{9}|1[2-9]\d{9}|44[1-9]\d{9})$/;
const postcodes = {
  India: /^[1-9]\d{5}$/,
  "United States": /^\d{5}(?:-\d{4})?$/,
  "United Kingdom": /^(?:GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2})$/,
};

export function validate(input, today = new Date().toISOString().slice(0, 10)) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.some(([field]) => field === key))
  )
    throw new Error(
      "Submit profile fields only. System fields cannot be edited.",
    );
  const data = {};
  for (const [key, label] of fields) {
    const raw = input[key] ?? "";
    if (
      typeof raw !== "string" ||
      raw.length > (key === "linkedin" ? 500 : 254)
    )
      throw new Error(`${label} is invalid or too long.`);
    const value = raw.normalize("NFC").trim();
    if (!value && !optional.includes(key))
      throw new Error(`${label} is required.`);
    if (options[key] && !options[key].includes(value))
      throw new Error(`Select a valid ${label}.`);
    data[key] = value;
  }
  for (const key of ["firstName", "lastName"])
    if (!/^\p{L}[\p{L}\p{M}]*(?:[ '’\-]\p{L}[\p{L}\p{M}]*)*$/u.test(data[key]))
      throw new Error(
        "Names must contain letters with optional spaces, apostrophes or hyphens.",
      );
  const birth = new Date(data.dob);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.dob) ||
    !Number.isFinite(+birth) ||
    birth.toISOString().slice(0, 10) !== data.dob ||
    data.dob > today
  )
    throw new Error("Enter a valid date of birth that is not in the future.");
  data.email = data.email.toLowerCase();
  if (!/^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/.test(data.email))
    throw new Error("Enter a valid email.");
  data.mobile = data.mobile.replace(/[\s()-]/g, "");
  if (!mobile.test(data.mobile))
    throw new Error("Enter a supported international mobile number.");
  data.postcode = data.postcode.toUpperCase().replace(/\s+/g, " ");
  if (!postcodes[data.country].test(data.postcode))
    throw new Error("Enter a postcode valid for the selected country.");
  if (!/^[1-9]\d{3}$/.test(data.year) || data.year > today.slice(0, 4))
    throw new Error("Enter a valid graduation year that is not in the future.");
  data.registration = data.registration.toUpperCase();
  if (data.status === "Employed" && (!data.title || !data.organisation))
    throw new Error("Employed alumni require a job title and organisation.");
  if (data.linkedin) {
    const url = URL.parse(data.linkedin);
    if (
      !url ||
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Enter a valid HTTP or HTTPS LinkedIn URL.");
  }
  return data;
}
