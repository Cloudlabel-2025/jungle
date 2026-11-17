import { emptyDayContent } from "./week-one-program-rules.js";

const reference =
  "Credit clear problem framing, multiple plausible explanations, comparison against the supplied clues, explicit uncertainty, and a practical independent check. Reward reasoning supported by evidence rather than confident guesses. The scenario is fictional; learners should separate supplied observations from assumptions.";
const contexts = {
  "D2-G01": [
    "The College Event poster says 10:00 in Hall A, a newer registration email says 11:00 in Hall B, and a volunteer message says entry closes at 10:30. The organiser has not confirmed which message supersedes the others. Identify three findings, ask two precise clarification questions and draft one message that prevents attendees being misled.",
    "A Wildlife Rescue note says move a fictional injured animal immediately; a second note says keep a safe distance until a specialist arrives. The location pin and written address disagree. You are coordinating information, not handling the animal. Identify the conflicting instructions, ask two clarifying questions and write a safe holding update for volunteers.",
    "The Sports Event fixture lists six teams, the group chat lists eight, and the venue booking only covers four matches. Two schedules overlap. Record three facts, ask two questions that resolve the conflict and draft a message explaining what is confirmed and what is still provisional.",
    "In a fictional Space Mission simulation, the launch checklist says use sensor A, a later memo says sensor B, and the dashboard still labels A as primary. The memo has no version number. Record the conflict, ask two targeted questions and write a short team message that avoids assuming either reading is correct.",
  ],
  "D2-G02": [
    "Navigation Beacon: Kiko spots a missing beacon on the fictional flight training display. The receiver log contains beacon B7 at 09:12, but the display last refreshed at 09:05. A second screen shows B7 normally. Investigate whether the signal is missing or the display is stale. Record a likely cause, supporting clues, two independent checks and a radio update that separates facts from guesses. This is an information puzzle; no aircraft controls need changing.",
    "Weather Echo: the fictional training display shows a rain alert for sector C, while a weather report marked 09:20 says clear. The alert was created at 08:40 and its expiry field is blank. A nearby sector still reports rain. Is this an outdated alert, a location mismatch or genuinely changing weather? Compare the timestamps and sectors, record a suspected cause and evidence, propose two checks and radio what remains uncertain. Do not make real flight decisions.",
    "Supply Manifest: Kiko's fictional cabin inventory shows four supply crates, but the signed loading log lists six. Two crates have destination code TRANSFER and the display filter says CABIN ONLY. A photo confirms six labelled crates were loaded, but does not show where each was placed. Investigate the count mismatch, distinguish a filtered display from missing supplies, propose two checks and send the crew an evidence-based update. Do not claim anything is missing without verification.",
    "Radio Relay: Kiko receives a route message stamped 09:30, but the relay log records it as 09:10. The sender's clock is twenty minutes ahead, and two relays repeat the same message ID. A later correction has a different ID but no acknowledgement. Trace whether the apparent new message is a duplicate or a correction, record the clues, propose two checks and radio a clear update. Investigate the messages only; do not change the aircraft's route.",
  ],
  "D3-G01": [
    "Nature case: a fictional garden study reports more butterflies after new flowers were planted. One unusually warm observation day accounts for most of the increase. Use STORY to explain the observation, the alternative explanation, evidence to collect and limits of your conclusion.",
    "Space case: a fictional student telescope log reports a light every evening at the same time. One cloudy night still has a recorded sighting, and the camera timestamp may be wrong. Use STORY to explain the claim, a testable alternative and what remains uncertain.",
    "Sports case: a fictional team claims a new training routine caused its wins. The improvement coincided with weaker opponents, and two match reports are missing. Use STORY to explain the pattern, challenge the causal claim and propose a fair comparison.",
    "Transport case: a fictional bus operator says a new route reduced travel time. One survey excludes the busiest hour, and the old survey included it. Use STORY to describe the problem, a fair comparison and the uncertainty in the claim.",
  ],
  "D4-G01": [
    "Nature claim: a fictional supplier says one sensor can predict every plant's needs with perfect accuracy. Only three plants were tested and no failures are reported. Use FIRE to frame the claim, integrate the clues, reason about alternatives and design a fair verification experiment.",
    "Space claim: a fictional simulation advertises that its model predicts every satellite pass exactly. The examples cover one clear evening and omit failed runs. Use FIRE to assess the claim, identify missing evidence and design a reproducible test.",
    "Sports claim: a fictional app promises that every athlete will improve after one session. Its examples include only successful users and no comparison group. Use FIRE to assess selection bias, explain uncertainty and propose a fair trial.",
    "Transport claim: a fictional routing app says its fastest route is always best. It ignores accessibility, tolls and traffic changes. Use FIRE to examine the claim, compare alternative definitions of best and propose verification checks.",
  ],
  "D4-G02": [
    "Excess Access case: in a fictional flight-training app, an ordinary crew member can send a direct API request that edits another crew member's profile. The UI hides the edit button, but the server checks only whether someone is signed in. Use FIRE to locate the missing ownership check, explain a safe test and propose remediation.",
    "Missing Access case: a flight-training crew coordinator cannot read their own crew roster after a role rename. The stored role says coordinator; the API still expects crew_admin. Use FIRE to explain the mismatch, evidence to verify and a safe correction that does not grant all users admin rights.",
    "UI/API Mismatch case: the UI disables a report-export button for ordinary members, but a direct request still downloads the report. Use FIRE to distinguish presentation from server authorisation, identify evidence and propose a server-side permission test.",
    "Identity Mismatch case: a request body contains a user ID supplied by the browser and the server trusts it as the acting identity. Another signed-in account can change that ID. Use FIRE to explain the risk, a safe two-account test and remediation using the authenticated session identity.",
  ],
};
export function starterScenarioBrief(activityId, index) {
  const context = contexts[activityId]?.[index];
  return context ? "Starter mission · fictional scenario. " + context : null;
}
const quiz = [
  [
    "Which part normally renders the interactive page a player sees?",
    "Frontend",
    "Database",
    "Private answer key",
    "Backup archive",
  ],
  [
    "Where should access to a private user record be authorised?",
    "On the server handling the request",
    "Only by hiding a button",
    "In a public URL label",
    "Only in a screenshot",
  ],
  [
    "What is an API used for in a web application?",
    "A defined way for components to exchange requests and responses",
    "A replacement for every database",
    "A decorative icon",
    "A user password",
  ],
  [
    "Which component persistently stores structured application records?",
    "Database",
    "Button hover effect",
    "Browser cursor",
    "Page heading",
  ],
  [
    "What does authentication establish?",
    "Who the signed-in user is",
    "Every action the user may perform",
    "Whether a claim is factual",
    "The speed of an animation",
  ],
  [
    "What does authorisation decide?",
    "Whether an identified user may perform an action",
    "Which font a page uses",
    "Whether the computer is on",
    "The colour of a link",
  ],
  [
    "What should a client do after a failed save response?",
    "Show the failure and preserve work for correction or retry",
    "Always show success",
    "Delete the local draft immediately",
    "Pretend the database was updated",
  ],
  [
    "What is a useful first step when a page shows stale data?",
    "Compare the UI, API response and stored record",
    "Change all user passwords",
    "Delete every record",
    "Assume the database is empty",
  ],
  [
    "Why validate submitted fields on the server?",
    "Client-side checks can be bypassed",
    "It removes the need for permissions",
    "It makes every claim true",
    "It guarantees zero network failures",
  ],
  [
    "Where should a private database password be configured?",
    "In protected server configuration",
    "Inside browser JavaScript",
    "In a public profile",
    "In an image caption",
  ],
  [
    "What helps prevent a retried submission awarding the same reward twice?",
    "An idempotent operation with a unique saved event",
    "Changing the button colour",
    "Adding more loading text",
    "Removing every retry",
  ],
  [
    "What does a transaction help achieve for related database writes?",
    "They commit together or roll back together",
    "Every query becomes public",
    "All validation is unnecessary",
    "Every browser stays online",
  ],
  [
    "How should you investigate an AI-generated factual claim?",
    "Check reliable independent evidence and uncertainty",
    "Trust its confident tone",
    "Count emojis",
    "Copy it without checking",
  ],
  [
    "What does a shared chat link need for automatic evidence reading?",
    "Public access to the intended conversation",
    "Another user's password",
    "A private browser session URL",
    "An image of a loading spinner",
  ],
  [
    "Which result is evidence of a completed save?",
    "A confirmed server response and persisted record",
    "A button click alone",
    "A hopeful success message before the request",
    "A screenshot of an empty form",
  ],
];

