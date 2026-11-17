import { pipExpression } from "./pip-expressions.js";
import { needsClockInTutorial } from "./attendance-policy.js";
// Guidance only. Saved server state remains the authority for every game action.
export function pipTutorial(
  data,
  { missionOpen = false, travelling = false, now = new Date() } = {},
) {
  if (data.user?.role !== "GAMER" || !data.story?.flight) return null;
  const record = data.dayOne?.records?.find((r) => r.userId === data.user._id);
  const submission = record?.submissions?.at(-1);
  const assigned = Boolean(record?.researchAssignment || record?.genreId);
  const session = data.playSession;
  const step = (
    id,
    title,
    message,
    target,
    action = "show",
    label = "Show me",
  ) => ({
    id,
    title,
    message,
    target,
    action,
    label,
    expression: pipExpression(id),
  });
  if (session?.state === "CHOICE")
    return step("attendance-check", "Your working day has ended",
      "Official attendance is closed. Choose Continue playing for a separate extra session, or finish for today.",
      "attendance", "attendance", "Open my clock");
  if (session && !["ACTIVE", "EXTRA"].includes(session.state)) {
    if (!needsClockInTutorial(session)) return null;
    if (!session.available)
      return step(
        "attendance-unavailable",
        "Your progress is safe",
        session.reason ||
          "Clock-in is not available yet. Command needs to open today's session.",
        null,
        null,
      );
    return step(
      "clock-in",
      "Ready for take-off?",
      "I'm Kiko, your flight companion. Clock in to start today's play session. Your saved mission stays with you.",
      "attendance",
      "attendance",
      "Find clock-in",
    );
  }
  if (session?.responseDeadline)
    return step(
      "attendance-check",
      "Still exploring?",
      "Official attendance has ended. Open your clock and choose Continue playing for extra play, or finish for today.",
      "attendance",
      "attendance",
      "Open my clock",
    );
  if (travelling)
    return step(
      "travelling",
      "Next stop: discovery",
      "We're on our way. Your mission opens when the helicopter reaches the checkpoint.",
      null,
      null,
    );
  const release = data.dayOne?.state;
  if (!["OPEN", "CLOSED"].includes(release))
    return step(
      "unreleased",
      "Waiting for clearance",
      "Level 1 has not been released yet. Command opens the mission; your progress is safe.",
      null,
      null,
    );
  if (!missionOpen) {
    if (
      record?.levelOne
        ? record.levelOne.result?.completed
        : submission && record.verification?.status === "VERIFIED"
    ) {
      const next = data.weekOneProgram?.days?.find((d) => d.day === 2);
      return step(
        "map-verified",
        "Discovery confirmed!",
        next?.state === "OPEN"
          ? "Your evidence is verified and Level 2 is open. Select its checkpoint and press Play."
          : "Your evidence is verified. The next level stays locked until Command releases it.",
        "level-two",
        next?.state === "OPEN" ? "next" : null,
        "Find Level 2",
      );
    }
    return step(
      submission ? "map-submitted" : assigned ? "map-resume" : "map-start",
      submission
        ? "Your discovery is saved"
        : assigned
          ? "Let's pick up your mission"
          : "Your first adventure",
      submission
        ? "Your chat has been received. Open Level 1 to see its review status."
        : "Select Level 1 and press Play. I'll help you through each checkpoint once we arrive.",
      "level-one-play",
      "mission",
      submission ? "View my mission" : "Find Level 1",
    );
  }
  if (!data.story.introComplete)
    return step(
      "boarding",
      "Welcome aboard, explorer",
      "I'm Kiko. We'll choose a world, investigate a question and bring back an AI chat. Begin flight learning to get started.",
      "boarding",
    );
  if (release === "CLOSED")
    return step(
      "closed",
      "This mission is closed",
      "You can view your saved work. Command must reopen Day 1 before you can change or submit anything.",
      null,
      null,
    );
  if (record?.levelOne?.result?.completed)
    return step(
      "verified",
      "Stars earned, explorer!",
      `Your result is saved: ${record.levelOne.result.stars} stars, ${record.levelOne.creditedTrophies} trophies and ${record.levelOne.creditedXp} XP. Let's check your next mission on the map.`,
      null,
      "map",
      "Back to the flight map",
    );
  const researchChecks = record?.levelOne?.automatic?.checks;
  if(record?.levelOne?.claimCheckRequired && researchChecks?.checkpoints && researchChecks?.readable && researchChecks?.related)
    return step("claim-check","Now give the answer a second look","Your research is secured. Open Mission 2, check one claim against an independent source, then tell me what you trust. It is fine to conclude that the evidence is still uncertain.","claim-check");
  if (record?.levelOne?.result?.status === "REVIEW_REQUIRED" && submission)
    return step(
      "review",
      "Let's read your shared chat",
      record.levelOne.result.reason,
      ["INVALID_LINK", "UNSUPPORTED_LINK", "NOT_PUBLIC"].includes(
        record.levelOne.result.readCode,
      )
        ? "replace-chat"
        : "review-link",
    );
  if (record?.levelOne?.result && submission)
    return step(
      "correction",
      "Let's strengthen your discovery",
      record.levelOne.result.reason,
      "replace-chat",
    );
  if (!record)
    return step(
      "day-check-in",
      "Let's record your arrival",
      "Check in first. Then your seven worlds will be ready to explore.",
      "day-check-in",
    );
  if (!assigned && !record.researchSelection)
    return step(
      "genre",
      "Choose your world",
      "Explore the seven beacons. Pick a world, then Set course to lock it. You can change your mind before confirming.",
      "genres",
    );
  if (!assigned)
    return step(
      "question",
      "Find your mission",
      "Your world is saved. Read the three mission cards, choose one and Lock this mission. That choice is final.",
      "questions",
    );
  if (submission) {
    if (record.verification?.status === "INACCESSIBLE")
      return step(
        "correction",
        "Let's repair the signal",
        "Command couldn't access your chat. Check its sharing permissions, then Replace chat link and explain your correction.",
        "replace-chat",
      );
    if (record.verification?.status === "VERIFIED")
      return step(
        "verified",
        "Discovery confirmed!",
        "Command verified your AI chat. Return to the map to check the next released level. Your work stays saved.",
        null,
        "map",
        "Back to the flight map",
      );
    return step(
      "submitted",
      "Transmission received!",
      "Your AI chat is saved. Centre Command will verify it. Submitting does not unlock the next level; Command releases that separately.",
      "receipt",
    );
  }
  if (!record.acknowledgedAt)
    return step(
      "accept",
      "A mission with your name on it",
      "Read your objective, then Accept mission. Accepting saves your acknowledgement; it does not start the research timer.",
      "accept",
    );
  if (!record.startedAt)
    return step(
      "begin",
      "Ready to investigate?",
      "Begin research when you're ready. Your research timer starts then and keeps running if you leave the page.",
      "begin",
    );
  if (record.deadline && Date.parse(record.deadline) <= new Date(now).getTime())
    return step(
      "expired",
      "Time to contact your MC",
      "Your research window has ended. Your saved work remains here. Ask your Mission Commander for an extension if you need more time.",
      null,
      null,
    );
  if (record.draft?.url)
    return step(
      "transmit",
      "Bring your discovery home",
      record.levelOne
        ? "Your chat link is saved. Transmit research chat when you're ready. I'll open the public conversation and check your research for stars, trophies and XP. No pasting needed!"
        : "Your chat link is saved as a draft. Press Transmit research chat to submit it for review. A draft alone is not a submission.",
      "transmit",
    );
  return step(
    "research",
    "Follow the evidence",
    record.levelOne
      ? "Investigate with your AI tool, ask follow-up questions and check sources. Use ChatGPT's Share button, then bring back the public conversation link. I'll read it automatically when you transmit."
      : "Use your AI tool to investigate the question. Ask follow-up questions and check the answers. Then share the conversation and paste its link here.",
    "chat",
  );
}

export function pipScope(data) {
  const record = data.dayOne?.records?.find((r) => r.userId === data.user._id);
  const contentVersion =
    record?.config?.version || data.dayOne?.config?.version || 1;
  return `codewild:pip:v1:${data.user._id}:${data.user.cohortId || "alpha"}:${record?._id || data.dayOne?.config?.day || "arrival"}:${contentVersion}`;
}
