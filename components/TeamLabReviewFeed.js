"use client";
export const reviewLabel = (status) =>
  ({
    REQUESTED: "Review requested",
    APPROVED: "Approved",
    CHANGES_REQUESTED: "Changes requested",
    COMMENT: "Review comment",
  })[status] || status;
export function reviewState(reviews = [], version) {
  return (
    reviews.find(
      (r) =>
        r.version === version &&
        ["APPROVED", "CHANGES_REQUESTED"].includes(r.status),
    ) || reviews.find((r) => r.version === version && r.status === "REQUESTED")
  );
}
export default function TeamLabReviewFeed({
  reviews = [],
  version,
  onOpenFile,
  currentReview,
}) {
  const state =
    currentReview?.version === version
      ? currentReview
      : reviewState(reviews, version);
  return (
    <section className="team-review-feed" aria-label="Project review feedback">
      <h2>
        Team project review{" "}
        <small>
          v{version} · {state ? reviewLabel(state.status) : "Not reviewed yet"}
        </small>
      </h2>
      {reviews.length ? (
        reviews.map((r, i) => (
          <article
            key={r._id || i}
            className={r.version === version ? "current" : "older"}
          >
            <strong>
              {reviewLabel(r.status)} · v{r.version}
            </strong>
            <small>
              {r.author} ·{" "}
              {r.role === "GAMER"
                ? "Player"
                : r.role === "MISSION_COMMANDER"
                  ? "MC"
                  : "CC"}{" "}
              · {new Date(r.createdAt).toLocaleString()}
            </small>
            {r.path && (
              <button onClick={() => onOpenFile?.(r.path, r.version)}>
                {r.path}
                {r.line ? `:${r.line}` : ""}
              </button>
            )}
            <p>{r.feedback}</p>
          </article>
        ))
      ) : (
        <p>
          Request a review when your saved project is ready. MC and CC feedback
          will appear here.
        </p>
      )}
    </section>
  );
}
