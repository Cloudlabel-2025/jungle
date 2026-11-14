import { activities } from "./week-one-catalog.js";
import { effectiveLevelOne } from "./level-one-rules.js";
import { effectiveFlightLevel, scoreFlightLevel } from "./week-one-level-rules.js";

export const completionBased = (program) =>
  program?.progressionMode === "COMPLETION";
export function flightProgress(days, dayOne, attempts = [], levelRows = []) {
  let previousComplete = true;
  return [1, 2, 3, 4, 5].map((day) => {
    const content = days.find((d) => d.day === day);
    const required = activities.filter((a) => a.day === day).map((a) => a.id);
    const ready = Boolean(
      content?.content &&
      ["PREPARED", "OPEN", "CLOSED"].includes(content.state) &&
      (day === 1 ||
        required.every((id) =>
          content.content.activities?.some((a) => a.id === id),
        )),
    );
    const savedLevel = levelRows.find((r) => r.day === day)?.data;
    const result = day === 1 ? effectiveLevelOne(dayOne?.levelOne) : effectiveFlightLevel(savedLevel) || scoreFlightLevel(day, attempts);
    const retained =
      dayOne?.levelOne?.practice &&
      dayOne.levelOne.creditedTrophies > 0 &&
      dayOne.levelOne.history?.some((h) => h.result?.completed);
    const completed = day > 1 && savedLevel ? Boolean(result?.completed) :
      day === 1
        ? Boolean(
            result?.completed ||
            retained ||
            (!dayOne?.levelOne &&
              dayOne?.submissions?.length &&
              dayOne?.verification?.status === "VERIFIED"),
          )
        : required.length > 0 &&
          required.every((id) => {
            const record = attempts.find((a) => a.activityId === id),
              d = record?.data;
            const submitted = d?.submissions?.at(-1);
            if (!submitted || !d.submittedAt) return false;
            if (d.activity.kind === "QUIZ")
              return (
                d.activity.questions?.length > 0 &&
                d.activity.questions.every((q) =>
                  Number.isInteger(submitted.answers?.[q.id]),
                )
              );
            return submitted.complete === true;
          });
    const available = ready && previousComplete;
    const level = {
      day,
      ready,
      completed,
      available,
      open: available && (!completed || savedLevel?.replayPending || savedLevel?.practice),
      stars: result?.completed ? result.stars || 0 : 0,
      result,
      creditedTrophies: savedLevel?.creditedTrophies || 0,
      creditedXp: savedLevel?.creditedXp || 0,
      replayPending: Boolean(savedLevel?.replayPending),
      practice: Boolean(savedLevel?.practice),
      state: available ? (completed && !savedLevel?.replayPending && !savedLevel?.practice ? "CLOSED" : "OPEN") : "LOCKED",
      status: !previousComplete
        ? `Complete Level ${day - 1} first`
        : !ready
          ? "Mission content is being prepared"
          : completed
            ? "Level completed"
            : "Ready to play",
      requiredActivities: required,
    };
    previousComplete = previousComplete && completed;
    return level;
  });
}
