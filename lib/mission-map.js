export const MAP_SPACING = 440;
export const MAP_MAX_X = 50000;
export const defaultMapPoint = (index) => ({
  x: 180 + index * MAP_SPACING,
  y: [58, 28, 62, 32, 58][index % 5],
});
export function missionMapPoint(level, positions, index, height) {
  const point = positions?.[level._id] || defaultMapPoint(index);
  return {
    x: point.x,
    y: 220 + ((Math.max(height, 400) - 360) * point.y) / 100,
    labelPlacement: point.y > 45 ? "above" : "below",
  };
}
export function missionMapWidth(levels, positions = {}) {
  return Math.max(
    1320,
    ...levels.map(
      (level, i) => (positions[level._id] || defaultMapPoint(i)).x + 180,
    ),
  );
}
export function validateMapPositions(input, allowedIds) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length > 105
  )
    fail("Provide positions for at most 105 map levels.");
  const entries = Object.entries(input).map(([id, point]) => {
    if (!allowedIds.includes(id))
      fail("A map level is unavailable in this cohort.");
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 100 ||
      point.x > MAP_MAX_X ||
      point.y < 0 ||
      point.y > 100
    )
      fail("Map positions must stay inside the playable map.");
    return [id, { x: Math.round(point.x), y: Math.round(point.y * 10) / 10 }];
  });
  return Object.fromEntries(entries);
}
