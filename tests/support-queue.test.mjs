import test from "node:test";
import assert from "node:assert/strict";
import { filterSupportTickets, supportQueueCounts, supportTicketOverdue } from "../lib/support-queue.js";
import { supportConsoleFixture } from "./support-console-fixture.mjs";

test("support queue counts active work and keeps historical breaches out of current overdue requests", () => {
  const { tickets } = supportConsoleFixture().support;
  assert.deepEqual(supportQueueCounts(tickets), { open: 6, unassigned: 3, overdue: 1 });
  assert.equal(supportTicketOverdue({ state: "RESPONDED", firstResponseAt: "2026-11-26", breachedAt: "2026-11-25" }), false);
  assert.equal(supportTicketOverdue({ state: "CLOSED", breachedAt: "2026-11-25" }), false);
  assert.equal(supportTicketOverdue({ state: "ASSIGNED", remainingWorkingMinutes: -2 }), true);
});
test("ticket filters search descriptions, tags and authorised people without mutating the snapshot", () => {
  const { tickets } = supportConsoleFixture().support;
  const original = structuredClone(tickets);
  assert.equal(filterSupportTickets(tickets, { filter: "closed" }).length, 2);
  assert.equal(filterSupportTickets(tickets, { filter: "overdue" }).length, 1);
  assert.equal(filterSupportTickets(tickets, { filter: "unassigned" }).length, 3);
  assert.deepEqual(filterSupportTickets(tickets, { query: "  MONGODB " }).map(row => row._id), ["support-1"]);
  assert.equal(filterSupportTickets(tickets, { query: "Priya", names: { "learner-2": "Priya" } }).length, 3);
  assert.deepEqual(tickets, original);
});
test("queue prioritises overdue and escalated requests, then unassigned requests, with stable ordering", () => {
  const { tickets } = supportConsoleFixture().support;
  tickets[2].escalated = true;
  const ordered = filterSupportTickets(tickets);
  assert.deepEqual(ordered.slice(0, 3).map(row => row._id), ["support-1", "support-3", "support-4"]);
  assert.deepEqual(filterSupportTickets([], { filter: "all" }), []);
});
