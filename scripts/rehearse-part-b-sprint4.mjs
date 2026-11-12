import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { models } from "../lib/db.js";
import { graph, workingAt } from "../lib/pilot-calendar.js";
import { parseCsv } from "../lib/pilot-assessment.js";
import { pilotAction, pilotSnapshot } from "../lib/pilot-engine.js";
import { pilotFixture, sprintConfig } from "../tests/pilot-fixture.mjs";

const input = process.argv[2];
if (!input) throw new Error("Supply the frozen Part B ZIP path.");
const friday = process.argv.includes("--uat05");
const focusRelease = process.argv.includes("--focus-rc");
const httpsRelease = process.argv.includes("--localhost-https-rc");
assert.ok(!(focusRelease && httpsRelease), "Select a single release");
assert.ok(
  !(focusRelease || httpsRelease) || friday,
  "Release selection requires --uat05",
);
const releaseDirectory = httpsRelease
  ? "sprint4-trusted-origin-rc"
  : focusRelease
    ? "sprint4-focus-rc"
    : null;
const candidateRoot = new URL(
  releaseDirectory
    ? `../sprint2-staging/${releaseDirectory}/source/sprint2-staging/`
    : "../sprint2-staging/",
  import.meta.url,
);
const pack = unzipSync(await readFile(input));
const root = "CODEWILD_PART_B/";
const checksums = parseCsv(
  strFromU8(
    pack[root + "07_APPROVAL_AND_INTEGRATION/FILE_INTEGRITY_SHA256.csv"],
  ),
);
const read = (name) => {
  const path = "02_WEEK5_SPRINT4/" + name;
  const bytes = pack[root + path];
  const expected = checksums.find((row) => row.path === path);
  assert.ok(bytes && expected);
  assert.equal(bytes.length, Number(expected.size_bytes));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    expected.sha256,
  );
  return strFromU8(bytes);
};
const roster = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const tasks = parseCsv(read("W5_S4_FROZEN_20_TASK_CARDS.csv")).map((row) => {
  assert.equal(row.status, "FROZEN");
  const uat = /^UAT-0([1-5])$/.exec(row.task_id);
  return {
    id: row.task_id,
    owner: row.gamer,
    tt: row.task_type,
    hours: Number(row.estimated_hours),
    title: row.title,
    instructions: row.definition_of_done,
    depends: row.depends_on ? row.depends_on.split(";") : [],
    evidenceRequired: row.evidence_required,
    technicalRole: row.technical_role,
    ...(uat && { uat: { day: roster[Number(uat[1]) - 1] } }),
  };
});
const acceptance = parseCsv(read("W5_S4_FROZEN_7_ACCEPTANCE_CHECKS.csv")).map(
  (row) => ({ id: row.check_id, text: row.requirement }),
);
assert.equal(tasks.length, 20);
assert.equal(tasks.filter((task) => task.tt === "TT1").length, 9);
assert.equal(
  tasks.reduce((sum, task) => sum + task.hours, 0),
  53.5,
);
assert.equal(acceptance.length, 7);
for (const [index, owner] of [..."ABCDE"].entries()) {
  const assigned = tasks.filter((task) => task.owner === owner);
  assert.equal(assigned.length, 4);
  assert.deepEqual(
    assigned
      .filter((task) => task.uat)
      .map(({ id, hours, uat }) => [id, hours, uat.day]),
    [[`UAT-0${index + 1}`, 2.5, roster[index]]],
  );
}
assert.deepEqual(tasks.find((task) => task.id === "UAT-05").depends, ["OP-13"]);
graph(tasks);

const output = process.env.CODEWILD_EVIDENCE_DIR
  ? resolve(process.env.CODEWILD_EVIDENCE_DIR, "workflow.json")
  : new URL(
      releaseDirectory
        ? `../sprint2-staging/${releaseDirectory}/workflow.json`
        : friday
          ? "../sprint2-staging/sprint4-uat05/workflow.json"
          : "../sprint2-staging/sprint4-isolated-import.json",
      import.meta.url,
    );
