import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { workHistory, workFile } from "../lib/work-history.js";
import { workSessions, sessionAt } from "../lib/work-sessions.js";
import { saveLabWork } from "../lib/lab-work.js";
import { dayOneAction, dayOneSnapshot } from "../lib/day-one.js";
import { attendanceAction, syncAttendance } from "../lib/attendance.js";
import { completeFlightIntro } from "../lib/player-stage.js";
import { weekOneAction, weekOneSnapshot } from "../lib/week-one.js";
import { programAction } from "../lib/week-one-program.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { publishFixtureRules } from "./week-one-program-fixture.mjs";
import { localParts } from "../lib/day-one-rules.js";
import { scheduleInstant } from "../lib/day-one-setup.js";
import { blankProgram } from "../lib/week-one-program-rules.js";
import { emptyRecovery } from "../lib/recovery-rules.js";
import { rosterDigest } from "../lib/recovery.js";
import { eodQuestions } from "../lib/week-one-catalog.js";

test("work sessions preserve millisecond boundaries, repeat clock-ins and unknown historical clock-outs", () => {
  const at = (n) => new Date(1700000000000 + n);
  const rows = [
    {
      _id: "session",
      clockAt: at(1),
      sessionState: "OUT",
      clockOutAt: at(20),
      sessionEvents: [
        { type: "IN", at: at(1) },
        { type: "OUT", at: at(10), source: "MANUAL" },
        { type: "IN", at: at(11) },
        { type: "OUT", at: at(20), source: "TIMEOUT" },
      ],
    },
  ];
  const sessions = workSessions(rows);
  assert.equal(sessions.length, 2);
  assert.equal(sessionAt(sessions, at(9)).id, sessions[0].id);
  assert.equal(sessionAt(sessions, at(10)), null);
  assert.equal(sessionAt(sessions, at(11)).id, sessions[1].id);
  assert.equal(sessionAt(sessions, at(20)), null);
  const unknown = workSessions([{ _id: "old", clockAt: at(1) }]);
  assert.equal(unknown[0].unknownEnd, true);
  assert.equal(sessionAt(unknown, at(5)), null);
  const pending = workSessions([
    {
      _id: "active",
      clockAt: at(1),
      sessionState: "ACTIVE",
      checkDueAt: at(10),
    },
  ]);
  assert.ok(sessionAt(pending, at(120009)));
  assert.equal(sessionAt(pending, at(120010)), null);
});

