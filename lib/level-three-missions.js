export const levelThreeMissions = {
  "D3-G01": {
    type: "EVIDENCE EXPEDITION",
    headline: "Question the obvious.",
    description:
      "One clue changes everything. Investigate the claim and build your STORY from evidence.",
    objective:
      "Explain the observation, test another explanation and say what is still uncertain.",
    art: "signals",
  },
  "D3-G02": {
    type: "SIGNAL-PATH ADVENTURE",
    headline: "Follow the signal.",
    description:
      "A click starts a journey. Rebuild its route through the app, one component at a time.",
    objective:
      "Order the component cards, explain their roles, and find where the journey could fail.",
    art: "radar",
  },
};
export const storyEvidencePrompts = {
  evidence: [
    "Back your STORY with evidence",
    "Explain which supplied clues support your conclusion, which challenge it, and which source or comparison you would check next.",
  ],
  sequence: [
    "Build the signal path",
    "Tap the component cards to build the journey. Move or remove cards until the order matches your explanation.",
  ],
  scene: [
    "S · Set the scene",
    "Describe the situation and the observations you were given. Separate facts from assumptions.",
  ],
  need: [
    "T · Tell the need",
    "What needs explaining or solving? State the important question clearly.",
  ],
  how: [
    "O · Outline how it works",
    "Explain the mechanism or sequence. Consider another explanation that could fit the clues.",
  ],
  concept: [
    "R · Relate to the concept",
    "Connect the story to the concept you are learning. Explain why the connection is useful.",
  ],
  takeaway: [
    "Y · Your takeaway",
    "What can you conclude? Explain what the story or analogy cannot prove.",
  ],
  uncertainty: [
    "Keep the mystery honest",
    "Which details are still unknown? What would you check before being confident?",
  ],
  components: [
    "Meet the crew behind the click",
    "Describe what the browser, API, server and database each do in your chosen scenario.",
  ],
  failure: [
    "Find a broken link",
    "Choose a possible failure point. Describe its effect and a practical check to locate it.",
  ],
  limit: [
    "Know where the story ends",
    "Where does your analogy stop matching real software? Explain an important limitation.",
  ],
};
export function missionAnswerPresent(key, value, cards = []) {
  if (key !== "sequence")
    return typeof value === "string" && Boolean(value.trim());
  return (
    Array.isArray(value) &&
    value.length === cards.length &&
    cards.length > 0 &&
    new Set(value).size === cards.length &&
    value.every((card) => cards.includes(card))
  );
}

// A rehearsal checks only the supplied component order, never explanation quality.
export function signalPathCheck(cards, placed) {
  if (!missionAnswerPresent("sequence", placed, cards))
    return { ready: false, mismatch: -1 };
  return {
    ready: true,
    mismatch: placed.findIndex((card, i) => card !== cards[i]),
  };
}