const sprint3Record = new URL(
  "../sprint2-staging/sprint3-resumed-isolated-record.json",
  import.meta.url,
);
const previousRecord = await readFile(sprint3Record, "utf8");
assert.equal(JSON.parse(previousRecord).key3, null);
let candidate;
const replica = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
try {
  process.env.MONGODB_URI = replica.getUri("part_b_sprint4_qa");
  const { cc, mc, otherMC, gamers, teams, cohortId } = await pilotFixture(1);
  const teamId = teams[0].id;
  let now = new Date("2026-11-30T07:00:00Z");
  const reason =
    "Synthetic Sprint 4 integration rehearsal only. No Sprint 3 or 4 acceptance is authorised.";
  const call = (actor, action, body = {}) =>
    pilotAction(
      actor,
      action,
      { requestId: randomUUID(), reason, ...body },
      now,
    );
  const snap = (actor = cc) => pilotSnapshot(actor, now);
  const config = {
    ...sprintConfig(teams, mc, 2),
    number: 4,
    kickoffStart: "2026-11-30T04:30:00Z",
    kickoffEnd: "2026-11-30T06:30:00Z",
    dueAt: "2026-12-04T11:30:00Z",
    contentApproval: reason,
    template: {
      number: 4,
      version: "Part B frozen 2026-11-06",
      tasks,
      acceptance,
    },
  };
  config.teams[0].owners = Object.fromEntries(
    tasks.map((task) => [task.id, gamers["ABCDE".indexOf(task.owner)]._id]),
  );
  config.resources = Object.fromEntries(
    tasks.map(({ id }) => [
      id,
      {
        author: "CURRICULUM",
        version: "QA fixture",
        approval: reason,
        url: `https://example.invalid/sprint4/isolated-resource/${id}`,
      },
    ]),
  );
  await assert.rejects(
    call(cc, "draft", { config }),
    /Load core sprints sequentially/,
  );
  // A sequencing fixture belongs only to this fresh database. It carries no acceptance or key.
  await models.PilotSprint.create({
    _id: "sprint4-qa-sequencing-fixture",
    cohortId,
    state: "CLOSED",
    version: 1,
    createdAt: new Date("2026-11-27T11:30:00Z"),
    data: {
      number: 3,
      teams: [],
      acceptances: [],
      gates: [],
      fixtureOnly: true,
    },
  });
  await assert.rejects(call(gamers[0], "draft", { config }), { status: 403 });
  await call(cc, "draft", { config });
  await assert.rejects(call(cc, "load"), { status: 409 });
  await call(cc, "approve");
  await call(cc, "load");
  const preview = await snap();
  assert.equal(preview.sprint.state, "PREVIEW");
  assert.deepEqual(preview.sprint.data.template.acceptance, acceptance);
  assert.equal(preview.tasks.length, 20);
  for (const task of tasks) {
    const card = preview.tasks.find((item) => item.data.code === task.id);
    for (const [key, value] of Object.entries(task))
      assert.deepEqual(card.data[key], value);
    assert.equal(card.userId, config.teams[0].owners[task.id]);
  }
  await call(mc, "kickoff", { teamId, evidence: reason });
  const uat = (index) =>
    preview.tasks.find((task) => task.data.code === `UAT-0${index}`);
  const start = (actor, task) =>
    call(actor, "task", { taskId: task._id, next: "Working" });
  await assert.rejects(start(gamers[1], uat(1)), { status: 403 });
  assert.equal((await snap(otherMC)).tasks.length, 0);
  const monday = new Date(now);
  for (let index = 2; index <= 4; index++) {
    await assert.rejects(start(gamers[index - 1], uat(index)), {
      status: 409,
      message: new RegExp(`opens on ${roster[index - 1]}`),
    });
    await assert.rejects(call(gamers[index - 1], "task", {
      taskId: uat(index)._id,
      evidence: "https://example.invalid/early-uat-evidence",
      summary: reason,
    }), { status: 409, message: /Start the scheduled Client Chair/ });
  }
  for (let index = 1; index <= 4; index++) {
    now = new Date(+monday + (index - 1) * 86400000);
    await start(gamers[index - 1], uat(index));
  }
  now = monday;
  await assert.rejects(
    start(gamers[4], uat(5)),
    /Prerequisites must first be accepted/,
  );
  await assert.rejects(
    call(cc, "accept", { teamId, decision: "ACCEPTED" }),
    /All seven latest client gates/,
  );
  const fridayEvidence = friday
    ? await rehearseFriday({
        call,
        snap,
        cc,
        mc,
        gamers,
        teamId,
        config,
        advance: (at) => {
          now = new Date(at);
        },
      })
    : null;
  const active = await snap();
  assert.equal(active.sprint.state, friday ? "CLIENT_REVIEW" : "ACTIVE");
  assert.equal(active.sprint.data.acceptances.length, 0);
  assert.equal(await readFile(sprint3Record, "utf8"), previousRecord);
  await writeFile(
    output,
    JSON.stringify(
      {
        team: "Fictional Team A",
        scope: "Disposable staging rehearsal",
        priorSprint:
          "Synthetic closure marker for import sequencing only. No Key 3 issued.",
        template: config.template,
        evidence: [
          "Frozen cards and gates matched the handover checksum register.",
          "CC draft, approval and load passed. Unapproved load and Gamer draft rejected.",
          "All 20 saved cards match frozen IDs, hours, definitions, owners and dependencies.",
          "The Tuesday through Thursday owners were blocked on Monday. Each owner started their own card on its assigned day. Another Gamer cannot start UAT-01.",
          "Before prerequisite completion, UAT-05 was blocked and CC acceptance was rejected without all seven gates.",
          "The Sprint 3 record was byte-identical after the run.",
        ],
        ...(fridayEvidence && { fridayEvidence }),
        cards: active.tasks.map((task) => ({
          id: task.data.code,
          ownerId: task.userId,
          state: task.state,
        })),
        key3: null,
        key4: null,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS: 20 frozen Sprint 4 cards and seven gates loaded for Fictional Team A.",
  );
  console.log(
    "PASS: owner checks, early UAT rejection, scheduled-day starts, UAT-05 prerequisite and Key 4 guards.",
  );
  console.log("Key 3 remains pending. No Key 4 recorded.");
} finally {
  try {
    if (candidate) await candidate.close();
  } finally {
    try {
      await mongoose.disconnect();
    } finally {
      await replica.stop();
    }
  }
}

async function rehearseFriday({
  call,
  snap,
  cc,
  mc,
  gamers,
  teamId,
  config,
  advance,
}) {
  const key2 = JSON.parse(
    await readFile(
      new URL(
        releaseDirectory
          ? `../sprint2-staging/${releaseDirectory}/release.json`
          : "../sprint2-staging/key-2-isolated-record.json",
        import.meta.url,
      ),
    ),
  );
  const fingerprint = createHash("sha256");
  for (const file of [
    "fields.mjs",
    "staging.mjs",
    "ui.jsx",
    "verify.mjs",
    "../package-lock.json",
  ]) {
    fingerprint
      .update(file)
      .update("\0")
      .update(await readFile(new URL(file, candidateRoot)))
      .update("\0");
  }
  const sha256 = fingerprint.digest("hex");
  assert.equal(sha256, key2.candidateSha256);
  const { start: startCandidate } = await import(
    new URL("staging.mjs", candidateRoot)
  );
  const tls = httpsRelease
    ? {
        key: await readFile(process.env.CODEWILD_STAGING_TLS_KEY_FILE),
        cert: await readFile(process.env.CODEWILD_STAGING_TLS_CERT_FILE),
      }
    : undefined;
  const evidence = [];
  const card = async (code) =>
    (await snap()).tasks.find((item) => item.data.code === code);
  const actor = (id) => [mc, ...gamers].find((user) => user._id === id);
  const start = (task, user = actor(task.userId)) =>
    call(user, "task", { taskId: task._id, next: "Working" });
  const approve = async (task, kind, index) => {
    const review = (await snap()).reviews.find(
      (row) =>
        row.state === "PENDING" &&
        row.data.taskId === task._id &&
        row.data.kind === kind &&
        (index === undefined || row.data.index === index),
    );
    assert.ok(review, `Missing ${kind} review for ${task.data.code}`);
    const reviewer = actor(review.data.reviewerId);
    assert.notEqual(reviewer._id, task.userId);
    if (task.data.code === "UAT-05" && kind === "FINAL") {
      await assert.rejects(
        call(actor(task.userId), "review", { reviewId: review._id, decision: "OK" }),
        { status: 403, message: /Independent assigned reviewer required/ },
      );
      assert.equal((await card("UAT-05")).state, "In Review");
    }
    await call(reviewer, "review", { reviewId: review._id, decision: "OK" });
    return {
      id: review._id,
      reviewer: reviewer._id,
      kind,
      ...(index !== undefined && { index }),
    };
  };
  const finish = async (task, summary) => {
    const owner = actor(task.userId);
    await call(owner, "task", {
      taskId: task._id,
      evidence: `https://example.invalid/disposable-qa/${task.data.code}`,
      summary,
    });
    const reviews = [];
    for (let stage = 0; stage < 5; stage++) {
      await call(owner, "task", {
        taskId: task._id,
        stage,
        complete: true,
        note: summary,
      });
      if ([0, 1, 3].includes(stage))
        reviews.push(await approve(task, "STAGE", stage));
    }
    await call(owner, "task", { taskId: task._id, next: "In Review" });
    reviews.push(await approve(task, "FINAL"));
    const accepted = await card(task.data.code);
    assert.equal(accepted.state, "Accepted");
    evidence.push({
      code: task.data.code,
      taskId: task._id,
      owner: owner._id,
      acceptedAt: accepted.data.acceptedAt,
      reviews,
      summary,
    });
    return accepted;
  };
  const send = async (source, target) => {
    await call(actor(source.userId), "handover", {
      fromId: source._id,
      toId: target._id,
      evidence: `Disposable QA handover from ${source.data.code} to ${target.data.code}.`,
    });
    return (await snap()).handovers.find(
      (row) => row.data.from === source._id && row.data.to === target._id,
    );
  };
  const receive = (handover, task) =>
    call(actor(task.userId), "receive", { handoverId: handover._id });
  const prepare = async (task) => {
    const handovers = [];
    for (const code of task.data.depends) {
      const source = await card(code);
      if (source.userId !== task.userId)
        handovers.push(await send(source, task));
    }
    if (handovers.length)
      advance(
        Math.max(...handovers.map((row) => Date.parse(row.data.readyAt))),
      );
    for (const handover of handovers) await receive(handover, task);
    await start(task);
  };
  const build = async (code) => {
    const task = await card(code);
    if (task.state === "Accepted") return;
    for (const dep of task.data.depends) await build(dep);
    await prepare(task);
    await finish(
      task,
      "Simulated prerequisite review to exercise the frozen dependency chain. Formal evidence and gate approval remain with CC.",
    );
  };
  const release = await card("OP-13");
  for (const dep of release.data.depends) await build(dep);
  await prepare(release);

  candidate = await startCandidate(0, { tls });
  const http = [];
  const request = async (
    path,
    expected,
    { method = "GET", body, cookie } = {},
  ) => {
    const began = performance.now();
    const response = await fetch(candidate.url + path, {
      method,
      headers: {
        ...(body && { "Content-Type": "application/json" }),
        ...(httpsRelease && method !== "GET" && { Origin: candidate.url }),
        ...(cookie && { Cookie: cookie }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    http.push({
      method,
      path,
      status: response.status,
      ms: Math.round(performance.now() - began),
    });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response;
  };
  const login = async (account) =>
    (
      await request("/api/login", 200, { method: "POST", body: account })
    ).headers
      .get("set-cookie")
      .split(";")[0];
  const smoke = async () => {
    await request("/health", 200);
    assert.match(await (await request("/", 200)).text(), /src="\/app.js"/);
    await (await request("/app.js", 200)).arrayBuffer();
    const cookie = await login(candidate.accounts[0]);
    const records = await (
      await request("/api/alumni", 200, { cookie })
    ).json();
    assert.equal(records.length, 20);
    return { cookie, records };
  };
  await smoke();
  // Exercise rollback to the pinned clean candidate before the Friday run.
  await candidate.close();
  candidate = await startCandidate(0, { tls });
  const { cookie, records } = await smoke();
  const restoredIds = records.map((record) => record._id).sort();
  assert.deepEqual(
    restoredIds,
    Array.from(
      { length: 20 },
      (_, i) => `AL-QA-${String(i + 1).padStart(3, "0")}`,
    ),
  );
  const acceptedRelease = await finish(
    release,
    `Disposable localhost release ${sha256}. Served HTML, compiled bundle, health, admin login and 20-record directory. Relaunch rollback restored the 20 pinned seed IDs. See workflow.json and sprint1-2-regression.log.`,
  );
  const friday = await card("UAT-05");
  assert.equal(friday.data.hours, 2.5);
  assert.equal(friday.data.uat.day, "Friday");
  await assert.rejects(
    start(friday),
    /Receive the current one-working-hour handover/,
  );
  const handover = await send(acceptedRelease, friday);
  await assert.rejects(
    receive(handover, friday),
    /One working hour has not elapsed/,
  );
  const originalMilestone = (await snap()).sprint.data.originalDueAt;
  const deadline = { taskId: friday._id, dueAt: "2026-12-04T12:00:00Z" };
  await assert.rejects(call(actor(friday.userId), "deadline", deadline), { status: 403 });
  await assert.rejects(call(mc, "deadline", deadline), { status: 403 });
  await call(cc, "deadline", {
    ...deadline,
    reason: "Isolated check of a revised Friday UAT target after a handover delay.",
  });
  const updatedTarget = await card("UAT-05");
  assert.equal(new Date(updatedTarget.data.dueAt).toISOString(), "2026-12-04T12:00:00.000Z");
  assert.equal(updatedTarget.data.dueHistory.at(-1).by, cc._id);
  assert.equal((await snap()).sprint.data.originalDueAt, originalMilestone);
  console.log("PASS PB-QA-046: Gamer could not change the deadline; CC revision preserved the Friday milestone.");
  const sessionStart = new Date("2026-12-04T04:30:00Z");
  const thursday = new Date("2026-12-03T07:00:00Z");
  assert.ok(new Date(handover.data.readyAt) <= thursday);
  advance(thursday);
  await receive(handover, friday);
  await assert.rejects(start(friday), { status: 409, message: /opens on Friday/ });
  advance(sessionStart);
  await assert.rejects(start(friday, gamers[0]), { status: 403 });
  await start(friday);
  const id = records[0]._id;
  const original = await (
    await request(`/api/alumni/${id}`, 200, { cookie })
  ).json();
  const payload = Object.fromEntries(
    Object.keys(original)
      .filter((key) => !["_id", "createdAt", "modifiedAt"].includes(key))
      .map((key) => [key, original[key]]),
  );
  const created = await (
    await request("/api/alumni", 201, {
      method: "POST",
      cookie,
      body: {
        ...payload,
        firstName: "Friday",
        email: "friday@example.invalid",
        registration: "UAT05",
      },
    })
  ).json();
  const path = `/api/alumni/${created._id}`;
  await request(path, 400, {
    method: "PUT",
    cookie,
    body: { ...payload, postcode: "SW1A 1AA" },
  });
  const saved = await (
    await request(path, 200, {
      method: "PUT",
      cookie,
      body: {
        ...payload,
        firstName: "Friday",
        email: "friday@example.invalid",
        registration: "UAT05",
        city: "Friday QA City",
      },
    })
  ).json();
  const fresh = await login(candidate.accounts[0]);
  assert.deepEqual(
    await (await request(path, 200, { cookie: fresh })).json(),
    saved,
  );
  assert.equal(saved._id, created._id);
  assert.equal(saved.createdAt, created.createdAt);
  assert.equal(saved.city, "Friday QA City");
  const restricted = await login(candidate.accounts[1]);
  await request("/api/alumni/AL-QA-001", 200, { cookie: restricted });
  await request(path, 403, { cookie: restricted });
  await request(path, 403, {
    method: "PUT",
    cookie: restricted,
    body: payload,
  });
  const sessionEnd = workingAt(sessionStart, config.calendar, 150);
  advance(sessionEnd);
  const acceptedUat = await finish(
    friday,
    "Accelerated fictional Friday verdict PASS for restored login, valid Create/Edit, invalid postcode rejection, cross-session persistence and alumnus restrictions. This is a simulated workflow recommendation for CC review.",
  );
  assert.equal(acceptedUat.data.evidence.length, 1);
  console.log("PASS PB-QA-047: independently reviewed no-defect outcome accepted without a code change.");
  const finalGate = {
    teamId,
    index: 7,
    decision: "PASS",
    evidence: "https://example.invalid/disposable-qa/UAT-05",
  };
  await assert.rejects(call(actor(friday.userId), "gate", finalGate), { status: 403 });
  await assert.rejects(call(actor(friday.userId), "accept", { teamId, decision: "ACCEPTED" }), { status: 403 });
  await call(cc, "gate", {
    ...finalGate,
    decision: "FAIL",
    reason: "Synthetic failed release gate to verify the acceptance guard.",
  });
  assert.equal((await snap()).sprint.data.gates.find((gate) => gate.code === "AC-7").decision, "FAIL");
  console.log("PASS PB-QA-045: Friday Gamer cannot self-review, record the release gate, or grant final acceptance.");
  await assert.rejects(
    call(cc, "accept", { teamId, decision: "ACCEPTED" }),
    /All seven latest client gates/,
  );
  console.log("CHECK PB-QA-064: the simulated failed release gate persisted and acceptance was rejected.");
  console.log(
    "PASS: OP-13 accepted in disposable workflow, timed handover received, and UAT-05 completed after restored-candidate checks. No Key 4.",
  );
  return {
    sha256,
    candidateUrl: candidate.url,
    restoredIds,
    http,
    testRecord: {
      id: saved._id,
      city: saved.city,
      createdAt: saved.createdAt,
      modifiedAt: saved.modifiedAt,
    },
    handover: { id: handover._id, readyAt: handover.data.readyAt },
    simulatedSession: {
      start: sessionStart.toISOString(),
      end: sessionEnd,
      workingMinutes: 150,
    },
    cards: evidence,
    formalGateApprovals: 0,
  };
}
