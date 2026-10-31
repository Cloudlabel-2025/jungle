export function recoveryFixture() {
  return {
    start: "2026-11-07T03:30:00Z",
    choiceDeadline: "2026-11-06T18:00:00Z",
    examClose: "2026-11-07T08:00:00Z",
    timeZone: "Asia/Kolkata",
    meetingUrl: "https://example.invalid/recovery",
    policyUrl: "https://example.invalid/policy",
    policyReference: "Institution-approved test policy",
    orientation: "Monday orientation instructions supplied by institution.",
    teamScoreBasis: "FRIDAY",
    lateAccess: "SEQUENTIAL",
    exams: ["TECHNOLOGY", "FUN"].map((type) => ({
      type,
      rubric:
        "Fixture rubric: evidence, investigation, verification and explanation; percentage 0–100.",
      variants: Array.from({ length: 4 }, (_, i) => ({
        id: `${type}-${i}`,
        name: `Test ${type} ${i + 1}`,
        question:
          "Fixture-only investigation: compare conflicting evidence and document your safe checks.",
        reference:
          "PRIVATE fixture reference and acceptable alternative interpretations.",
      })),
    })),
  };
}
