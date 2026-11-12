import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { parseCsv } from "../lib/pilot-assessment.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { graph } from "../lib/pilot-calendar.js";
import { pilotFixture, sprintConfig } from "../tests/pilot-fixture.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Supply the frozen Part B ZIP path.");
const recordApprovedTeam = process.argv.includes("--record-approved-team-a");
const staging = new URL("../sprint2-staging/", import.meta.url);
const baselineSha =
  "4d872356e6cb8f439da2ce84b4599a70bdda9b61f63a847d7761b4019c69f6cc";
if (recordApprovedTeam) {
  const fingerprint = createHash("sha256");
  for (const file of [
    "fields.mjs",
    "staging.mjs",
    "ui.jsx",
    "verify.mjs",
    "../package-lock.json",
  ])
    fingerprint
      .update(file)
      .update("\0")
      .update(await readFile(new URL(file, staging)))
      .update("\0");
  assert.equal(
    fingerprint.digest("hex"),
    baselineSha,
    "Approved candidate fingerprint changed",
  );
  assert.match(
    await readFile(new URL("verification.log", staging), "utf8"),
    new RegExp(baselineSha),
  );
}
const outer = unzipSync(await readFile(sourcePath));
const source =
  outer[
    "CODEWILD_PART_B/08_SOURCE_PACKS_UNCHANGED/CODEWILD_Sprint3_Four_Incident_Patch_Preparation_Kits_V1.zip"
  ];
assert.ok(source, "Original Sprint 3 source pack required");
assert.equal(
  createHash("sha256").update(source).digest("hex"),
  "c3bb26d9391da6491c2d8f292d33547141f6d2e8ddf776c5e639691376cf5676",
);
const files = unzipSync(source);
const read = (name) => strFromU8(files[`CODEWILD_SPRINT3/${name}`]);
const cards = parseCsv(read("06_SPRINT3_FROZEN_20_CARDS.csv"));
const tasks = cards.map((row) => ({
  id: row.task_id,
  owner: row.gamer,
  tt: row.type,
  title: row.task,
  hours: Number(row.estimated_hours),
  depends: row.depends_on ? row.depends_on.split(";") : [],
}));
const acceptance = parseCsv(read("07_SPRINT3_FROZEN_7_CC_ACCEPTANCE.csv")).map(
  (row) => ({ id: row.check_id, text: row.CC_victory_check }),
);
const configSource = JSON.parse(read("08_SPRINT3_FROZEN_GAME_CONFIG.json"));
assert.deepEqual(
  tasks,
  configSource.task_cards.map((card) => ({
    id: card.id,
    owner: card.gamer,
    tt: card.tt_type,
    title: card.summary,
    hours: card.hours,
    depends: card.depends_on,
  })),
);
assert.deepEqual(
  acceptance,
  configSource.cc_victory_checks.map((check) => ({
    id: String(check.id),
    text: check.criterion,
  })),
);
assert.equal(tasks.length, 20);
assert.equal(tasks.filter((task) => task.tt === "TT1").length, 6);
assert.equal(
  tasks.reduce((sum, task) => sum + task.hours, 0),
  43,
);
assert.equal(acceptance.length, 7);
graph(tasks);

