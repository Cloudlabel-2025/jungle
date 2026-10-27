import { teamRoles, playerRole } from "./team-roles.js";

const entries = [
  [
    "Team message board",
    "One message input, a Save button, and a list that survives refreshing. No login, editing, or search.",
    4,
    [
      "Save a non-empty message",
      "List saved messages after refreshing",
      "Show loading, empty, and failed-request states",
    ],
    [
      "Agree GET /api/messages → [{ id, text }] and POST /api/messages { text } → { id, text }. Connect the full save-and-refresh flow.",
      "Build one labelled message input, Save button, and message list with loading and error states.",
      "Implement GET and POST /api/messages. Trim text, reject empty messages, and return useful errors.",
      "Create a message model with text and createdAt. Verify valid saves, empty-message rejection, and persistence after refresh.",
      "Provide .env.example without secrets and README install/start/build steps. Have a teammate verify a fresh setup.",
    ],
  ],
  [
    "Suggestion box",
    "Submit a title and description and see all suggestions. Keep it anonymous.",
    6,
    [
      "Save a title and description",
      "Reject missing or oversized fields",
      "Show both fields in the suggestion list",
    ],
    [
      "Define the two-field request contract and integrate the complete submission journey.",
      "Build a two-field form and suggestion cards with validation messages.",
      "Implement create/list endpoints with title and description length limits.",
      "Define the suggestion model and test missing, oversized, and valid fields.",
      "Add sample data, document environment setup, and verify the build and fresh start.",
    ],
  ],
  [
    "Personal notes app",
    "Create, list, and delete notes. No accounts or editing yet.",
    8,
    [
      "Create and list notes",
      "Confirm before deleting a note",
      "Deleted notes stay deleted after refreshing",
    ],
    [
      "Agree note identifiers and integrate creation and deletion, including not-found errors.",
      "Build note cards, a creation form, and an accessible delete confirmation.",
      "Implement create/list/delete endpoints with validation and not-found handling.",
      "Model notes and test deletion, invalid identifiers, and persistence.",
      "Document seed/reset commands and automate a build plus smoke check.",
    ],
  ],
  [
    "Contact book",
    "Add, view, edit, and delete contacts with a name and email.",
    8,
    [
      "Create, edit, and delete contacts",
      "Validate names and email addresses",
      "Show saved changes after refreshing",
    ],
    [
      "Agree update semantics and integrate the full contact lifecycle.",
      "Build the contact list and add/edit forms; retain entered values on errors.",
      "Implement contact CRUD and server-side name/email validation.",
      "Model contacts and test valid updates, invalid email, and missing records.",
      "Add repeatable checks and a fresh-install walkthrough with sample contacts.",
    ],
  ],
  [
    "Reading list",
    "Save books, mark them read or unread, and filter by status.",
    10,
    [
      "Save a book title and author",
      "Toggle read/unread with persistence",
      "Filter all, read, and unread books",
    ],
    [
      "Define reading states and integrate filters with status updates.",
      "Build book forms, status controls, and clear filter/empty states.",
      "Implement book creation, listing by status, and validated status updates.",
      "Model books and test toggling twice, filters, and invalid states.",
      "Automate smoke checks and document a repeatable demonstration.",
    ],
  ],
  [
    "Expense diary",
    "Record expenses with an amount and category and show the total. Use fictional data.",
    12,
    [
      "Record a positive amount and category",
      "Display entries and an accurate total",
      "Reject invalid amounts without changing totals",
    ],
    [
      "Agree integer minor-unit amounts and integrate entries with server-calculated totals.",
      "Build the expense form, category list, and formatted spending summary.",
      "Validate decimal input, store integer minor units, and return the calculated total.",
      "Model expenses and test decimal precision, zero/negative values, and totals.",
      "Add automated checks and document sample data and configuration.",
    ],
  ],
  [
    "Supply tracker",
    "Add supplies, adjust quantities, and highlight low stock.",
    12,
    [
      "Create supplies with a low-stock threshold",
      "Increase and decrease quantities",
      "Prevent negative stock and highlight low stock",
    ],
    [
      "Define adjustment rules and integrate errors and low-stock indicators.",
      "Build supply cards, adjustment controls, and low-stock labels.",
      "Implement validated atomic stock adjustments that cannot produce negative quantities.",
      "Model quantities/thresholds and test boundary values and simultaneous decrements.",
      "Add a health endpoint and document logs plus a recovery walkthrough.",
    ],
  ],
  [
    "Team task board",
    "Create tasks, assign a member from a supplied list, and change status. No authentication yet.",
    16,
    [
      "Create and assign a task to a valid member",
      "Move tasks between todo, doing, and done",
      "Filter by member and persist changes",
    ],
    [
      "Agree member/task contracts and integrate the assigned-task journey.",
      "Build task columns, member selection, and member filters.",
      "Implement task endpoints; validate member identifiers and allowed statuses.",
      "Model member references and test invalid assignments, filters, and updates.",
      "Seed the member list and automate build, test, and smoke checks.",
    ],
  ],
  [
    "Workshop registration",
    "List workshops, register participants, and display remaining seats.",
    20,
    [
      "List workshops and remaining capacity",
      "Register a participant only once per workshop",
      "Prevent overbooking, including concurrent requests",
    ],
    [
      "Agree registration outcomes and integrate full/duplicate registration handling.",
      "Build workshop cards, registration forms, and remaining-seat states.",
      "Implement capacity-safe registration and duplicate registration rejection.",
      "Model workshops/registrations and test final-seat races and duplicates.",
      "Provide reproducible concurrency checks, logs, and deployment/run instructions.",
    ],
  ],
  [
    "Private journal",
    "Use an established authentication library to register, sign in, and manage private entries.",
    24,
    [
      "Register, sign in, and sign out",
      "Create and list private journal entries",
      "Prevent access to another user's entries on every endpoint",
    ],
    [
      "Choose an established auth library and integrate registration, sessions, and private entries. Document the trust boundaries.",
      "Build labelled auth forms and private-entry screens with expired-session handling.",
      "Use the selected library for sessions; enforce ownership and server validation on every journal endpoint.",
      "Model users/entries and test two-user isolation, unauthenticated requests, and session expiry.",
      "Document server-only secrets, secure deployment settings, automated checks, and backup/restore steps.",
    ],
  ],
];

