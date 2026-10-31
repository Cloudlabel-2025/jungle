import { createHash } from "node:crypto";
import { fail, requiredText } from "./day-one-rules.js";
import { iso, finite, safeId } from "./week-one-program-rules.js";
import {
  fraction,
  plus,
  over,
  numeric,
  stored,
  atLeast,
} from "./week-one-fractions.js";

export const recoveryTypes = ["TECHNOLOGY", "FUN"];
export const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function emptyRecovery() {
  return {
    policy: null,
    draft: {
      timeZone: "Asia/Kolkata",
      exams: recoveryTypes.map((type) => ({
        type,
        rubric: "",
        variants: Array.from({ length: 4 }, (_, i) => ({
          id: `${type.toLowerCase()}-${i + 1}`,
          name: `Variant ${i + 1}`,
          question: "",
          reference: "",
        })),
      })),
    },
    configs: [],
    participants: [],
    batches: [],
    proposals: [],
    rewards: [],
    incidents: [],
  };
}
export function validateRecoveryConfig(input) {
  const c = structuredClone(input);
  c.start = iso(c.start, "Saturday start");
  c.choiceDeadline = iso(c.choiceDeadline, "choice deadline");
  c.examClose = iso(c.examClose, "exam access closing time");
  try {
    new Intl.DateTimeFormat("en", { timeZone: c.timeZone }).format(new Date());
  } catch {
    fail("Supply a valid time zone.");
  }
  if (
    new Intl.DateTimeFormat("en", {
      timeZone: c.timeZone,
      weekday: "long",
    }).format(new Date(c.start)) !== "Saturday"
  )
    fail("The shared recovery session must start on Saturday.");
  if (
    Date.parse(c.choiceDeadline) > Date.parse(c.start) ||
    Date.parse(c.examClose) < Date.parse(c.start) + 170 * 60000
  )
    fail(
      "Choice deadline must precede the class; exam access must cover the 170-minute programme.",
    );
  for (const key of ["meetingUrl", "policyUrl"]) {
    let url;
    try {
      url = new URL(c[key]);
    } catch {
      fail(`Supply an approved HTTPS ${key}.`);
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail(`Supply an approved HTTPS ${key}.`);
    c[key] = url.href;
  }
  c.policyReference = requiredText(
    c.policyReference,
    "Institution policy approval reference",
    10,
    2000,
  );
  c.orientation = requiredText(
    c.orientation,
    "Monday orientation notice",
    10,
    4000,
  );
  if (!["FRIDAY", "RECOVERY"].includes(c.teamScoreBasis))
    fail("Choose Friday or recovery score for recovered learners' team bands.");
  if (!["WINDOW", "SEQUENTIAL"].includes(c.lateAccess))
    fail("Choose exam access policy: WINDOW or SEQUENTIAL.");
  if (
    !Array.isArray(c.exams) ||
    c.exams.length !== 2 ||
    new Set(c.exams.map((e) => e.type)).size !== 2
  )
    fail("Supply both exam packs.");
  c.exams = recoveryTypes.map((type) => {
    const e = c.exams.find((e) => e.type === type);
    if (
      !e ||
      !Array.isArray(e.variants) ||
      e.variants.length !== 4 ||
      new Set(e.variants.map((v) => v.id)).size !== 4
    )
      fail("Each exam requires exactly four distinct variants.");
    return {
      type,
      rubric: requiredText(
        e.rubric,
        "Approved marking rubric and instructions",
        20,
        8000,
      ),
      variants: e.variants.map((v) => ({
        id: safeId(v.id),
        name: requiredText(v.name, "Variant name", 1, 120),
        question: requiredText(v.question, "Exam question", 20, 10000),
        reference: requiredText(
          v.reference,
          "Private reference answer and alternatives",
          20,
          10000,
        ),
      })),
    };
  });
  return c;
}
export function recoveryScore(tech, fun, assessable = true) {
  if (!assessable || tech == null || fun == null)
    return { status: "INCOMPLETE", total: null };
  finite(tech, 0, 100, "Technology percentage");
  finite(fun, 0, 100, "Fun percentage");
  const exact = over(plus(fraction(tech), fraction(fun)), fraction(2));
  return {
    status: atLeast(exact, fraction(60)) ? "CLEARED" : "INSTITUTION_PENDING",
    total: numeric(exact),
    ratio: stored(exact),
  };
}
export const humanRequired = (score) => score <= 50 || score >= 85;
export function recoveryTeamSizes(n) {
  if (n < 3) return [];
  const sizes = Array(Math.floor(n / 5)).fill(5),
    r = n % 5;
  if (r >= 3) sizes.push(r);
  else if (r === 1 && sizes.length >= 2) {
    sizes.splice(-2, 2, 5, 3, 3);
  } else if (r === 1) {
    sizes.splice(-1, 1, 3, 3);
  } else if (r === 2) {
    sizes.splice(-1, 1, 4, 3);
  }
  return sizes.sort((a, b) => b - a);
}
export function generateRecoveryTeams(rows, seed) {
  const sizes = recoveryTeamSizes(rows.length);
  if (!sizes.length)
    fail(
      "Fewer than three cleared learners: institution decision required.",
      409,
    );
  // Score bands stay ordered; seeded shuffling within each band makes a proposal reproducible.
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.userId.localeCompare(b.userId),
  );
  const highCount = sizes.length,
    lowCount = sizes.filter((n) => n === 5).length;
  const shuffle = (xs) =>
    xs.sort((a, b) =>
      hash([seed, a.userId]).localeCompare(hash([seed, b.userId])),
    );
  const highs = shuffle(sorted.slice(0, highCount)),
    lows = shuffle(sorted.slice(sorted.length - lowCount || sorted.length)),
    mids = shuffle(sorted.slice(highCount, lowCount ? -lowCount : undefined));
  // Give the strongest available high/middle combination to the smallest crews.
  const teams = sizes.map((size, i) => ({
    id: `recovery-team-${i + 1}`,
    size,
    members: [],
    credits: size === 3 ? 2 : size === 4 ? 1 : 0,
    effectiveWeek: 2,
  }));
  const order = [...teams].sort((a, b) => a.size - b.size);
  order.forEach((t) => {
    if (t.size < 5) highs.sort((a, b) => b.score - a.score);
    else shuffle(highs);
    t.members.push(highs.shift().userId);
  });
  teams
    .filter((t) => t.size === 5)
    .forEach((t, i) => t.members.push(lows[i].userId));
  // Reduced crews receive a strong middle scorer; full crews use the seeded band shuffle.
  for (const t of order.filter((t) => t.size < 5)) {
    mids.sort((a, b) => b.score - a.score);
    if (mids.length) t.members.push(mids.shift().userId);
  }
  shuffle(mids);
  let turn = 0;
  while (mids.length) {
    const t = order[turn++ % order.length];
    if (t.members.length < t.size) t.members.push(mids.shift().userId);
  }
  return teams;
}
export function validateRecoveryTeams(teams, rows) {
  const members = teams?.flatMap((t) => t.members) || [];
  if (
    !Array.isArray(teams) ||
    teams.some(
      (t) =>
        !Array.isArray(t.members) ||
        t.members.length < 3 ||
        t.members.length > 5,
    ) ||
    new Set(members).size !== rows.length ||
    members.length !== rows.length ||
    rows.some((r) => !members.includes(r.userId))
  )
    fail("Include every eligible learner exactly once in teams of 3–5.");
  return teams.map((t, i) => ({
    id: `recovery-team-${i + 1}`,
    members: t.members,
    size: t.members.length,
    credits: 5 - t.members.length,
    effectiveWeek: 2,
  }));
}
