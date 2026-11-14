export const pipExpressions = Object.freeze([
  "welcoming",
  "thinking",
  "guiding",
  "celebrating",
  "concerned",
]);

export function pipExpression(stepId) {
  if (["clock-in", "boarding", "day-check-in", "map-start"].includes(stepId))
    return "welcoming";
  if (["submitted", "verified", "map-verified"].includes(stepId))
    return "celebrating";
  if (
    [
      "attendance-unavailable",
      "attendance-check",
      "closed",
      "expired",
      "correction",
    ].includes(stepId)
  )
    return "concerned";
  if (["research", "map-submitted", "unreleased"].includes(stepId))
    return "thinking";
  return "guiding";
}

export function pipImage(expression) {
  return `/images/pip/pip-${pipExpressions.includes(expression) ? expression : "welcoming"}.webp`;
}