export const projectLevels = entries.map(
  ([name, description, hours, criteria, work], i) => ({
    _id: `project_${i + 1}`,
    number: i + 1,
    name,
    description,
    hours,
    criteria,
    baseXp: 100 + i * 25,
    baseTrophies: 50 + i * 10,
    tasks: teamRoles.map((role, index) => ({
      targetRole: role.code,
      title: `${name} · ${role.label}`,
      instructions: work[index],
      acceptanceCriteria: `${work[index]} Submit a completion summary and 1–10 evidence references (repository, pull request, test output, or demo). The delivered project must satisfy: ${criteria.join("; ")}.`,
    })),
  }),
);

export function projectRecipients(level, players) {
  return level.tasks.map((task) => {
    const matches = players.filter(
      (p) =>
        p.active !== false &&
        p.role === "GAMER" &&
        playerRole(p) === task.targetRole,
    );
    if (matches.length !== 1)
      throw new Error(
        `Your team needs exactly one active ${teamRoles.find((r) => r.code === task.targetRole).label}; found ${matches.length}. Ask the Council to fix the roster.`,
      );
    return { ...task, assigneeId: matches[0]._id };
  });
}

// A project day is eight working hours, Monday–Friday, 09:00–17:00 IST.
export function addProjectHours(value, hours) {
  let remaining = hours * 3600000;
  let cursor = +new Date(value);
  if (!Number.isFinite(cursor) || !Number.isFinite(hours) || hours < 0)
    throw new Error("Invalid project time.");
  while (remaining > 0) {
    const local = new Date(cursor + 330 * 60000);
    const day = local.getUTCDay();
    const midnight =
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate(),
      ) -
      330 * 60000;
    const start = midnight + 9 * 3600000;
    const end = midnight + 17 * 3600000;
    if (day === 0 || day === 6 || cursor >= end) {
      cursor = midnight + 86400000;
      continue;
    }
    cursor = Math.max(cursor, start);
    const used = Math.min(remaining, end - cursor);
    remaining -= used;
    cursor += used;
  }
  return new Date(cursor);
}

export function projectStars(submittedAt, dueAt, lateUntil) {
  return +new Date(submittedAt) <= +new Date(dueAt)
    ? 3
    : +new Date(submittedAt) <= +new Date(lateUntil)
      ? 2
      : 1;
}

export function contributionScore(scores) {
  const weights = {
    quality: 40,
    verification: 25,
    timeliness: 20,
    collaboration: 15,
  };
  for (const key of Object.keys(weights))
    if (
      !Number.isInteger(scores?.[key]) ||
      scores[key] < 0 ||
      scores[key] > weights[key]
    )
      throw new Error(`${key} must be an integer from 0 to ${weights[key]}.`);
  const total = Object.keys(weights).reduce((sum, key) => sum + scores[key], 0);
  if (total < 1)
    throw new Error("An accepted contribution must score at least 1 point.");
  return total;
}

export function projectReward(level, stars, score) {
  if (
    ![1, 2, 3].includes(stars) ||
    !Number.isFinite(score) ||
    score < 1 ||
    score > 100
  )
    throw new Error("Invalid project reward.");
  const factor = ([0, 1, 1.25, 1.5][stars] * score) / 100;
  return {
    xp: Math.round(level.baseXp * factor),
    trophies: Math.round(level.baseTrophies * factor),
  };
}
