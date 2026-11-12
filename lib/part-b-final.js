import partB from "./pilot-part-b.json" with { type: "json" };
import { demand } from "./access-scope.js";
import { text, number } from "./pilot-rules.js";

export const finalCriteria = partB.finalFriday.passport.page1.criterion_scores;
export function safeReference(value) {
  const ref = text(value, "Sanitised evidence reference", 1, 2000);
  if (ref.startsWith("https://")) {
    const parsed = new URL(ref);
    demand(!parsed.username && !parsed.password && !parsed.search && !parsed.hash,
      "Remove credentials, query strings and fragments from exported URLs.", 400);
  } else demand(/^[\w./:-]{1,200}$/.test(ref), "Use an evidence ID or a sanitised HTTPS URL.", 400);
  demand(!/(?:sk-proj-|sk-[a-zA-Z0-9]{20}|mongodb(?:\+srv)?:|bearer\s)/i.test(ref), "Secret-bearing references are not permitted.", 400);
  return ref;
}
export function criterionProfile(rows) {
  demand(Array.isArray(rows) && rows.length === 13 && new Set(rows.map(r => r?.criterion_id)).size === 13,
    "Supply all thirteen distinct criterion scores, using null for NOT_ASSESSED.", 400);
  return finalCriteria.map(definition => {
    const row = rows.find(r => r?.criterion_id === definition.criterion_id);
    demand(row && Array.isArray(row.evidence_refs) && row.evidence_refs.length <= 10,
      "Each criterion needs bounded evidence references.", 400);
    const score = row.approved_score === null ? null : number(row.approved_score, 0, definition.max_score);
    demand(score === null || row.evidence_refs.length > 0, "Assessed criteria require evidence.", 400);
    return { criterion_id: definition.criterion_id, display_name: definition.display_name,
      dimension_id: definition.dimension_id, max_score: definition.max_score,
      approved_score: score, assessment_state: score === null ? "NOT_ASSESSED" : "ASSESSED",
      evidence_refs: row.evidence_refs.map(safeReference) };
  });
}
export function questionSets(sets, aliases) {
  demand(Array.isArray(sets) && sets.length === aliases.length && new Set(sets.map(r => r?.gamer_id)).size === sets.length,
    "Return one question set per exported Gamer.", 400);
  return sets.map(row => {
    demand(aliases.includes(row?.gamer_id) && row.team_id === "T01" && Array.isArray(row.questions) && row.questions.length === 3,
      "Return exactly Q1, Q2 and Q3 for each exported Gamer.", 400);
    const questions = ["common", "personalised", "reasoning"].map((type, index) => {
      const item = row.questions[index];
      demand(item?.id === `Q${index + 1}` && item.type === type,
        "Use Q1 common, Q2 personalised and Q3 reasoning in order.", 400);
      demand(Array.isArray(item.assesses) && item.assesses.length > 0 && item.assesses.every(name => finalCriteria.some(c => c.display_name === name)),
        "Questions must identify approved criteria.", 400);
      demand(Array.isArray(item.expected_answer_elements) && item.expected_answer_elements.length > 0 && item.expected_answer_elements.length <= 10,
        "Supply expected answer elements for each question.", 400);
      demand(Array.isArray(item.evidence_refs) && item.evidence_refs.length <= 10, "Supply bounded question evidence references.", 400);
      return { id: item.id, type, question: text(item.question, "Advisory question", 5, 1000),
        assesses: item.assesses, expected_answer_elements: item.expected_answer_elements.map(v => text(v, "Answer element", 1, 500)),
        evidence_refs: item.evidence_refs.map(safeReference),
        alternate_question: text(item.alternate_question, "Equivalent alternate question", 5, 1000) };
    });
    return { gamerId: row.gamer_id, questions };
  });
}
export function adminChairEvidence(body) {
  demand(body.environment === "ISOLATED_STAGING" || body.environment === "ISOLATED_BRANCH",
    "Administrator's Chair must use isolated staging or an isolated branch.", 400);
  demand(body.sharedReleaseUnchanged === true, "Preserve the accepted shared application.", 400);
  const durationMinutes = number(body.durationMinutes, 1, 10);
  const criteria = body.criteria;
  demand(criteria && Object.keys(criteria).length === 5 && "ABCDE".split("").every(key =>
    criteria[key] && typeof criteria[key].earned === "boolean"), "Verify all five Administrator's Chair criteria.", 400);
  const checked = Object.fromEntries("ABCDE".split("").map(key => [key, {
    earned: criteria[key].earned,
    evidence: criteria[key].earned ? safeReference(criteria[key].evidence) : null,
  }]));
  const bonus = Object.values(checked).filter(row => row.earned).length;
  demand(body.bonus === bonus, "Bonus must equal the five evidenced criterion points.", 400);
  return { bonus, criteria: checked, durationMinutes, environment: body.environment,
    target: safeReference(body.target), baseline: safeReference(body.baseline),
    rollback: safeReference(body.rollback), sharedReleaseUnchanged: true };
}

export function evidenceObservations(rows, kind) {
  demand(Array.isArray(rows) && rows.length <= 2, "Supply at most two evidenced observations.", 400);
  return rows.map(row => {
    demand(finalCriteria.some(c => c.criterion_id === row.criterion_id), "Use an approved criterion.", 400);
    return { criterion_id: row.criterion_id, [kind]: text(row[kind], "Respectful evidenced observation", 3, 500),
      evidence_ref: safeReference(row.evidence_ref) };
  });
}
