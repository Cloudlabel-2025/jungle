export function completionKey(userId, attempt) {
  return `codewild:level-celebration:${userId}:${attempt._id}:${attempt.clearedAt || "cleared"}`;
}

export function pendingCompletions(data, seen) {
  if (data?.user?.role !== "GAMER") return [];
  return (data.projectAttempts || [])
    .filter(
      (attempt) =>
        attempt.teamId === data.user.teamId &&
        attempt.status === "CLEARED" &&
        attempt.stars >= 1 &&
        attempt.stars <= 3 &&
        attempt.rewards?.length &&
        !seen(completionKey(data.user._id, attempt)),
    )
    .sort((a, b) => +new Date(a.clearedAt || 0) - +new Date(b.clearedAt || 0));
}
