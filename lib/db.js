import mongoose from "mongoose";
const { Schema } = mongoose;
const string = { type: String, required: true };
const base = { _id: string };
const definitions = {
  Migration: {
    ...base,
    appliedAt: { type: Date, default: Date.now },
    description: string,
  },
  Credential: {
    ...base,
    passwordHash: string,
    failures: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  User: {
    ...base,
    name: string,
    email: { ...string, unique: true },
    role: { ...string, enum: ["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"] },
    teamId: String,
    assignment: String,
    teamRoleCode: {
      type: String,
      enum: ["TEAM_LEAD", "FRONTEND", "BACKEND", "DATABASE_QA", "DEVOPS"],
    },
    active: { type: Boolean, default: true },
    lastSeenAt: Date,
    hp: { type: Number, min: 0, max: 5, default: 5 },
    xp: { type: Number, min: 0, default: 0 },
    trophies: { type: Number, min: 0, default: 0 },
    rewardVersion: { type: Number, default: 2 },
    drops: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastSettledDay: String,
    xpDay: String,
    dailyXp: { type: Number, default: 0 },
    trophyDay: String,
    dailyTrophies: { type: Number, default: 0 },
  },
  Team: { ...base, name: string, code: string, color: String },
  Cohort: {
    ...base,
    name: string,
    college: string,
    startDate: string,
    currentWeek: { type: Number, min: 1, max: 52 },
    shift: String,
    scenario: String,
    version: { type: Number, default: 1 },
    rulesVersion: { type: Number, default: 1 },
    workingCalendar: {
      timeZone: String,
      startMinute: Number,
      weekdays: [Number],
      holidays: [String],
    },
    discoveryPrompt: String,
    discoveryVersion: { type: Number, default: 0 },
    rosterVersion: { type: Number, default: 0 },
  },
  Task: {
    ...base,
    teamId: string,
    assigneeId: string,
    title: string,
    description: String,
    status: { ...string, enum: ["Backlog", "In Progress", "Review", "Done"] },
    dueAt: { type: Date, required: true },
    report: String,
    reportedAt: Date,
    deadlineChecked: { type: Boolean, default: false },
    dependencyId: String,
    priority: String,
    xp: { type: Number, default: 10 },
    approvedAt: Date,
    challengeId: String,
    definitionId: String,
    challengeName: String,
    targetRole: String,
    originalAssigneeId: String,
    releasedAt: Date,
    acceptanceCriteria: String,
    submissionSummary: String,
    evidenceReferences: [String],
    submittedAt: Date,
    submissionVersion: { type: Number, default: 0 },
    reviewFeedback: String,
  },
  Challenge: {
    ...base,
    cohortId: string,
    name: string,
    description: string,
    status: { ...string, enum: ["DRAFT", "PUBLISHED"] },
    version: { type: Number, default: 1 },
    createdBy: string,
    createdAt: Date,
    updatedAt: Date,
    publishedAt: Date,
    publishedBy: String,
    definitions: [
      {
        _id: string,
        title: string,
        instructions: string,
        acceptanceCriteria: string,
        targetRole: {
          ...string,
          enum: ["TEAM_LEAD", "FRONTEND", "BACKEND", "DATABASE_QA", "DEVOPS"],
        },
        dueAt: { type: Date, required: true },
        priority: { ...string, enum: ["MEDIUM", "HIGH", "CRITICAL"] },
      },
    ],
  },
  ChallengeEvent: {
    ...base,
    challengeId: string,
    actorId: string,
    kind: string,
    details: Schema.Types.Mixed,
    createdAt: Date,
  },
  TaskEvent: {
    ...base,
    taskId: string,
    challengeId: string,
    teamId: string,
    actorId: string,
    kind: string,
    details: Schema.Types.Mixed,
    createdAt: Date,
  },
  Attendance: {
    ...base,
    userId: string,
    day: string,
    clockAt: { type: Date, required: true },
    onTime: Boolean,
    reason: String,
  },
  Trophy: {
    ...base,
    userId: string,
    amount: { type: Number, min: 0 },
    legacyAmount: Number,
    rewardVersion: { type: Number, default: 2 },
    reason: string,
    eventKey: { ...string, unique: true },
    day: string,
    createdAt: { type: Date, default: Date.now },
  },
  Experience: {
    ...base,
    userId: string,
    amount: { type: Number, min: 0, required: true },
    reason: string,
    eventKey: { ...string, unique: true },
    day: string,
    createdAt: { type: Date, default: Date.now },
  },
  RewardMigration: {
    ...base,
    userId: { ...string, unique: true },
    legacyXp: Number,
    legacyDailyXp: Number,
    legacyXpDay: String,
    xp: Number,
    trophies: Number,
    convertedAt: { type: Date, default: Date.now },
  },
  Energy: {
    ...base,
    userId: string,
    change: Number,
    result: Number,
    reason: string,
    ruleId: Number,
    eventKey: { ...string, unique: true },
    day: string,
    createdAt: { type: Date, default: Date.now },
  },
  Rescue: {
    ...base,
    userId: string,
    teamId: string,
    status: {
      type: String,
      enum: ["OPEN", "RECOVERING", "CLOSED"],
      default: "OPEN",
    },
    plan: String,
    openedAt: { type: Date, default: Date.now },
    closedAt: Date,
  },
  Progress: {
    ...base,
    userId: string,
    moduleId: string,
    completedAt: { type: Date, default: Date.now },
  },
  Journal: {
    ...base,
    userId: string,
    teamId: string,
    day: string,
    workDone: string,
    learnings: string,
    blockers: String,
    tomorrowPlan: string,
    supportTicketIds: [String],
    submittedAt: { type: Date, default: Date.now },
  },
  Message: {
    ...base,
    teamId: string,
    senderId: string,
    senderName: string,
    message: string,
    isBlocker: Boolean,
    resolvedAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  Proposal: {
    ...base,
    proposerId: string,
    recipientId: string,
    perkId: string,
    kind: {
      type: String,
      enum: ["PERK", "HP_OVERRIDE", "XP_OVERRIDE"],
      default: "PERK",
    },
    amount: Number,
    rationale: string,
    status: {
      type: String,
      enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED"],
      default: "PENDING_APPROVAL",
    },
    approvers: [String],
    rejectedBy: String,
    createdAt: { type: Date, default: Date.now },
  },
  ClientEvent: {
    ...base,
    title: string,
    description: string,
    disruptionType: string,
    broadcastAt: { type: Date, default: Date.now },
    creatorId: string,
  },
  Coaching: {
    ...base,
    userId: string,
    authorId: string,
    notes: string,
    standupRating: { type: Number, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now },
  },
  RuleVersion: {
    ...base,
    version: Number,
    text: string,
    authorId: string,
    createdAt: { type: Date, default: Date.now },
  },
  Clearance: {
    ...base,
    userId: string,
    reviewerId: string,
    competency: { type: Number, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now },
  },
  Lab: {
    ...base,
    files: [
      { _id: false, path: string, content: { type: String, required: true } },
    ],
    updatedAt: { type: Date, default: Date.now },
  },
  HelpTicket: {
    ...base,
    cohortId: string,
    teamId: string,
    createdBy: string,
    taskId: String,
    issueId: String,
    description: string,
    category: {
      type: String,
      enum: [null, "EXPERIENCE", "COGNITION", "EXPERT_INTERVENTION_NEEDED"],
      default: null,
    },
    tags: [String],
    state: {
      ...string,
      enum: [
        "NEW",
        "TRIAGED",
        "ASSIGNED",
        "IN_PROGRESS",
        "RESPONDED",
        "RESOLVED",
        "CLOSED",
      ],
    },
    assignedTo: String,
    assignedAt: Date,
    dueAt: Date,
    firstResponseAt: Date,
    acknowledgedAt: Date,
    resolvedAt: Date,
    escalated: { type: Boolean, default: false },
    breachedAt: Date,
    calendarSnapshot: {
      timeZone: String,
      startMinute: Number,
      weekdays: [Number],
      holidays: [String],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
  },
  SupportEvent: {
    ...base,
    cohortId: string,
    ticketId: string,
    actorId: string,
    kind: string,
    details: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  },
  SupportIntervention: {
    ...base,
    ticketId: string,
    kind: {
      ...string,
      enum: ["INT01", "INT02", "INT03", "INT04", "INT05", "INT06"],
    },
    approvedBy: string,
    performerId: string,
    plannedAt: Date,
    actualAt: Date,
    guidance: string,
    outcome: String,
    artifact: String,
    createdAt: Date,
  },
  SupportAttempt: {
    ...base,
    ticketId: string,
    actorId: string,
    approach: string,
    rationale: string,
    result: { ...string, enum: ["SUCCESSFUL", "UNSUCCESSFUL"] },
    artifact: string,
    verifiedBy: String,
    createdAt: Date,
  },
  TechnicalIssue: {
    ...base,
    cohortId: string,
    symptom: string,
    cause: String,
    taskId: String,
    recurrenceOf: String,
    createdBy: string,
    createdAt: Date,
  },
  KnowledgeCase: {
    ...base,
    cohortId: string,
    ticketId: string,
    status: { ...string, enum: ["DRAFT", "PUBLISHED", "WITHDRAWN"] },
    version: Number,
    authorId: string,
    reviewerId: String,
    content: Schema.Types.Mixed,
    updatedAt: Date,
  },
  CaseVersion: {
    ...base,
    caseId: string,
    version: Number,
    actorId: string,
    status: string,
    content: Schema.Types.Mixed,
    createdAt: Date,
  },
  DiscoveryBaseline: {
    ...base,
    cohortId: string,
    userId: { ...string, unique: true },
    prompt: string,
    promptVersion: Number,
    priorExposure: string,
    activity: string,
    helpUsed: string,
    reflection: string,
    reasoning: String,
    commanderNotes: String,
    reviewerId: String,
    createdAt: Date,
    updatedAt: Date,
  },
  GrowthReport: {
    ...base,
    cohortId: string,
    userId: { ...string, unique: true },
    proposedBy: string,
    validatedBy: String,
    status: {
      ...string,
      enum: ["PROPOSED", "VALIDATED", "CORRECTION_REQUESTED"],
    },
    strengths: string,
    unobserved: string,
    trajectory: string,
    support: string,
    pathway: String,
    comparison: string,
    evidenceIds: [String],
    scores: [Number],
    total: Number,
    correction: String,
    rubricVersion: string,
    updatedAt: Date,
  },
};
export const models = Object.fromEntries(
  Object.entries(definitions).map(([name, fields]) => {
    const schema = new Schema(fields, { versionKey: false, strict: "throw" });
    if (name === "Attendance" || name === "Journal")
      schema.index({ userId: 1, day: 1 }, { unique: true });
    if (name === "Progress")
      schema.index({ userId: 1, moduleId: 1 }, { unique: true });
    if (name === "Task") {
      schema.index({ teamId: 1, dueAt: 1 });
      schema.index(
        { challengeId: 1, definitionId: 1, teamId: 1 },
        {
          unique: true,
          partialFilterExpression: { challengeId: { $type: "string" } },
        },
      );
    }
    if (name === "ChallengeEvent")
      schema.index({ challengeId: 1, createdAt: 1 });
    if (name === "TaskEvent") schema.index({ taskId: 1, createdAt: 1 });
    if (name === "Message") schema.index({ teamId: 1, createdAt: -1 });
    if (name === "HelpTicket")
      schema.index({ cohortId: 1, assignedTo: 1, createdAt: -1 });
    if (
      name === "SupportEvent" ||
      name === "SupportAttempt" ||
      name === "SupportIntervention"
    )
      schema.index({ ticketId: 1, createdAt: 1 });
    if (name === "CaseVersion")
      schema.index({ caseId: 1, version: 1 }, { unique: true });
    return [name, mongoose.models[name] || mongoose.model(name, schema)];
  }),
);
export async function connect() {
  if (!process.env.MONGODB_URI)
    throw new Error(
      "MongoDB is not configured. Run npm run dev, or configure MONGODB_URI in .env.local.",
    );
  if (mongoose.connection.readyState === 1) return mongoose;
  globalThis.__codewildMongo ||= mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
    .catch((e) => {
      globalThis.__codewildMongo = null;
      throw e;
    });
  return globalThis.__codewildMongo;
}
export async function transaction(fn) {
  await connect();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}
