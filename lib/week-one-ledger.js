import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { professionalScore } from "./week-one-program-rules.js";

const timely = (at, deadline) =>
  Boolean(at && deadline && Date.parse(at) <= Date.parse(deadline));
export function dayRewards(day, observation, attempts, discovery) {
  const result = {
    clock: timely(observation.clockAt, day.officialStart) ? 1 : 0,
    agenda: timely(
      observation.agendaAcknowledgedAt,
      new Date(Date.parse(day.officialStart) + 30 * 60000).toISOString(),
    )
      ? 4
      : 0,
    recap1: timely(
      observation.recaps?.["1"],
      day.recaps?.find((r) => r.session === 1)?.deadline,
    )
      ? 4
      : 0,
    recap2: timely(
      observation.recaps?.["2"],
      day.recaps?.find((r) => r.session === 2)?.deadline,
    )
      ? 4
      : 0,
    eod: timely(observation.eod?.at, day.scheduledEnd) ? 4 : 0,
  };
  if (day.day < 5) {
    for (const kind of ["GENERAL", "TECHNICAL"])
      result[kind.toLowerCase()] = attempts.some(
        (a) => a.data.activity.kind === kind && a.data.firstQualifyingAt,
      )
        ? 6
        : 0;
    result.discovery =
      discovery?.data.review?.genuine &&
      timely(discovery.data.submittedAt, day.scheduledEnd)
        ? 1
        : 0;
  } else {
    const fitness = attempts.find((a) => a.activityId === "D5-F01"),
      quiz = attempts.find((a) => a.activityId === "D5-Q01");
    result.fitness = fitness?.data.firstQualifyingAt ? 6 : 0;
    result.quiz = quiz?.data.submittedAt ? 4 : 0;
    result.reflection = fitness?.data.submissions?.at(-1)?.answers.reflection
      ? 3
      : 0;
  }
  return result;
}
export async function reconcileTrophies(ctx, record) {
  const attempts = await models.WeekOneAttempt.find({
    cohortId: ctx.cohortId,
    userId: record.userId,
  })
    .session(ctx.session)
    .lean();
  for (const day of ctx.release.days.filter(
    (d) => d.day > 1 && ["OPEN", "CLOSED"].includes(d.state),
  )) {
    const observation = record.data.days[day.day] || {};
    const daily = attempts.filter((a) => a.day === day.day);
    const rewards = dayRewards(
      day,
      observation,
      daily,
      daily.find((a) => a.activityId === `D${day.day}-DISCOVERY`),
    );
    for (const [rule, amount] of Object.entries(rewards)) {
      const key = `day${day.day}:${rule}`;
      const earned = record.data.ledger
        .filter((e) => e.key === key)
        .reduce((n, e) => n + e.amount, 0);
      if (earned !== amount)
        record.data.ledger.push({
          id: randomUUID(),
          key,
          day: day.day,
          rule,
          amount: amount - earned,
          actorId: ctx.user._id,
          at: ctx.at,
          version: "week1-v1",
          evidence: `${record._id}:${day.day}:${rule}`,
        });
    }
  }
}
export function professionalEvidence(
  release,
  learner,
  attempts,
  day1,
  program,
) {
  const state = learner?.data || { days: {}, exceptions: {}, ruleAcks: {} };
  return professionalScore(
    release.days
      .filter((d) => d.state === "CLOSED")
      .map((day) => {
        const d = day.day === 1 ? day1?.data || {} : state.days[day.day] || {};
        const exception = state.exceptions?.[day.day] || {};
        const events = [],
          add = (id, met, evidence) =>
            events.push({
              id,
              met: Boolean(met),
              evidence,
              excused: Boolean(exception.excluded?.includes(id)),
            });
        add("clock", timely(d.clockAt, day.officialStart), d.clockAt);
        add(
          "agenda",
          timely(
            d.agendaAcknowledgedAt,
            new Date(Date.parse(day.officialStart) + 30 * 60000).toISOString(),
          ),
          d.agendaAcknowledgedAt,
        );
        add("eod", timely(d.eod?.at, day.scheduledEnd), d.eod?.at);
        if (day.day === 1) {
          const s = d.submissions?.at(-1);
          add(
            "research",
            s &&
              timely(
                s.at,
                d.deadline ||
                  new Date(Date.parse(d.startedAt) + 90 * 60000).toISOString(),
              ),
            s?.id,
          );
        } else {
          for (const recap of day.recaps || [])
            add(
              `recap${recap.session}`,
              timely(d.recaps?.[recap.session], recap.deadline),
              d.recaps?.[recap.session],
            );
          for (const activity of day.content.activities || []) {
            const a = attempts.find((a) => a.activityId === activity.id);
            add(
              activity.id,
              activity.kind === "QUIZ"
                ? Boolean(a?.data.submittedAt)
                : Boolean(a?.data.firstQualifyingAt),
              a?._id,
            );
          }
        }
        const rules = program.rules.filter(
          (r) => Date.parse(r.publishedAt) <= Date.parse(day.scheduledEnd),
        );
        const applicable = rules.at(-1);
        if (
          applicable &&
          (day.day === 1 ||
            Date.parse(applicable.publishedAt) >= Date.parse(day.officialStart))
        )
          add(
            "rules",
            timely(state.ruleAcks?.[applicable.version]?.at, day.scheduledEnd),
            `rules:${applicable.version}`,
          );
        const group = program.groups.find((g) =>
          g.members.includes(learner?.userId || day1?.userId),
        );
        const round = program.rounds
          .filter((r) => r.day === day.day && r.groupId === group?.id)
          .at(-1);
        if (
          round?.closedAt &&
          (round.round === 2 ||
            round.ballots.some(
              (b) => b.userId === (learner?.userId || day1?.userId),
            ))
        )
          add(
            "ballot",
            round.ballots.some(
              (b) => b.userId === (learner?.userId || day1?.userId),
            ),
            round.id,
          );
        const discovery = attempts.find(
          (a) => a.activityId === `D${day.day}-DISCOVERY`,
        );
        return {
          day: day.day,
          events,
          excused: exception.excused,
          agendaMissing: !d.agendaViewedAt && !d.agendaAcknowledgedAt,
          discoveryRequired:
            day.day > 1 && day.day < 5 && Boolean(day.content.discovery),
          discoveryAttempted: Boolean(
            discovery?.data.review?.genuine &&
            timely(
              discovery.data.firstEvidenceAt || discovery.data.submittedAt,
              day.scheduledEnd,
            ),
          ),
          discoveryExcused: Boolean(exception.discoveryExcused),
        };
      }),
  );
}
