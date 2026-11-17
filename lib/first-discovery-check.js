export const claimVerdicts = ["SUPPORTED", "CHALLENGED", "UNCERTAIN"];
export function claimCheckAnswers(raw, complete = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Record your claim check.");
  const result = {};
  for (const [key, max] of Object.entries({
    claim: 600,
    source: 2000,
    finding: 1200,
    verdict: 20,
  })) {
    const value = raw[key] ?? "";
    if (typeof value !== "string" || value.length > max)
      throw Error("Keep your claim check within the field limits.");
    result[key] = value.trim();
  }
  if (result.verdict && !claimVerdicts.includes(result.verdict))
    throw Error("Choose supported, challenged or uncertain.");
  if (complete) {
    if (result.claim.length < 20)
      throw Error(
        "Choose one specific claim from your research, at least 20 characters.",
      );
    let url;
    try {
      url = new URL(result.source);
    } catch {
      throw Error("Add an HTTPS source you checked outside the AI chat.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      /^(?:localhost|127\.)/i.test(url.hostname) ||
      /(^|\.)(chatgpt\.com|chat\.openai\.com|gemini\.google\.com|claude\.ai|copilot\.microsoft\.com|perplexity\.ai)$/i.test(
        url.hostname,
      )
    )
      throw Error(
        "Use an independent HTTPS source rather than another AI chat.",
      );
    if (!result.verdict)
      throw Error("Choose what your source tells you about the claim.");
    if ((result.finding.match(/[\p{L}\p{N}]+/gu) || []).length < 20)
      throw Error(
        "Explain what you checked and what you trust in at least 20 words.",
      );
  }
  return result;
}
export function completedClaimCheck(data, submission) {
  if (data.levelOne?.claimCheckRequired !== true) return true;
  const check = data.claimCheck;
  if (!check?.at || check.researchRevisionId !== submission?.id) return false;
  try {
    claimCheckAnswers(check, true);
    return true;
  } catch {
    return false;
  }
}
