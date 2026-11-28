const labels = {
  onTime: "Submitted within the mission time", linkRead: "AI conversation could be read",
  quiz: "Quiz answers met the target", submitted: "Mission work submitted", complete: "All required work completed",
  detailedNotes: "Notes include enough detail", distinctNotes: "Answers are distinct", sequence: "Steps are in the correct order",
  freshChat: "A new AI conversation was submitted", claimCheck: "Independent claim check completed", checkpoints: "Mission steps completed in order",
  readable: "Conversation includes readable evidence", related: "Evidence relates to the mission", followUp: "Follow-up questions included",
  comparison: "Alternatives compared", sources: "Supporting sources included",
  claim: "Claim", source: "Source", verdict: "Player’s verdict", finding: "Player’s finding",
  notes: "Notes", url: "Submitted link", at: "Submitted at",
};
export const reviewLabel = key => labels[key] || key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, letter => letter.toUpperCase());

function Answer({ value }) {
  if (value === null || value === undefined || value === "") return <span className="muted">Not provided</span>;
  if (Array.isArray(value)) return <ol>{value.map((item, index) => <li key={index}><Answer value={item}/></li>)}</ol>;
  if (typeof value === "object") return <ReviewAnswers answers={value}/>;
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (["http:", "https:"].includes(url.protocol)) return <a href={url.href} target="_blank" rel="noopener noreferrer">{value}</a>;
    } catch {}
  }
  return <span>{typeof value === "boolean" ? value ? "Yes" : "No" : String(value)}</span>;
}

export function ReviewAnswers({ answers, questions = [] }) {
  return <dl className="review-answer-list">{Object.entries(answers || {}).map(([key, value]) => {
    const question = questions.find(item => item.id === key);
    const option = question && Number.isInteger(value) ? question.options?.[value] : undefined;
    return <div key={key}><dt>{question?.prompt || reviewLabel(key)}</dt><dd><Answer value={option ?? value}/></dd></div>;
  })}</dl>;
}

export function ScoringChecks({ automatic }) {
  return <section className="review-scoring-summary" aria-label="How the stars were calculated">
    <h4>How the stars were calculated</h4>
    <p>{automatic?.reason || "Scoring checks will appear after the player submits their work."}</p>
    {automatic?.checks && <ul className="review-check-list">{Object.entries(automatic.checks).map(([key, value]) => <li key={key}><span>{reviewLabel(key)}</span><strong data-met={typeof value === "boolean" ? String(value) : undefined}>{typeof value === "boolean" ? value ? "Met" : "Not met" : <Answer value={value}/>}</strong></li>)}</ul>}
    {automatic?.verificationScope && <p className="muted">{automatic.verificationScope}</p>}
  </section>;
}
