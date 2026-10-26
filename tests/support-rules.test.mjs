import test from "node:test";
import assert from "node:assert/strict";
import {
  workingDueAt,
  validateCalendar,
  weightedAssessment,
  remainingWorkingMinutes,
} from "../lib/support-rules.js";
import { hashPassword, checkPassword } from "../lib/password.js";
const calendar = {
  timeZone: "Asia/Kolkata",
  startMinute: 540,
  weekdays: [1, 2, 3, 4, 5],
  holidays: [],
};
test("AT05: 16:30 assignment rolls over to 09:30 next working day", () => {
  assert.equal(
    workingDueAt("2026-10-26T16:30:00+05:30", calendar).toISOString(),
    "2026-10-27T04:00:00.000Z",
  );
  assert.equal(
    remainingWorkingMinutes(
      "2026-10-26T16:45:00+05:30",
      "2026-10-27T09:30:00+05:30",
      calendar,
    ),
    45,
  );
  assert.equal(
    remainingWorkingMinutes(
      "2026-10-27T10:00:00+05:30",
      "2026-10-27T09:30:00+05:30",
      calendar,
    ),
    0,
  );
  assert.equal(
    workingDueAt("2026-10-26T16:30:00+05:30", {
      ...calendar,
      holidays: ["2026-10-27"],
    }).toISOString(),
    "2026-10-28T04:00:00.000Z",
  );
});
test("after hours, weekends, exact boundaries and seconds preserve working time", () => {
  assert.equal(
    workingDueAt("2026-10-30T19:30:00+05:30", calendar).toISOString(),
    "2026-11-02T04:30:00.000Z",
  );
  assert.equal(
    workingDueAt("2026-10-26T16:00:00+05:30", calendar).toISOString(),
    "2026-10-26T11:30:00.000Z",
  );
  assert.equal(
    workingDueAt("2026-10-26T16:30:15+05:30", calendar).toISOString(),
    "2026-10-27T04:00:15.000Z",
  );
  assert.equal(
    workingDueAt("2026-10-26T17:00:00+05:30", calendar).toISOString(),
    "2026-10-27T04:30:00.000Z",
  );
});
test("cohort calendars support other timezones and shifts", () => {
  assert.equal(
    workingDueAt("2026-10-26T18:30:00-04:00", {
      ...calendar,
      timeZone: "America/New_York",
      startMinute: 660,
    }).toISOString(),
    "2026-10-27T15:30:00.000Z",
  );
  assert.throws(() => validateCalendar({ ...calendar, timeZone: undefined }));
  assert.throws(() => validateCalendar({ ...calendar, timeZone: "Not/AZone" }));
  assert.throws(() => validateCalendar({ ...calendar, weekdays: [] }));
  assert.throws(() => validateCalendar({ ...calendar, startMinute: 1100 }));
  assert.throws(() =>
    validateCalendar({ ...calendar, holidays: ["2026-02-30"] }),
  );
});
test("AT13: 40/20/25/15 rubric preserves unobserved dimensions", () => {
  assert.equal(weightedAssessment([100, 100, 100, 100]), 100);
  assert.equal(weightedAssessment([80, 60, 100, 40]), 75);
  assert.equal(weightedAssessment([80, null, 100, 40]), null);
  assert.throws(() => weightedAssessment([101, 60, 100, 40]));
  assert.throws(() => weightedAssessment([80, 60, 100]));
});
test("individual credentials use salted hashes and reject incorrect passwords", async () => {
  const hash = await hashPassword("test-password-123");
  assert.notEqual(hash, await hashPassword("test-password-123"));
  assert.equal(await checkPassword("test-password-123", hash), true);
  assert.equal(await checkPassword("wrong-password", hash), false);
  assert.equal(await checkPassword("test-password-123", "invalid"), false);
  await assert.rejects(hashPassword("short"));
});
