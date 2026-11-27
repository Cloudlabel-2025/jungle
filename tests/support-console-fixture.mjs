export function supportConsoleFixture() {
  const tickets = Array.from({ length: 8 }, (_, index) => ({
    _id: `support-${index + 1}`, createdBy: index % 2 ? "learner-2" : "learner-1",
    description: ["Unable to connect the project database from Code Lab", "Need guidance on the API validation checkpoint", "Review the deployment error after merging changes", "Clarification on the current research activity", "Help reproducing a failed frontend test", "Unable to resume the saved coding task", "Resolved authentication issue", "Closed environment configuration request"][index],
    state: index > 5 ? (index === 6 ? "RESOLVED" : "CLOSED") : index === 0 ? "ASSIGNED" : "NEW",
    createdAt: `2026-11-26T0${index}:00:00Z`, assignedTo: index < 3 || index > 5 ? "guide-1" : undefined,
    assignedAt: index < 3 ? "2026-11-26T08:00:00Z" : undefined,
    dueAt: index < 3 ? "2026-11-26T09:00:00Z" : undefined,
    breachedAt: index === 0 ? "2026-11-26T09:01:00Z" : undefined,
    category: index === 0 ? "EXPERT_INTERVENTION_NEEDED" : undefined,
    tags: index === 0 ? ["MongoDB", "connection"] : [], unassignedWaitMinutes: 12,
  }));
  return {
    user: { _id: "cc-preview", name: "Campus coordinator", role: "CENTRE_COMMAND" },
    tasks: [], roster: [{ _id: "learner-1", name: "Aarav" }, { _id: "learner-2", name: "Priya" }],
    support: { tickets, calendar: { timeZone: "Asia/Kolkata" }, operators: [{ _id: "guide-1", name: "Campus guide", role: "MISSION_COMMANDER" }],
      attempts: [], interventions: [], events: [], caseVersions: [], effort: { sessions: [], comparisons: [], reviewerIds: [], canReview: true },
      cases: ["Database connection checklist", "Tracing an API validation failure", "Verify a deployment before release"].map((title, index) => ({
        _id: `case-${index}`, ticketId: "support-7", status: index === 2 ? "DRAFT" : "PUBLISHED", version: 1,
        content: { title, cause: "A configuration mismatch prevented the application from reaching its expected service.", unsuccessful: "Retrying the unchanged request did not resolve the configuration mismatch.", successful: "Check the active environment and validate the connection against a known working request.", applicability: "Use this checklist when investigating environment and API configuration issues.", prerequisites: "Access to the approved project environment.", anonymisation: "Reviewed private details removed.", validationEvidence: "Verified against the resolved request." },
      })),
    },
  };
}
