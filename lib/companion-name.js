// Keep persisted tutorial IDs and asset paths stable. Old published briefs can
// still contain the former display name; translate it only when presenting it.
export const companionName = "Kiko";
export function companionText(value) {
  return typeof value === "string"
    ? value.replace(/\bPip\b/g, companionName).replace(/\bPIP\b/g, "KIKO")
    : value;
}
export function sameCompanionBrief(expected, actual) {
  return typeof expected === "string" && typeof actual === "string" && companionText(expected) === companionText(actual);
}
