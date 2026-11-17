import { completedClaimCheck } from "./first-discovery-check.js";
export const LEVEL_ONE_RULES = "level-one-v1";
export const LEVEL_ONE_REWARDS = "level-one-rewards-v2";
export const LEVEL_ONE_XP_RATIO = 5;
export const levelOneReward = (stars) => ({
  trophies: [0, 15, 25, 30][stars] ?? 0,
  xp: ([0, 15, 25, 30][stars] ?? 0) * LEVEL_ONE_XP_RATIO,
});
export const newLevelOne = () => ({
  rulesVersion: LEVEL_ONE_RULES,
  rewardVersion: LEVEL_ONE_REWARDS,
  attempt: 1,
  history: [],
  awards: [],
  creditedTrophies: 0,
  practice: false,
});

// Deterministic evidence checks, not a claim of factual accuracy or originality.
// The public-link adapter supplies normalized conversation evidence separately.
export function scoreLevelOne(data, submission) {
  const transcript = submission.transcript || "";
  const words = transcript.match(/[\p{L}\p{N}]+/gu) || [];
  const users = [...transcript.matchAll(/^(?:user|human|you|player)\s*:/gim)];
  const assistants = [
    ...transcript.matchAll(
      /^(?:assistant|ai|chatgpt|gemini|claude|copilot)\s*:/gim,
    ),
  ];
  const question =
    data.researchAssignment?.question?.prompt ||
    data.config.genres.find((g) => g.id === data.genreId)?.question ||
    "";
  const keywords = [
    ...new Set(question.toLowerCase().match(/[a-z]{5,}/g) || []),
  ].filter(
    (w) =>
      ![
        "their",
        "there",
        "which",
        "should",
        "would",
        "could",
        "about",
        "three",
        "first",
        "after",
        "before",
        "considering",
        "investigate",
        "research",
        "sources",
        "reasoning",
        "question",
        "compare",
        "options",
        "alternatives",
        "verify",
        "explain",
        "describe",
        "discuss",
        "provide",
        "using",
        "based",
      ].includes(w),
  );
  const topic = keywords.filter((w) =>
    transcript.toLowerCase().includes(w),
  ).length;
  const evidenceTime = Math.max(
    Date.parse(submission.at),
    Date.parse(submission.evidence?.providerUpdatedAt) || 0,
  );
  const claimCheck = completedClaimCheck(data, submission);
  const checks = {
    claimCheck,
    checkpoints: Boolean(
      data.genreId &&
      data.acknowledgedAt &&
      data.startedAt &&
      Number.isFinite(Date.parse(data.startedAt)) &&
      Number.isFinite(Date.parse(submission.at)) &&
      Date.parse(submission.at) >= Date.parse(data.startedAt),
    ),
    readable:
      words.length >= 80 &&
      (submission.evidence?.userTurns ?? users.length) >= 1 &&
      (submission.evidence?.assistantTurns ?? assistants.length) >= 1,
    related: topic >= Math.min(2, keywords.length) && keywords.length > 0,
    followUp:
      (submission.evidence?.userTurns ?? users.length) >= 3 &&
      (submission.evidence?.assistantTurns ?? assistants.length) >= 3,
    comparison:
      /\b(compar\w*|versus|alternatives?|trade.?offs?|advantages?|disadvantages?)\b/i.test(
        transcript,
      ),
    sources: /https:\/\/[^\s<>]+/i.test(transcript),
    onTime:
      Number.isFinite(Date.parse(data.startedAt)) &&
      Date.parse(submission.at) >= Date.parse(data.startedAt) &&
      Math.max(
        evidenceTime,
        data.levelOne?.claimCheckRequired
          ? Date.parse(data.claimCheck?.at) || 0
          : 0,
      ) <= Date.parse(data.deadline),
  };
  const researchComplete =
    checks.checkpoints && checks.readable && checks.related;
  const complete = researchComplete && checks.claimCheck;
  const strongEffort = checks.followUp && checks.comparison && checks.sources;
  const stars = complete ? (strongEffort ? (checks.onTime ? 3 : 2) : 1) : 0;
  return {
    rulesVersion: LEVEL_ONE_RULES,
    rewardVersion: LEVEL_ONE_REWARDS,
    source: "SYSTEM",
    status: complete ? "COMPLETED" : "NEEDS_CORRECTION",
    completed: complete,
    stars,
    ...levelOneReward(stars),
    checks,
    revisionId: submission.id,
    at: submission.at,
    elapsedSeconds: Math.max(
      0,
      Math.floor(
        (Math.max(
          Date.parse(submission.at),
          data.levelOne?.claimCheckRequired &&
            data.claimCheck?.researchRevisionId === submission.id
            ? Date.parse(data.claimCheck.at) || 0
            : 0,
        ) -
          Date.parse(data.startedAt)) /
          1000,
      ),
    ),
    reason:
      researchComplete && !claimCheck
        ? "Mission 1 secured. Complete Mission 2: check one claim against an independent source and explain what you trust."
        : complete
          ? `Readable mission evidence accepted. ${strongEffort ? "Follow-up, comparison and source checks met." : "Add follow-up questions, comparisons and sources to improve your stars."}${checks.onTime ? " Within the research window." : " Outside the research window."}`
          : "Share a conversation that includes your question and the AI response, at least 80 words, and discussion of your assigned mission. You do not need to paste the chat.",
    verificationScope: submission.evidence
      ? "Public shared conversation retrieved automatically. Checks cover mission relevance, conversation structure, follow-up, comparisons, source links and server-recorded time; factual accuracy and originality are not certified."
      : "Transcript structure and mission relevance only; factual accuracy and originality are not automatically certified.",
    ...(submission.evidence ? { evidence: submission.evidence } : {}),
  };
}

export function effectiveLevelOne(level) {
  return level?.override || level?.automatic || null;
}

export function applySharedChatReview(
  data,
  submission,
  reading,
  now = new Date(),
  { clearReopen = false } = {},
) {
  data.levelOne ||= newLevelOne();
  const previous = data.levelOne.automatic;
  if (reading.ok) {
    submission.transcript = reading.transcript;
    submission.evidence = reading.evidence;
    delete submission.readError;
    data.verification = {
      status: "VERIFIED",
      revision: submission.id,
      method: "PUBLIC_SHARED_CHAT",
      at: now.toISOString(),
      actorId: "system:shared-chat-reader",
      reason:
        "The public shared conversation was retrieved successfully. Research quality is assessed separately.",
    };
    data.levelOne.automatic = scoreLevelOne(data, submission);
    data.levelOne.automatic.checkedAt = now.toISOString();
  } else {
    submission.readError = {
      code: reading.code,
      message: reading.message,
      at: now.toISOString(),
    };
    if (!previous?.completed || previous.revisionId !== submission.id)
      data.levelOne.automatic = {
        rulesVersion: LEVEL_ONE_RULES,
        source: "SYSTEM",
        status: "REVIEW_REQUIRED",
        completed: false,
        stars: 0,
        trophies: 0,
        xp: 0,
        revisionId: submission.id,
        at: submission.at,
        checkedAt: now.toISOString(),
        reason: reading.message,
        checks: { linkRead: false },
        readCode: reading.code,
        verificationScope:
          "The shared conversation could not be read. No research score is inferred from an inaccessible link.",
      };
  }
  if (
    clearReopen &&
    data.levelOne.override &&
    !data.levelOne.override.completed
  ) {
    (data.levelOne.overrideHistory ||= []).push(data.levelOne.override);
    data.levelOne.override = null;
  }
}