export function starterFlightContent(day, original) {
  const content = emptyDayContent(day);
  const base = Date.parse(original.officialStart);
  content.timeZone = original.timeZone;
  content.officialStart = new Date(base + (day - 1) * 86400000).toISOString();
  content.closingCutoff = new Date(
    base + (day - 1) * 86400000 + 8 * 3600000,
  ).toISOString();
  if (day < 5) {
    content.nudgeAt = new Date(
      base + (day - 1) * 86400000 + 4 * 3600000,
    ).toISOString();
    content.discovery = {
      title: "One claim worth checking",
      brief:
        "Investigate a claim from today's mission. Compare the supplied evidence with an alternative explanation and retain the sources or checks that changed your view.",
    };
  }
  for (const activity of content.activities) {
    if (activity.questions)
      activity.questions = quiz.map(([question, ...options], i) => ({
        id: `q${i + 1}`,
        question,
        options,
        correct: 0,
      }));
    else if (activity.id === "D5-F01")
      activity.variants = original.genres.map((g) => ({
        id: g.id,
        name: g.name,
        brief: g.question,
        reference:
          "Revisit the pinned Day 1 question using a fresh AI conversation. Compare the new evidence against the original chat, explain how STORY and FIRE structure the investigation, distinguish confirmed claims from uncertainty and document how your reasoning changed. " +
          reference,
      }));
    else
      activity.variants = activity.variants.map((v, i) => ({
        ...v,
        brief:
          "Starter mission · fictional scenario. " +
          (activity.id === "D3-G02"
            ? `${v.name} case: trace a user action from the browser through an API request, server validation and permissions, a database operation, and the response rendered in the browser. Order the component cards, explain the flow using STORY, identify a possible failure and describe where the analogy stops being accurate.`
            : contexts[activity.id][i]),
        reference,
        ...(activity.id === "D3-G02"
          ? {
              cards: [
                "Browser action",
                "API request",
                "Server validation and permissions",
                "Database operation",
                "API response",
                "Browser rendering",
              ],
            }
          : {}),
      }));
  }
  return content;
}
