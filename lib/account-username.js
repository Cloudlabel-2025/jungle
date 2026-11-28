// Escape the hyphen for browsers that compile HTML patterns with the Unicode v flag.
export const usernamePattern = "[a-zA-Z0-9][a-zA-Z0-9_.\\-]{2,31}";
export const usernameHint = "Plain names such as arjun work. Dots, underscores and hyphens are optional. Use 3–32 characters and a unique username within this college.";
export function normalizeAccountUsername(value) {
  const username=typeof value==="string"?value.trim().toLowerCase():"";
  if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username))throw Object.assign(new Error("Use 3–32 letters, numbers, dots, underscores or hyphens, starting with a letter or number."),{status:400});
  return username;
}
