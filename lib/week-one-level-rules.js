import { activities } from "./week-one-catalog.js";
import { levelOneReward } from "./level-one-rules.js";

export const WEEK_ONE_LEVEL_RULES = "week-one-levels-v1";
export const FLIGHT_REWARD_VERSION = "flight-xp-v2";
export function levelReward(stars, day = 1) {
  if (!Number.isInteger(day) || day < 1 || day > 5)
    throw new Error("Choose a flight level from 1 to 5.");
  const base = levelOneReward(stars);
  return { trophies: base.trophies, xp: base.xp * day };
}
export const newFlightLevel = () => ({
  attempt: 1,
  history: [],
  awards: [],
  creditedTrophies: 0,
  creditedXp: 0,
  practice: false,
  replayPending: false,
});
export const weekOneLevelGuides = {
  2: {
    title: "Explore",
    objective:
      "Resolve conflicting instructions and investigate the lost flight signal.",
    extra:
      "Make your two diagnostic checks different. Explain the clues behind your crew update.",
  },
  3: {
    title: "Tell your STORY",
    objective:
      "Explain the clue that does not fit and trace how a user action travels through a system.",
    extra:
      "Place every component card in the supplied correct order. Complete every STORY field, evidence and the limits of your analogy.",
  },
  4: {
    title: "Light the FIRE",
    objective: "Challenge the impossible claim and investigate the wrong door.",
    extra:
      "Complete the FIRE fields. Give two different checks, the affected layer and a safe remediation plan.",
  },
  5: {
    title: "Prove your skills",
    objective:
      "Revisit your original research with a fresh AI chat and complete the full-stack quiz.",
    extra:
      "Use a fresh shared chat URL and score at least 80% on the quiz. Include your Day 1 comparison and reflection.",
  },
};
const words = (value) =>
  typeof value === "string" ? (value.match(/[\p{L}\p{N}]+/gu) || []).length : 0;
const normal = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function scoreFlightLevel(day, attempts) {
  const required = activities.filter((a) => a.day === day);
  const checks = {
    complete: required.length === 2,
    detailedNotes: true,
    distinctNotes: true,
    sequence: true,
    quiz: true,
    freshChat: true,
    onTime: true,
  };
  const revisions = [];
  for (const activity of required) {
    const record = attempts.find((a) => a.activityId === activity.id),
      d = record?.data,
      s = d?.submissions?.at(-1);
    revisions.push({ activityId: activity.id, submissionId: s?.id || null });
    if (!s || !d.submittedAt) {
      checks.complete = false;
      checks.onTime = false;
      continue;
    }
    const answers = s.answers || {};
    if (activity.kind === "QUIZ") {
      const questions = d.activity.questions || [];
      const answered =
        questions.length > 0 &&
        questions.every(
          (q) =>
            Number.isInteger(answers[q.id]) &&
            answers[q.id] >= 0 &&
            answers[q.id] < q.options.length,
        );
      checks.complete &&= answered;
      const correct = questions.filter(
        (q) => answers[q.id] === q.correct,
      ).length;
      checks.quiz &&= answered && correct / questions.length >= 0.8;
    } else {
      const keys = activity.fields.filter(
        (k) => !["sequence", "url"].includes(k),
      );
      checks.complete &&=
        s.complete === true &&
        activity.fields.every((key) =>
          key === "sequence"
            ? Array.isArray(answers[key]) &&
              answers[key].length === d.variant?.cards?.length
            : typeof answers[key] === "string" && Boolean(answers[key].trim()),
        );
      checks.detailedNotes &&= keys.every((key) => words(answers[key]) >= 12);
      checks.distinctNotes &&=
        new Set(keys.map((key) => normal(answers[key]))).size === keys.length;
      if (activity.fields.includes("sequence"))
        checks.sequence &&=
          JSON.stringify(answers.sequence) === JSON.stringify(d.variant?.cards);
      if (activity.kind === "FITNESS")
        checks.freshChat &&=
          /^https:\/\//i.test(answers.url || "") &&
          !(d.originalUrls || [d.originalUrl]).includes(answers.url);
    }
    const time = Date.parse(s.at),
      deadline = Date.parse(s.deadline || d.deadline);
    checks.onTime &&=
      !s.late &&
      !s.expired &&
      Number.isFinite(time) &&
      Number.isFinite(deadline) &&
      time >= Date.parse(d.startedAt) &&
      time <= deadline;
  }
  const effort =
    checks.detailedNotes &&
    checks.distinctNotes &&
    checks.sequence &&
    checks.quiz &&
    checks.freshChat;
  const stars = checks.complete ? (effort ? (checks.onTime ? 3 : 2) : 1) : 0;
  return {
    rulesVersion: WEEK_ONE_LEVEL_RULES,
    source: "SYSTEM",
    completed: checks.complete,
    stars,
    ...levelReward(stars, day),
    rewardVersion: FLIGHT_REWARD_VERSION,
    checks,
    revisions,
    reason: !checks.complete
      ? "Complete both missions to earn this level's stars."
      : stars === 3
        ? "Both missions complete, published effort checks met and submitted within their timers."
        : stars === 2
          ? "Published effort checks met. One or more missions finished after their timer."
          : "Both missions complete. Open the star guide to improve your effort checks.",
    verificationScope:
      "Automatic checks cover required evidence, note length and distinctness, component order, quiz answers and server-recorded time. Factual accuracy and originality are not certified.",
  };
}
export function effectiveFlightLevel(level) {
  const result = level?.override || level?.automatic || null;
  if (!level?.practice) return result;
  return (
    [result, ...(level.history || []).map((h) => h.result)]
      .filter((r) => r?.completed)
      .sort((a, b) => b.stars - a.stars)[0] || result
  );
}