const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
try {
  process.env.MONGODB_URI = replica.getUri("part_b_sprint3_rehearsal");
  const { cc, mc, otherMC, gamers, teams } = await pilotFixture();
  const teamId = teams[0].id;
  const recordedAt = new Date().toISOString();
  let now = new Date("2026-11-09T07:00:00Z");
  const reason = "Disposable QA rehearsal only. Synthetic workflow evidence.";
  const evidence = "https://example.invalid/sprint-3/platform-rehearsal";
  const call = (user, action, body = {}) =>
    pilotAction(
      user,
      action,
      { requestId: randomUUID(), reason, ...body },
      now,
    );
  const snapshot = (user = cc) => pilotSnapshot(user, now);
  const load = async (config) => {
    await call(cc, "draft", { config });
    await assert.rejects(call(cc, "load"), { status: 409 });
    await call(cc, "approve");
    await call(cc, "load");
  };
  const kickoff = async () => {
    for (const team of teams)
      await call(mc, "kickoff", { teamId: team.id, evidence: reason });
  };
  const config = sprintConfig(teams, mc, 2);
  config.number = 3;
  config.kickoffStart = "2026-11-23T04:30:00Z";
  config.kickoffEnd = "2026-11-23T06:30:00Z";
  config.dueAt = "2026-11-27T11:30:00Z";
  config.contentApproval = reason;
  config.template = {
    number: 3,
    version: "Part B frozen 2026-11-06",
    tasks,
    acceptance,
  };
  for (const team of config.teams)
    team.owners = Object.fromEntries(
      tasks.map((task) => [task.id, team.members["ABCDE".indexOf(task.owner)]]),
    );
  config.resources = Object.fromEntries(
    tasks.map(({ id }) => [
      id,
      {
        author: "CURRICULUM",
        version: "QA-1",
        approval: reason,
        url: `https://example.invalid/clues/${id}`,
      },
    ]),
  );
  await assert.rejects(
    call(cc, "draft", { config }),
    /Load core sprints sequentially/,
  );
  for (const number of [1, 2]) {
    now = new Date(
      number === 1 ? "2026-11-09T07:00:00Z" : "2026-11-16T07:00:00Z",
    );
    await load(sprintConfig(teams, mc, number));
    await kickoff();
    for (const team of teams) {
      const approved = recordApprovedTeam && team.id === teamId;
      if (approved) {
        for (let index = 1; index <= 7; index++) {
          await call(cc, "gate", {
            teamId,
            index,
            decision: "PASS",
            evidence: `https://example.invalid/isolated-evidence/sprint-${number}/gate-${index}`,
            reason: `User approved localhost and signed off all 14 checks for Fictional Team A. Candidate SHA-256 ${baselineSha}. Actual evidence: sprint2-staging/acceptance-evidence/index.html, S${number}-AC0${index}.`,
          });
        }
      }
      await call(cc, "accept", {
        teamId: team.id,
        decision: approved ? "ACCEPTED" : "NOT_ACCEPTED",
        ...(approved && {
          reason: `CC sign-off supplied by the user in this chat for Fictional Team A at localhost. Approved candidate ${baselineSha}.`,
        }),
      });
    }
    const accepted = await snapshot();
    await call(cc, "close");
    if (recordApprovedTeam) {
      const disposition = accepted.sprint.data.acceptances.find(
        (entry) => entry.teamId === teamId,
      );
      assert.equal(disposition.key, `Key ${number}`);
      await writeFile(
        new URL(`key-${number}-isolated-record.json`, staging),
        JSON.stringify(
          {
            team: "Fictional Team A",
            teamId,
            recordedAt,
            scope:
              "Disposable synthetic cohort. Engine timestamps use the simulated programme clock.",
            candidateSha256: baselineSha,
            approvedTestUrl: "http://127.0.0.1:3112/",
            evidenceIndex: "acceptance-evidence/index.html",
            evidenceMapping:
              "Reserved example.invalid URLs satisfy the engine's HTTPS field. The evidence index is the actual local source.",
            sprintId: accepted.sprint._id,
            sprintNumber: number,
            acceptance: disposition,
            gates: accepted.sprint.data.gates.filter(
              (entry) => entry.teamId === teamId,
            ),
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
    }
  }
  console.log(
    recordApprovedTeam
      ? "PASS: approved Team A Key 1 and Key 2 recorded and exported; prerequisite sprints closed."
      : "PASS: sequential load guard; prior fixture sprints closed without Keys.",
  );
  now = new Date("2026-11-23T07:00:00Z");
  await load(config);
  const loaded = await snapshot();
  assert.equal(loaded.sprint.state, "PREVIEW");
  assert.deepEqual(loaded.sprint.data.template.acceptance, acceptance);
  assert.equal(loaded.tasks.length, 100);
  for (const team of config.teams) {
    const teamTasks = loaded.tasks.filter(
      (task) => task.teamId === team.teamId,
    );
    assert.equal(teamTasks.length, 20);
    for (const task of tasks) {
      const stored = teamTasks.find((card) => card.data.code === task.id);
      assert.equal(stored.userId, team.owners[task.id]);
      for (const [key, value] of Object.entries(task))
        assert.deepEqual(stored.data[key], value);
    }
  }
  assert.equal((await snapshot(otherMC)).tasks.length, 0);
  assert.ok(
    (await snapshot(gamers[0])).tasks.every(
      (task) => task.teamId === teams[0].id,
    ),
  );
  const card = (id) =>
    loaded.tasks.find(
      (task) => task.teamId === teamId && task.data.code === id,
    );
  const user = (id) => [mc, ...gamers].find((actor) => actor._id === id);
  const start = (task) =>
    call(user(task.userId), "task", { taskId: task._id, next: "Working" });
  await assert.rejects(start(card("QA-09")), { status: 409 });
  await kickoff();
  const dependent = card("QA-11");
  await assert.rejects(
    start(dependent),
    /Prerequisites must first be accepted/,
  );
  const complete = async (task) => {
    await start(task);
    const owner = user(task.userId);
    await call(owner, "task", { taskId: task._id, evidence, summary: reason });
    for (let stage = 0; stage < 5; stage++) {
      await call(owner, "task", {
        taskId: task._id,
        stage,
        complete: true,
        note: reason,
      });
      if ([0, 1, 3].includes(stage)) {
        const review = (await snapshot()).reviews.find(
          (item) =>
            item.data.taskId === task._id &&
            item.data.index === stage &&
            item.state === "PENDING",
        );
        await call(user(review.data.reviewerId), "review", {
          reviewId: review._id,
          decision: "OK",
        });
      }
    }
    await call(owner, "task", { taskId: task._id, next: "In Review" });
    const review = (await snapshot()).reviews.find(
      (item) =>
        item.data.taskId === task._id &&
        item.data.kind === "FINAL" &&
        item.state === "PENDING",
    );
    await call(mc, "review", { reviewId: review._id, decision: "OK" });
  };
  for (const id of dependent.data.depends) await complete(card(id));
  await assert.rejects(
    start(dependent),
    /Receive the current one-working-hour handover/,
  );
  const sourceCard = card("OP-09");
  await call(user(sourceCard.userId), "handover", {
    fromId: sourceCard._id,
    toId: dependent._id,
    evidence: reason,
  });
  const handover = (await snapshot()).handovers.find(
    (item) =>
      item.data.from === sourceCard._id && item.data.to === dependent._id,
  );
  assert.equal(handover.state, "TRANSIT");
  const receive = () =>
    call(user(dependent.userId), "receive", { handoverId: handover._id });
  await assert.rejects(receive(), /One working hour has not elapsed/);
  now = new Date(handover.data.readyAt);
  await receive();
  await start(dependent);
  assert.equal(
    (await snapshot()).tasks.find((task) => task._id === dependent._id).state,
    "Working",
  );
  console.log(
    "PASS: 100 cards loaded with original IDs, owners, hours and edges; all seven gates retained.",
  );
  console.log(
    "PASS: scoped views, kickoff, independent reviews and timed handover unlocking QA-11.",
  );
  for (let index = 1; index <= 7; index++)
    await call(cc, "gate", {
      teamId,
      index,
      decision: "BLOCKED",
      evidence,
      reason: recordApprovedTeam
        ? "Sprint 2 baseline accepted. Sprint 3 incident selection and approval, execution, regression and live defence evidence are pending."
        : "No accepted learner app baseline or executed incident evidence in this platform rehearsal.",
    });
  await assert.rejects(
    call(cc, "accept", { teamId, decision: "ACCEPTED" }),
    /All seven latest client gates/,
  );
  assert.equal(
    (await snapshot()).sprint.data.gates.filter(
      (gate) => gate.decision === "BLOCKED",
    ).length,
    7,
  );
  console.log(
    "PASS: CC recorded seven blocked client gates and the engine withheld Key 3.",
  );
  console.log(
    "BLOCKED: learner-app incident, rollback, earlier client regression and live defence evidence.",
  );
  if (recordApprovedTeam) {
    const resumed = await snapshot();
    await writeFile(
      new URL("sprint3-resumed-isolated-record.json", staging),
      JSON.stringify(
        {
          recordedAt,
          team: "Fictional Team A",
          teamId,
          candidateSha256: baselineSha,
          prerequisiteRecord: "key-2-isolated-record.json",
          sprintId: resumed.sprint._id,
          state: resumed.sprint.state,
          teamTaskStates: resumed.tasks
            .filter((task) => task.teamId === teamId)
            .map((task) => ({ code: task.data.code, state: task.state })),
          gates: resumed.sprint.data.gates.filter(
            (entry) => entry.teamId === teamId,
          ),
          key3: null,
          next: "Record MC selection and CC approval for a team-specific incident and operator before the incident rehearsal.",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  }
} finally {
  try {
    await mongoose.disconnect();
  } finally {
    await replica.stop();
  }
}
