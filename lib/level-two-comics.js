import { comicSourceBriefs } from "./level-two-comic-sources.js";
import { levelThreeScenarioComic } from "./level-three-comics.js";
import { sameCompanionBrief } from "./companion-name.js";

const panel = (title, speaker, dialogue, clue, evidence, alt) => ({
  title,
  speaker,
  dialogue,
  clue,
  evidence,
  alt,
});
const stories = {
  "D2-G01": [
    {
      slug: "college-event",
      name: "College Event",
      panels: [
        panel(
          "The poster",
          "Explorer",
          "The poster says 10:00 in Hall A. That’s where I was heading!",
          "Inspect the poster",
          "Event poster: 10:00 · Hall A.",
          "Two students examining an event poster on a campus noticeboard.",
        ),
        panel(
          "A newer message",
          "Friend",
          "Wait! This newer email says 11:00 in Hall B. Which message should we trust?",
          "Open the email clue",
          "The registration email is newer than the poster: 11:00 · Hall B.",
          "Students reading a registration email on a laptop facing them.",
        ),
        panel(
          "One more deadline",
          "Volunteer",
          "I’ve been told entry closes at 10:30. These times don’t line up!",
          "Listen to the volunteer",
          "Volunteer message: entry closes at 10:30. This conflicts with the email’s 11:00 start.",
          "A volunteer speaking by radio near the campus entrance.",
        ),
        panel(
          "Untangle the messages",
          "Kiko",
          "The organiser hasn’t confirmed which message replaces the others. Find three facts, ask two questions, then send one clear update.",
          "Your investigation",
          "Do not assume the newest message is correct. Separate confirmed details from what still needs clarification.",
          "Students and Kiko comparing the conflicting event information.",
        ),
      ],
    },
    {
      slug: "wildlife-rescue",
      name: "Wildlife Rescue",
      panels: [
        panel(
          "An urgent note",
          "Volunteer",
          "This note says to move the animal immediately. But we’re coordinating information, not handling it.",
          "Read the first note",
          "First instruction: move the fictional injured animal immediately. Volunteers must not handle it.",
          "Volunteers reading a rescue note from behind a safe barrier.",
        ),
        panel(
          "A different instruction",
          "Specialist’s message",
          "Keep a safe distance until a specialist arrives. That’s a different instruction!",
          "Read the specialist note",
          "Second instruction: keep a safe distance and wait for a specialist. It conflicts with the first note.",
          "A ranger showing volunteers a second instruction sheet.",
        ),
        panel(
          "Two locations",
          "Explorer",
          "The location pin and the written address point to different places. We need to check that too.",
          "Inspect the location clues",
          "The map pin and the written address disagree. Neither has been confirmed as the right location.",
          "A map and separate address card being compared on a ranger table.",
        ),
        panel(
          "Hold and clarify",
          "Kiko",
          "Stay safely back. Identify the conflicts, ask two precise questions and write a holding update for the volunteers.",
          "Your investigation",
          "Coordinate information only. Do not invent a confirmed location or recommend handling the animal.",
          "Volunteers communicating by radio while remaining behind the safety barrier.",
        ),
      ],
    },
    {
      slug: "sports-event",
      name: "Sports Event",
      panels: [
        panel(
          "Six teams?",
          "Organiser",
          "Our published fixture lists six teams. Let’s check it against the other messages.",
          "Inspect the fixture",
          "Published fixture: six teams.",
          "An organiser examining the sports fixture by a college playing field.",
        ),
        panel(
          "Or eight?",
          "Teammate",
          "The group chat lists eight teams. That’s not the same count!",
          "Read the chat clue",
          "Group chat: eight teams. The difference from the fixture has not been resolved.",
          "An organiser reading a group chat on a monitor facing the reader.",
        ),
        panel(
          "The schedule clashes",
          "Organiser",
          "The venue booking covers only four matches, and two schedules overlap. What is actually confirmed?",
          "Compare the booking",
          "Venue booking: four matches. Two schedules overlap. These clues do not establish which schedule is correct.",
          "Booking and schedule papers lying flat on the scorer’s table.",
        ),
        panel(
          "Get everyone aligned",
          "Kiko",
          "Record three facts. Ask two questions that resolve the conflict. Tell the team what is confirmed and what is provisional.",
          "Your investigation",
          "Compare the fixture, chat and booking. Do not silently pick one as the final schedule.",
          "The organisers and Kiko discussing the conflicting sports schedules.",
        ),
      ],
    },
    {
      slug: "space-mission",
      name: "Space Mission",
      panels: [
        panel(
          "The checklist",
          "Trainee",
          "Our simulation checklist says to use sensor A. Is that still the current instruction?",
          "Inspect the checklist",
          "Fictional simulation checklist: use sensor A.",
          "A trainee reading a correctly oriented checklist beside a blue sensor module.",
        ),
        panel(
          "A later memo",
          "Trainee",
          "This later memo says sensor B. But it has no version number!",
          "Inspect the memo",
          "Later memo: use sensor B. Its version number is missing.",
          "A trainee reading a memo beside an amber sensor module.",
        ),
        panel(
          "The display disagrees",
          "Explorer",
          "The dashboard still labels A as primary. The checklist, memo and display aren’t aligned.",
          "Inspect the dashboard",
          "Simulation dashboard: sensor A is still labelled primary. This does not prove which instruction is valid.",
          "A trainee and Kiko comparing the simulator dashboard with the memo.",
        ),
        panel(
          "Check before choosing",
          "Kiko",
          "Record the conflict, ask two targeted questions and send a short update. Don’t assume either sensor reading is correct.",
          "Your investigation",
          "This is a fictional information puzzle. Explain what needs confirmation rather than operating any controls.",
          "The trainees and Kiko comparing documents laid on a simulator desk.",
        ),
      ],
    },
  ],
  "D2-G02": [
    {
      slug: "navigation-beacon",
      name: "Navigation Beacon",
      panels: [
        panel(
          "A missing dot",
          "Kiko",
          "Beacon B7 is missing from this training display. Is the signal gone, or is the display behind?",
          "Inspect the display",
          "The fictional flight-training display does not show B7. Its last refresh was 09:05.",
          "Kiko and an explorer noticing a missing dot on a training display.",
        ),
        panel(
          "The receiver saw it",
          "Explorer",
          "The receiver log contains B7 at 09:12. That’s later than the display’s 09:05 refresh.",
          "Read the receiver log",
          "Receiver log: B7 received at 09:12. Display last refresh: 09:05.",
          "An explorer reading a receiver log at a fixed cabin desk.",
        ),
        panel(
          "Another screen",
          "Explorer",
          "This second screen shows B7 normally. The two screens don’t agree.",
          "Compare the screens",
          "The second screen shows B7. Compare the screens and their refresh information before choosing an explanation.",
          "Two training displays showing different beacon information.",
        ),
        panel(
          "Follow the evidence",
          "Kiko",
          "Record a likely cause and supporting clues. Plan two independent checks, then radio what’s confirmed and what’s still a guess.",
          "Your investigation",
          "Investigate the information only. No aircraft controls need changing, and a stale display is a hypothesis to check.",
          "Kiko and an explorer preparing a radio update beside the training displays.",
        ),
      ],
    },
    {
      slug: "weather-echo",
      name: "Weather Echo",
      panels: [
        panel(
          "Rain in sector C",
          "Explorer",
          "This training display shows a rain alert for sector C. Let’s check its timestamp.",
          "Inspect the rain alert",
          "Rain alert: sector C, created at 08:40. The expiry field is blank.",
          "An explorer and Kiko inspecting a rain alert on a cabin training screen.",
        ),
        panel(
          "A newer report",
          "Explorer",
          "A report marked 09:20 says clear. That seems different from the alert.",
          "Read the weather report",
          "Weather report at 09:20: clear. Its time and location need comparing against the alert.",
          "An explorer reading a clear-weather report on a fixed monitor.",
        ),
        panel(
          "The neighbouring sector",
          "Kiko",
          "A nearby sector still reports rain. Could this be old information, a location mismatch or changing weather?",
          "Compare sectors and times",
          "Nearby sector: rain. Sector C alert: 08:40, no expiry. Clear report: 09:20. Do not treat neighbouring sectors as identical.",
          "Adjacent map sectors and weather reports being compared.",
        ),
        panel(
          "Report the uncertainty",
          "Kiko",
          "Record your suspected cause and evidence. Propose two checks, then radio what remains uncertain.",
          "Your investigation",
          "This is a fictional training puzzle. Investigate the reports; do not make real flight decisions.",
          "An explorer and Kiko reviewing weather reports before a radio update.",
        ),
      ],
    },
    {
      slug: "supply-manifest",
      name: "Supply Manifest",
      panels: [
        panel(
          "Four in the cabin",
          "Kiko",
          "The cabin inventory display shows four supply crates. Let’s compare it with the loading record.",
          "Inspect the inventory",
          "Cabin inventory display: four crates. The filter reads CABIN ONLY.",
          "Kiko and an explorer examining a cabin inventory display.",
        ),
        panel(
          "Six were loaded",
          "Explorer",
          "The signed loading log lists six crates. A loading photo also shows six labelled crates.",
          "Check the log and photo",
          "Signed loading log: six crates. Photo: six labelled crates loaded, without showing where each was placed.",
          "A loading log and a photo of six crates on a desk.",
        ),
        panel(
          "The transfer clue",
          "Explorer",
          "Two crates have the destination code TRANSFER. Could that explain a different count?",
          "Inspect tags and filter",
          "Two crates: TRANSFER. Display filter: CABIN ONLY. The photo does not establish each crate’s final location.",
          "Transfer tags and a cabin-only filter being compared.",
        ),
        panel(
          "Missing or filtered?",
          "Kiko",
          "Investigate the mismatch. Give a likely cause, evidence and two checks. Send the crew an update without claiming supplies are missing.",
          "Your investigation",
          "Distinguish a filtered display from missing supplies. Verify the explanation before treating it as a fact.",
          "An explorer and Kiko comparing the manifest, display and loading photo.",
        ),
      ],
    },
    {
      slug: "radio-relay",
      name: "Radio Relay",
      panels: [
        panel(
          "A new message?",
          "Explorer",
          "This route message is stamped 09:30, but the relay log records it at 09:10.",
          "Compare the timestamps",
          "Message stamp: 09:30. Relay log: 09:10. The sender’s clock is twenty minutes ahead.",
          "Kiko and a headset-wearing explorer inspecting a radio message and clock.",
        ),
        panel(
          "An echo in the relay",
          "Kiko",
          "Two relays repeat the same message ID. It might be the same message arriving twice.",
          "Inspect message IDs",
          "Two relay entries repeat the same message ID. This supports checking for duplicates, not assuming a new instruction.",
          "A relay log showing two matching message symbols.",
        ),
        panel(
          "An unconfirmed correction",
          "Explorer",
          "There’s a later correction with a different ID, but no acknowledgement. Was it received?",
          "Inspect the correction",
          "Later correction: a different message ID. Acknowledgement: missing.",
          "A new correction message beside an empty acknowledgement indicator.",
        ),
        panel(
          "Separate echo from update",
          "Kiko",
          "Trace the clocks and message IDs. Record a cause, clues and two checks, then radio a clear update. Don’t change the aircraft’s route.",
          "Your investigation",
          "Investigate the messages only. The correction’s receipt and status still need verification.",
          "An explorer and Kiko comparing clocks and logs before a radio update.",
        ),
      ],
    },
  ],
};

const comicAssetVersions = {
  "college-event": "v3",
  "wildlife-rescue": "v2",
  "sports-event": "v2",
  "space-mission": "v2",
  "weather-echo": "v2",
  "radio-relay": "v2",
};

export const levelTwoComics = Object.entries(stories).flatMap(
  ([activityId, entries]) =>
    entries.map((story, index) => ({
      ...story,
      activityId,
      variantId: `variant-${index + 1}`,
      sourceBrief: comicSourceBriefs[story.slug],
      image: `/images/level-two-comics/${story.slug}-${comicAssetVersions[story.slug] || "v1"}.webp`,
    })),
);
export function scenarioComic(activityId, variant) {
  if (["D3-G01", "D3-G02"].includes(activityId))
    return levelThreeScenarioComic(activityId, variant);
  return (
    levelTwoComics.find(
      (story) =>
        story.activityId === activityId &&
        story.variantId === variant?.id &&
        story.name === variant?.name &&
        sameCompanionBrief(story.sourceBrief, variant?.brief),
    ) || null
  );
}
