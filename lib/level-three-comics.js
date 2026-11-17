import { levelThreeComicSources } from "./level-three-comic-sources.js";
import { sameCompanionBrief } from "./companion-name.js";

const panel = (title, speaker, dialogue, clue, evidence, alt) => ({
  title,
  speaker,
  dialogue,
  clue,
  evidence,
  alt,
});
const investigations = [
  {
    slug: "nature",
    name: "Nature",
    panels: [
      panel(
        "A garden discovery",
        "Explorer",
        "More butterflies appeared after the new flowers were planted. Did the flowers cause it?",
        "Inspect the observation",
        "The study reports an increase after planting flowers. Timing alone does not establish the cause.",
        "Explorers and the familiar twin-rotor Kiko observing butterflies in a flower garden.",
      ),
      panel(
        "A warmer day",
        "Friend",
        "Most of the increase came from one unusually warm day. That clue changes the story.",
        "Compare the conditions",
        "One unusually warm observation day accounts for most of the increase. Weather is a plausible alternative explanation.",
        "The same garden under unusually warm sunshine with a thermometer nearby.",
      ),
      panel(
        "A fair comparison",
        "Explorer",
        "Let's compare similar observation times and weather, including a patch without new flowers.",
        "Plan an independent check",
        "Collect comparable observations across several days. The supplied scenario has not already proved the result of this check.",
        "Explorers compare two garden patches and record observations on correctly oriented paper.",
      ),
      panel(
        "Tell the honest STORY",
        "Kiko",
        "Explain what happened, why it needs checking and what remains uncertain. Don't turn a pattern into proof!",
        "Your investigation",
        "Complete the five STORY checkpoints, supporting evidence and uncertainty. Distinguish the supplied facts from your proposed tests.",
        "Kiko and the explorers thoughtfully discussing the garden evidence.",
      ),
    ],
  },
  {
    slug: "space",
    name: "Space",
    panels: [
      panel(
        "A light on schedule",
        "Explorer",
        "The telescope log records a light every evening at the same time. What could explain that pattern?",
        "Open the observation log",
        "A recurring light at the same recorded time is the claim to investigate, not proof of a particular cause.",
        "Explorers use a student telescope at dusk while Kiko observes.",
      ),
      panel(
        "Clouds and a sighting",
        "Friend",
        "One cloudy night still has a recorded sighting. Does the record really belong to that night?",
        "Inspect the odd clue",
        "The log contains a sighting on a cloudy night. Investigate the observation and its recording rather than assuming either is correct.",
        "A cloudy observatory night and an observation recorded by a camera.",
      ),
      panel(
        "Check the clock",
        "Explorer",
        "The camera timestamp might be wrong. We should compare its clock with an independent time source.",
        "Check the timestamp",
        "The camera clock may be wrong. A timing error is a testable alternative; its cause has not been established.",
        "Explorers compare the camera clock with the observatory clock.",
      ),
      panel(
        "Observe, then explain",
        "Kiko",
        "Build a STORY from the clues. Propose another observation, and keep uncertainty in your conclusion.",
        "Your investigation",
        "Explain the claim, a testable alternative, evidence to collect and what remains uncertain. No supplied clue establishes an extraordinary explanation.",
        "The explorers and twin-rotor Kiko prepare another telescope observation.",
      ),
    ],
  },
  {
    slug: "sports",
    name: "Sports",
    panels: [
      panel(
        "A winning routine?",
        "Explorer",
        "The team says its new training routine caused the wins. Let's check that explanation.",
        "Inspect the claim",
        "The new routine and improved results happened together. The claim is causal, so alternatives matter.",
        "Explorers and Kiko watch a sports team following a new training plan.",
      ),
      panel(
        "Different opponents",
        "Friend",
        "The improvement also happened against weaker opponents. Could that explain some of the wins?",
        "Compare the opposition",
        "The improvement coincided with weaker opponents. This is an alternative explanation in the supplied scenario.",
        "The team competes against inexperienced opponents while the explorers watch.",
      ),
      panel(
        "Two missing reports",
        "Explorer",
        "Two match reports are missing. We cannot pretend we have a complete record.",
        "Check the evidence gaps",
        "Two match reports are missing. Their contents are unknown; do not invent results or assume they support the claim.",
        "Explorers inspect match-report folders with two empty spaces, facing the papers they read.",
      ),
      panel(
        "Make it a fair test",
        "Kiko",
        "Compare similarly matched opponents and use STORY to explain what the evidence can and cannot show.",
        "Your investigation",
        "Challenge the causal claim, propose a fair comparison and state the uncertainty caused by missing reports.",
        "Kiko and the explorers consider comparable practice teams on a sports field.",
      ),
    ],
  },
  {
    slug: "transport",
    name: "Transport",
    panels: [
      panel(
        "A faster route?",
        "Explorer",
        "The bus operator says its new route reduced travel time. Were the journeys measured fairly?",
        "Read the survey claim",
        "The claim compares travel times before and after a route change. Check whether the survey conditions match.",
        "Explorers and Kiko inspect a route survey at a green bus stop.",
      ),
      panel(
        "The quiet sample",
        "Friend",
        "The new survey excludes the busiest hour. That can change the average travel time.",
        "Inspect the new sample",
        "The new survey excludes the busiest hour. Its sample does not cover the same conditions as the old survey.",
        "A bus travels on a quiet off-peak road.",
      ),
      panel(
        "The missing rush hour",
        "Explorer",
        "The old survey included the busy hour. We are comparing different traffic conditions.",
        "Compare the old sample",
        "The old survey included the busiest hour. The difference in sampling could explain some of the apparent improvement.",
        "A bus waits in heavy rush-hour traffic on the same road.",
      ),
      panel(
        "Compare like with like",
        "Kiko",
        "Use STORY to explain the problem. Propose matching survey periods and say what is still unknown.",
        "Your investigation",
        "A fair comparison should account for comparable times and traffic. The supplied evidence has not proved the route caused the improvement.",
        "Explorers and Kiko compare correctly oriented route diagrams on a table.",
      ),
    ],
  },
];
const systems = [
  [
    "crew-login",
    "Crew Login",
    "sign in",
    "a crew login",
    "the requested account",
    "A login can fail when identity checks reject the request; signing in does not grant every permission.",
  ],
  [
    "flight-logs",
    "Search Flight Logs",
    "search the flight logs",
    "a search request",
    "matching flight-log records",
    "A stale or failed search may show no results; compare the request, response and stored records.",
  ],
  [
    "crew-profile",
    "Update Crew Profile",
    "edit your own crew profile",
    "a profile update",
    "your own profile record",
    "A profile update must check ownership on the server; a hidden button is not an authorisation check.",
  ],
  [
    "supply-request",
    "Supply Request",
    "request supplies",
    "a supply request",
    "the new request record",
    "A confirmed request save is not a promise that supplies have already been delivered.",
  ],
].map(([slug, name, action, request, record, caveat]) => ({
  slug,
  name,
  panels: [
    panel(
      "A click begins the journey",
      "Explorer",
      `I want to ${action}. What happens after I use the app?`,
      "Start with the browser",
      `The browser captures the user's action and prepares ${request}. The click alone does not prove a completed operation.`,
      "An over-the-shoulder view of an explorer using a laptop whose display faces its reader.",
    ),
    panel(
      "A request reaches the server",
      "Kiko",
      "The API carries the request. The server checks the fields, identity and permission before continuing.",
      "Inspect the server checkpoint",
      "The API is the request/response interface. Server validation and authorisation are required; browser presentation does not replace them.",
      "The familiar twin-rotor Kiko examines a signal reaching a shielded server.",
    ),
    panel(
      "The database has a role",
      "Explorer",
      `The server works with ${record}. Which component reads or writes the data?`,
      "Follow the stored record",
      `The database operation is controlled by the server. ${caveat} The archive in the picture is an analogy, not a literal database mechanism.`,
      "Explorers inspect database archive cards with their printed faces toward the reader, not the camera.",
    ),
    panel(
      "Bring the answer back",
      "Kiko",
      "The API returns a response and the browser renders it. Rebuild the whole path and explain a possible failure.",
      "Your investigation",
      "Order all six supplied component cards, complete STORY, explain each component, a failure point and the limits of the analogy. Keep the original scenario's scope.",
      "An over-the-shoulder explorer view of the response on a correctly oriented laptop, with the same Kiko nearby.",
    ),
  ],
}));

export const levelThreeComics = [
  ...investigations.map((story, index) => ({
    ...story,
    activityId: "D3-G01",
    variantId: `variant-${index + 1}`,
  })),
  ...systems.map((story, index) => ({
    ...story,
    activityId: "D3-G02",
    variantId: `variant-${index + 1}`,
  })),
].map((story) => ({
  ...story,
  sourceBrief: levelThreeComicSources[story.activityId][story.variantId].brief,
  image: `/images/level-three-comics/${story.slug}-${story.slug === "transport" ? "v3" : "v1"}.webp`,
}));

export function levelThreeScenarioComic(activityId, variant) {
  return (
    levelThreeComics.find(
      (story) =>
        story.activityId === activityId &&
        story.variantId === variant?.id &&
        story.name === variant?.name &&
        sameCompanionBrief(story.sourceBrief, variant?.brief) &&
        (activityId !== "D3-G02" ||
          JSON.stringify(variant.cards) ===
            JSON.stringify([
              "Browser action",
              "API request",
              "Server validation and permissions",
              "Database operation",
              "API response",
              "Browser rendering",
            ])),
    ) || null
  );
}
