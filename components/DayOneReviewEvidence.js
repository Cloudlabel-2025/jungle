import LevelOneResult from "./LevelOneResult";
import SubmissionHistory from "./SubmissionHistory";
export default function DayOneReviewEvidence({
  record: r,
  canVerify,
  formatDate,
  compact=false,
}) {
  const assignment = r.researchAssignment;
  const mission =
    assignment?.question || r.config.genres.find((g) => g.id === r.genreId);
  const submission = r.submissions.at(-1);
  return (
    <section aria-label="Saved Level 1 work" className="receipt">
      <h3>Saved Level 1 work</h3>
      {r.levelOne && !compact && <LevelOneResult level={r.levelOne} />}
      <p>
        <strong>World:</strong>{" "}
        {assignment?.genreName ||
          r.researchSelection?.genreName ||
          mission?.name ||
          "Not selected"}
      </p>
      <p>
        <strong>Mission:</strong>{" "}
        {mission?.title || mission?.name || "Question not selected"}
      </p>
      {(mission?.prompt || mission?.question) && (
        <p>{mission.prompt || mission.question}</p>
      )}
      <p>
        Mission accepted:{" "}
        {r.acknowledgedAt ? formatDate(r.acknowledgedAt) : "Not yet"}
        {" · "}Research started:{" "}
        {r.startedAt ? formatDate(r.startedAt) : "Not yet"}
      </p>
      {submission ? (
        <>
          <p>
            <strong>AI chat submitted:</strong> {formatDate(submission.at)} ·{" "}
            {r.submissions.length} saved{" "}
            {r.submissions.length === 1 ? "submission" : "submissions"}
          </p>
          {canVerify && (
            <a
              className="btn"
              href={submission.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View submitted AI thread
            </a>
          )}
          {submission.transcript && (
            <section className="review-conversation">
              <h4>Submitted conversation evidence</h4>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  maxHeight: 300,
                  overflow: "auto",
                }}
              >
                {submission.transcript}
              </pre>
            </section>
          )}
          {r.levelOne?.automatic && !compact && (
            <details>
              <summary>Automatic scoring checks</summary>
              {Object.entries(r.levelOne.automatic.checks).map(
                ([name, passed]) => (
                  <p key={name}>
                    {name}: {passed ? "Met" : "Not met"}
                  </p>
                ),
              )}
              <p>{r.levelOne.automatic.verificationScope}</p>
            </details>
          )}
          <p>
            {r.verification?.status === "VERIFIED"
              ? "AI chat verified."
              : r.verification?.status === "INACCESSIBLE"
                ? "The submitted chat needs an access correction."
                : r.levelOne
                  ? "Work saved. Automatic shared-link review is pending or needs a retry."
                  : "Work received. Awaiting Centre Command link verification."}
          </p>
          {!canVerify && (
            <p>
              MC and CC can change level results or allow replay. Private
              baseline assessment remains with CC.
            </p>
          )}
        </>
      ) : (
        <p>
          {r.draft?.url
            ? "An AI chat link is saved as a draft, but has not been submitted."
            : "No AI chat has been submitted yet."}
        </p>
      )}
      <SubmissionHistory userId={r.userId} day={1} revision={r.version}/>
    </section>
  );
}
