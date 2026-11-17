export const PIP_STEPS = ["claim-check","attendance-check", "attendance-unavailable", "clock-in", "travelling", "unreleased", "map-verified", "map-submitted", "map-resume", "map-start", "boarding", "closed", "verified", "review", "correction", "day-check-in", "genre", "question", "submitted", "accept", "begin", "expired", "transmit", "research"];
export const emptyPipProgress = (generation = 1) => ({ generation, version: 0, seen: [], dismissed: [], completed: [], following: false });
export const pipAccountKey = (data) => JSON.stringify([data.user._id, data.user.cohortId || "alpha", data.pipProgress?.generation || 1]);
export function mergePipProgress(base, patch = {}) {
  const merged = { ...emptyPipProgress(base?.generation), ...base };
  for (const key of ["seen", "dismissed", "completed"])
    merged[key] = [...new Set([...(merged[key] || []), ...(patch[key] || [])])].filter((id) => PIP_STEPS.includes(id));
  if (typeof patch.following === "boolean") merged.following = patch.following;
  return merged;
}
export function completedPipSteps(data) {
  const record = data.dayOne?.records?.find((r) => r.userId === data.user._id), done = [];
  if (data.playSession?.hasClockedIn || ["ACTIVE", "EXTRA", "OUT"].includes(data.playSession?.state)) done.push("clock-in");
  if (data.story?.introComplete) done.push("boarding");
  if (record) done.push("day-check-in");
  if (record?.researchSelection || record?.genreId || record?.researchAssignment) done.push("genre");
  if (record?.genreId || record?.researchAssignment) done.push("question");
  if (record?.acknowledgedAt) done.push("accept");
  if (record?.startedAt) done.push("begin");
  if (record?.draft?.url || record?.submissions?.length) done.push("research");
  if (record?.submissions?.length) done.push("transmit");
  if(record?.claimCheck?.at && record.claimCheck.researchRevisionId===record.submissions?.at(-1)?.id)done.push("claim-check");
  return done;
}
