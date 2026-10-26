import { models, connect } from "./db.js";
import { personas, teams } from "./catalog.js";
import { migrateRewards } from "./reward-migration.js";
export async function seed() {
  await connect();
  await migrateRewards();
  for (const model of Object.values(models)) await model.init();
  await models.Cohort.updateOne(
    { _id: "alpha" },
    {
      $setOnInsert: {
        name: "Alpha Cohort 2026",
        college: "Titan Institute of Technology",
        startDate: "2026-10-24",
        currentWeek: 1,
        shift: "09:00–18:00 IST",
        scenario: "Apex Financial High-Throughput Ledger System",
      },
    },
    { upsert: true },
  );
  for (const team of teams)
    await models.Team.updateOne(
      { _id: team._id },
      { $setOnInsert: team },
      { upsert: true },
    );
  for (const p of personas)
    await models.User.updateOne(
      { _id: p._id },
      { $setOnInsert: p },
      { upsert: true },
    );
  const templates = [
    [
      "Build the customer dashboard",
      "Create an accessible overview of balances and recent transfers.",
      "In Progress",
      "HIGH",
      1,
    ],
    [
      "Implement double-entry transfers",
      "Validate sufficient funds and preserve ledger balance in one transaction.",
      "Backlog",
      "CRITICAL",
      2,
    ],
    [
      "Test the zero-negative invariant",
      "Cover rejected transfers, decimal precision, and conservation of funds.",
      "Backlog",
      "HIGH",
      3,
    ],
    [
      "Ship the deployment pipeline",
      "Configure checks, protect credentials, and document rollback.",
      "Backlog",
      "MEDIUM",
      4,
    ],
    [
      "Design the transaction history",
      "Build responsive transaction filters and readable receipts.",
      "Review",
      "MEDIUM",
      0,
    ],
    [
      "Write the API contract",
      "Document request validation, errors, and idempotency keys.",
      "Backlog",
      "MEDIUM",
      0,
    ],
  ];
  for (let ti = 0; ti < 5; ti++)
    for (let i = 0; i < templates.length; i++) {
      const [title, description, status, priority, assignee] = templates[i];
      const id = `quest_${ti}_${i}`;
      await models.Task.updateOne(
        { _id: id },
        {
          $setOnInsert: {
            teamId: teams[ti]._id,
            assigneeId: personas[ti * 5 + assignee]._id,
            title,
            description,
            status,
            priority,
            dueAt: new Date(Date.now() + (i + 1) * 86400000),
            dependencyId: i === 2 ? `quest_${ti}_1` : undefined,
            xp: i === 1 ? 20 : 10,
          },
        },
        { upsert: true },
      );
    }
}
