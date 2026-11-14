import test from "node:test";
import assert from "node:assert/strict";
import { flightProgress } from "../lib/flight-progression.js";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { validateDayContent } from "../lib/week-one-program-rules.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

test("starter packs are valid, all five levels stay sequential and incomplete quiz answers do not complete a level", () => {
  const original = fixtureConfig();
  const days = [
    { day: 1, state: "PREPARED", content: original },
    ...[2, 3, 4, 5].map((day) => ({
      day,
      state: "PREPARED",
      content: validateDayContent(
        day,
        starterFlightContent(day, original),
        original,
      ),
    })),
  ];
  let progress = flightProgress(days, {
    levelOne: { automatic: { completed: true, stars: 1 } },
  });
  assert.equal(progress[1].available, true);
  assert.equal(progress[2].available, false);
  const rows = days
    .slice(1)
    .flatMap((day) =>
      day.content.activities.map((activity) => ({
        activityId: activity.id,
        data: {
          activity,
          submittedAt: "saved",
          submissions: [
            {
              complete: true,
              answers:
                activity.kind === "QUIZ"
                  ? Object.fromEntries(activity.questions.map((q) => [q.id, 0]))
                  : {},
            },
          ],
        },
      })),
    );
  progress = flightProgress(
    days,
    { levelOne: { automatic: { completed: true, stars: 1 } } },
    rows,
  );
  assert.equal(progress[4].completed, true);
  delete rows.at(-1).data.submissions[0].answers.q15;
  assert.equal(
    flightProgress(
      days,
      { levelOne: { automatic: { completed: true, stars: 1 } } },
      rows,
    )[4].completed,
    false,
  );
  assert.equal(
    flightProgress(
      days,
      { levelOne: { override: { completed: false } } },
      rows,
    )[1].available,
    false,
  );
});
