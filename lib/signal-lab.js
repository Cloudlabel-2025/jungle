import { levelThreeScenarioComic } from "./level-three-comics.js";

export const reasoningRoles = ["claim", "evidence", "explanation"];
export function reasoningCheck(order = []) {
  return (
    order.length === 3 && reasoningRoles.every((role, i) => order[i] === role)
  );
}
export function labStateFor(activityId, raw) {
  if (
    !["D3-G01", "D3-G02"].includes(activityId) ||
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  )
    throw Error("Supply a valid Level 3 lab state.");
  const { circuit = [], fault = "none", prediction = "" } = raw;
  if (
    !Array.isArray(circuit) ||
    circuit.length > 3 ||
    new Set(circuit).size !== circuit.length ||
    circuit.some((role) => !reasoningRoles.includes(role))
  )
    throw Error("Use each reasoning module once.");
  if (!["none", "permissions", "database"].includes(fault))
    throw Error("Choose a valid simulated fault.");
  const predictions =
    activityId === "D3-G01"
      ? ["", "proven", "uncertain", "unrelated"]
      : ["", "blocked", "no-response", "continues"];
  if (!predictions.includes(prediction))
    throw Error("Choose a prediction for this mission.");
  return {
    circuit: activityId === "D3-G01" ? [...circuit] : [],
    fault: activityId === "D3-G02" ? fault : "none",
    prediction,
  };
}
export function experimentOutcome(activityId, state) {
  const expected =
    activityId === "D3-G01"
      ? "uncertain"
      : state.fault === "permissions"
        ? "blocked"
        : state.fault === "database"
          ? "no-response"
          : "continues";
  return { expected, correct: state.prediction === expected };
}
export function reasoningModules(variant) {
  const source = levelThreeScenarioComic("D3-G01", variant);
  if (!source) return null;
  const explanation = {
    Nature:
      "Weather may explain the increase; the flowers' effect needs a fair comparison.",
    Space:
      "A recording error is possible; check the camera clock before explaining the sighting.",
    Sports:
      "Weaker opposition may explain the wins; missing reports limit the conclusion.",
    Transport:
      "Different survey periods may explain the improvement; compare matching traffic conditions.",
  }[variant.name];
  return [
    { id: "claim", label: "Claim", text: source.panels[0].dialogue },
    { id: "evidence", label: "Evidence", text: source.panels[1].dialogue },
    { id: "explanation", label: "Explanation", text: explanation },
  ];
}
export function labTime(deadline, now) {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(deadline) - new Date(now)) / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