test(
  "MongoDB saved work: reflection recovery, dated attendance, private history, cursor ties and per-day workspace checkpoints",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    t.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-11-16T03:30:00Z"),
    });
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `work_history_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    await connect();
    for (const m of Object.values(models)) await m.init();
    const zone = "Asia/Kolkata",
      day = localParts(new Date(), zone).day,
      now = new Date(scheduleInstant(day, "09:00", zone));
    const a = {
      _id: "history-a",
      name: "Player A",
      email: "history-a@example.invalid",
      role: "GAMER",
      cohortId: "alpha",
    };
    const b = {
      ...a,
      _id: "history-b",
      name: "Player B",
      email: "history-b@example.invalid",
    };
    const cc = {
      ...a,
      _id: "history-cc",
      name: "CC",
      email: "history-cc@example.invalid",
      role: "CENTRE_COMMAND",
    };
    try {
      await models.User.insertMany([a, b, cc]);
      await models.Cohort.create({
        _id: "alpha",
        name: "History QA",
        college: "Synthetic",
        startDate: day,
        currentWeek: 1,
      });
      const end = new Date(scheduleInstant(day, "17:00", zone)),
        start = scheduleInstant(day, "00:00", zone);
      const config = {
        ...fixtureConfig(),
        day,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        availableAt: start,
        officialStart: start,
        clockCutoff: new Date(now.getTime() + 3600000).toISOString(),
        closingCutoff: end.toISOString(),
        revealAfter: new Date(end.getTime() + 8 * 86400000).toISOString(),
      };
      await dayOneAction(cc, "release", { config, revision: 0 }, now);
      await publishFixtureRules(cc, now);
      await weekOneAction(
        cc,
        "open",
        { day: 1, revision: (await weekOneSnapshot(cc)).revision },
        now,
      );
      await completeFlightIntro(a, {});
      await attendanceAction(a, "clock-in", {}, now);
      await attendanceAction(b, "clock-in", {}, now);
      const version = (
        await models.DayOneRecord.findOne({ userId: a._id }).lean()
      ).version;
      const text =
        "Investigate evidence and compare reliable sources before drawing a conclusion.";
      const saved = await dayOneAction(
        a,
        "reflection-draft",
        { ownerId: a._id, kind: "sod", text, draftVersion: 0 },
        now,
      );
      assert.equal(saved.draftVersion, 1);
      const restored = (await dayOneSnapshot(a, now)).records[0];
      assert.equal(restored.reflectionDrafts.sod.text, text);
      assert.equal(restored.sod, undefined);
      assert.equal(restored.version, version);
      await assert.rejects(
        dayOneAction(
          a,
          "reflection-draft",
          { ownerId: b._id, kind: "sod", text, draftVersion: 1 },
          now,
        ),
        (e) => e.status === 403,
      );
      await assert.rejects(
        dayOneAction(
          a,
          "reflection-draft",
          {
            ownerId: a._id,
            kind: "sod",
            text: text + " changed",
            draftVersion: 0,
          },
          now,
        ),
        (e) => e.status === 409,
      );
      await dayOneAction(
        b,
        "reflection-draft",
        {
          ownerId: b._id,
          kind: "sod",
          text: "PRIVATE_OTHER_PLAYER_TEXT",
          draftVersion: 0,
        },
        now,
      );
      await models.DayOneEvent.create({
        _id: "private-grade",
        cohortId: "alpha",
        userId: a._id,
        actorId: cc._id,
        kind: "ASSESSMENT_SAVED",
        createdAt: now,
        details: { after: { assessment: { notes: "PRIVATE_GRADE_TEXT" } } },
      });
      let history = await workHistory(a, { date: day }, new Date());
      assert.ok(
        history.entries.some(
          (e) => e.status === "Draft" && e.details.some((d) => d.text === text),
        ),
      );
      assert.ok(!JSON.stringify(history).includes("PRIVATE_OTHER_PLAYER_TEXT"));
      assert.ok(!JSON.stringify(history).includes("PRIVATE_GRADE_TEXT"));
      assert.ok(
        history.entries
          .filter((e) => e.status === "Draft")
          .every((e) => e.sessionId),
      );
      await dayOneAction(a, "sod", { text, version }, now);
      assert.equal(
        (await models.DayOneRecord.findOne({ userId: a._id }).lean()).data
          .reflectionDrafts?.sod,
        undefined,
      );
      await assert.rejects(
        dayOneAction(
          a,
          "reflection-draft",
          { ownerId: a._id, kind: "sod", text, draftVersion: 1 },
          now,
        ),
        (e) => e.status === 409,
      );
      const answers = eodQuestions[1].map(
        (_, i) =>
          `Draft answer ${i + 1}: independent verification and clear evidence.`,
      );
      await programAction(
        a,
        "reflection-draft",
        { day: 1, ownerId: a._id, kind: "eod", answers, draftVersion: 0 },
        now,
      );
      assert.deepEqual(
        (await dayOneSnapshot(a, now)).records[0].reflectionDrafts.eod.answers,
        answers,
      );
      assert.equal((await dayOneSnapshot(a, now)).records[0].eod, undefined);
      // Day 2 drafts share the same safe restore behavior without completing EOD.
      const release = await models.WeekOneRelease.findById("alpha");
      release.days[0].state = "CLOSED";
      release.days[1] = {
        day: 2,
        state: "OPEN",
        officialStart: start,
        scheduledEnd: end.toISOString(),
        content: { day: 2, timeZone: zone },
      };
      release.markModified("days");
      await release.save();
      await programAction(a, "clock", { day: 2 }, now);
      await programAction(
        a,
        "reflection-draft",
        {
          day: 2,
          ownerId: a._id,
          kind: "sod",
          text: "Day two plan draft only.",
          draftVersion: 0,
        },
        now,
      );
      const learner = await models.WeekOneLearner.findOne({
        userId: a._id,
      }).lean();
      assert.equal(learner.data.days[2].sod, undefined);
      assert.equal(
        learner.data.days[2].reflectionDrafts.sod.value.text,
        "Day two plan draft only.",
      );
      await programAction(
        a,
        "sod",
        { day: 2, text: "Day two plan is now submitted." },
        now,
      );
      assert.equal(
        (await models.WeekOneLearner.findOne({ userId: a._id }).lean()).data
          .days[2].reflectionDrafts?.sod,
        undefined,
      );
      await syncAttendance(new Date(end.getTime() + 120000));
      assert.equal(
        (await models.Attendance.findOne({ userId: a._id }).lean())
          .sessionState,
        "OUT",
      );
      assert.deepEqual(
        (await models.DayOneRecord.findOne({ userId: a._id }).lean()).data
          .reflectionDrafts.eod.answers,
        answers,
      );
      // A full page boundary may contain events with exactly the same timestamp.
      const tie = new Date(now.getTime() + 20);
      await models.DayOneEvent.insertMany(
        Array.from({ length: 115 }, (_, i) => ({
          _id: `history-tie-${String(i).padStart(3, "0")}`,
          cohortId: "alpha",
          userId: a._id,
          actorId: a._id,
          kind: "CLASS",
          createdAt: tie,
          details: {},
        })),
      );
      await models.WeekOneEvent.create({
        _id: "week-tie",
        cohortId: "alpha",
        actorId: a._id,
        kind: "AGENDA-ACK",
        createdAt: tie,
        details: { userId: a._id },
      });
      const all = [];
      let cursor;
      do {
        const page = await workHistory(
          a,
          { date: day, ...(cursor ? { cursor } : {}) },
          new Date(end.getTime() + 120000),
        );
        all.push(...page.entries);
        cursor = page.nextCursor;
      } while (cursor);
      assert.equal(new Set(all.map((e) => e.id)).size, all.length);
      assert.equal(
        all.filter((e) => e.id.startsWith("day1:history-tie-")).length,
        115,
      );
      assert.ok(all.some((e) => e.id === "week1:week-tie"));
      await assert.rejects(
        workHistory(a, { date: day, userId: b._id }),
        (e) => e.status === 400,
      );
      await assert.rejects(
        workHistory(cc, { date: day }),
        (e) => e.status === 403,
      );
      await assert.rejects(
        workHistory(a, { date: day, cursor: "invalid" }),
        (e) => e.status === 400,
      );
      // A separate approved expedition cohort exercises code persistence and scope.
      const people = Array.from({ length: 5 }, (_, i) => ({
        ...a,
        _id: `lab-${i}`,
        name: `Lab ${i}`,
        email: `lab-${i}@example.invalid`,
        cohortId: "beta",
        teamId: "lab-team",
      }));
      await models.User.insertMany(people);
      await models.Team.create({
        _id: "lab-team",
        name: "Lab team",
        code: "LAB",
        cohortId: "beta",
      });
      await models.Cohort.create({
        _id: "beta",
        name: "Code QA",
        college: "Synthetic",
        startDate: day,
        currentWeek: 2,
      });
      const p = blankProgram();
      p.locked = true;
      p.publications = [
        {
          version: 1,
          results: people.map((u) => ({
            userId: u._id,
            status: "CLEARED",
            total: 80,
          })),
          teams: [],
          recognition: { awards: [], examples: [] },
        },
      ];
      const recovery = emptyRecovery();
      recovery.published = {
        version: 1,
        teams: [{ id: "lab-team", members: people.map((u) => u._id) }],
        eligibleDigest: rosterDigest(recovery, p.publications[0]),
      };
      p.recovery = recovery;
      await models.WeekOneProgram.create({ _id: "beta", version: 1, data: p });
      const first = new Date(Date.parse(`${day}T12:00:00Z`) - 2 * 86400000)
          .toISOString()
          .slice(0, 10),
        second = new Date(Date.parse(`${day}T12:00:00Z`) - 86400000)
          .toISOString()
          .slice(0, 10);
      const at = (date, time) => new Date(scheduleInstant(date, time, zone));
      for (const d of [first, second])
        await models.Attendance.create({
          _id: `lab-session-${d}`,
          userId: people[0]._id,
          cohortId: "beta",
          day: d,
          timeZone: zone,
          clockAt: at(d, "09:00"),
          sessionState: "OUT",
          clockOutAt: at(d, "17:00"),
          clockOutReason: "MANUAL",
          sessionEvents: [
            { type: "IN", at: at(d, "09:00") },
            { type: "OUT", at: at(d, "17:00"), source: "MANUAL" },
          ],
        });
      const files = {
        "src/App.jsx": "first day's saved source",
        "src/styles.css": "body { color: green; }",
        "tests/ledger.test.js": "test first day",
      };
      const save = (user, body, when) =>
        transaction((session) => saveLabWork(user, body, session, when));
      assert.equal(
        (
          await save(
            people[0],
            { ownerId: people[0]._id, files, expectedVersion: 0 },
            at(first, "10:00"),
          )
        ).version,
        1,
      );
      assert.equal(
        (
          await save(
            people[0],
            { ownerId: people[0]._id, files, expectedVersion: 0 },
            at(first, "10:01"),
          )
        ).version,
        1,
      );
      const changed = { ...files, "src/App.jsx": "second day's saved source" };
      await assert.rejects(
        save(
          people[0],
          { ownerId: people[0]._id, files: changed, expectedVersion: 0 },
          at(second, "10:00"),
        ),
        (e) => e.status === 409,
      );
      await save(
        people[0],
        { ownerId: people[0]._id, files: changed, expectedVersion: 1 },
        at(second, "10:00"),
      );
      assert.equal(
        await models.LabCheckpoint.countDocuments({ userId: people[0]._id }),
        2,
      );
      const firstHistory = await workHistory(
        people[0],
        { date: first },
        new Date(),
      );
      const checkpoint = firstHistory.entries.find((e) =>
        e.id.startsWith("workspace:"),
      );
      assert.ok(checkpoint);
      assert.ok(checkpoint.sessionId);
      const id = checkpoint.id.slice("workspace:".length);
      assert.deepEqual((await workFile(people[0], id)).files, files);
      await assert.rejects(workFile(people[1], id), (e) => e.status === 404);
      await assert.rejects(workFile(a, id), (e) => e.status === 403);
      await assert.rejects(
        save(
          people[0],
          { ownerId: people[1]._id, files, expectedVersion: 2 },
          at(second, "11:00"),
        ),
        (e) => e.status === 403,
      );
      await models.User.updateOne(
        { _id: people[0]._id },
        { $set: { active: false } },
      );
      await assert.rejects(
        save(
          people[0],
          { ownerId: people[0]._id, files, expectedVersion: 2 },
          at(second, "11:00"),
        ),
        (e) => e.status === 403,
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
