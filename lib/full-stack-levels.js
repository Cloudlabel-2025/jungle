import { characters, disciplines, characterKey } from "./characters.js";

// Each row is one complete vertical feature, owned by one character for the whole level.
const features = [
  [
    [
      "announcements",
      "Announcements",
      "Save and list one-line team announcements; reject blank text.",
    ],
    [
      "questions",
      "Question wall",
      "Save and list one-line questions; reject blank text.",
    ],
    ["ideas", "Idea wall", "Save and list one-line ideas; reject blank text."],
    [
      "wins",
      "Small wins",
      "Save and list one-line team wins; reject blank text.",
    ],
    [
      "resources",
      "Resource wall",
      "Save and list one-line resource descriptions; reject blank text.",
    ],
  ],
  [
    [
      "suggestions",
      "Suggestions",
      "Submit and list anonymous suggestions with a required title and description.",
    ],
    [
      "issues",
      "Issue reports",
      "Submit and list anonymous issue reports with a required title and description.",
    ],
    [
      "requests",
      "Resource requests",
      "Submit and list requests with a required resource name and reason.",
    ],
    [
      "questions",
      "Ask the team",
      "Submit and list questions with a required subject and question body.",
    ],
    [
      "kudos",
      "Team kudos",
      "Submit and list appreciation cards with a required recipient name and message.",
    ],
  ],
  [
    [
      "notes",
      "Quick notes",
      "Create, list and delete plain-text notes with a delete confirmation.",
    ],
    [
      "bookmarks",
      "Saved references",
      "Create, list and delete a title plus reference URL; validate the URL.",
    ],
    [
      "decisions",
      "Decision log",
      "Create, list and delete short decisions with their reason.",
    ],
    [
      "reminders",
      "Reminders",
      "Create, list and delete reminders with a title and due date.",
    ],
    [
      "checklists",
      "Checklist items",
      "Create, list and delete individual checklist items with a title.",
    ],
  ],
  [
    [
      "people",
      "People",
      "Create, read, update and delete contacts with name and email validation.",
    ],
    [
      "companies",
      "Companies",
      "Create, read, update and delete companies with name and contact email.",
    ],
    [
      "groups",
      "Contact groups",
      "Create, read, update and delete named groups with a description.",
    ],
    [
      "venues",
      "Meeting places",
      "Create, read, update and delete venues with name and address.",
    ],
    [
      "emergency",
      "Emergency contacts",
      "Create, read, update and delete fictional emergency contacts with name and phone.",
    ],
  ],
  [
    [
      "books",
      "Books",
      "Save title and author, persist read/unread status, and filter by status.",
    ],
    [
      "articles",
      "Articles",
      "Save title and reference URL, persist read/unread status, and filter by status.",
    ],
    [
      "courses",
      "Courses",
      "Save title and provider, persist planned/completed status, and filter by status.",
    ],
    [
      "podcasts",
      "Podcasts",
      "Save episode title and host, persist queued/listened status, and filter by status.",
    ],
    [
      "papers",
      "Research papers",
      "Save title and author, persist unread/reviewed status, and filter by status.",
    ],
  ],
  [
    [
      "expenses",
      "Expense entries",
      "Save positive expense amounts in integer minor units with category; list entries and a server-calculated total.",
    ],
    [
      "income",
      "Income entries",
      "Save positive fictional income amounts in integer minor units with source; list entries and an accurate total.",
    ],
    [
      "budgets",
      "Category budgets",
      "Save and edit positive category budget limits in integer minor units; reject duplicate categories.",
    ],
    [
      "reimbursements",
      "Reimbursement log",
      "Save positive reimbursement amounts, purpose and pending/paid status; filter entries and calculate pending totals.",
    ],
    [
      "reports",
      "Saved spending reports",
      "Save a named date-range report, query expense totals for that range, and reject reversed date ranges.",
    ],
  ],
  [
    [
      "supplies",
      "Supply catalogue",
      "Create supplies with quantity and low-stock threshold; safely adjust stock without allowing negative quantities.",
    ],
    [
      "requests",
      "Supply requests",
      "Create item requests with positive quantity and track pending/fulfilled status without double-fulfilling.",
    ],
    [
      "deliveries",
      "Incoming deliveries",
      "Record deliveries with positive quantity and received/pending status; apply stock changes exactly once.",
    ],
    [
      "allocations",
      "Equipment checkout",
      "Check an available item out to a named member and return it; prevent duplicate active checkout.",
    ],
    [
      "alerts",
      "Stock alerts",
      "Save threshold preferences, list low-stock items, and acknowledge alerts with persistent state.",
    ],
  ],
  [
    [
      "tasks",
      "Task workflow",
      "Create tasks assigned to valid members and persist todo/doing/done transitions.",
    ],
    [
      "milestones",
      "Milestones",
      "Create milestones with due dates; link tasks, reject missing references, and report completion.",
    ],
    [
      "comments",
      "Task discussions",
      "Create and list comments linked to existing tasks; validate member and task references.",
    ],
    [
      "labels",
      "Labels and filtering",
      "Create unique labels, attach them to tasks, and persist label-filtered views.",
    ],
    [
      "workload",
      "Workload planner",
      "Save each member's capacity, query assigned unfinished tasks, and show over-capacity warnings.",
    ],
  ],
  [
    [
      "workshops",
      "Workshop catalogue",
      "Create and list workshops with positive capacity and remaining seats; reject reducing capacity below booked seats.",
    ],
    [
      "registrations",
      "Registration",
      "Register a participant only once and prevent overbooking, including concurrent final-seat requests.",
    ],
    [
      "waitlist",
      "Waitlist",
      "Join a full workshop's waitlist once and promote the earliest eligible participant when a seat becomes free.",
    ],
    [
      "checkin",
      "Participant check-in",
      "Persist check-in for a valid registration, reject duplicates, and show a workshop attendance summary.",
    ],
    [
      "cancellations",
      "Cancellation and seats",
      "Cancel a valid booking idempotently, release a seat once, and integrate with the waitlist.",
    ],
  ],
  [
    [
      "auth",
      "Accounts and sessions",
      "Use an established authentication library for registration, sign-in and sign-out; persist a profile and verify session expiry.",
    ],
    [
      "entries",
      "Private journal entries",
      "Create, list, edit and delete entries, enforcing session and ownership checks on every operation.",
    ],
    [
      "tags",
      "Private tags",
      "Create private tags, attach them to owned entries and filter; reject cross-account entry and tag references.",
    ],
    [
      "search",
      "Private search preferences",
      "Persist private search preferences and search only the current user's entries with validated pagination.",
    ],
    [
      "archive",
      "Private archive",
      "Archive and restore owned entries idempotently; persist private archive preferences and prevent cross-account access.",
    ],
  ],
];
export function fullStackLevel(legacy) {
  const rows = features[legacy.number - 1];
  if (!rows) return legacy;
  const featureDefinitions = rows.map(([key, name, objective], i) => ({
    key,
    name,
    objective,
    characterKey: characters[i].key,
  }));
  const tasks = tasksForFeatures(featureDefinitions);
  return {
    ...legacy,
    learningMode: "FULL_STACK",
    description: `Build one shared ${legacy.name.toLowerCase()}. Each player owns a different feature through frontend, backend, database, testing and deployment. ${legacy.description}`,
    features: featureDefinitions,
    criteria: featureDefinitions.map((f) => `${f.name}: ${f.objective}`),
    tasks,
  };
}
export function tasksForFeatures(featureDefinitions) {
  return featureDefinitions.flatMap((feature) =>
    disciplines.map((discipline) => {
      const path = `/api/${feature.key}`;
      const instructions = {
        FRONTEND: `Build accessible controls and a list/view for ${feature.name}. Include loading, empty, validation and request-error states. Connect to ${path}. ${feature.objective}`,
        BACKEND: `Implement the ${path} endpoint(s) needed for ${feature.name}, agree request/response contracts, validate all input on the server and return useful errors. ${feature.objective}`,
        DATABASE: `Define and persist the records needed for ${feature.name}, with validated fields, stable identifiers and timestamps. Verify state survives reload and enforce required constraints. ${feature.objective}`,
        TESTING: `Verify the complete ${feature.name} journey from UI through API to database. Cover successful work, invalid input, empty states and persistence; add boundary, concurrency or ownership checks required here. ${feature.objective}`,
        DEPLOYMENT: `Integrate ${feature.name} into the team's shared app and run its end-to-end smoke check from a fresh setup. Document routes, sample data and environment names without secrets. Demonstrate your feature in the team's running build. ${feature.objective}`,
      }[discipline.code];
      return {
        targetRole: `${feature.characterKey}:${discipline.code}`,
        targetCharacter: feature.characterKey,
        featureId: feature.key,
        featureName: feature.name,
        discipline: discipline.code,
        title: `${feature.name} · ${discipline.label}`,
        instructions,
        acceptanceCriteria: `${feature.objective} Show evidence for your ${discipline.label.toLowerCase()} contribution: repository/PR, test output or running demo. Explain how it connects to the other layers; all of your five tasks must be reviewed.`,
      };
    }),
  );
}
export function fullStackRecipients(level, players) {
  const active = players.filter(
    (p) => p.active !== false && p.role === "GAMER",
  );
  if (active.length !== 5)
    throw new Error(
      `Your team needs exactly five active players; found ${active.length}. Ask Centre Command to fix the roster.`,
    );
  return level.tasks.map((task) => {
    const matches = active.filter(
      (p) => characterKey(p) === task.targetCharacter,
    );
    if (matches.length !== 1)
      throw new Error(
        `Your team needs one ${characters.find((c) => c.key === task.targetCharacter)?.label || task.targetCharacter} character; found ${matches.length}. Ask Centre Command to fix the roster.`,
      );
    return { ...task, assigneeId: matches[0]._id };
  });
}
