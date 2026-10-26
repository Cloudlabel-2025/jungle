import mongoose from "mongoose";
const { Schema } = mongoose;
const string = { type: String, required: true };
const base = { _id: string };
const definitions = {
  User: {
    ...base,
    name: string,
    email: { ...string, unique: true },
    role: { ...string, enum: ["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"] },
    teamId: String,
    assignment: String,
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
};
export const models = Object.fromEntries(
  Object.entries(definitions).map(([name, fields]) => {
    const schema = new Schema(fields, { versionKey: false, strict: "throw" });
    if (name === "Attendance" || name === "Journal")
      schema.index({ userId: 1, day: 1 }, { unique: true });
    if (name === "Progress")
      schema.index({ userId: 1, moduleId: 1 }, { unique: true });
    if (name === "Task") schema.index({ teamId: 1, dueAt: 1 });
    if (name === "Message") schema.index({ teamId: 1, createdAt: -1 });
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
