import { criteria, activities } from "./week-one-catalog.js";
import { fail, requiredText, threadUrl } from "./day-one-rules.js";
import {
  fraction,
  sum,
  times,
  over,
  plus,
  numeric,
  stored,
  atLeast,
} from "./week-one-fractions.js";

export const defaultSettings = () => ({
  version: 1,
  weights: {
    fitness: 50,
    general: 15,
    technical: 12,
    quiz: 3,
    showcase: 10,
    professional: 10,
  },
  clearance: 60,
  distinction: 92,
  specialist: 92,
  calendar: {
    timeZone: "Asia/Kolkata",
    startMinute: 540,
    weekdays: [1, 2, 3, 4, 5],
    holidays: [],
  },
  compassQuestions: [],
  awardDefinitions: [],
  rescueSlots: [],
});
export const blankProgram = () => ({
  settings: defaultSettings(),
  rules: [],
  faq: [],
  groups: [],
  rounds: [],
  challenges: [],
  teamRequests: [],
  specialistReviews: [],
  publications: [],
});
export const finite = (n, min, max, label) => {
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
    fail(`${label} must be between ${min} and ${max}.`);
  return n;
};
export function iso(value, label) {
  if (
    typeof value !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(`Set ${label} with an explicit time zone.`);
  return new Date(value).toISOString();
}
export const safeId = (value, label = "ID") => {
  const id = requiredText(value, label, 1, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(id))
    fail(`${label} may use letters, numbers, hyphens and underscores.`);
  return id;
};
export function validateSettings(raw) {
  const d = defaultSettings(),
    c = structuredClone(raw);
  if (!c || typeof c !== "object") fail("Supply organisation settings.");
  if (
    !c.weights ||
    Object.keys(c.weights).sort().join() !==
      Object.keys(d.weights).sort().join()
  )
    fail("Supply all six readiness weights.");
  for (const [key, n] of Object.entries(c.weights)) finite(n, 0, 100, key);
  if (
    Math.abs(Object.values(c.weights).reduce((a, b) => a + b, 0) - 100) > 1e-9
  )
    fail("Readiness weights must sum to 100.");
  finite(c.clearance, 0, 100, "Clearance");
  finite(c.distinction, c.clearance, 100, "Distinction");
  finite(c.specialist, 0, 100, "Specialist threshold");
  if (
    !Array.isArray(c.compassQuestions) ||
    (c.compassQuestions.length !== 0 && c.compassQuestions.length !== 3)
  )
    fail(
      "Supply exactly three curriculum-approved Compass Check prompts, or leave them unconfigured.",
    );
  c.compassQuestions = c.compassQuestions.map((q) =>
    requiredText(q, "Compass prompt", 5, 500),
  );
  if (
    !Array.isArray(c.awardDefinitions) ||
    (c.awardDefinitions.length &&
      (c.awardDefinitions.length !== 13 ||
        c.awardDefinitions.filter((a) => a.category === "SKILL").length !== 5 ||
        c.awardDefinitions.filter((a) => a.category === "GROWTH").length !== 8))
  )
    fail("Configure five Skill and eight Growth award definitions.");
  c.awardDefinitions = c.awardDefinitions.map((a) => ({
    id: safeId(a.id),
    name: requiredText(a.name, "Award name", 3, 150),
    category: a.category,
    rule: requiredText(a.rule, "Award selection rule", 10, 2000),
  }));
  if (
    new Set(c.awardDefinitions.map((a) => a.id)).size !==
    c.awardDefinitions.length
  )
    fail("Award IDs must be unique.");
  if (!Array.isArray(c.rescueSlots)) fail("Supply approved Saturday slots.");
  c.rescueSlots = c.rescueSlots.map((s) => {
    const start = iso(s.start, "rescue start"),
      end = iso(s.end, "rescue end");
    if (Date.parse(end) - Date.parse(start) !== 3600000)
      fail("Each rescue slot must last one hour.");
    finite(s.capacity, 1, 10000, "Slot capacity");
    if (!Number.isInteger(s.capacity))
      fail("Slot capacity must be an integer.");
    return {
      id: safeId(s.id),
      start,
      end,
      capacity: s.capacity,
      meetingUrl: threadUrl(s.meetingUrl),
      approval: requiredText(
        s.approval,
        "College scheduling approval",
        10,
        2000,
      ),
    };
  });
  if (new Set(c.rescueSlots.map((s) => s.id)).size !== c.rescueSlots.length)
    fail("Rescue slot IDs must be unique.");
  return c;
}
export function emptyDayContent(day) {
  return {
    day,
    timeZone: "Asia/Kolkata",
    officialStart: "",
    closingCutoff: "",
    nudgeAt: "",
    activities: activities
      .filter((a) => a.day === day)
      .map((a) => ({
        id: a.id,
        rubricVersion: `week1-${a.id}-v1`,
        variants: (a.variantNames || []).map((name, i) => ({
          id: `variant-${i + 1}`,
          name,
          brief: "",
          reference: "",
          cards: [],
        })),
        ...(a.kind === "QUIZ"
          ? {
              questions: Array.from({ length: 15 }, (_, i) => ({
                id: `q${i + 1}`,
                question: "",
                options: ["", "", "", ""],
                correct: 0,
              })),
            }
          : {}),
      })),
    ...(day < 5 ? { discovery: { title: "", brief: "" } } : {}),
  };
}
export function validateDayContent(day, raw, original) {
  if (!raw || typeof raw !== "object") fail("Supply versioned day content.");
  const c = {
    day,
    timeZone: requiredText(raw.timeZone, "Time zone", 3, 100),
    officialStart: iso(raw.officialStart, "official start"),
    closingCutoff: iso(raw.closingCutoff, "closing time"),
    activities: [],
  };
  try {
    new Intl.DateTimeFormat("en", { timeZone: c.timeZone }).format();
  } catch {
    fail("Choose a valid IANA time zone.");
  }
  if (Date.parse(c.officialStart) >= Date.parse(c.closingCutoff))
    fail("The day must end after it starts.");
  const expected = activities.filter((a) => a.day === day);
  if (
    !Array.isArray(raw.activities) ||
    raw.activities.length !== expected.length ||
    new Set(raw.activities.map((a) => a.id)).size !== expected.length
  )
    fail("Supply exactly the two approved activities for this day.");
  for (const a of expected) {
    const supplied = raw.activities.find((v) => v.id === a.id);
    if (!supplied) fail(`Missing ${a.id}.`);
    const pack = {
      ...a,
      rubricVersion: requiredText(
        supplied.rubricVersion,
        "Rubric version",
        2,
        100,
      ),
    };
    if (a.kind === "QUIZ") {
      if (
        !Array.isArray(supplied.questions) ||
        supplied.questions.length !== 15
      )
        fail("Configure 15 quiz questions.");
      pack.questions = supplied.questions.map((q) => {
        if (
          !Array.isArray(q.options) ||
          q.options.length < 2 ||
          q.options.length > 6 ||
          !Number.isInteger(q.correct) ||
          q.correct < 0 ||
          q.correct >= q.options.length
        )
          fail("Each quiz question needs one valid keyed answer.");
        const options = q.options.map((v) =>
          requiredText(v, "Answer option", 1, 1000),
        );
        if (new Set(options).size !== options.length)
          fail("Quiz options must be distinct.");
        return {
          id: safeId(q.id),
          question: requiredText(q.question, "Quiz question", 10, 2000),
          options,
          correct: q.correct,
        };
      });
      if (new Set(pack.questions.map((q) => q.id)).size !== 15)
        fail("Question IDs must be unique.");
    } else {
      if (
        !Array.isArray(supplied.variants) ||
        supplied.variants.length !== 4 ||
        new Set(supplied.variants.map((v) => v.id)).size !== 4
      )
        fail(`${a.id} needs four distinct reference packs.`);
      pack.variants = supplied.variants.map((v, i) => {
        const variant = {
          id: safeId(v.id),
          name: requiredText(v.name, "Variant name", 2, 100),
          brief: requiredText(v.brief, "Scenario brief", 20, 12000),
          reference: requiredText(
            v.reference,
            "Reference answer and valid alternatives",
            20,
            16000,
          ),
        };
        if (day === 5) {
          const g = original?.genres.find((g) => g.id === v.id);
          if (!g || v.brief !== g.question)
            fail(
              "Fitness variants must preserve the original Day 1 question IDs and text.",
            );
          variant.name = g.name;
        } else if (v.name !== a.variantNames[i])
          fail(`Keep the approved ${a.id} variant order and names.`);
        if (a.fields.includes("sequence")) {
          if (
            !Array.isArray(v.cards) ||
            v.cards.length < 4 ||
            v.cards.length > 12 ||
            new Set(v.cards).size !== v.cards.length
          )
            fail("Supply distinct component cards for Follow That Click.");
          variant.cards = v.cards.map((v) =>
            requiredText(v, "Component card", 1, 100),
          );
        }
        return variant;
      });
    }
    c.activities.push(pack);
  }
  if (day < 5) {
    c.discovery = {
      title: requiredText(
        raw.discovery?.title,
        "Daily Discovery title",
        3,
        150,
      ),
      brief: requiredText(
        raw.discovery?.brief,
        "Daily Discovery brief",
        20,
        8000,
      ),
    };
    c.nudgeAt = iso(raw.nudgeAt, "midday nudge");
    if (
      Date.parse(c.nudgeAt) < Date.parse(c.officialStart) ||
      Date.parse(c.nudgeAt) > Date.parse(c.closingCutoff)
    )
      fail("The midday nudge must fall within the day.");
  }
  return c;
}
export function publicActivity(a) {
  const { variants, questions, ...rest } = a;
  return {
    ...rest,
    ...(variants ? { variants: variants.map(({ reference, ...v }) => v) } : {}),
    ...(questions
      ? { questions: questions.map(({ correct, ...q }) => q) }
      : {}),
  };
}
export function answersFor(activity, variant, raw, complete = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("Supply structured answer fields.");
  if (activity.kind === "QUIZ")
    return Object.fromEntries(
      activity.questions.map((q) => {
        const answer = raw[q.id] ?? null;
        if (
          answer !== null &&
          (!Number.isInteger(answer) ||
            answer < 0 ||
            answer >= q.options.length)
        )
          fail("Choose a valid quiz option.");
        return [q.id, answer];
      }),
    );
  return Object.fromEntries(
    activity.fields.map((key) => {
      const value = raw[key] ?? (key === "sequence" ? [] : "");
      if (key === "sequence") {
        if (
          !Array.isArray(value) ||
          value.some((v) => !variant.cards.includes(v)) ||
          new Set(value).size !== value.length
        )
          fail("Choose each component card at most once.");
        return [key, value];
      }
      if (typeof value !== "string" || value.length > 8000)
        fail(`${key} must contain at most 8000 characters.`);
      if (key === "url" && value.trim() && complete)
        return [key, threadUrl(value)];
      return [key, value.trim()];
    }),
  );
}
export const completeAnswers = (activity, variant, answers) =>
  activity.kind === "QUIZ" ||
  activity.fields.every((key) =>
    key === "sequence"
      ? answers[key]?.length === variant.cards.length
      : Boolean(answers[key]?.trim()),
  );
export function weightedRatings(keys, ratings) {
  if (
    !ratings ||
    Array.isArray(ratings) ||
    Object.keys(ratings).sort().join() !== [...keys].sort().join()
  )
    fail("Ratings must cover exactly the applicable criteria.");
  const scored = keys.map((key) => {
    const c = criteria.find((c) => c.key === key);
    if (!c) fail("Unknown criterion.");
    return { ...c, rating: finite(ratings[key], 0, 4, c.name) };
  });
  const maximum = scored.reduce((n, c) => n + c.weight, 0);
  const ratio = over(
    sum(scored.map((c) => times(fraction(c.rating), fraction(c.weight)))),
    fraction(4 * maximum),
  );
  return {
    percent: numeric(times(ratio, fraction(100))),
    ratio: stored(ratio),
    maximum,
    criteria: scored,
  };
}
export const needsHumanReview = (percent, unreliable = false) =>
  unreliable || percent <= 50 || percent >= 85;
export const quizRatio = (activity, answers) =>
  stored(
    fraction(
      BigInt(
        activity.questions.filter((q) => answers[q.id] === q.correct).length,
      ),
      15n,
    ),
  );
export const quizScore = (activity, answers) =>
  numeric(times(fraction(quizRatio(activity, answers)), fraction(100)));
export function professionalScore(days) {
  let exact = fraction(0);
  let pending = false;
  let total = 0,
    missing = 0;
  const ledger = [];
  for (const d of days) {
    if (d.excused) {
      ledger.push({
        day: d.day,
        score: null,
        excused: true,
        events: [],
        status: "NOT_ASSESSED",
      });
      pending = true;
      continue;
    }
    const eligible = d.events.filter((e) => !e.excused);
    if (!eligible.length) pending = true;
    const score = eligible.length
      ? (2 * eligible.filter((e) => e.met).length) / eligible.length
      : 0;
    let penalty = 0;
    if (d.agendaMissing) {
      missing++;
      if (missing === 3) penalty += 1;
    } else missing = 0;
    if (d.discoveryRequired && !d.discoveryAttempted && !d.discoveryExcused)
      penalty += 0.5;
    ledger.push({ day: d.day, score, penalty, events: eligible });
    total += score - penalty;
    exact = plus(
      exact,
      plus(
        eligible.length
          ? fraction(
              BigInt(2 * eligible.filter((e) => e.met).length),
              BigInt(eligible.length),
            )
          : fraction(0),
        fraction(-penalty),
      ),
    );
  }
  const bounded = atLeast(exact, fraction(0))
    ? atLeast(exact, fraction(10))
      ? fraction(10)
      : exact
    : fraction(0);
  return {
    total: numeric(bounded),
    pending,
    ratio: stored(over(bounded, fraction(10))),
    ledger,
  };
}
export function readiness(parts, settings, ratios = {}) {
  if (Object.values(parts).some((v) => v === null || v === undefined))
    return {
      status: "PENDING",
      parts,
      total: null,
      configVersion: settings.version,
    };
  const exact = sum(
    Object.entries(parts).map(([key, percent]) =>
      times(
        ratios[key]
          ? fraction(ratios[key])
          : over(fraction(percent), fraction(100)),
        fraction(settings.weights[key]),
      ),
    ),
  );
  const total = numeric(exact);
  return {
    status: atLeast(exact, fraction(settings.clearance))
      ? "CLEARED"
      : "RESCUE_PENDING",
    parts,
    total,
    distinction: atLeast(exact, fraction(settings.distinction)),
    totalRatio: stored(exact),
    configVersion: settings.version,
  };
}
export function balancedTeams(results) {
  const cleared = results
    .filter((r) => r.status === "CLEARED")
    .sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId));
  if (!cleared.length) return [];
  const count = Math.ceil(cleared.length / 5),
    teams = Array.from({ length: count }, (_, i) => ({
      id: `week1-team-${i + 1}`,
      members: [],
      status: "PROVISIONAL",
    }));
  const high = cleared.slice(0, count),
    low = cleared.slice(-count).reverse(),
    middle = cleared.slice(count, -count);
  high.forEach((r, i) => teams[i].members.push(r.userId));
  for (const r of low)
    if (!teams.some((t) => t.members.includes(r.userId)))
      teams[low.indexOf(r)].members.push(r.userId);
  middle.forEach((r, i) =>
    teams[
      Math.floor(i / count) % 2 ? count - 1 - (i % count) : i % count
    ].members.push(r.userId),
  );
  return teams;
}
export function bookRescues(results, slots, timeZone, fridayEnd) {
  const usage = new Map();
  return results
    .filter((r) => r.status === "RESCUE_PENDING")
    .map((r) => {
      const slot = slots.find((s) => {
        const weekday = new Intl.DateTimeFormat("en-US", {
          timeZone,
          weekday: "long",
        }).format(new Date(s.start));
        return (
          weekday === "Saturday" &&
          Date.parse(s.start) > Date.parse(fridayEnd) &&
          Date.parse(s.start) < Date.parse(fridayEnd) + 2 * 86400000 &&
          (usage.get(s.id) || 0) < s.capacity
        );
      });
      if (!slot) return { userId: r.userId, status: "SCHEDULING_EXCEPTION" };
      usage.set(slot.id, (usage.get(slot.id) || 0) + 1);
      return {
        userId: r.userId,
        status: "BOOKED",
        slotId: slot.id,
        start: slot.start,
        end: slot.end,
        meetingUrl: slot.meetingUrl,
      };
    });
}
