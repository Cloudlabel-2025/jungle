import { models, connect } from "../lib/db.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { emptyRecovery } from "../lib/recovery-rules.js";
import { rosterDigest } from "../lib/recovery.js";
import manifests from "../lib/pilot-manifests.json" with { type: "json" };
export async function pilotFixture() {
  await connect();
  for (const m of Object.values(models)) await m.init();
  const cohortId = "alpha",
    cc = {
      _id: "pilot-cc",
      name: "QA CC",
      email: "cc@pilot.invalid",
      role: "CENTRE_COMMAND",
      cohortId,
    },
    cc2 = { ...cc, _id: "pilot-cc2", email: "cc2@pilot.invalid" },
    mc = {
      ...cc,
      _id: "pilot-mc",
      name: "QA MC",
      email: "mc@pilot.invalid",
      role: "MISSION_COMMANDER",
    },
    otherMC = { ...mc, _id: "pilot-other-mc", email: "other-mc@pilot.invalid" },
    gamers = Array.from({ length: 25 }, (_, i) => ({
      _id: `pilot-g${i}`,
      name: `QA Gamer ${i}`,
      email: `g${i}@pilot.invalid`,
      cohortId,
      role: "GAMER",
      teamId: `pilot-team-${Math.floor(i / 5)}`,
    })),
    teams = Array.from({ length: 5 }, (_, i) => ({
      id: `pilot-team-${i}`,
      members: gamers.slice(i * 5, i * 5 + 5).map((g) => g._id),
    }));
  await models.Cohort.create({
    _id: cohortId,
    name: "Synthetic pilot",
    college: "QA only",
    startDate: "2026-11-01",
  });
  await models.User.insertMany([
    cc,
    cc2,
    mc,
    otherMC,
    ...gamers,
    {
      _id: "other-college",
      name: "Outside",
      email: "outside@pilot.invalid",
      cohortId: "other",
      role: "GAMER",
      teamId: "other-team",
    },
  ]);
  await models.Team.insertMany([
    ...teams.map((t) => ({
      _id: t.id,
      name: t.id,
      code: t.id,
      cohortId,
      commanderId: mc._id,
    })),
    { _id: "other-team", name: "Other", code: "OTHER", cohortId: "other" },
  ]);
  const p = blankProgram();
  p.locked = true;
  p.publications = [
    {
      version: 1,
      results: gamers.map((g) => ({
        userId: g._id,
        name: g.name,
        total: 80,
        status: "CLEARED",
      })),
      recognition: { awards: [], examples: [] },
      teams: [],
      rescue: [],
    },
  ];
  const r = emptyRecovery();
  r.fridayVersion = 1;
  r.published = {
    version: 1,
    teams,
    by: cc._id,
    at: "2026-11-07T07:00:00Z",
    eligibleDigest: rosterDigest(r, p.publications[0]),
  };
  p.recovery = r;
  await models.WeekOneProgram.create({ _id: cohortId, version: 1, data: p });
  return { cc, cc2, mc, otherMC, gamers, teams, cohortId };
}
export function sprintConfig(teams, mc, number = 1) {
  const m = manifests.sprints[number - 1];
  return {
    number,
    calendar: {
      timeZone: "Asia/Kolkata",
      intervals: [
        { startMinute: 600, endMinute: 780 },
        { startMinute: 840, endMinute: 1020 },
      ],
      weekdays: [1, 2, 3, 4, 5],
      holidays: [],
    },
    kickoffStart:
      number === 1 ? "2026-11-09T04:30:00Z" : "2026-11-16T04:30:00Z",
    kickoffEnd: number === 1 ? "2026-11-09T06:30:00Z" : "2026-11-16T04:30:00Z",
    dueAt: number === 1 ? "2026-11-13T11:30:00Z" : "2026-11-20T11:30:00Z",
    teams: teams.map((t) => ({
      teamId: t.id,
      members: t.members,
      commanderId: mc._id,
      owners: Object.fromEntries(
        m.tasks.map((c) => [c.id, t.members["ABCDE".indexOf(c.owner)]]),
      ),
      rationale: "Synthetic approved allocation for disposable tests only.",
    })),
    resources: Object.fromEntries(
      m.tasks.map((c) => [
        c.id,
        {
          author: "CURRICULUM",
          url: `https://example.invalid/${c.id}`,
          version: "QA-1",
          approval: "Synthetic Curriculum approval for disposable tests.",
        },
      ]),
    ),
  };
}
