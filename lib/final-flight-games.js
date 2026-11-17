// Board state is a saved learning aid. Only submitted evidence determines rewards.
export function flightGameState(activityId, raw) {
  if (!["D4-G01", "D4-G02", "D5-F01", "D5-Q01"].includes(activityId))
    throw Error("This mission does not support a flight board.");
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Invalid flight board.");
  const out = {};
  const ranges = { cursor: 100, inspected: 100, runs: 999 };
  for (const [key, max] of Object.entries(ranges))
    if (raw[key] !== undefined) {
      if (!Number.isInteger(raw[key]) || raw[key] < 0 || raw[key] > max)
        throw Error("Invalid board position.");
      out[key] = raw[key];
    }
  for (const [key, values] of Object.entries({
    plan: ["fair", "success", "assume"],
    actor: ["self", "other"],
    policy: ["signin", "owner"],
    mode: ["board", "report"],
  }))
    if (raw[key] !== undefined) {
      if (!values.includes(raw[key])) throw Error("Invalid board selection.");
      out[key] = raw[key];
    }
  return out;
}
export function attemptComplete(record) {
  const d = record?.data,
    s = d?.submissions?.at(-1);
  if (!d?.submittedAt || !s) return false;
  return d.activity.kind === "QUIZ"
    ? Boolean(d.activity.questions?.length) &&
        d.activity.questions.every(
          (q) =>
            Number.isInteger(s.answers?.[q.id]) &&
            s.answers[q.id] >= 0 &&
            s.answers[q.id] < q.options.length,
        )
    : s.complete === true;
}
export function firstUnanswered(activity, answers = {}) {
  const keys =
    activity.kind === "QUIZ"
      ? activity.questions.map((q) => q.id)
      : activity.fields;
  const i = keys.findIndex((k) =>
    activity.kind === "QUIZ"
      ? !Number.isInteger(answers[k])
      : !String(answers[k] || "").trim(),
  );
  return i < 0 ? 0 : i;
}
export function experimentFeedback(technical, state) {
  if (technical)
    return state.actor === "other"
      ? state.policy === "owner"
        ? {
            safe: true,
            title: "Request blocked",
            text: "The server checks the signed-in identity against the record owner. Another crew member’s record stays protected.",
          }
        : {
            safe: false,
            title: "Access leak detected",
            text: "Being signed in is not permission to edit another person’s record. Hiding the button would not stop this request.",
          }
      : {
          safe: true,
          title: "Own record accessible",
          text: "This checks the permitted path only. Test another identity too before claiming the boundary is secure.",
        };
  return state.plan === "fair"
    ? {
        safe: true,
        title: "A test that can challenge the claim",
        text: "Include different conditions, a comparison and failed runs. Record what would disprove the claim; this plan alone does not prove it.",
      }
    : state.plan === "success"
      ? {
          safe: false,
          title: "The failures disappeared",
          text: "Selecting only successful examples hides counter-evidence. Keep every run and compare under fair conditions.",
        }
      : {
          safe: false,
          title: "Confidence is not evidence",
          text: "Repeating the promise cannot verify it. Design an independent check with measurable outcomes.",
        };
}
export const reportPrompts = {
  frame: "What exactly is the claim or failure? What outcome needs checking?",
  integrate:
    "Which supplied clues support or challenge it? What information is missing?",
  reason: "Compare plausible explanations. Why does your evidence favour one?",
  experiment: "Design a fair check. What result would change your mind?",
  evidence:
    "Name the observations, sources or independent checks behind your answer.",
  uncertainty: "What is still unknown? What should the crew avoid assuming?",
  layer: "Which component is responsible, and what evidence points there?",
  check1:
    "Describe a specific safe diagnostic check and its expected observation.",
  check2: "Use a different check that could challenge the first explanation.",
  remediation:
    "How would you correct the issue safely and verify that legitimate access still works?",
  update: "Brief the crew: confirmed facts, suspected cause and next action.",
  scene: "Return to your original question. What is the situation now?",
  need: "What precise question did your new investigation need to answer?",
  how: "Explain how the process or system works, step by step.",
  concept: "Connect your research to a concept you learned during the flight.",
  takeaway:
    "What did you learn, and where does your explanation stop being useful?",
  reflection:
    "Compare your first research with this attempt. What changed in your reasoning, evidence and use of AI?",
  url: "Bring back a new public shared AI conversation. Your original chat cannot be reused.",
};
