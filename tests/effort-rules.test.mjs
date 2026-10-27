import test from "node:test";
import assert from "node:assert/strict";
import {
  activeMinutes,
  comparisonTotals,
  durationLabel,
  overlaps,
} from "../lib/effort-rules.js";
const period = (start, end, kind = "ACTIVE") => ({
  startedAt: `2026-10-26T${start}:00Z`,
  endedAt: end ? `2026-10-26T${end}:00Z` : null,
  sessionKind: kind,
});
test("AT16: completed active effort includes failed investigation, excludes waiting, blocked, running and removed periods", () => {
  assert.equal(
    activeMinutes([
      period("01:00", "04:00"),
      period("05:00", "09:00"),
      period("09:00", "10:00", "WAITING"),
      period("10:00", "11:00", "BLOCKED"),
      period("11:00", null),
      { ...period("12:00", "13:00"), deletedAt: new Date() },
    ]),
    420,
  );
});
test("AT17–19: signed verified totals include negatives and zero, exclude pending/rejected/unlinked", () => {
  const totals = comparisonTotals([
    { status: "VERIFIED", deltaMinutes: 360 },
    { status: "VERIFIED", deltaMinutes: -60 },
    { status: "VERIFIED", deltaMinutes: 0 },
    { status: "PENDING", deltaMinutes: 999 },
    { status: "REJECTED", deltaMinutes: 999 },
    { status: "VERIFIED", deltaMinutes: 999, deletedAt: new Date() },
  ]);
  assert.deepEqual(totals, {
    sampleCount: 3,
    deltaMinutes: 300,
    pendingCount: 1,
    rejectedCount: 1,
  });
  assert.equal(durationLabel(360, true), "+6h 0m");
  assert.equal(durationLabel(-60, true), "−1h 0m");
  assert.equal(durationLabel(0, true), "0h 0m");
});
test("AT19: cross-ticket overlaps and open timers conflict; adjacent periods are allowed", () => {
  assert.equal(
    overlaps(period("01:00", "03:00"), period("02:00", "04:00")),
    true,
  );
  assert.equal(
    overlaps(period("01:00", "03:00"), period("03:00", "04:00")),
    false,
  );
  assert.equal(overlaps(period("01:00", null), period("12:00", "13:00")), true);
});
